import { encodeGif, scaleFrame } from "../modules/gif.js";
import { reorderFrameCollections } from "../modules/frame-utils.js";
import { blendPixels, compositeLayers } from "../modules/pixel-composite.js";
import { frameInsertionIndex, rotatePixelImage, scalePixelImage, transformPixelImage } from "../modules/selection-utils.js";
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
    $, state, canvas, ctx, gridCanvas, gridCtx, interactionCanvas,
    interactionCtx, brushCursor, toolCursorIcon, t, createImage, cloneImage,
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
  
  function normalizedRect(from, to) {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    return { x, y, width: Math.abs(to.x - from.x) + 1, height: Math.abs(to.y - from.y) + 1 };
  }
  
  function pointInSelection(point) {
    const selection = state.selection;
    return selection && point.x >= selection.x && point.y >= selection.y &&
      point.x < selection.x + selection.width && point.y < selection.y + selection.height;
  }
  
  function selectionImageFrom(image, selection) {
    const result = new ImageData(selection.width, selection.height);
    for (let y = 0; y < selection.height; y += 1) {
      for (let x = 0; x < selection.width; x += 1) {
        const sourceIndex = ((selection.y + y) * state.width + selection.x + x) * 4;
        result.data.set(image.data.slice(sourceIndex, sourceIndex + 4), (y * selection.width + x) * 4);
      }
    }
    return result;
  }
  
  function clearImageRect(image, selection) {
    for (let y = selection.y; y < selection.y + selection.height; y += 1) {
      for (let x = selection.x; x < selection.x + selection.width; x += 1) {
        image.data.set([0, 0, 0, 0], (y * state.width + x) * 4);
      }
    }
  }
  
  function pasteImageInto(image, source, targetX, targetY) {
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const destinationX = targetX + x;
        const destinationY = targetY + y;
        if (destinationX < 0 || destinationY < 0 || destinationX >= state.width || destinationY >= state.height) continue;
        const sourceIndex = (y * source.width + x) * 4;
        image.data.set(source.data.slice(sourceIndex, sourceIndex + 4), (destinationY * state.width + destinationX) * 4);
      }
    }
  }
  
  function selectionHandleAtEvent(event) {
    if (!state.selection || state.tool !== "select") return null;
    const rect = state.canvasRect || canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const selection = state.pendingSelection || state.selection;
    const left = selection.x * state.zoom;
    const top = selection.y * state.zoom;
    const right = (selection.x + selection.width) * state.zoom;
    const bottom = (selection.y + selection.height) * state.zoom;
    const rotateY = Math.max(9, top - 20);
    const handles = {
      nw: [left, top],
      ne: [right, top],
      sw: [left, bottom],
      se: [right, bottom],
      rotate: [(left + right) / 2, rotateY]
    };
    const threshold = Math.max(8, Math.min(12, state.zoom * 0.7));
    return Object.entries(handles).find(([, point]) => Math.hypot(x - point[0], y - point[1]) <= threshold)?.[0] || null;
  }
  
  function boundaryPointFromEvent(event) {
    const rect = state.canvasRect || canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(state.width, Math.round((event.clientX - rect.left) / state.zoom))),
      y: Math.max(0, Math.min(state.height, Math.round((event.clientY - rect.top) / state.zoom)))
    };
  }
  
  function startSelectionTransform(event, handle) {
    const selection = { ...state.selection };
    const baseFrame = cloneImage(state.frames[state.activeFrame]);
    const clearedFrame = cloneImage(baseFrame);
    clearImageRect(clearedFrame, selection);
    const rect = state.canvasRect || canvas.getBoundingClientRect();
    const centerX = selection.x + selection.width / 2;
    const centerY = selection.y + selection.height / 2;
    saveHistory();
    state.selectionTransform = {
      handle,
      selection,
      source: selectionImageFrom(baseFrame, selection),
      clearedFrame,
      centerX,
      centerY,
      centerClientX: rect.left + centerX * state.zoom,
      centerClientY: rect.top + centerY * state.zoom,
      startAngle: Math.atan2(event.clientY - (rect.top + centerY * state.zoom), event.clientX - (rect.left + centerX * state.zoom))
    };
    state.drawing = true;
  }
  
  function updateSelectionTransform(event) {
    const transform = state.selectionTransform;
    if (!transform) return;
    let transformed;
    let target;
    if (transform.handle === "rotate") {
      const angle = Math.atan2(event.clientY - transform.centerClientY, event.clientX - transform.centerClientX);
      const step = event.shiftKey ? 90 : 15;
      const degrees = Math.round(((angle - transform.startAngle) * 180 / Math.PI) / step) * step;
      transformed = rotatePixelImage(transform.source, degrees);
      target = {
        x: Math.round(transform.centerX - transformed.width / 2),
        y: Math.round(transform.centerY - transformed.height / 2),
        width: transformed.width,
        height: transformed.height,
        angle: degrees
      };
    } else {
      const point = boundaryPointFromEvent(event);
      const selection = transform.selection;
      const opposite = {
        nw: { x: selection.x + selection.width, y: selection.y + selection.height },
        ne: { x: selection.x, y: selection.y + selection.height },
        sw: { x: selection.x + selection.width, y: selection.y },
        se: { x: selection.x, y: selection.y }
      }[transform.handle];
      const width = Math.max(1, Math.abs(point.x - opposite.x));
      const height = Math.max(1, Math.abs(point.y - opposite.y));
      target = {
        x: Math.min(point.x, opposite.x),
        y: Math.min(point.y, opposite.y),
        width,
        height
      };
      target.x = Math.min(target.x, state.width - width);
      target.y = Math.min(target.y, state.height - height);
      transformed = scalePixelImage(transform.source, width, height);
    }
    target.x = Math.max(0, Math.min(state.width - Math.min(target.width, state.width), target.x));
    target.y = Math.max(0, Math.min(state.height - Math.min(target.height, state.height), target.y));
    const frame = cloneImage(transform.clearedFrame);
    pasteImageInto(frame, transformed, target.x, target.y);
    state.frames[state.activeFrame] = frame;
    state.pendingSelection = {
      x: target.x,
      y: target.y,
      width: Math.min(target.width, state.width - target.x),
      height: Math.min(target.height, state.height - target.y),
      angle: target.angle || 0
    };
  }
  
  function moveSelection(point) {
    const source = state.gestureBase;
    const selection = state.selection;
    const targetX = Math.max(0, Math.min(state.width - selection.width, selection.x + point.x - state.gestureStart.x));
    const targetY = Math.max(0, Math.min(state.height - selection.height, selection.y + point.y - state.gestureStart.y));
    const dx = targetX - selection.x;
    const dy = targetY - selection.y;
    const result = cloneImage(source);
    const pixels = [];
  
    for (let y = 0; y < selection.height; y += 1) {
      for (let x = 0; x < selection.width; x += 1) {
        const sx = selection.x + x;
        const sy = selection.y + y;
        const sourceIndex = (sy * state.width + sx) * 4;
        pixels.push(Array.from(source.data.slice(sourceIndex, sourceIndex + 4)));
        result.data.set([0, 0, 0, 0], sourceIndex);
      }
    }
    for (let y = 0; y < selection.height; y += 1) {
      for (let x = 0; x < selection.width; x += 1) {
        const tx = selection.x + dx + x;
        const ty = selection.y + dy + y;
        if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
        result.data.set(pixels[y * selection.width + x], (ty * state.width + tx) * 4);
      }
    }
    state.frames[state.activeFrame] = result;
    state.pendingSelection = { ...selection, x: targetX, y: targetY };
  }
  
  function nudgeSelection(dx, dy) {
    if (!state.selection) return;
    saveHistory();
    state.gestureBase = cloneImage(state.frames[state.activeFrame]);
    state.gestureStart = { x: state.selection.x, y: state.selection.y };
    moveSelection({ x: state.selection.x + dx, y: state.selection.y + dy });
    state.selection = state.pendingSelection;
    state.pendingSelection = null;
    state.gestureBase = null;
    state.gestureStart = null;
    invalidateComposite(state.activeFrame);
    render();
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
  
  function renderFrames() {
    const host = $("#frames");
    host.innerHTML = "";
    const generation = ++state.frameRenderGeneration;
    const fragment = document.createDocumentFragment();
    const scheduleThumbnail = (thumb, index) => {
      const draw = () => {
        if (generation === state.frameRenderGeneration) {
          thumb.getContext("2d").putImageData(compositeFrame(index), 0, 0);
        }
      };
      if (index === state.activeFrame) draw();
      else if ("requestIdleCallback" in window) requestIdleCallback(draw, { timeout: 500 });
      else setTimeout(draw, 0);
    };
    state.layers[0].frames.forEach((_, index) => {
      const item = document.createElement("div");
      item.className = `frame${index === state.activeFrame ? " active" : ""}`;
      item.draggable = true;
      item.dataset.frameIndex = index;
      const button = document.createElement("button");
      button.className = "frame-preview";
      button.title = `Кадр ${index + 1}`;
      const thumb = document.createElement("canvas");
      thumb.width = state.width;
      thumb.height = state.height;
      scheduleThumbnail(thumb, index);
      const number = document.createElement("span");
      number.className = "frame-number";
      number.textContent = String(index + 1);
      button.append(thumb, number);
      button.addEventListener("click", () => {
        state.activeFrame = index;
        state.selection = null;
        render();
      });
      const actions = document.createElement("div");
      actions.className = "frame-card-actions";
      const duplicate = document.createElement("button");
      duplicate.type = "button";
      duplicate.className = "frame-duplicate";
      duplicate.textContent = "⧉";
      duplicate.title = t("duplicate");
      duplicate.setAttribute("aria-label", t("duplicate"));
      duplicate.addEventListener("click", (event) => {
        event.stopPropagation();
        state.activeFrame = index;
        addFrame(true);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "frame-delete";
      remove.textContent = "×";
      remove.title = t("delete");
      remove.setAttribute("aria-label", t("delete"));
      remove.disabled = state.layers[0].frames.length === 1;
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteFrame(index);
      });
      actions.append(duplicate, remove);
      item.append(button, actions);
      item.addEventListener("dragstart", (event) => {
        state.draggedFrame = index;
        item.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      });
      item.addEventListener("dragend", () => {
        state.draggedFrame = null;
        document.querySelectorAll(".frame").forEach((frame) => frame.classList.remove("dragging", "drop-before", "drop-after"));
      });
      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (state.draggedFrame === null || state.draggedFrame === index) return;
        const after = event.clientY > item.getBoundingClientRect().top + item.offsetHeight / 2;
        item.classList.toggle("drop-before", !after);
        item.classList.toggle("drop-after", after);
        event.dataTransfer.dropEffect = "move";
      });
      item.addEventListener("dragleave", () => item.classList.remove("drop-before", "drop-after"));
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData("text/plain"));
        const after = event.clientY > item.getBoundingClientRect().top + item.offsetHeight / 2;
        reorderFrame(from, index + (after ? 1 : 0));
      });
      fragment.append(item);
    });
    host.append(fragment);
  }
  
  function updateStats() {
    const count = state.layers[0].frames.length;
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
  
  function addFrame(copy = false) {
    state.layers.forEach((layer) => {
      const source = layer.frames[state.activeFrame];
      layer.frames.splice(state.activeFrame + 1, 0, copy ? cloneImage(source) : createImage());
    });
    state.activeFrame += 1;
    state.selection = null;
    invalidateComposite();
    render();
    document.querySelector(`.frame[data-frame-index="${state.activeFrame}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
  
  function reorderFrame(from, insertionIndex) {
    const to = reorderFrameCollections(state.layers.map((layer) => layer.frames), from, insertionIndex);
    if (to === from) return;
    state.activeFrame = to;
    state.previewFrame = to;
    state.selection = null;
    state.draggedFrame = null;
    invalidateComposite();
    render();
    document.querySelector(`.frame[data-frame-index="${to}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  
  function copyWholeFrame() {
    state.frameClipboard = state.layers.map((layer) => cloneImage(layer.frames[state.activeFrame]));
    showToast(t("frameCopied"));
  }
  
  function pasteWholeFrame(placement = "after") {
    if (!state.frameClipboard) return showToast(t("emptyFrameClipboard"));
    const insertion = frameInsertionIndex(state.activeFrame, state.layers[0].frames.length, placement);
    state.layers.forEach((layer, index) => {
      const copied = state.frameClipboard[index];
      layer.frames.splice(insertion, 0, copied ? cloneImage(copied) : createImage());
    });
    state.activeFrame = insertion;
    state.previewFrame = insertion;
    state.selection = null;
    invalidateComposite();
    render();
    document.querySelector(`.frame[data-frame-index="${insertion}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast(t("framePasted"));
  }
  
  function deleteFrame(index = state.activeFrame) {
    if (state.layers[0].frames.length === 1) return;
    state.layers.forEach((layer) => layer.frames.splice(index, 1));
    state.activeFrame = Math.min(index, state.layers[0].frames.length - 1);
    state.selection = null;
    invalidateComposite();
    render();
  }
  
  function clearFrame() {
    saveHistory();
    state.frames[state.activeFrame] = createImage();
    state.selection = null;
    invalidateComposite(state.activeFrame);
    render();
  }
  
  function clearSelection() {
    if (!state.selection) return clearFrame();
    clearSelectionPixels();
    state.selection = null;
    render();
  }
  
  function undo() {
    const previous = state.history.pop();
    if (!previous) return showToast("Нечего отменять");
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
  
  function exportScale() {
    return Math.max(1, Math.min(16, Math.round(Number($("#exportScale").value) || 1)));
  }
  
  function exportGif() {
    const scale = exportScale();
    const frames = state.layers[0].frames.map((_, index) => scaleFrame(compositeFrame(index), state.width, state.height, scale));
    const width = state.width * scale;
    const height = state.height * scale;
    const bytes = encodeGif(frames, width, height, state.fps);
    const blob = new Blob([bytes], { type: "image/gif" });
    const link = document.createElement("a");
    const name = $("#projectName").value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "pixel-motion";
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.gif`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("GIF готов к скачиванию");
  }
  
  function downloadCanvas(surface, suffix) {
    surface.toBlob((blob) => {
      const link = document.createElement("a");
      const name = $("#projectName").value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-") || "pixel-motion";
      link.href = URL.createObjectURL(blob);
      link.download = `${name}${suffix}.png`;
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
  
  function renderLayers() {
    const host = $("#layersList");
    if (!host) return;
    host.innerHTML = "";
    [...state.layers].reverse().forEach((layer, reverseIndex) => {
      const index = state.layers.length - reverseIndex - 1;
      const item = document.createElement("div");
      item.className = `layer-item${index === state.activeLayer ? " active" : ""}`;
      const visibility = document.createElement("button");
      visibility.className = `layer-visibility${layer.visible ? " visible" : ""}`;
      visibility.innerHTML = layer.visible
        ? '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M3 3 21 21"/><path d="M10.6 6.2A11 11 0 0 1 12 6c6.5 0 10 6 10 6a15 15 0 0 1-2.1 2.8M6.4 6.4C3.5 8.2 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.5-.6"/></svg>';
      visibility.title = layer.visible ? t("hideLayer") : t("showLayer");
      visibility.setAttribute("aria-label", visibility.title);
      visibility.addEventListener("click", () => {
        layer.visible = !layer.visible;
        invalidateComposite();
        render();
      });
      const name = document.createElement("span");
      name.className = "layer-name";
      name.textContent = layer.name;
      name.addEventListener("click", () => {
        state.activeLayer = index;
        state.selection = null;
        render();
      });
      name.addEventListener("dblclick", () => {
        const next = window.prompt("Layer name", layer.name);
        if (next?.trim()) {
          layer.name = next.trim();
          render();
        }
      });
      const up = document.createElement("button");
      up.className = "layer-action";
      up.innerHTML = '<svg viewBox="0 0 24 24"><path d="m7 14 5-5 5 5"/></svg>';
      up.title = t("moveLayerUp");
      up.disabled = index === state.layers.length - 1;
      up.addEventListener("click", () => {
        if (index >= state.layers.length - 1) return;
        [state.layers[index], state.layers[index + 1]] = [state.layers[index + 1], state.layers[index]];
        state.activeLayer = index + 1;
        invalidateComposite();
        render();
      });
      const down = document.createElement("button");
      down.className = "layer-action";
      down.innerHTML = '<svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>';
      down.title = t("moveLayerDown");
      down.disabled = index === 0;
      down.addEventListener("click", () => {
        if (index <= 0) return;
        [state.layers[index], state.layers[index - 1]] = [state.layers[index - 1], state.layers[index]];
        state.activeLayer = index - 1;
        invalidateComposite();
        render();
      });
      const remove = document.createElement("button");
      remove.className = "layer-action layer-remove";
      remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6 18 18M18 6 6 18"/></svg>';
      remove.title = t("delete");
      remove.disabled = state.layers.length === 1;
      remove.addEventListener("click", () => {
        if (state.layers.length === 1) return;
        state.layers.splice(index, 1);
        if (index < state.activeLayer) state.activeLayer -= 1;
        else state.activeLayer = Math.min(state.activeLayer, state.layers.length - 1);
        invalidateComposite();
        render();
      });
      item.append(visibility, name, up, down, remove);
      host.append(item);
    });
    $("#layersCount").textContent = state.layers.length;
  }
  
  function addLayer() {
    const frameCount = state.layers[0].frames.length;
    state.layers.push({
      name: `${t("layer")} ${state.layers.length + 1}`,
      visible: true,
      frames: Array.from({ length: frameCount }, () => createImage())
    });
    state.activeLayer = state.layers.length - 1;
    invalidateComposite();
    render();
  }
  
  function selectionImage() {
    if (!state.selection) return null;
    const result = new ImageData(state.selection.width, state.selection.height);
    const source = state.frames[state.activeFrame];
    for (let y = 0; y < state.selection.height; y += 1) {
      for (let x = 0; x < state.selection.width; x += 1) {
        const sourceIndex = ((state.selection.y + y) * state.width + state.selection.x + x) * 4;
        result.data.set(source.data.slice(sourceIndex, sourceIndex + 4), (y * result.width + x) * 4);
      }
    }
    return result;
  }
  
  function copySelection() {
    const image = selectionImage();
    if (!image) return showToast("Сначала выделите область");
    state.clipboard = cloneImage(image);
    showToast("Выделение скопировано");
  }
  
  function pasteSelection() {
    if (!state.clipboard) return showToast("Буфер пуст");
    saveHistory();
    const x = state.selection?.x || 0;
    const y = state.selection?.y || 0;
    const image = state.frames[state.activeFrame];
    for (let yy = 0; yy < state.clipboard.height; yy += 1) {
      for (let xx = 0; xx < state.clipboard.width; xx += 1) {
        const tx = x + xx;
        const ty = y + yy;
        if (tx >= state.width || ty >= state.height) continue;
        const sourceIndex = (yy * state.clipboard.width + xx) * 4;
        image.data.set(state.clipboard.data.slice(sourceIndex, sourceIndex + 4), (ty * state.width + tx) * 4);
      }
    }
    state.selection = { x, y, width: Math.min(state.clipboard.width, state.width - x), height: Math.min(state.clipboard.height, state.height - y) };
    invalidateComposite(state.activeFrame);
    setTool("select");
    render();
  }
  
  function transformSelection(type) {
    const source = selectionImage();
    if (!source) return showToast("Сначала выделите область");
    saveHistory();
    const transformed = transformPixelImage(source, type);
    const result = new ImageData(transformed.data, transformed.width, transformed.height);
    clearSelectionPixels(false);
    const targetX = Math.max(0, Math.min(state.selection.x, state.width - result.width));
    const targetY = Math.max(0, Math.min(state.selection.y, state.height - result.height));
    state.clipboard = result;
    pasteSelectionAt(result, targetX, targetY);
    state.selection = { x: targetX, y: targetY, width: result.width, height: result.height };
    invalidateComposite(state.activeFrame);
    render();
  }
  
  function pasteSelectionAt(source, x, y) {
    const image = state.frames[state.activeFrame];
    for (let yy = 0; yy < source.height; yy += 1) {
      for (let xx = 0; xx < source.width; xx += 1) {
        if (x + xx >= state.width || y + yy >= state.height) continue;
        const index = (yy * source.width + xx) * 4;
        image.data.set(source.data.slice(index, index + 4), ((y + yy) * state.width + x + xx) * 4);
      }
    }
  }
  
  function clearSelectionPixels(save = true) {
    if (!state.selection) return;
    if (save) saveHistory();
    const image = state.frames[state.activeFrame];
    for (let y = state.selection.y; y < state.selection.y + state.selection.height; y += 1) {
      for (let x = state.selection.x; x < state.selection.x + state.selection.width; x += 1) {
        image.data.set([0, 0, 0, 0], (y * state.width + x) * 4);
      }
    }
    invalidateComposite(state.activeFrame);
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
