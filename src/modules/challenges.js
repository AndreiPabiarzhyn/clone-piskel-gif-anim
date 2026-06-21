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
const green = [92, 205, 164, 255];
const orange = [255, 145, 74, 255];
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

const happySlime = createPixels(16, 16, [
  { color: green, pixels: rowsToPixels([
    "...####...",
    "..######..",
    ".########.",
    "##########",
    "##########",
    "##########",
    ".########.",
    "..######.."
  ], 3, 5) },
  { color: dark, pixels: [[6, 8], [11, 8], [7, 11], [8, 12], [9, 12], [10, 11]] },
  { color: white, pixels: [[6, 7], [11, 7]] }
]);

const rocket = createPixels(16, 16, [
  { color: white, pixels: rowsToPixels([
    "...##...",
    "..####..",
    ".######.",
    ".######.",
    ".######.",
    "..####..",
    "..####.."
  ], 4, 2) },
  { color: blue, pixels: rowsToPixels([".####.", "######", "######"], 5, 6) },
  { color: dark, pixels: rowsToPixels(["##....##", "##....##"], 3, 9) },
  { color: orange, pixels: rowsToPixels([".##.", "####", ".##.", "..#."], 6, 11) },
  { color: yellow, pixels: [[7, 6], [8, 6], [7, 7], [8, 7]] }
]);

function blinkFrame(closed = false) {
  return createPixels(16, 16, [
    { color: yellow, pixels: rowsToPixels([
      "...####...",
      "..######..",
      ".########.",
      "##########",
      "##########",
      "##########",
      ".########.",
      "..######.."
    ], 3, 4) },
    {
      color: dark,
      pixels: closed
        ? [[6, 8], [7, 8], [10, 8], [11, 8], [7, 11], [8, 12], [9, 12], [10, 11]]
        : [[6, 7], [7, 7], [10, 7], [11, 7], [7, 11], [8, 12], [9, 12], [10, 11]]
    },
    { color: white, pixels: closed ? [] : [[6, 6], [10, 6]] }
  ]);
}

