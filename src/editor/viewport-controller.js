export function createViewportController(deps) {
  const {
    $, state, canvas, gridCanvas, gridCtx, interactionCanvas,
    interactionCtx, brushCursor, toolCursorIcon, updateCanvasRect
  } = deps;

  function fitZoom() {
    const wrap = $("#canvasWrap");
    const availableWidth = Math.max(160, wrap.clientWidth - 24);
    const availableHeight = Math.max(160, wrap.clientHeight - 24);
    state.zoom = Math.max(2, Math.min(40, Math.floor(Math.min(availableWidth / state.width, availableHeight / state.height))));
    resizeCanvas();
  }
  
  function showsBrushPreview() {
    return Boolean(state.hoverPoint && ["pencil", "eraser"].includes(state.pointerTool || state.tool));
  }
  
  function renderBrushCursor() {
    if (!showsBrushPreview()) {
      brushCursor.style.display = "none";
    } else {
      const width = Math.min(state.brushSize, state.width - state.hoverPoint.x) * state.zoom;
      const height = Math.min(state.brushSize, state.height - state.hoverPoint.y) * state.zoom;
      brushCursor.style.display = "block";
      brushCursor.style.width = `${width}px`;
      brushCursor.style.height = `${height}px`;
      brushCursor.style.transform = `translate3d(${state.hoverPoint.x * state.zoom}px, ${state.hoverPoint.y * state.zoom}px, 0)`;
    }
  
    const pointerTool = state.pointerTool || state.tool;
    const showToolIcon = Boolean(state.pointerPosition && ["pencil", "eraser", "fill"].includes(pointerTool));
    toolCursorIcon.hidden = !showToolIcon;
    if (showToolIcon) {
      const iconScale = Math.max(0.42, Math.min(1, state.zoom / 16));
      toolCursorIcon.style.setProperty("--cursor-icon-scale", iconScale.toFixed(3));
      const isSizedBrush = ["pencil", "eraser"].includes(pointerTool) && state.hoverPoint;
      const visibleBrushWidth = isSizedBrush ? Math.min(state.brushSize, state.width - state.hoverPoint.x) : 1;
      const visibleBrushHeight = isSizedBrush ? Math.min(state.brushSize, state.height - state.hoverPoint.y) : 1;
      const anchorX = state.pointerPosition.x + (visibleBrushWidth - 1) * state.zoom;
      const anchorY = state.pointerPosition.y + (visibleBrushHeight - 1) * state.zoom;
      toolCursorIcon.dataset.tool = pointerTool;
      const canvasWidth = state.width * state.zoom;
      const canvasHeight = state.height * state.zoom;
      toolCursorIcon.classList.toggle("flip-x", anchorX > canvasWidth - 30);
      toolCursorIcon.classList.toggle("flip-y", anchorY > canvasHeight - 30);
      toolCursorIcon.style.transform = `translate3d(${anchorX}px, ${anchorY}px, 0)`;
    }
  }
  
  function scheduleBrushCursor() {
    if (state.cursorFrame) return;
    state.cursorFrame = requestAnimationFrame(() => {
      state.cursorFrame = 0;
      renderBrushCursor();
    });
  }
  
  function renderGrid() {
    const displayWidth = state.width * state.zoom;
    const displayHeight = state.height * state.zoom;
    const ratio = window.devicePixelRatio || 1;
    gridCanvas.width = Math.round(displayWidth * ratio);
    gridCanvas.height = Math.round(displayHeight * ratio);
    gridCanvas.style.width = `${displayWidth}px`;
    gridCanvas.style.height = `${displayHeight}px`;
    gridCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    gridCtx.clearRect(0, 0, displayWidth, displayHeight);
    gridCanvas.hidden = !state.gridVisible;
    if (state.gridVisible) {
      gridCtx.beginPath();
      gridCtx.strokeStyle = state.zoom >= 8 ? "rgba(12, 11, 14, .42)" : "rgba(12, 11, 14, .28)";
      gridCtx.lineWidth = 1;
      for (let x = state.zoom; x < displayWidth; x += state.zoom) {
        gridCtx.moveTo(x + 0.5, 0);
        gridCtx.lineTo(x + 0.5, displayHeight);
      }
      for (let y = state.zoom; y < displayHeight; y += state.zoom) {
        gridCtx.moveTo(0, y + 0.5);
        gridCtx.lineTo(displayWidth, y + 0.5);
      }
      gridCtx.stroke();
    }
  
  }
  
  function renderInteraction() {
    const displayWidth = state.width * state.zoom;
    const displayHeight = state.height * state.zoom;
    const ratio = window.devicePixelRatio || 1;
    if (interactionCanvas.width !== Math.round(displayWidth * ratio) || interactionCanvas.height !== Math.round(displayHeight * ratio)) {
      interactionCanvas.width = Math.round(displayWidth * ratio);
      interactionCanvas.height = Math.round(displayHeight * ratio);
      interactionCanvas.style.width = `${displayWidth}px`;
      interactionCanvas.style.height = `${displayHeight}px`;
    }
    interactionCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    interactionCtx.clearRect(0, 0, displayWidth, displayHeight);
    interactionCanvas.hidden = !state.selection;
    $("#selectionActions").hidden = state.tool !== "select" || !state.selection;
    const selectionSize = $("#selectionSize");
    const visibleSelection = state.pendingSelection || state.selection;
    if (selectionSize) {
      selectionSize.value = visibleSelection
        ? `${visibleSelection.width} × ${visibleSelection.height}${visibleSelection.angle ? ` · ${visibleSelection.angle}°` : ""}`
        : "—";
    }
  
    if (state.selection) {
      const selection = state.pendingSelection || state.selection;
      interactionCtx.save();
      interactionCtx.strokeStyle = "#ffffff";
      interactionCtx.lineWidth = 2;
      interactionCtx.setLineDash([5, 4]);
      interactionCtx.shadowColor = "rgba(0, 0, 0, .9)";
      interactionCtx.shadowBlur = 2;
      interactionCtx.strokeRect(
        selection.x * state.zoom + 1,
        selection.y * state.zoom + 1,
        selection.width * state.zoom - 2,
        selection.height * state.zoom - 2
      );
      const left = selection.x * state.zoom;
      const top = selection.y * state.zoom;
      const right = (selection.x + selection.width) * state.zoom;
      const bottom = (selection.y + selection.height) * state.zoom;
      const rotateY = Math.max(9, top - 20);
      const handleSize = Math.max(7, Math.min(11, state.zoom * .65));
      interactionCtx.setLineDash([]);
      interactionCtx.shadowBlur = 0;
      interactionCtx.strokeStyle = "#17161a";
      interactionCtx.fillStyle = "#f7d154";
      [[left, top], [right, top], [left, bottom], [right, bottom]].forEach(([x, y]) => {
        interactionCtx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
        interactionCtx.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
      });
      interactionCtx.beginPath();
      interactionCtx.moveTo((left + right) / 2, top);
      interactionCtx.lineTo((left + right) / 2, rotateY);
      interactionCtx.strokeStyle = "#f7d154";
      interactionCtx.lineWidth = 1.5;
      interactionCtx.stroke();
      interactionCtx.beginPath();
      interactionCtx.arc((left + right) / 2, rotateY, handleSize / 2, 0, Math.PI * 2);
      interactionCtx.fill();
      interactionCtx.strokeStyle = "#17161a";
      interactionCtx.stroke();
      interactionCtx.restore();
    }
  
  }
  
  function resizeCanvas() {
    canvas.style.width = `${state.width * state.zoom}px`;
    canvas.style.height = `${state.height * state.zoom}px`;
    const gridSize = `${state.zoom}px ${state.zoom}px`;
    canvas.style.backgroundSize = gridSize;
    canvas.style.backgroundPosition = `0 0, 0 ${state.zoom / 2}px, ${state.zoom / 2}px -${state.zoom / 2}px, -${state.zoom / 2}px 0`;
    $("#zoomValue").value = `${state.zoom}×`;
    $("#footerZoom").textContent = `${state.zoom}×`;
    renderGrid();
    renderInteraction();
    scheduleBrushCursor();
    requestAnimationFrame(updateCanvasRect);
  }
  
  function zoomCanvasAt(clientX, clientY, nextZoom) {
    const wrap = $("#canvasWrap");
    const oldRect = canvas.getBoundingClientRect();
    const pixelX = Math.max(0, Math.min(state.width, (clientX - oldRect.left) / state.zoom));
    const pixelY = Math.max(0, Math.min(state.height, (clientY - oldRect.top) / state.zoom));
    const zoom = Math.max(2, Math.min(40, Math.round(nextZoom)));
    if (zoom === state.zoom) return;
    state.autoFit = false;
    state.zoom = zoom;
    toolCursorIcon.classList.add("zoom-sync");
    resizeCanvas();
    requestAnimationFrame(() => {
      const newRect = canvas.getBoundingClientRect();
      wrap.scrollLeft += newRect.left + pixelX * state.zoom - clientX;
      wrap.scrollTop += newRect.top + pixelY * state.zoom - clientY;
      updateCanvasRect();
      if (state.pointerClient) {
        state.pointerPosition = {
          x: Math.max(0, Math.min(state.canvasRect.width, state.pointerClient.x - state.canvasRect.left)),
          y: Math.max(0, Math.min(state.canvasRect.height, state.pointerClient.y - state.canvasRect.top))
        };
        state.hoverPoint = {
          x: Math.max(0, Math.min(state.width - 1, Math.floor(state.pointerPosition.x / state.zoom))),
          y: Math.max(0, Math.min(state.height - 1, Math.floor(state.pointerPosition.y / state.zoom)))
        };
        renderBrushCursor();
      }
      requestAnimationFrame(() => toolCursorIcon.classList.remove("zoom-sync"));
    });
  }

  return {
    fitZoom,
    renderBrushCursor,
    scheduleBrushCursor,
    renderGrid,
    renderInteraction,
    resizeCanvas,
    zoomCanvasAt
  };
}
