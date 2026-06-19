const transparent = [0, 0, 0, 0];

function createPixels(width, height, shapes) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const { color, pixels } of shapes) {
    for (const [x, y] of pixels) {
      const index = (y * width + x) * 4;
      data.set(color, index);
    }
  }
  return data;
}

function rowsToPixels(rows, offsetX = 0, offsetY = 0) {
  const pixels = [];
  rows.forEach((row, y) => [...row].forEach((value, x) => {
    if (value !== ".") pixels.push([x + offsetX, y + offsetY]);
  }));
  return pixels;
}

const yellow = [247, 209, 84, 255];
const red = [237, 100, 115, 255];
const blue = [94, 156, 255, 255];
const white = [255, 255, 255, 255];
const dark = [53, 49, 61, 255];

const heart = createPixels(16, 16, [
  { color: red, pixels: rowsToPixels([
    ".##...##.",
    "####.####",
    "#########",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#...."
  ], 3, 4) }
]);

const robot = createPixels(16, 16, [
  { color: blue, pixels: rowsToPixels([
    "..######..",
    ".########.",
    "##########",
    "##########",
    "##########",
    ".########.",
    "..######.."
  ], 3, 4) },
  { color: white, pixels: [[6, 7], [11, 7]] },
  { color: dark, pixels: [[7, 10], [8, 11], [9, 11], [10, 10]] },
  { color: yellow, pixels: [[8, 2], [8, 3]] }
]);

function sparkFrame(offsetY) {
  return createPixels(16, 16, [
    { color: yellow, pixels: rowsToPixels([
    "..#..",
    ".###.",
    "#####",
    ".###.",
    "..#.."
    ], 5, offsetY) },
    { color: white, pixels: [[7, offsetY + 1], [8, offsetY + 1]] }
  ]);
}

const sparkFrames = [sparkFrame(8), sparkFrame(4), sparkFrame(8)];
const spark = sparkFrames[0];

export const CHALLENGES = [
  {
    id: "pixel-heart",
    level: 1,
    width: 16,
    height: 16,
    title: "Пиксельное сердце",
    subtitle: "Повтори рисунок по клеткам",
    description: "Нарисуй сердце точно как на образце. Важны форма, цвет и прозрачный фон.",
    rules: ["1 кадр", "Красное сердце", "Сходство не ниже 96%"],
    template: heart,
    minScore: 0.96,
    reward: 100,
    kind: "template"
  },
  {
    id: "tiny-robot",
    level: 2,
    width: 16,
    height: 16,
    title: "Маленький робот",
    subtitle: "Собери персонажа из нескольких цветов",
    description: "Повтори робота по образцу. Пара неточных пикселей допустима.",
    rules: ["1 кадр", "Используй 4 цвета", "Сходство не ниже 90%"],
    template: robot,
    minScore: 0.9,
    minColors: 4,
    reward: 180,
    kind: "template"
  },
  {
    id: "jumping-spark",
    level: 3,
    width: 16,
    height: 16,
    title: "Прыгающая искра",
    subtitle: "Создай короткую GIF-анимацию",
    description: "Нарисуй светящуюся искру по образцу, а затем оживи её: она должна подпрыгнуть и вернуться.",
    rules: ["Кадр 1 — искра внизу", "Кадр 2 — искра наверху", "Кадр 3 — возврат вниз"],
    template: spark,
    frameTemplates: sparkFrames,
    minScore: 0.82,
    minFrames: 3,
    reward: 300,
    kind: "animation"
  }
];

function pixelEquals(actual, target, index) {
  for (let channel = 0; channel < 4; channel += 1) {
    if (actual[index + channel] !== target[index + channel]) return false;
  }
  return true;
}

export function templateSimilarity(actual, target) {
  if (!actual || actual.length !== target.length) return 0;
  let matches = 0;
  for (let index = 0; index < target.length; index += 4) {
    if (pixelEquals(actual, target, index)) matches += 1;
  }
  return matches / (target.length / 4);
}

