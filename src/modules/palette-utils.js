function colorDistance(first, second) {
  const red = first[0] - second[0];
  const green = first[1] - second[1];
  const blue = first[2] - second[2];
  return red * red + green * green + blue * blue;
}

export function rgbaToHex(red, green, blue) {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function extractPalette(data, limit = 8) {
  const buckets = new Map();
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 32) continue;
    const color = [
      Math.round(data[index] / 16) * 16,
      Math.round(data[index + 1] / 16) * 16,
      Math.round(data[index + 2] / 16) * 16
    ].map((value) => Math.min(255, value));
    const key = color.join(",");
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  const candidates = [...buckets.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([key]) => key.split(",").map(Number));
  const selected = [];
  for (const color of candidates) {
    if (selected.every((existing) => colorDistance(existing, color) > 900)) selected.push(color);
    if (selected.length === limit) break;
  }
  return selected.map((color) => rgbaToHex(...color));
}

export function normalizePalette(colors, limit = 16) {
  return [...new Set(colors.map((color) => color.toLowerCase()).filter((color) => /^#[0-9a-f]{6}$/.test(color)))].slice(0, limit);
}

