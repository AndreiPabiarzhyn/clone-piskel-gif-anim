import test from "node:test";
import assert from "node:assert/strict";
import { challengeUi, TRANSLATIONS } from "../src/modules/i18n.js";

const languages = ["ru", "en", "pl", "es", "tr", "pt", "id", "it"];
const coreKeys = [
  "pencil",
  "eraser",
  "fill",
  "mirror",
  "shade",
  "brush3",
  "layerNamePrompt",
  "selection",
  "frames",
  "layers",
  "download",
  "myProjects",
  "challenges",
  "newLayer"
];

test("every supported language contains core editor copy", () => {
  for (const language of languages) {
    assert.ok(TRANSLATIONS[language], language);
    for (const key of coreKeys) assert.ok(TRANSLATIONS[language][key], `${language}.${key}`);
  }
});

test("challenge UI falls back to English for unknown languages", () => {
  assert.equal(challengeUi("unknown", "level"), challengeUi("en", "level"));
  assert.equal(challengeUi("en", "missing-key"), "missing-key");
});
