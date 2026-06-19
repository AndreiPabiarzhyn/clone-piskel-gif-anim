function colorKey(r, g, b) {
  return (r << 16) | (g << 8) | b;
}

function buildPalette(frames) {
  const frequencies = new Map();
  for (const frame of frames) {
    for (let index = 0; index < frame.data.length; index += 4) {
      if (frame.data[index + 3] < 20) continue;
      const key = colorKey(frame.data[index], frame.data[index + 1], frame.data[index + 2]);
      frequencies.set(key, (frequencies.get(key) || 0) + 1);
    }
  }

  const colors = [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 255)
    .map(([key]) => [(key >> 16) & 255, (key >> 8) & 255, key & 255]);
  return [[0, 0, 0], ...colors];
}

function nearestColor(r, g, b, palette) {
  let best = palette.length > 1 ? 1 : 0;
  let distance = Infinity;
  for (let index = 1; index < palette.length; index += 1) {
    const color = palette[index];
    const next = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
    if (next < distance) {
      distance = next;
      best = index;
    }
  }
  return best;
}

function tableSizeFor(colorCount) {
  let size = 2;
  while (size < colorCount && size < 256) size *= 2;
  return size;
}

// A deliberately simple and robust GIF LZW stream. Literal codes are emitted
// in short groups separated by clear codes, before the decoder needs to grow
// its code width. Files are slightly larger, but remain small for pixel art.
function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const codeSize = minCodeSize + 1;
  const maxGroupLength = clearCode - 2;
  const bytes = [];
  let currentByte = 0;
  let bitCount = 0;

  const writeCode = (code) => {
    currentByte |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(currentByte & 0xff);
      currentByte >>>= 8;
      bitCount -= 8;
    }
  };

  for (let offset = 0; offset < indices.length; offset += maxGroupLength) {
    writeCode(clearCode);
    const end = Math.min(indices.length, offset + maxGroupLength);
    for (let index = offset; index < end; index += 1) writeCode(indices[index]);
  }
  writeCode(endCode);
  if (bitCount > 0) bytes.push(currentByte & 0xff);
  return bytes;
}

export function gifDelay(fps) {
  return Math.max(2, Math.round(100 / Math.max(1, fps)));
}

export function scaleFrame(frame, width, height, scale) {
  const factor = Math.max(1, Math.floor(scale));
  if (factor === 1) return frame;
  const scaledWidth = width * factor;
  const scaledHeight = height * factor;
  const data = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;
      for (let yy = 0; yy < factor; yy += 1) {
        for (let xx = 0; xx < factor; xx += 1) {
          const targetIndex = ((y * factor + yy) * scaledWidth + x * factor + xx) * 4;
          data.set(frame.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
        }
      }
    }
  }
  return { data, width: scaledWidth, height: scaledHeight };
}

export function encodeGif(frames, width, height, fps, requestedPalette) {
  if (!frames.length) throw new Error("GIF requires at least one frame");
  const palette = requestedPalette?.length ? requestedPalette.slice(0, 256) : buildPalette(frames);
  const tableSize = tableSizeFor(palette.length);
  const paddedPalette = [...palette];
  while (paddedPalette.length < tableSize) paddedPalette.push([0, 0, 0]);
  const sizeCode = Math.max(0, Math.log2(tableSize) - 1);
  const minCodeSize = Math.max(2, Math.log2(tableSize));

  const bytes = [];
  const push = (...values) => bytes.push(...values);
  const word = (value) => push(value & 0xff, (value >> 8) & 0xff);
  const text = (value) => push(...Array.from(value, (character) => character.charCodeAt(0)));

  text("GIF89a");
  word(width);
  word(height);
  push(0x80 | 0x70 | sizeCode, 0x00, 0x00);
  for (const color of paddedPalette) push(...color);
  text("!\xFF\x0BNETSCAPE2.0");
  push(3, 1);
  word(0);
  push(0);

  for (const frame of frames) {
    text("!\xF9\x04");
    push(0x09);
    word(gifDelay(fps));
    push(0x00, 0x00);
    text(",");
    word(0);
    word(0);
    word(width);
    word(height);
    push(0x00, minCodeSize);

    const indices = new Uint8Array(width * height);
    for (let pixel = 0, index = 0; pixel < indices.length; pixel += 1, index += 4) {
      indices[pixel] = frame.data[index + 3] < 20
        ? 0
        : nearestColor(frame.data[index], frame.data[index + 1], frame.data[index + 2], palette);
    }
    const compressed = lzwEncode(indices, minCodeSize);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.slice(offset, offset + 255);
      push(block.length, ...block);
    }
    push(0);
  }

  push(0x3b);
  return new Uint8Array(bytes);
}
