export function hexToRgba(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

export function setPixel(image, x, y, color, size = 1) {
  for (let yy = y; yy < y + size; yy += 1) {
    for (let xx = x; xx < x + size; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) continue;
      image.data.set(color, (yy * image.width + xx) * 4);
    }
  }
}

export function mirroredBrushX(width, x, size = 1) {
  return width - x - size;
}

export function adjustPixel(image, x, y, amount, size = 1) {
  for (let yy = y; yy < y + size; yy += 1) {
    for (let xx = x; xx < x + size; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= image.width || yy >= image.height) continue;
      const index = (yy * image.width + xx) * 4;
      if (image.data[index + 3] === 0) continue;
      for (let channel = 0; channel < 3; channel += 1) {
        image.data[index + channel] = Math.max(0, Math.min(255, image.data[index + channel] + amount));
      }
    }
  }
}

export function fillAt(image, x, y, replacement) {
  const start = (y * image.width + x) * 4;
  const target = Array.from(image.data.slice(start, start + 4));
  if (target.every((value, index) => value === replacement[index])) return;
  const queue = [[x, y]];
  const visited = new Uint8Array(image.width * image.height);
  while (queue.length) {
    const [currentX, currentY] = queue.pop();
    if (currentX < 0 || currentY < 0 || currentX >= image.width || currentY >= image.height) continue;
    const position = currentY * image.width + currentX;
    if (visited[position]) continue;
    visited[position] = 1;
    const index = position * 4;
    if (!target.every((value, channel) => image.data[index + channel] === value)) continue;
    image.data.set(replacement, index);
    queue.push([currentX + 1, currentY], [currentX - 1, currentY], [currentX, currentY + 1], [currentX, currentY - 1]);
  }
}

export function drawLine(image, from, to, color, size = 1) {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = -Math.abs(to.y - y);
  const stepX = x < to.x ? 1 : -1;
  const stepY = y < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    setPixel(image, x, y, color, size);
    if (x === to.x && y === to.y) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x += stepX; }
    if (doubled <= dx) { error += dx; y += stepY; }
  }
}

export function adjustLine(image, from, to, amount, size = 1) {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = -Math.abs(to.y - y);
  const stepX = x < to.x ? 1 : -1;
  const stepY = y < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    adjustPixel(image, x, y, amount, size);
    if (x === to.x && y === to.y) break;
    const doubled = 2 * error;
    if (doubled >= dy) { error += dy; x += stepX; }
    if (doubled <= dx) { error += dx; y += stepY; }
  }
}

export function drawRectangle(image, from, to, color, size = 1) {
  drawLine(image, from, { x: to.x, y: from.y }, color, size);
  drawLine(image, { x: to.x, y: from.y }, to, color, size);
  drawLine(image, to, { x: from.x, y: to.y }, color, size);
  drawLine(image, { x: from.x, y: to.y }, from, color, size);
}

export function drawEllipse(image, from, to, color, size = 1) {
  const left = Math.min(from.x, to.x);
  const right = Math.max(from.x, to.x);
  const top = Math.min(from.y, to.y);
  const bottom = Math.max(from.y, to.y);
  const radiusX = Math.max((right - left) / 2, 0.5);
  const radiusY = Math.max((bottom - top) / 2, 0.5);
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  const steps = Math.max(12, Math.ceil(2 * Math.PI * Math.max(radiusX, radiusY) * 2));
  let previous = null;
  for (let index = 0; index <= steps; index += 1) {
    const angle = index / steps * Math.PI * 2;
    const point = {
      x: Math.round(centerX + radiusX * Math.cos(angle)),
      y: Math.round(centerY + radiusY * Math.sin(angle))
    };
    if (previous) drawLine(image, previous, point, color, size);
    previous = point;
  }
}
