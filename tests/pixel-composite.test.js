import test from "node:test";
import assert from "node:assert/strict";
import { blendPixels, compositeLayers } from "../src/modules/pixel-composite.js";

test("opaque pixels replace pixels below them", () => {
  const target = new Uint8ClampedArray([255, 0, 0, 255]);
  blendPixels(target, new Uint8ClampedArray([0, 0, 255, 255]));
  assert.deepEqual([...target], [0, 0, 255, 255]);
});

test("semi-transparent pixels are alpha-composited", () => {
  const target = new Uint8ClampedArray([0, 0, 0, 0]);
  blendPixels(target, new Uint8ClampedArray([100, 150, 200, 128]));
  assert.deepEqual([...target], [100, 150, 200, 128]);
});

test("hidden layers are ignored during compositing", () => {
  const layers = [
    { visible: true, frames: [new Uint8ClampedArray([20, 30, 40, 255])] },
    { visible: false, frames: [new Uint8ClampedArray([200, 0, 0, 255])] }
  ];
  assert.deepEqual([...compositeLayers(layers, 0, 4)], [20, 30, 40, 255]);
});
