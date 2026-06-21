import test from "node:test";
import assert from "node:assert/strict";
import { loadProjects, readStoredJson, removeProjects, saveRecentProject, STORAGE_KEYS } from "../src/modules/project-store.js";

function withStorage(run) {
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
  try {
    return run(values);
  } finally {
    globalThis.localStorage = previous;
  }
}

test("malformed stored JSON falls back safely", () => withStorage((values) => {
  values.set("broken", "{");
  assert.deepEqual(readStoredJson("broken", []), []);
}));

test("recent project save replaces the same project id", () => withStorage(() => {
  saveRecentProject({ id: "one", name: "First" });
  saveRecentProject({ id: "one", name: "Updated" });
  assert.deepEqual(loadProjects(), [{ id: "one", name: "Updated" }]);
}));

test("project removal also removes matching backups", () => withStorage((values) => {
  values.set(STORAGE_KEYS.projects, JSON.stringify([{ id: "one" }, { id: "two" }]));
  values.set(STORAGE_KEYS.backups, JSON.stringify([{ projectId: "one" }, { projectId: "two" }]));
  const result = removeProjects(["one"]);
  assert.deepEqual(result.projects, [{ id: "two" }]);
  assert.deepEqual(result.backups, [{ projectId: "two" }]);
}));