function foregroundSimilarity(actual, target) {
  if (!actual || actual.length !== target.length) return 0;
  let relevant = 0;
  let matches = 0;
  for (let index = 0; index < target.length; index += 4) {
    if (!actual[index + 3] && !target[index + 3]) continue;
    relevant += 1;
    if (pixelEquals(actual, target, index)) matches += 1;
  }
  return relevant ? matches / relevant : 1;
}

export function countOpaqueColors(data) {
  const colors = new Set();
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3]) colors.add(`${data[index]},${data[index + 1]},${data[index + 2]},${data[index + 3]}`);
  }
  return colors.size;
}

function frameSignature(data) {
  let hash = 2166136261;
  for (let index = 0; index < data.length; index += 1) {
    hash ^= data[index];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function opaqueCentroid(data, width) {
  let xTotal = 0;
  let yTotal = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (!data[index + 3]) continue;
    const pixel = index / 4;
    xTotal += pixel % width;
    yTotal += Math.floor(pixel / width);
    count += 1;
  }
  return count ? { x: xTotal / count, y: yTotal / count } : null;
}

export function verifyChallenge(challenge, frames) {
  const firstFrame = frames[0] || transparent;
  const similarity = templateSimilarity(firstFrame, challenge.template);
  const colors = countOpaqueColors(firstFrame);
  const uniqueFrames = new Set(frames.map(frameSignature)).size;
  const centroids = frames.map((frame) => opaqueCentroid(frame, challenge.width)).filter(Boolean);
  const movement = centroids.reduce((largest, point, index) => {
    if (!index) return largest;
    const previous = centroids[index - 1];
    return Math.max(largest, Math.hypot(point.x - previous.x, point.y - previous.y));
  }, 0);

  const checks = [
    { id: "similarity", passed: similarity >= challenge.minScore, value: Math.round(similarity * 100) }
  ];
  if (challenge.minColors) checks.push({ id: "colors", passed: colors >= challenge.minColors, value: colors });
  if (challenge.minFrames) {
    checks.push({ id: "frames", passed: frames.length >= challenge.minFrames, value: frames.length });
    checks.push({ id: "motion", passed: uniqueFrames >= 2 && movement >= 1.5, value: Math.round(movement * 10) / 10 });
    if (challenge.frameTemplates) {
      const frameScores = challenge.frameTemplates.map((template, index) => foregroundSimilarity(frames[index], template));
      checks.push({
        id: "sequence",
        passed: frameScores.every((score) => score >= challenge.minScore),
        value: Math.round((frameScores.reduce((sum, score) => sum + score, 0) / frameScores.length) * 100)
      });
    }
  }

  return {
    passed: checks.every((check) => check.passed),
    score: Math.round(similarity * 100),
    checks
  };
}

export function normalizeChallengeProgress(value) {
  if (Array.isArray(value)) {
    return {
      xp: 0,
      streak: value.length,
      completed: Object.fromEntries(value.map((id) => [id, { bestScore: 100, rewarded: true }]))
    };
  }
  return {
    xp: Math.max(0, Number(value?.xp) || 0),
    streak: Math.max(0, Number(value?.streak) || 0),
    completed: value?.completed && typeof value.completed === "object" ? value.completed : {}
  };
}

export function levelFromXp(xp) {
  const safeXp = Math.max(0, Number(xp) || 0);
  const level = Math.floor(safeXp / 250) + 1;
  const current = safeXp % 250;
  return { level, current, target: 250, progress: current / 250 };
}

export function awardChallenge(progressValue, challenge, score) {
  const progress = normalizeChallengeProgress(progressValue);
  const previous = progress.completed[challenge.id];
  const firstCompletion = !previous?.rewarded;
  const earnedXp = firstCompletion ? challenge.reward : 0;
  return {
    progress: {
      xp: progress.xp + earnedXp,
      streak: firstCompletion ? progress.streak + 1 : progress.streak,
      completed: {
        ...progress.completed,
        [challenge.id]: {
          rewarded: true,
          bestScore: Math.max(previous?.bestScore || 0, score),
          completedAt: previous?.completedAt || Date.now()
        }
      }
    },
    earnedXp,
    firstCompletion
  };
}
