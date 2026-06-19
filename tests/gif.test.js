import test from "node:test";
import assert from "node:assert/strict";
import { encodeGif, gifDelay } from "../src/modules/gif.js";

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
