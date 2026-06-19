export function blendPixels(target, source, tint = null, opacity = 1) {
  for (let index = 0; index < source.length; index += 4) {
    const sourceAlpha = source[index + 3] / 255 * opacity;
    if (sourceAlpha === 0) continue;
    if (sourceAlpha === 1) {
      target[index] = tint ? tint[0] : source[index];
      target[index + 1] = tint ? tint[1] : source[index + 1];
      target[index + 2] = tint ? tint[2] : source[index + 2];
      target[index + 3] = 255;
      continue;
    }
    const targetAlpha = target[index + 3] / 255;
    const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
    if (outputAlpha === 0) continue;
    const red = tint ? tint[0] : source[index];
    const green = tint ? tint[1] : source[index + 1];
    const blue = tint ? tint[2] : source[index + 2];
    target[index] = Math.round((red * sourceAlpha + target[index] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
    target[index + 1] = Math.round((green * sourceAlpha + target[index + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
    target[index + 2] = Math.round((blue * sourceAlpha + target[index + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
    target[index + 3] = Math.round(outputAlpha * 255);
  }
  return target;
}

export function compositeLayers(layers, frameIndex, pixelLength) {
  const output = new Uint8ClampedArray(pixelLength);
  layers.forEach((layer) => {
    const frame = layer.frames[frameIndex];
    if (layer.visible && frame) blendPixels(output, frame.data || frame);
  });
  return output;
}
