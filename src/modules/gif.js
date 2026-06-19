const DEFAULT_PALETTE = [
  [0, 0, 0], [255, 255, 255], [247, 209, 84], [237, 100, 115],
  [92, 205, 164], [94, 156, 255], [175, 112, 226], [255, 145, 74],
  [54, 50, 61], [124, 117, 132], [35, 30, 42], [213, 205, 219],
  [70, 114, 84], [63, 81, 126], [116, 72, 126], [140, 83, 55]
];

function nearestColor(r, g, b, palette) {
  let best = 1;
  let distance = Infinity;
  for (let i = 1; i < palette.length; i += 1) {
    const color = palette[i];
    const next = (r - color[0]) ** 2 + (g - color[1]) ** 2 + (b - color[2]) ** 2;
    if (next < distance) {
      distance = next;
      best = i;
    }
  }
  return best;
}

function lzwEncode(indices, minCodeSize = 4) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  const dictionary = new Map();
  const bytes = [];
  let currentByte = 0;
  let bitCount = 0;

  const writeCode = (code) => {
    currentByte |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      bytes.push(currentByte & 0xff);
      currentByte >>= 8;
      bitCount -= 8;
    }
  };

  writeCode(clearCode);
  let prefix = String(indices[0] ?? 0);

  for (let i = 1; i < indices.length; i += 1) {
    const symbol = indices[i];
    const key = `${prefix},${symbol}`;
    if (dictionary.has(key)) {
      prefix = key;
      continue;
    }

    const prefixCode = prefix.includes(",") ? dictionary.get(prefix) : Number(prefix);
    writeCode(prefixCode);

    if (nextCode < 4096) {
      dictionary.set(key, nextCode);
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
    } else {
      writeCode(clearCode);
      dictionary.clear();
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
    }
    prefix = String(symbol);
  }

  writeCode(prefix.includes(",") ? dictionary.get(prefix) : Number(prefix));
  writeCode(endCode);
  if (bitCount > 0) bytes.push(currentByte & 0xff);
  return bytes;
}

export function gifDelay(fps) {
  return Math.max(2, Math.round(100 / Math.max(1, fps)));
}

export function encodeGif(frames, width, height, fps, palette = DEFAULT_PALETTE) {
  const bytes = [];
  const push = (...values) => bytes.push(...values);
  const word = (value) => push(value & 0xff, (value >> 8) & 0xff);
  const text = (value) => push(...Array.from(value, (character) => character.charCodeAt(0)));

  text("GIF89a");
  word(width);
  word(height);
  push(0xf3, 0x00, 0x00);
  for (const color of palette) push(...color);
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
    word(0); word(0); word(width); word(height);
    push(0x00, 0x04);

    const indices = [];
    for (let i = 0; i < frame.data.length; i += 4) {
      indices.push(frame.data[i + 3] < 20 ? 0 : nearestColor(frame.data[i], frame.data[i + 1], frame.data[i + 2], palette));
    }
    const compressed = lzwEncode(indices);
    for (let offset = 0; offset < compressed.length; offset += 255) {
      const block = compressed.slice(offset, offset + 255);
      push(block.length, ...block);
    }
    push(0);
  }

  push(0x3b);
  return new Uint8Array(bytes);
}
