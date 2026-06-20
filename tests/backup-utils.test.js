import test from "node:test";
import assert from "node:assert/strict";
import { addBackup, backupsForProject, projectFingerprint } from "../src/modules/backup-utils.js";

function project(id = "project-a", pixel = 0) {
  const frame = Array(16).fill(0);
  frame[0] = pixel;
  return { id, name: "Test", width: 2, height: 2, fps: 8, layers: [{ visible: true, frames: [frame] }] };
}

test("backup fingerprint changes when pixels change", () => {
  assert.notEqual(projectFingerprint(project("a", 0)), projectFingerprint(project("a", 255)));
});

test("identical consecutive backups are not duplicated", () => {
  const first = addBackup([], project(), 1);
  const second = addBackup(first, project(), 2);
  assert.equal(second.length, 1);
});

test("backup history is limited independently per project", () => {
  let backups = [];
  for (let index = 0; index < 12; index += 1) backups = addBackup(backups, project("a", index), index, 4);
  backups = addBackup(backups, project("b", 99), 20, 4);
  assert.equal(backupsForProject(backups, "a").length, 4);
  assert.equal(backupsForProject(backups, "b").length, 1);
});

