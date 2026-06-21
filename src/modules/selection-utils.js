export function scalePixelImage(source, targetWidth, targetHeight) {
  const width = Math.max(1, Math.round(targetWidth));
  const height = Math.max(1, Math.round(targetHeight));
  const result = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(y * source.height / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x * source.width / width));
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      result.set(source.data.slice(sourceIndex, sourceIndex + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data: result };
}

export function transformPixelImage(source, type) {
  const rotate = type === "rotate";
  const width = rotate ? source.height : source.width;
  const height = rotate ? source.width : source.height;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      let targetX = x;
      let targetY = y;
      if (type === "rotate") {
        targetX = source.height - 1 - y;
        targetY = x;
      } else if (type === "flipX") {
        targetX = source.width - 1 - x;
      } else if (type === "flipY") {
        targetY = source.height - 1 - y;
      }
      const sourceIndex = (y * source.width + x) * 4;
      data.set(source.data.slice(sourceIndex, sourceIndex + 4), (targetY * width + targetX) * 4);
    }
  }
  return { width, height, data };
}

export function rotatePixelImage(source, degrees) {
  const radians = Number(degrees) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const width = Math.max(1, Math.ceil(Math.abs(source.width * cosine) + Math.abs(source.height * sine) - 1e-9));
  const height = Math.max(1, Math.ceil(Math.abs(source.width * sine) + Math.abs(source.height * cosine) - 1e-9));
  const data = new Uint8ClampedArray(width * height * 4);
  const sourceCenterX = (source.width - 1) / 2;
  const sourceCenterY = (source.height - 1) / 2;
  const targetCenterX = (width - 1) / 2;
  const targetCenterY = (height - 1) / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const relativeX = x - targetCenterX;
      const relativeY = y - targetCenterY;
      const sourceX = Math.round(relativeX * cosine + relativeY * sine + sourceCenterX);
      const sourceY = Math.round(-relativeX * sine + relativeY * cosine + sourceCenterY);
      if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) continue;
      const sourceIndex = (sourceY * source.width + sourceX) * 4;
      data.set(source.data.slice(sourceIndex, sourceIndex + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

export function frameInsertionIndex(activeIndex, frameCount, placement = "after") {
  if (placement === "before") return Math.max(0, activeIndex);
  return Math.min(frameCount, activeIndex + 1);
}
