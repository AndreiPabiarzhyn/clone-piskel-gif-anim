import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeProjectBinary,
  encodeProjectBinary,
  parseProject,
  parseProjectFile,
  stringifyProject
} from "../src/modules/project-format.js";

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

test("pxm binary project round-trips with its signature and checksum", async () => {
  const project = sampleProject();
  const bytes = await encodeProjectBinary(project);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "PXM1");
  assert.deepEqual(await decodeProjectBinary(bytes), project);
});

test("pxm rejects a project with corrupted payload bytes", async () => {
  const bytes = await encodeProjectBinary(sampleProject());
  bytes[bytes.length - 1] ^= 0xff;
  await assert.rejects(() => decodeProjectBinary(bytes), /checksum/);
});

test("pxm rejects truncated project files", async () => {
  const bytes = await encodeProjectBinary(sampleProject());
  await assert.rejects(() => decodeProjectBinary(bytes.slice(0, -5)), /length/);
});

test("project file import recognizes pxm by signature", async () => {
  const project = sampleProject();
  const bytes = await encodeProjectBinary(project);
  const file = { name: "renamed.data", arrayBuffer: async () => bytes.buffer };
  assert.deepEqual(await parseProjectFile(file), project);
});

test("project file import remains compatible with legacy json projects", async () => {
  const project = sampleProject();
  const bytes = new TextEncoder().encode(stringifyProject(project));
  const file = { name: "legacy.pixelmotion", arrayBuffer: async () => bytes.buffer };
  assert.deepEqual(await parseProjectFile(file), project);
});

test("pxm supports a maximum-size canvas project", async () => {
  const project = sampleProject();
  project.width = 128;
  project.height = 128;
  project.layers[0].frames = [Array(128 * 128 * 4).fill(0)];
  const bytes = await encodeProjectBinary(project);
  const restored = await decodeProjectBinary(bytes);
  assert.equal(restored.width, 128);
  assert.equal(restored.layers[0].frames[0].length, 65536);
});

test("pxm rejects an invalid signature", async () => {
  const bytes = await encodeProjectBinary(sampleProject());
  bytes[0] = 0;
  await assert.rejects(() => decodeProjectBinary(bytes), /Unsupported PXM/);
});