const blinkFrames = [blinkFrame(false), blinkFrame(true), blinkFrame(false)];

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
    i18n: {
      en: { title: "Pixel Heart", subtitle: "Copy the picture cell by cell", description: "Draw the heart exactly like the reference. Shape, color, and the transparent background all matter.", rules: ["1 frame", "Red heart", "At least 96% similarity"] },
      pl: { title: "Pikselowe serce", subtitle: "Odtwórz obrazek kratka po kratce", description: "Narysuj serce dokładnie jak na wzorze. Liczą się kształt, kolor i przezroczyste tło.", rules: ["1 klatka", "Czerwone serce", "Co najmniej 96% podobieństwa"] },
      es: { title: "Corazón pixelado", subtitle: "Copia el dibujo celda por celda", description: "Dibuja el corazón exactamente como en el modelo. Importan la forma, el color y el fondo transparente.", rules: ["1 fotograma", "Corazón rojo", "Al menos 96% de similitud"] },
      tr: { title: "Piksel Kalp", subtitle: "Resmi kare kare kopyala", description: "Kalbi örnekteki gibi çiz. Şekil, renk ve şeffaf arka plan önemlidir.", rules: ["1 kare", "Kırmızı kalp", "En az %96 benzerlik"] },
      pt: { title: "Coração em pixels", subtitle: "Copie o desenho célula por célula", description: "Desenhe o coração exatamente como no modelo. Forma, cor e fundo transparente são importantes.", rules: ["1 quadro", "Coração vermelho", "Pelo menos 96% de semelhança"] },
      id: { title: "Hati Piksel", subtitle: "Salin gambar kotak demi kotak", description: "Gambar hati persis seperti contoh. Bentuk, warna, dan latar transparan semuanya penting.", rules: ["1 frame", "Hati merah", "Kemiripan minimal 96%"] }
    },
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
    i18n: {
      en: { title: "Tiny Robot", subtitle: "Build a character with several colors", description: "Copy the robot from the reference. A couple of inaccurate pixels are allowed.", rules: ["1 frame", "Use 4 colors", "At least 90% similarity"] },
      pl: { title: "Mały robot", subtitle: "Zbuduj postać z kilku kolorów", description: "Odtwórz robota według wzoru. Kilka niedokładnych pikseli jest dozwolonych.", rules: ["1 klatka", "Użyj 4 kolorów", "Co najmniej 90% podobieństwa"] },
      es: { title: "Robot pequeño", subtitle: "Crea un personaje con varios colores", description: "Copia el robot del modelo. Se permiten un par de píxeles imprecisos.", rules: ["1 fotograma", "Usa 4 colores", "Al menos 90% de similitud"] },
      tr: { title: "Küçük Robot", subtitle: "Birkaç renkle bir karakter oluştur", description: "Robotu örneğe göre kopyala. Birkaç hatalı piksele izin verilir.", rules: ["1 kare", "4 renk kullan", "En az %90 benzerlik"] },
      pt: { title: "Robô pequeno", subtitle: "Monte um personagem com várias cores", description: "Copie o robô do modelo. Alguns pixels imprecisos são permitidos.", rules: ["1 quadro", "Use 4 cores", "Pelo menos 90% de semelhança"] },
      id: { title: "Robot Kecil", subtitle: "Buat karakter dengan beberapa warna", description: "Salin robot dari contoh. Beberapa piksel yang kurang tepat masih diperbolehkan.", rules: ["1 frame", "Gunakan 4 warna", "Kemiripan minimal 90%"] }
    },
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
    i18n: {
      en: { title: "Jumping Spark", subtitle: "Create a short GIF animation", description: "Draw the glowing spark from the reference, then animate it jumping up and returning.", rules: ["Frame 1 — spark at the bottom", "Frame 2 — spark at the top", "Frame 3 — return to the bottom"] },
      pl: { title: "Skacząca iskra", subtitle: "Utwórz krótką animację GIF", description: "Narysuj świecącą iskrę według wzoru, a potem ożyw ją: ma podskoczyć i wrócić.", rules: ["Klatka 1 — iskra na dole", "Klatka 2 — iskra na górze", "Klatka 3 — powrót na dół"] },
      es: { title: "Chispa saltarina", subtitle: "Crea una animación GIF corta", description: "Dibuja la chispa luminosa del modelo y anímala para que salte y vuelva.", rules: ["Fotograma 1 — chispa abajo", "Fotograma 2 — chispa arriba", "Fotograma 3 — vuelve abajo"] },
      tr: { title: "Zıplayan Kıvılcım", subtitle: "Kısa bir GIF animasyonu oluştur", description: "Örnekteki parlak kıvılcımı çiz, sonra yukarı zıplayıp geri dönecek şekilde canlandır.", rules: ["Kare 1 — kıvılcım aşağıda", "Kare 2 — kıvılcım yukarıda", "Kare 3 — tekrar aşağıda"] },
      pt: { title: "Faísca saltitante", subtitle: "Crie uma animação GIF curta", description: "Desenhe a faísca brilhante do modelo e anime-a para saltar e voltar.", rules: ["Quadro 1 — faísca embaixo", "Quadro 2 — faísca em cima", "Quadro 3 — volta para baixo"] },
      id: { title: "Percikan Melompat", subtitle: "Buat animasi GIF pendek", description: "Gambar percikan bercahaya dari contoh, lalu animasikan agar melompat dan kembali.", rules: ["Frame 1 — percikan di bawah", "Frame 2 — percikan di atas", "Frame 3 — kembali ke bawah"] }
    },
    kind: "animation"
  },
  {
    id: "happy-slime",
    level: 4,
    width: 16,
    height: 16,
    title: "Весёлый слайм",
    subtitle: "Нарисуй выразительного персонажа",
    description: "Повтори зелёного слайма и постарайся точно передать его глаза и улыбку.",
    rules: ["1 кадр", "Используй 3 цвета", "Сходство не ниже 90%"],
    template: happySlime,
    minScore: 0.9,
    minColors: 3,
    reward: 220,
    i18n: {
      en: { title: "Happy Slime", subtitle: "Draw an expressive character", description: "Copy the green slime and carefully recreate its eyes and smile.", rules: ["1 frame", "Use 3 colors", "At least 90% similarity"] },
      pl: { title: "Wesoły glutek", subtitle: "Narysuj wyrazistą postać", description: "Odtwórz zielonego glutka, zwracając uwagę na oczy i uśmiech.", rules: ["1 klatka", "Użyj 3 kolorów", "Co najmniej 90% podobieństwa"] },
      es: { title: "Slime feliz", subtitle: "Dibuja un personaje expresivo", description: "Copia el slime verde y reproduce con cuidado sus ojos y sonrisa.", rules: ["1 fotograma", "Usa 3 colores", "Al menos 90% de similitud"] },
      tr: { title: "Mutlu Slime", subtitle: "İfadeli bir karakter çiz", description: "Yeşil slime'ı kopyala; gözlerini ve gülümsemesini dikkatle çiz.", rules: ["1 kare", "3 renk kullan", "En az %90 benzerlik"] },
      pt: { title: "Slime feliz", subtitle: "Desenhe um personagem expressivo", description: "Copie o slime verde e reproduza com cuidado seus olhos e sorriso.", rules: ["1 quadro", "Use 3 cores", "Pelo menos 90% de semelhança"] },
      id: { title: "Slime Ceria", subtitle: "Gambar karakter yang ekspresif", description: "Salin slime hijau dan gambar mata serta senyumnya dengan teliti.", rules: ["1 frame", "Gunakan 3 warna", "Kemiripan minimal 90%"] }
    },
    kind: "template"
  },
  {
    id: "pixel-rocket",
    level: 5,
    width: 16,
    height: 16,
    title: "Пиксельная ракета",
    subtitle: "Собери сложный объект из пяти цветов",
    description: "Нарисуй ракету с иллюминатором, крыльями и ярким пламенем.",
    rules: ["1 кадр", "Используй 5 цветов", "Сходство не ниже 88%"],
    template: rocket,
    minScore: 0.88,
    minColors: 5,
    reward: 320,
    i18n: {
      en: { title: "Pixel Rocket", subtitle: "Build a detailed object with five colors", description: "Draw the rocket with its window, fins, and bright flame.", rules: ["1 frame", "Use 5 colors", "At least 88% similarity"] },
      pl: { title: "Pikselowa rakieta", subtitle: "Zbuduj złożony obiekt z pięciu kolorów", description: "Narysuj rakietę z oknem, statecznikami i jasnym płomieniem.", rules: ["1 klatka", "Użyj 5 kolorów", "Co najmniej 88% podobieństwa"] },
      es: { title: "Cohete pixelado", subtitle: "Crea un objeto detallado con cinco colores", description: "Dibuja el cohete con ventana, aletas y una llama brillante.", rules: ["1 fotograma", "Usa 5 colores", "Al menos 88% de similitud"] },
      tr: { title: "Piksel Roket", subtitle: "Beş renkle ayrıntılı bir nesne yap", description: "Penceresi, kanatları ve parlak alevi olan roketi çiz.", rules: ["1 kare", "5 renk kullan", "En az %88 benzerlik"] },
      pt: { title: "Foguete em pixels", subtitle: "Monte um objeto detalhado com cinco cores", description: "Desenhe o foguete com janela, aletas e uma chama brilhante.", rules: ["1 quadro", "Use 5 cores", "Pelo menos 88% de semelhança"] },
      id: { title: "Roket Piksel", subtitle: "Buat objek detail dengan lima warna", description: "Gambar roket dengan jendela, sirip, dan api yang terang.", rules: ["1 frame", "Gunakan 5 warna", "Kemiripan minimal 88%"] }
    },
    kind: "template"
  },
  {
    id: "blinking-face",
    level: 6,
    width: 16,
    height: 16,
    title: "Подмигивающий герой",
    subtitle: "Оживи лицо в трёх кадрах",
    description: "Создай короткую анимацию: открытые глаза, моргание и возвращение к первому кадру.",
    rules: ["Кадр 1 — глаза открыты", "Кадр 2 — глаза закрыты", "Кадр 3 — глаза снова открыты"],
    template: blinkFrames[0],
    frameTemplates: blinkFrames,
    minScore: 0.86,
    minFrames: 3,
    minMovement: 0,
    reward: 420,
    i18n: {
      en: { title: "Blinking Hero", subtitle: "Bring a face to life in three frames", description: "Create a short animation: open eyes, blink, then return to the first pose.", rules: ["Frame 1 — eyes open", "Frame 2 — eyes closed", "Frame 3 — eyes open again"] },
      pl: { title: "Mrugający bohater", subtitle: "Ożyw twarz w trzech klatkach", description: "Utwórz animację: otwarte oczy, mrugnięcie i powrót do pierwszej pozy.", rules: ["Klatka 1 — oczy otwarte", "Klatka 2 — oczy zamknięte", "Klatka 3 — znów otwarte"] },
      es: { title: "Héroe parpadeante", subtitle: "Da vida a una cara en tres fotogramas", description: "Crea una animación: ojos abiertos, parpadeo y regreso a la primera pose.", rules: ["Fotograma 1 — ojos abiertos", "Fotograma 2 — ojos cerrados", "Fotograma 3 — abiertos otra vez"] },
      tr: { title: "Göz Kırpan Kahraman", subtitle: "Bir yüzü üç karede canlandır", description: "Açık gözler, göz kırpma ve ilk poza dönüşten oluşan kısa bir animasyon yap.", rules: ["Kare 1 — gözler açık", "Kare 2 — gözler kapalı", "Kare 3 — tekrar açık"] },
      pt: { title: "Herói piscando", subtitle: "Dê vida a um rosto em três quadros", description: "Crie uma animação: olhos abertos, piscada e retorno à primeira pose.", rules: ["Quadro 1 — olhos abertos", "Quadro 2 — olhos fechados", "Quadro 3 — abertos novamente"] },
      id: { title: "Pahlawan Berkedip", subtitle: "Hidupkan wajah dalam tiga frame", description: "Buat animasi singkat: mata terbuka, berkedip, lalu kembali ke pose pertama.", rules: ["Frame 1 — mata terbuka", "Frame 2 — mata tertutup", "Frame 3 — terbuka lagi"] }
    },
    kind: "animation"
  }
];

