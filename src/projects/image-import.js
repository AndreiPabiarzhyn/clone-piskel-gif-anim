function frameFromSource(source, sourceWidth, sourceHeight, width, height) {
  const surface = document.createElement("canvas");
  surface.width = width;
  surface.height = height;
  const context = surface.getContext("2d");
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

export function createImageImporter(deps) {
  const {
    $, state, t, canvas, previewCanvas, invalidateComposite,
    fitZoom, render, showToast
  } = deps;

  return async function importImage(file) {
    state.activeChallenge = null;
    const bytes = await file.arrayBuffer();
    let frames = [];
    let sourceWidth;
    let sourceHeight;

    if (file.type === "image/gif" && "ImageDecoder" in window) {
      const decoder = new ImageDecoder({ data: bytes, type: file.type });
      await decoder.tracks.ready;
      const count = decoder.tracks.selectedTrack.frameCount;
      for (let index = 0; index < count; index += 1) {
        const { image } = await decoder.decode({ frameIndex: index, completeFramesOnly: true });
        sourceWidth ||= image.displayWidth;
        sourceHeight ||= image.displayHeight;
        frames.push(image);
      }
    } else {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      frames = [bitmap];
    }

    const scale = Math.min(1, 128 / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    state.width = width;
    state.height = height;
    const importedFrames = frames.map((frame) => frameFromSource(frame, sourceWidth, sourceHeight, width, height));
    frames.forEach((frame) => frame.close?.());
    state.layers = [{ name: `${t("layer")} 1`, visible: true, frames: importedFrames }];
    state.activeLayer = 0;
    state.activeFrame = 0;
    state.editorBuffer = null;
    invalidateComposite();
    state.projectId = crypto.randomUUID();
    canvas.width = width;
    canvas.height = height;
    previewCanvas.width = width;
    previewCanvas.height = height;
    $("#projectName").value = file.name.replace(/\.[^.]+$/, "");
    fitZoom();
    render();
    showToast(t("imported"));
  };
}
