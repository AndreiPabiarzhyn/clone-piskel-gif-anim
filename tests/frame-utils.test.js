import test from "node:test";
import assert from "node:assert/strict";
import { reorderFrameCollections } from "../src/modules/frame-utils.js";

test("frame reorder keeps every layer synchronized", () => {
  const layers = [
    ["a1", "a2", "a3"],
    ["b1", "b2", "b3"]
  ];
  const active = reorderFrameCollections(layers, 0, 3);
  assert.equal(active, 2);
  assert.deepEqual(layers, [
    ["a2", "a3", "a1"],
    ["b2", "b3", "b1"]
  ]);
});

test("dropping a frame onto its current position is a no-op", () => {
  const layers = [["a1", "a2"]];
  assert.equal(reorderFrameCollections(layers, 1, 1), 1);
  assert.deepEqual(layers, [["a1", "a2"]]);
});
