import test from "node:test";
import assert from "node:assert/strict";
import { extractPalette, normalizePalette } from "../src/modules/palette-utils.js";

test("palette extraction ignores transparent pixels and keeps dominant colors", () => {
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255,
    250, 5, 5, 255,
    0, 0, 255, 255,
    0, 255, 0, 0
  ]);
  const palette = extractPalette(pixels, 4);
  assert.equal(palette.length, 2);
  assert.ok(palette.includes("#ff0000"));
  assert.ok(palette.includes("#0000ff"));
});

test("palette normalization removes invalid and duplicate colors", () => {
  assert.deepEqual(normalizePalette(["#FFFFFF", "#ffffff", "red", "#000000"]), ["#ffffff", "#000000"]);
});

