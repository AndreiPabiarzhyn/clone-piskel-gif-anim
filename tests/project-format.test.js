import test from "node:test";
import assert from "node:assert/strict";
import { parseProject, stringifyProject } from "../src/modules/project-format.js";

function sampleProject() {
  return {
    id: "example",
    name: "Test",
    width: 2,
    height: 2,
    fps: 8,
    updatedAt: 1,
    layers: [{ name: "Layer 1", visible: true, frames: [Array(16).fill(0)] }]
  };
}

test("pixelmotion project round-trips through the versioned format", () => {
  const project = sampleProject();
  assert.deepEqual(parseProject(stringifyProject(project)), project);
});

test("pixelmotion rejects mismatched layer frame counts", () => {
  const project = sampleProject();
  project.layers.push({ name: "Layer 2", visible: true, frames: [] });
  assert.throws(() => stringifyProject(project), /same number of frames/);
});

test("pixelmotion rejects malformed pixel data", () => {
  const project = sampleProject();
  project.layers[0].frames[0] = [1, 2, 3];
  assert.throws(() => stringifyProject(project), /pixel data/);
});
