import { encodeGif, scaleFrame } from "../modules/gif.js";

export function createExportController({ $, state, compositeFrame, showToast }) {
  function exportScale() {
    return Math.max(1, Math.min(16, Math.round(Number($("#exportScale").value) || 1)));
  }

  function projectFileName() {
    return $("#projectName").value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "pixel-motion";
  }

  function exportGif() {
    const scale = exportScale();
    const frames = state.layers[0].frames.map((_, index) =>
      scaleFrame(compositeFrame(index), state.width, state.height, scale)
    );
    const width = state.width * scale;
    const height = state.height * scale;
    const bytes = encodeGif(frames, width, height, state.fps);
    const blob = new Blob([bytes], { type: "image/gif" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${projectFileName()}.gif`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("GIF готов к скачиванию");
  }

  function downloadCanvas(surface, suffix) {
    surface.toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${projectFileName()}${suffix}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  }

  function exportPng() {
    const scale = exportScale();
    const frame = scaleFrame(compositeFrame(state.activeFrame), state.width, state.height, scale);
    const surface = document.createElement("canvas");
    surface.width = state.width * scale;
    surface.height = state.height * scale;
    surface.getContext("2d").putImageData(new ImageData(frame.data, surface.width, surface.height), 0, 0);
    downloadCanvas(surface, "");
  }

  function exportSpriteSheet() {
    const scale = exportScale();
    const count = state.layers[0].frames.length;
    const surface = document.createElement("canvas");
    surface.width = state.width * scale * count;
    surface.height = state.height * scale;
    const surfaceCtx = surface.getContext("2d");
    for (let index = 0; index < count; index += 1) {
      const frame = scaleFrame(compositeFrame(index), state.width, state.height, scale);
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = state.width * scale;
      frameCanvas.height = state.height * scale;
      frameCanvas.getContext("2d").putImageData(new ImageData(frame.data, frameCanvas.width, frameCanvas.height), 0, 0);
      surfaceCtx.drawImage(frameCanvas, index * frameCanvas.width, 0);
    }
    downloadCanvas(surface, "-spritesheet");
  }

  return { exportGif, exportPng, exportSpriteSheet };
}
