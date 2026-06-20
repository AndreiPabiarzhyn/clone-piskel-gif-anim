import test from "node:test";
import assert from "node:assert/strict";
import { frameInsertionIndex, scalePixelImage } from "../src/modules/selection-utils.js";

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

