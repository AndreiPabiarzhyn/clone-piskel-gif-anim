import test from "node:test";
import assert from "node:assert/strict";
import { adjustLine, adjustPixel, drawLine, fillAt, hexToRgba, mirroredBrushX, setPixel } from "../src/modules/editor-tools.js";

function image(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

test("hex colors convert to opaque RGBA", () => {
  assert.deepEqual(hexToRgba("#5ccda4"), [92, 205, 164, 255]);
});

test("brush pixels are clipped to the canvas", () => {
  const target = image(2, 2);
  setPixel(target, 1, 1, [255, 0, 0, 255], 3);
  assert.equal(target.data.filter((value, index) => index % 4 === 3 && value).length, 1);
});

test("line drawing connects distant pixels", () => {
  const target = image(4, 4);
  drawLine(target, { x: 0, y: 0 }, { x: 3, y: 3 }, [255, 255, 255, 255]);
  assert.equal(target.data.filter((value, index) => index % 4 === 3 && value).length, 4);
});

test("flood fill stays inside a boundary", () => {
  const target = image(3, 1);
  setPixel(target, 1, 0, [0, 0, 0, 255]);
  fillAt(target, 0, 0, [255, 0, 0, 255]);
  assert.deepEqual([...target.data.slice(0, 12)], [
    255, 0, 0, 255,
    0, 0, 0, 255,
    0, 0, 0, 0
  ]);
});

test("mirror brush aligns its full size across the vertical axis", () => {
  assert.equal(mirroredBrushX(8, 1, 1), 6);
  assert.equal(mirroredBrushX(8, 1, 3), 4);
});

test("light and shade preserve alpha and clamp color channels", () => {
  const target = image(2, 1);
  setPixel(target, 0, 0, [240, 10, 100, 255]);
  adjustPixel(target, 0, 0, 30);
  adjustPixel(target, 1, 0, -30);
  assert.deepEqual([...target.data], [255, 40, 130, 255, 0, 0, 0, 0]);
});

test("tone adjustment follows a continuous line", () => {
  const target = image(3, 1);
  for (let x = 0; x < 3; x += 1) setPixel(target, x, 0, [100, 100, 100, 255]);
  adjustLine(target, { x: 0, y: 0 }, { x: 2, y: 0 }, -20);
  assert.deepEqual([target.data[0], target.data[4], target.data[8]], [80, 80, 80]);
});
