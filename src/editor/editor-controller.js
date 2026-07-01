import { blendPixels, compositeLayers } from "../modules/pixel-composite.js";
import { createExportController } from "./export-controller.js";
import { createFrameController } from "./frame-controller.js";
import { createLayerController } from "./layer-controller.js";
import { createSelectionController } from "./selection-controller.js";
import {
  adjustLine,
  adjustPixel,
  drawEllipse as paintEllipse,
  drawLine as paintLine,
  drawRectangle as paintRectangle,
  fillAt,
  hexToRgba,
  mirroredBrushX,
  setPixel as paintPixel
} from "../modules/editor-tools.js";

export function createEditorController(deps) {
  const {
    $, state, canvas, ctx, t, createImage, cloneImage, setCurrentColor,
    saveHistory, invalidateComposite, scheduleAutosave, shapeTools,
    scheduleBrushCursor, renderInteraction,
    scheduleRecoverySnapshot, renderChallengeRunner
  } = deps;
  const SHAPE_TOOLS = shapeTools;

  function editorBuffer() {
    if (!state.editorBuffer || state.editorBuffer.width !== state.width || state.editorBuffer.height !== state.height) {
      state.editorBuffer = new ImageData(state.width, state.height);
    } else {
      state.editorBuffer.data.fill(0);
    }
    return state.editorBuffer;
  }
  
  function compositeFrame(frameIndex) {
    if (!state.compositeCache.has(frameIndex)) {
      state.compositeCache.set(frameIndex, compositeLayers(state.layers, frameIndex, state.width * state.height * 4));
    }
    return new ImageData(new Uint8ClampedArray(state.compositeCache.get(frameIndex)), state.width, state.height);
  }
  
  function setPixel(image, x, y, color, size = state.brushSize) {
    paintPixel(image, x, y, color, size);
  }
  
  function drawLine(image, from, to, color, size = state.brushSize) {
    paintLine(image, from, to, color, size);
  }

  function drawMirrorLine(image, from, to, color, size = state.brushSize) {
    drawLine(image, from, to, color, size);
    drawLine(
      image,
      { x: mirroredBrushX(state.width, from.x, size), y: from.y },
      { x: mirroredBrushX(state.width, to.x, size), y: to.y },
      color,
      size
    );
  }

  function effectiveToolForEvent(event) {
    if (event.buttons !== 2) return state.tool;
    if (state.tool === "shade") return "shade";
    if (state.tool === "mirror") return "mirror-eraser";
    return "eraser";
  }
  
  function brushSizeForEvent(event) {
    if (event.pointerType !== "pen" || !event.pressure) return state.brushSize;
    return Math.max(1, Math.min(8, Math.round(state.brushSize * (0.65 + event.pressure * 0.7))));
  }
  
  function drawRectangle(image, from, to, color) {
    paintRectangle(image, from, to, color, state.brushSize);
  }
  
  function drawEllipse(image, from, to, color) {
    paintEllipse(image, from, to, color, state.brushSize);
  }
  
  function pointFromEvent(event) {
    const rect = state.canvasRect || canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(state.width - 1, Math.floor((event.clientX - rect.left) / rect.width * state.width))),
      y: Math.max(0, Math.min(state.height - 1, Math.floor((event.clientY - rect.top) / rect.height * state.height)))
    };
  }
  
  function updateCanvasRect() {
    state.canvasRect = canvas.getBoundingClientRect();
  }
  
  function pauseAutosaveWhileDrawing() {
    clearTimeout(state.saveTimer);
    if (state.saveIdle && "cancelIdleCallback" in window) {
      cancelIdleCallback(state.saveIdle);
      state.saveIdle = null;
    }
  }
  
  function startPaint(event) {
    pauseAutosaveWhileDrawing();
    const point = pointFromEvent(event);
    const effectiveTool = effectiveToolForEvent(event);
    if (!state.layers[state.activeLayer].visible && effectiveTool !== "picker" && effectiveTool !== "select") {
      state.layers[state.activeLayer].visible = true;
    }
    state.drawing = true;
    state.lastPoint = point;
    state.gestureStart = point;
    state.gestureBase = cloneImage(state.frames[state.activeFrame]);
    state.pendingSelection = null;
  
    if (effectiveTool === "picker") {
      const image = state.frames[state.activeFrame];
      const index = (point.y * state.width + point.x) * 4;
      if (image.data[index + 3]) {
        setCurrentColor(`#${[0, 1, 2].map((offset) => image.data[index + offset].toString(16).padStart(2, "0")).join("")}`);
      }
      state.drawing = false;
      return;
    }
  
    if (effectiveTool === "shade") {
      saveHistory();
      adjustPixel(
        state.frames[state.activeFrame],
        point.x,
        point.y,
        event.buttons === 2 ? -24 : 24,
        brushSizeForEvent(event)
      );
      invalidateComposite(state.activeFrame);
    } else if (effectiveTool === "fill") {
      saveHistory();
      fillAt(state.frames[state.activeFrame], point.x, point.y, hexToRgba(state.color));
      invalidateComposite(state.activeFrame);
      state.drawing = false;
    } else if (effectiveTool === "select") {
      const handle = selectionHandleAtEvent(event);
      if (handle) {
        startSelectionTransform(event, handle);
      } else {
        state.movingSelection = pointInSelection(point);
      }
      if (state.movingSelection) {
        state.layers[state.activeLayer].visible = true;
        saveHistory();
      }
      else if (!handle) state.selection = normalizedRect(point, point);
    } else if (SHAPE_TOOLS.has(effectiveTool)) {
      saveHistory();
      setPixel(state.frames[state.activeFrame], point.x, point.y, hexToRgba(state.color));
    } else if (effectiveTool === "mirror" || effectiveTool === "mirror-eraser") {
      saveHistory();
      drawMirrorLine(
        state.frames[state.activeFrame],
        point,
        point,
        effectiveTool === "mirror-eraser" ? [0, 0, 0, 0] : hexToRgba(state.color),
        brushSizeForEvent(event)
      );
      invalidateComposite(state.activeFrame);
    } else if (!SHAPE_TOOLS.has(effectiveTool)) {
      saveHistory();
      setPixel(state.frames[state.activeFrame], point.x, point.y, effectiveTool === "eraser" ? [0, 0, 0, 0] : hexToRgba(state.color), brushSizeForEvent(event));
      invalidateComposite(state.activeFrame);
    }
    if (state.drawing) {
      renderEditor();
      scheduleActiveFrameThumbnail();
    } else render();
  }
  
  function continuePaint(event) {
    if (!state.drawing) return;
    const point = pointFromEvent(event);
    state.hoverPoint = point;
    const effectiveTool = effectiveToolForEvent(event);
    const color = ["eraser", "mirror-eraser"].includes(effectiveTool) ? [0, 0, 0, 0] : hexToRgba(state.color);
  
    if (state.selectionTransform) {
      updateSelectionTransform(event);
    } else if (effectiveTool === "shade") {
      adjustLine(
        state.frames[state.activeFrame],
        state.lastPoint,
        point,
        event.buttons === 2 ? -24 : 24,
        brushSizeForEvent(event)
      );
      state.lastPoint = point;
    } else if (effectiveTool === "mirror" || effectiveTool === "mirror-eraser") {
      drawMirrorLine(
        state.frames[state.activeFrame],
        state.lastPoint,
        point,
        color,
        brushSizeForEvent(event)
      );
      state.lastPoint = point;
    } else if (SHAPE_TOOLS.has(effectiveTool)) {
      const image = cloneImage(state.gestureBase);
      if (effectiveTool === "line") drawLine(image, state.gestureStart, point, color);
      if (effectiveTool === "rectangle") drawRectangle(image, state.gestureStart, point, color);
      if (effectiveTool === "ellipse") drawEllipse(image, state.gestureStart, point, color);
      state.frames[state.activeFrame] = image;
    } else if (effectiveTool === "select") {
      if (state.movingSelection) moveSelection(point);
      else state.selection = normalizedRect(state.gestureStart, point);
    } else {
      const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
      for (const sample of samples.length ? samples : [event]) {
        const samplePoint = pointFromEvent(sample);
        drawLine(state.frames[state.activeFrame], state.lastPoint, samplePoint, color, brushSizeForEvent(sample));
        state.lastPoint = samplePoint;
      }
    }
    invalidateComposite(state.activeFrame);
    schedulePaintRender();
  }
  
  function schedulePaintRender() {
    if (state.paintRenderFrame) return;
    state.paintRenderFrame = requestAnimationFrame(() => {
      state.paintRenderFrame = 0;
      renderEditor();
      scheduleActiveFrameThumbnail();
      scheduleBrushCursor();
    });
  }
  
  function endPaint() {
    if (state.paintRenderFrame) {
      cancelAnimationFrame(state.paintRenderFrame);
      state.paintRenderFrame = 0;
    }
    if ((state.movingSelection || state.selectionTransform) && state.pendingSelection) {
      state.selection = { ...state.pendingSelection };
      delete state.selection.angle;
    }
    state.drawing = false;
    state.movingSelection = false;
    state.selectionTransform = null;
    state.lastPoint = null;
    state.gestureBase = null;
    state.pendingSelection = null;
    invalidateComposite(state.activeFrame);
    render();
    scheduleRecoverySnapshot();
  }
  
  function renderEditor() {
    const display = editorBuffer();
    if (state.onionSkin && state.activeFrame > 0) {
      blendPixels(display.data, compositeFrame(state.activeFrame - 1).data, [255, 82, 103], 75 / 255);
    }
    if (state.onionSkin && state.activeFrame < state.layers[0].frames.length - 1) {
      blendPixels(display.data, compositeFrame(state.activeFrame + 1).data, [79, 156, 255], 75 / 255);
    }
    state.layers.forEach((layer) => {
      if (layer.visible && layer.frames[state.activeFrame]) blendPixels(display.data, layer.frames[state.activeFrame].data);
    });
    ctx.putImageData(display, 0, 0);
    renderInteraction();
  }
  
  function scheduleActiveFrameThumbnail() {
    if (state.thumbnailFrame) return;
    state.thumbnailFrame = requestAnimationFrame(() => {
      state.thumbnailFrame = 0;
      const thumb = document.querySelector(`.frame[data-frame-index="${state.activeFrame}"] .frame-preview canvas`);
      if (thumb) thumb.getContext("2d").putImageData(compositeFrame(state.activeFrame), 0, 0);
    });
  }
  
  const frameController = createFrameController({
    $, state, t, cloneImage, createImage, compositeFrame, invalidateComposite,
    saveHistory, showToast, render: (...args) => render(...args)
  });
  const { renderFrames, addFrame, copyWholeFrame, pasteWholeFrame, clearFrame } = frameController;

  const layerController = createLayerController({
    $, state, t, createImage, invalidateComposite, render: (...args) => render(...args)
  });
  const { renderLayers, addLayer } = layerController;

  const selectionController = createSelectionController({
    $, state, canvas, cloneImage, saveHistory, invalidateComposite, t,
    render: (...args) => render(...args),
    setTool: (...args) => setTool(...args),
    showToast,
    clearFrame: (...args) => frameController.clearFrame(...args)
  });
  const {
    normalizedRect,
    pointInSelection,
    selectionHandleAtEvent,
    startSelectionTransform,
    updateSelectionTransform,
    moveSelection,
    nudgeSelection,
    copySelection,
    pasteSelection,
    transformSelection,
    clearSelection
  } = selectionController;

  const exportController = createExportController({ $, state, compositeFrame, showToast });
  const { exportGif, exportPng, exportSpriteSheet } = exportController;

  function updateStats() {
    $("#canvasDimensions").textContent = `${state.width} × ${state.height} px`;
    $("#footerCanvasSize").textContent = `${state.width} × ${state.height} px`;
  }
  
  function render() {
    renderEditor();
    renderFrames();
    renderLayers();
    updateStats();
    renderChallengeRunner();
    state.previewDirty = true;
    scheduleAutosave();
  }
  
  function setTool(tool) {
    state.tool = tool;
    state.selection = tool === "select" ? state.selection : null;
    $("#selectionActions").hidden = tool !== "select" || !state.selection;
    document.querySelectorAll(".tool").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
    canvas.style.cursor = ["pencil", "eraser", "fill", "mirror", "shade"].includes(tool) ? "none" : tool === "select" ? "cell" : "crosshair";
    scheduleBrushCursor();
    renderEditor();
  }
  
  function undo() {
    const previous = state.history.pop();
    if (!previous) return showToast(t("nothingToUndo"));
    state.activeLayer = previous.layer;
    state.frames[previous.frame] = previous.image;
    state.activeFrame = previous.frame;
    state.selection = null;
    invalidateComposite(previous.frame);
    render();
  }
  
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
  }
  
  return {
    compositeFrame,
    pointInSelection,
    selectionHandleAtEvent,
    nudgeSelection,
    pointFromEvent,
    updateCanvasRect,
    startPaint,
    continuePaint,
    endPaint,
    renderEditor,
    renderFrames,
    updateStats,
    render,
    setTool,
    addFrame,
    copyWholeFrame,
    pasteWholeFrame,
    clearFrame,
    undo,
    showToast,
    exportGif,
    exportPng,
    exportSpriteSheet,
    renderLayers,
    addLayer,
    copySelection,
    pasteSelection,
    transformSelection,
    clearSelection
  };
}
