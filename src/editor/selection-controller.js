import { rotatePixelImage, scalePixelImage, transformPixelImage } from "../modules/selection-utils.js";

export function createSelectionController(deps) {
  const {
    state, canvas, cloneImage, saveHistory, invalidateComposite,
    render, setTool, showToast, clearFrame, t
  } = deps;

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
      nw: [left, top], ne: [right, top], sw: [left, bottom], se: [right, bottom],
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

  function selectionImage() {
    if (!state.selection) return null;
    return selectionImageFrom(state.frames[state.activeFrame], state.selection);
  }

  function copySelection() {
    const image = selectionImage();
    if (!image) return showToast(t("selectAreaFirst"));
    state.clipboard = cloneImage(image);
    showToast(t("selectionCopied"));
  }

  function pasteSelection() {
    if (!state.clipboard) return showToast(t("emptyClipboard"));
    saveHistory();
    const x = state.selection?.x || 0;
    const y = state.selection?.y || 0;
    pasteImageInto(state.frames[state.activeFrame], state.clipboard, x, y);
    state.selection = {
      x, y,
      width: Math.min(state.clipboard.width, state.width - x),
      height: Math.min(state.clipboard.height, state.height - y)
    };
    invalidateComposite(state.activeFrame);
    setTool("select");
    render();
  }

  function transformSelection(type) {
    const source = selectionImage();
    if (!source) return showToast(t("selectAreaFirst"));
    saveHistory();
    const transformed = transformPixelImage(source, type);
    clearSelectionPixels(false);
    const targetX = Math.max(0, Math.min(state.selection.x, state.width - transformed.width));
    const targetY = Math.max(0, Math.min(state.selection.y, state.height - transformed.height));
    state.clipboard = transformed;
    pasteImageInto(state.frames[state.activeFrame], transformed, targetX, targetY);
    state.selection = { x: targetX, y: targetY, width: transformed.width, height: transformed.height };
    invalidateComposite(state.activeFrame);
    render();
  }

  function clearSelectionPixels(save = true) {
    if (!state.selection) return;
    if (save) saveHistory();
    clearImageRect(state.frames[state.activeFrame], state.selection);
    invalidateComposite(state.activeFrame);
  }

  function clearSelection() {
    if (!state.selection) return clearFrame();
    clearSelectionPixels();
    state.selection = null;
    render();
  }

  return {
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
  };
}
