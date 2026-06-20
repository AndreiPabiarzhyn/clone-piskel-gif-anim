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

export function frameInsertionIndex(activeIndex, frameCount, placement = "after") {
  if (placement === "before") return Math.max(0, activeIndex);
  return Math.min(frameCount, activeIndex + 1);
}

