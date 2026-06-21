import test from "node:test";
import assert from "node:assert/strict";
import { awardChallenge, awardDailyCompletion, challengeCopy, challengeDayKey, CHALLENGES, countOpaqueColors, dailyChallengeForDate, levelFromXp, normalizeChallengeProgress, templateSimilarity, verifyChallenge } from "../src/modules/challenges.js";

test("template challenge accepts an exact drawing", () => {
  const challenge = CHALLENGES[0];
  const result = verifyChallenge(challenge, [challenge.template]);
  assert.equal(result.passed, true);
  assert.equal(result.score, 100);
});

test("template similarity penalizes missing pixels", () => {
  const challenge = CHALLENGES[0];
  const empty = new Uint8ClampedArray(challenge.template.length);
  assert.ok(templateSimilarity(empty, challenge.template) < challenge.minScore);
});

test("robot template contains the required color count", () => {
  const challenge = CHALLENGES[1];
  assert.ok(countOpaqueColors(challenge.template) >= challenge.minColors);
  assert.equal(verifyChallenge(challenge, [challenge.template]).passed, true);
});

test("animation challenge requires distinct moving frames", () => {
  const challenge = CHALLENGES[2];
  const result = verifyChallenge(challenge, challenge.frameTemplates);
  assert.equal(result.passed, true);
});

test("animation challenge rejects duplicate frames", () => {
  const challenge = CHALLENGES[2];
  const result = verifyChallenge(challenge, [challenge.template, challenge.template, challenge.template]);
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.id === "motion").passed, false);
});

test("animation challenge rejects frames in the wrong order", () => {
  const challenge = CHALLENGES[2];
  const result = verifyChallenge(challenge, [challenge.frameTemplates[1], challenge.frameTemplates[0], challenge.frameTemplates[2]]);
  assert.equal(result.passed, false);
  assert.equal(result.checks.find((check) => check.id === "sequence").passed, false);
});

test("every bundled challenge accepts its exact reference", () => {
  for (const challenge of CHALLENGES) {
    const frames = challenge.frameTemplates || [challenge.template];
    assert.equal(verifyChallenge(challenge, frames).passed, true, challenge.id);
  }
});

test("challenge library now contains a six-step course", () => {
  assert.equal(CHALLENGES.length, 6);
  assert.deepEqual(CHALLENGES.map((challenge) => challenge.level), [1, 2, 3, 4, 5, 6]);
});

test("challenge reward is granted only on first completion", () => {
  const challenge = CHALLENGES[0];
  const first = awardChallenge({}, challenge, 97);
  const replay = awardChallenge(first.progress, challenge, 100);
  assert.equal(first.earnedXp, challenge.reward);
  assert.equal(first.progress.streak, 1);
  assert.equal(replay.earnedXp, 0);
  assert.equal(replay.progress.xp, challenge.reward);
  assert.equal(replay.progress.completed[challenge.id].bestScore, 100);
});

test("artist level advances every 250 XP", () => {
  assert.deepEqual(levelFromXp(0), { level: 1, current: 0, target: 250, progress: 0 });
  assert.equal(levelFromXp(250).level, 2);
  assert.equal(levelFromXp(620).current, 120);
});

test("legacy completed challenge arrays are migrated", () => {
  const progress = normalizeChallengeProgress(["pixel-heart"]);
  assert.equal(progress.completed["pixel-heart"].rewarded, true);
  assert.equal(progress.streak, 1);
  assert.deepEqual(progress.daily, { lastCompleted: "", streak: 0, completed: {} });
});

test("daily challenge rotates predictably by local calendar day", () => {
  const first = dailyChallengeForDate(new Date(2026, 0, 1));
  const second = dailyChallengeForDate(new Date(2026, 0, 2));
  assert.equal(first, CHALLENGES[0]);
  assert.equal(second, CHALLENGES[1]);
  assert.equal(challengeDayKey(new Date(2026, 5, 21)), "2026-06-21");
});

test("daily reward is granted once and consecutive days build a streak", () => {
  const first = awardDailyCompletion({}, "2026-06-20", 50);
  const duplicate = awardDailyCompletion(first.progress, "2026-06-20", 50);
  const next = awardDailyCompletion(first.progress, "2026-06-21", 50);
  assert.equal(first.earnedXp, 50);
  assert.equal(duplicate.earnedXp, 0);
  assert.equal(next.progress.daily.streak, 2);
  assert.equal(next.progress.xp, 100);
});

test("every challenge has complete copy in every supported language", () => {
  const languages = ["ru", "en", "pl", "es", "tr", "pt", "id"];
  for (const challenge of CHALLENGES) {
    for (const language of languages) {
      const copy = challengeCopy(challenge, language);
      assert.ok(copy.title);
      assert.ok(copy.subtitle);
      assert.ok(copy.description);
      assert.equal(copy.rules.length, challenge.rules.length);
      assert.ok(copy.rules.every(Boolean));
    }
  }
});
