import test from "node:test";
import assert from "node:assert/strict";
import { frameInsertionIndex, rotatePixelImage, scalePixelImage, transformPixelImage } from "../src/modules/selection-utils.js";

test("pixel selection scaling uses nearest-neighbor pixels", () => {
  const source = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
  };
  const scaled = scalePixelImage(source, 4, 2);
  assert.deepEqual([...scaled.data.slice(0, 16)], [
    255, 0, 0, 255, 255, 0, 0, 255,
    0, 0, 255, 255, 0, 0, 255, 255
  ]);
});

test("frame insertion supports before and after placement", () => {
  assert.equal(frameInsertionIndex(2, 5, "before"), 2);
  assert.equal(frameInsertionIndex(2, 5, "after"), 3);
  assert.equal(frameInsertionIndex(4, 5, "after"), 5);
});

test("selection rotation preserves pixels and swaps dimensions", () => {
  const source = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
  };
  const rotated = transformPixelImage(source, "rotate");
  assert.equal(rotated.width, 1);
  assert.equal(rotated.height, 2);
  assert.deepEqual([...rotated.data], [...source.data]);
});

test("selection reflection is pixel perfect", () => {
  const source = {
    width: 2,
    height: 1,
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
  };
  assert.deepEqual(
    [...transformPixelImage(source, "flipX").data],
    [0, 0, 255, 255, 255, 0, 0, 255]
  );
});

test("arbitrary selection rotation keeps nearest-neighbor pixels", () => {
  const source = {
    width: 3,
    height: 1,
    data: new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255
    ])
  };
  const rotated = rotatePixelImage(source, 90);
  assert.equal(rotated.width, 1);
  assert.equal(rotated.height, 3);
  const opaque = [...rotated.data].filter((value, index) => index % 4 === 3 && value > 0).length;
  assert.equal(opaque, 3);
});

test("zero-degree rotation preserves image data", () => {
  const source = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray(16).fill(127)
  };
  const rotated = rotatePixelImage(source, 0);
  assert.equal(rotated.width, 2);
  assert.equal(rotated.height, 2);
  assert.deepEqual([...rotated.data], [...source.data]);
});