export function challengeCopy(challenge, language = "ru") {
  if (language === "ru" || !challenge.i18n?.[language]) {
    return { title: challenge.title, subtitle: challenge.subtitle, description: challenge.description, rules: challenge.rules };
  }
  return challenge.i18n[language];
}

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
    checks.push({ id: "motion", passed: uniqueFrames >= 2 && movement >= (challenge.minMovement ?? 1.5), value: Math.round(movement * 10) / 10 });
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
      completed: Object.fromEntries(value.map((id) => [id, { bestScore: 100, rewarded: true }])),
      daily: { lastCompleted: "", streak: 0, completed: {} }
    };
  }
  const daily = value?.daily && typeof value.daily === "object" ? value.daily : {};
  return {
    xp: Math.max(0, Number(value?.xp) || 0),
    streak: Math.max(0, Number(value?.streak) || 0),
    completed: value?.completed && typeof value.completed === "object" ? value.completed : {},
    daily: {
      lastCompleted: typeof daily.lastCompleted === "string" ? daily.lastCompleted : "",
      streak: Math.max(0, Number(daily.streak) || 0),
      completed: daily.completed && typeof daily.completed === "object" ? daily.completed : {}
    }
  };
}

export function challengeDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dailyChallengeForDate(date = new Date(), challenges = CHALLENGES) {
  if (!challenges.length) return null;
  const start = new Date(date.getFullYear(), 0, 1);
  const day = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
  return challenges[((day % challenges.length) + challenges.length) % challenges.length];
}

function previousDayKey(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day - 1);
  return challengeDayKey(date);
}

export function awardDailyCompletion(progressValue, dayKey, reward = 50) {
  const progress = normalizeChallengeProgress(progressValue);
  if (progress.daily.completed[dayKey]) return { progress, earnedXp: 0, firstCompletion: false };
  const continued = progress.daily.lastCompleted === previousDayKey(dayKey);
  return {
    progress: {
      ...progress,
      xp: progress.xp + reward,
      daily: {
        lastCompleted: dayKey,
        streak: continued ? progress.daily.streak + 1 : 1,
        completed: { ...progress.daily.completed, [dayKey]: { reward, completedAt: Date.now() } }
      }
    },
    earnedXp: reward,
    firstCompletion: true
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
