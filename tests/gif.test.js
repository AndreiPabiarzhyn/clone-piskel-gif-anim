import test from "node:test";
import assert from "node:assert/strict";
import { encodeGif, gifDelay, scaleFrame } from "../src/modules/gif.js";

function decodeGifFrames(bytes) {
  let offset = 6;
  const readWord = () => {
    const value = bytes[offset] | (bytes[offset + 1] << 8);
    offset += 2;
    return value;
  };
  const width = readWord();
  const height = readWord();
  const packed = bytes[offset++];
  offset += 2;
  const paletteSize = 1 << ((packed & 0x07) + 1);
  const palette = [];
  for (let index = 0; index < paletteSize; index += 1) {
    palette.push([bytes[offset++], bytes[offset++], bytes[offset++]]);
  }

  const frames = [];
  while (offset < bytes.length && bytes[offset] !== 0x3b) {
    if (bytes[offset] === 0x21) {
      offset += 2;
      while (bytes[offset]) offset += bytes[offset] + 1;
      offset += 1;
      continue;
    }
    assert.equal(bytes[offset++], 0x2c);
    offset += 8;
    const imagePacked = bytes[offset++];
    assert.equal(imagePacked & 0x80, 0);
    const minCodeSize = bytes[offset++];
    const compressed = [];
    while (bytes[offset]) {
      const size = bytes[offset++];
      compressed.push(...bytes.slice(offset, offset + size));
      offset += size;
    }
    offset += 1;

    let byteOffset = 0;
    let bitOffset = 0;
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let dictionary;
    let nextCode;
    let previous = null;
    const pixels = [];

    const reset = () => {
      dictionary = Array.from({ length: clearCode }, (_, value) => [value]);
      dictionary[clearCode] = null;
      dictionary[endCode] = null;
      nextCode = endCode + 1;
      codeSize = minCodeSize + 1;
      previous = null;
    };
    const readCode = () => {
      let value = 0;
      for (let bit = 0; bit < codeSize; bit += 1) {
        value |= ((compressed[byteOffset] >> bitOffset) & 1) << bit;
        bitOffset += 1;
        if (bitOffset === 8) {
          bitOffset = 0;
          byteOffset += 1;
        }
      }
      return value;
    };

    reset();
    while (byteOffset < compressed.length) {
      const code = readCode();
      if (code === clearCode) {
        reset();
        continue;
      }
      if (code === endCode) break;
      const entry = dictionary[code] || (code === nextCode && previous ? [...previous, previous[0]] : null);
      assert.ok(entry, `Invalid LZW code ${code}`);
      pixels.push(...entry);
      if (previous) {
        dictionary[nextCode++] = [...previous, entry[0]];
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
      }
      previous = entry;
    }
    assert.equal(pixels.length, width * height);
    frames.push(pixels.map((index) => palette[index]));
  }
  return { width, height, frames };
}

test("gif delay is calculated from fps", () => {
  assert.equal(gifDelay(10), 10);
  assert.equal(gifDelay(24), 4);
  assert.equal(gifDelay(100), 2);
});

test("encoder creates a complete animated GIF89a", () => {
  const frame = { data: new Uint8ClampedArray(4 * 4 * 4) };
  frame.data.set([247, 209, 84, 255], 0);
  const gif = encodeGif([frame, frame], 4, 4, 8);
  assert.equal(new TextDecoder().decode(gif.slice(0, 6)), "GIF89a");
  assert.equal(gif.at(-1), 0x3b);
  assert.ok(gif.length > 100);
  assert.ok(new TextDecoder().decode(gif).includes("NETSCAPE2.0"));
});

test("encoder writes custom canvas dimensions", () => {
  const width = 16;
  const height = 24;
  const frame = { data: new Uint8ClampedArray(width * height * 4) };
  const gif = encodeGif([frame], width, height, 12);
  assert.equal(gif[6] | (gif[7] << 8), width);
  assert.equal(gif[8] | (gif[9] << 8), height);
});

test("encoder produces a fully decodable complex frame", () => {
  const width = 32;
  const height = 32;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      data.set([x * 8, y * 8, (x + y) * 4, 255], (y * width + x) * 4);
    }
  }
  const decoded = decodeGifFrames(encodeGif([{ data }], width, height, 8));
  assert.equal(decoded.frames.length, 1);
  assert.equal(decoded.frames[0].length, width * height);
});

test("encoder preserves project colors exactly when palette fits", () => {
  const data = new Uint8ClampedArray([
    12, 34, 56, 255,
    210, 111, 9, 255
  ]);
  const decoded = decodeGifFrames(encodeGif([{ data }], 2, 1, 8));
  assert.deepEqual(decoded.frames[0], [[12, 34, 56], [210, 111, 9]]);
});

test("encoder preserves distinct animated frames", () => {
  const first = new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 0, 0, 0
  ]);
  const second = new Uint8ClampedArray([
    0, 0, 0, 0,
    0, 0, 255, 255
  ]);
  const decoded = decodeGifFrames(encodeGif([{ data: first }, { data: second }], 2, 1, 6));
  assert.equal(decoded.frames.length, 2);
  assert.deepEqual(decoded.frames[0], [[255, 0, 0], [0, 0, 0]]);
  assert.deepEqual(decoded.frames[1], [[0, 0, 0], [0, 0, 255]]);
});

test("pixel-perfect frame scaling duplicates source pixels", () => {
  const frame = {
    data: new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 255, 255
    ])
  };
  const scaled = scaleFrame(frame, 2, 1, 2);
  assert.equal(scaled.width, 4);
  assert.equal(scaled.height, 2);
  assert.deepEqual([...scaled.data], [
    255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 255
  ]);
});
