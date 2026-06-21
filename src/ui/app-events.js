import { CHALLENGES } from "../modules/challenges.js";

export function bindAppEvents(api) {
  const {
    $, state, canvas, palette, t,
    setCurrentColor, updateCanvasRect, startPaint, continuePaint, endPaint,
    scheduleBrushCursor, pointFromEvent, selectionHandleAtEvent, pointInSelection,
    zoomCanvasAt, setTool, addFrame, copyWholeFrame, pasteWholeFrame, clearFrame,
    undo, updateStats, renderEditor, renderGrid, updatePlaybackControl,
    exportGif, exportPng, exportSpriteSheet, exportProjectFile, importProjectFile,
    importImage, applyLanguage, scheduleAutosave, addLayer, copySelection,
    pasteSelection, transformSelection, clearSelection, fitZoom, resetProject,
    showToast, renderRecentProjects, selectedProjectIds, deleteSelectedProjects,
    deleteAllProjects, createBackup, serializeProject, renderBackups,
    renderChallengeList, checkActiveChallenge, leaveChallenge,
    openChallengeReference, updateReferenceZoom, fitReferenceZoom,
    renderLargeChallengeReference, closeVictory, startChallenge, nudgeSelection
  } = api;
  const on = (selector, type, listener, options) => $(selector).addEventListener(type, listener, options);

  palette.forEach((color) => {
    const button = document.createElement("button");
    button.className = "swatch";
    button.style.background = color;
    button.title = color;
    button.addEventListener("click", () => setCurrentColor(color));
    $("#swatches").append(button);
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (event.pointerType === "touch" && state.penActive) return;
    if (event.pointerType === "pen") state.penActive = true;
    if (event.pointerType === "touch") {
      state.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.touchPointers.size === 2) {
        endPaint();
        const [first, second] = [...state.touchPointers.values()];
        state.pinch = {
          distance: Math.hypot(second.x - first.x, second.y - first.y),
          zoom: state.zoom
        };
        return;
      }
    }
    updateCanvasRect();
    canvas.setPointerCapture(event.pointerId);
    startPaint(event);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" && state.touchPointers.has(event.pointerId)) {
      state.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (state.pinch && state.touchPointers.size >= 2) {
        event.preventDefault();
        const [first, second] = [...state.touchPointers.values()];
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        zoomCanvasAt(
          (first.x + second.x) / 2,
          (first.y + second.y) / 2,
          state.pinch.zoom * distance / Math.max(1, state.pinch.distance)
        );
        return;
      }
    }
    continuePaint(event);
    state.hoverPoint = pointFromEvent(event);
    state.pointerClient = { x: event.clientX, y: event.clientY };
    const rect = state.canvasRect || canvas.getBoundingClientRect();
    state.pointerPosition = {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
    };
    state.pointerTool = event.buttons === 2 ? "eraser" : state.tool;
    if (state.drawing) return scheduleBrushCursor();
    if (state.tool === "select") {
      const handle = selectionHandleAtEvent(event);
      const cursors = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", rotate: "grab" };
      canvas.style.cursor = cursors[handle] || (pointInSelection(state.hoverPoint) ? "move" : "cell");
    }
    scheduleBrushCursor();
  });

  canvas.addEventListener("pointerenter", (event) => {
    updateCanvasRect();
    state.hoverPoint = pointFromEvent(event);
    state.pointerClient = { x: event.clientX, y: event.clientY };
    state.pointerPosition = {
      x: event.clientX - state.canvasRect.left,
      y: event.clientY - state.canvasRect.top
    };
    state.pointerTool = state.tool;
    scheduleBrushCursor();
  });
  canvas.addEventListener("pointerleave", () => {
    state.hoverPoint = null;
    state.pointerPosition = null;
    state.pointerClient = null;
    state.pointerTool = null;
    scheduleBrushCursor();
  });
  const finishPointer = (event) => {
    state.touchPointers.delete(event.pointerId);
    if (state.touchPointers.size < 2) state.pinch = null;
    if (event.pointerType === "pen") state.penActive = false;
    endPaint();
  };
  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  on("#canvasWrap", "scroll", updateCanvasRect, { passive: true });
  on("#canvasWrap", "wheel", (event) => {
    event.preventDefault();
    zoomCanvasAt(event.clientX, event.clientY, state.zoom + (event.deltaY < 0 ? 2 : -2));
  }, { passive: false });
  window.addEventListener("resize", updateCanvasRect, { passive: true });

  on("#toolGrid", "click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (button) setTool(button.dataset.tool);
  });
  on("#colorPicker", "input", (event) => setCurrentColor(event.target.value));
  on("#brushSizes", "click", (event) => {
    const button = event.target.closest("[data-size]");
    if (!button) return;
    state.brushSize = Number(button.dataset.size);
    document.querySelectorAll("#brushSizes button").forEach((item) => item.classList.toggle("active", item === button));
    $("#brushValue").value = `${state.brushSize} px`;
    scheduleBrushCursor();
  });
  on("#fpsRange", "input", (event) => {
    state.fps = Number(event.target.value);
    $("#fpsValue").value = `${state.fps} FPS`;
    updateStats();
  });
  on("#onionSkin", "change", (event) => {
    state.onionSkin = event.target.checked;
    $("#onionButton").classList.toggle("active", state.onionSkin);
    $("#onionButton").setAttribute("aria-pressed", String(state.onionSkin));
    renderEditor();
  });
  on("#onionButton", "click", () => {
    $("#onionSkin").checked = !$("#onionSkin").checked;
    $("#onionSkin").dispatchEvent(new Event("change"));
  });

  on("#addFrame", "click", () => addFrame(false));
  on("#copyFrame", "click", copyWholeFrame);
  on("#pasteFrame", "click", pasteWholeFrame);
  on("#clearFrame", "click", clearFrame);
  on("#undoButton", "click", undo);
  on("#addLayer", "click", addLayer);
  on("#copySelection", "click", copySelection);
  on("#pasteSelection", "click", pasteSelection);
  on("#flipSelectionX", "click", () => transformSelection("flipX"));
  on("#flipSelectionY", "click", () => transformSelection("flipY"));
  on("#deleteSelection", "click", clearSelection);

  const exportDialog = $("#exportDialog");
  const exportScale = () => Math.max(1, Math.min(16, Math.round(Number($("#exportScale").value) || 1)));
  const updateExportScale = (value = $("#exportScale").value, commit = true) => {
    const scale = Math.max(1, Math.min(16, Math.round(Number(value) || 1)));
    if (commit) $("#exportScale").value = scale;
    $("#exportOutputSize").value = `${state.width} × ${state.height} → ${state.width * scale} × ${state.height * scale} px`;
    document.querySelectorAll("[data-export-scale]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.exportScale) === scale);
    });
  };
  api.getExportScale = exportScale;
  on("#exportGif", "click", () => { exportGif(); exportDialog.close(); });
  on("#exportPng", "click", () => { exportPng(); exportDialog.close(); });
  on("#exportSheet", "click", () => { exportSpriteSheet(); exportDialog.close(); });
  on("#exportProject", "click", async () => {
    try {
      await exportProjectFile();
      exportDialog.close();
    } catch (error) {
      console.error(error);
      showToast(`${t("invalidProject")}: ${error.message}`);
    }
  });
  on("#exportMenuButton", "click", () => { updateExportScale(); exportDialog.showModal(); });
  on("#closeExport", "click", () => exportDialog.close());
  on("#exportScale", "input", (event) => {
    if (event.target.value !== "") updateExportScale(event.target.value, false);
  });
  on("#exportScale", "change", (event) => updateExportScale(event.target.value));
  on("#exportScalePresets", "click", (event) => {
    const button = event.target.closest("[data-export-scale]");
    if (button) updateExportScale(button.dataset.exportScale);
  });

  on("#importFile", "click", () => $("#fileInput").click());
  on("#fileInput", "change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    const name = file.name.toLowerCase();
    const isImage = file.type.startsWith("image/") || name.endsWith(".png") || name.endsWith(".gif");
    const isProject = name.endsWith(".pxm") || name.endsWith(".pixelmotion") || file.type === "application/json" || !isImage;
    try {
      if (isProject) await importProjectFile(file);
      else await importImage(file);
    } catch (error) {
      console.error(error);
      showToast(isProject ? `${t("invalidProject")}: ${error.message}` : t("invalidProject"));
    }
    event.target.value = "";
  });

  const centeredZoom = (amount) => {
    const rect = $("#canvasWrap").getBoundingClientRect();
    zoomCanvasAt(rect.left + rect.width / 2, rect.top + rect.height / 2, state.zoom + amount);
  };
  on("#zoomIn", "click", () => centeredZoom(2));
  on("#zoomOut", "click", () => centeredZoom(-2));
  on("#zoomFit", "click", () => { state.autoFit = true; fitZoom(); });
  on("#toggleGrid", "click", (event) => {
    state.gridVisible = !state.gridVisible;
    event.currentTarget.classList.toggle("active");
    renderGrid();
  });
  on("#playPause", "click", () => {
    state.playing = !state.playing;
    updatePlaybackControl();
  });

  on("#languageSelect", "change", (event) => applyLanguage(event.target.value));
  on("#projectName", "input", scheduleAutosave);
  const newProjectDialog = $("#newProjectDialog");
  on("#newProject", "click", () => {
    $("#projectWidth").value = state.width;
    $("#projectHeight").value = state.height;
    newProjectDialog.showModal();
  });
  on("#sizePresets", "click", (event) => {
    const button = event.target.closest("[data-size]");
    if (!button) return;
    document.querySelectorAll("[data-size]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $("#projectWidth").value = button.dataset.size;
    $("#projectHeight").value = button.dataset.size;
  });
  on("#newProjectForm", "submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const width = Math.max(8, Math.min(128, Number($("#projectWidth").value) || 32));
    const height = Math.max(8, Math.min(128, Number($("#projectHeight").value) || 32));
    resetProject(width, height);
    $("#projectName").value = t("untitledProject");
    newProjectDialog.close();
    showToast(`${t("canvas")} ${width} × ${height}`);
  });

  const projectsDialog = $("#projectsDialog");
  const openProjects = () => { renderRecentProjects(); projectsDialog.showModal(); };
  document.querySelector(".brand").addEventListener("click", (event) => {
    event.preventDefault();
    openProjects();
  });
  on("#openProjects", "click", openProjects);
  on("#projectSearch", "input", renderRecentProjects);
  on("#projectSort", "change", renderRecentProjects);
  on("#selectAllProjects", "change", (event) => {
    document.querySelectorAll(".project-card").forEach((card) => {
      if (event.target.checked) selectedProjectIds.add(card.dataset.projectId);
      else selectedProjectIds.delete(card.dataset.projectId);
    });
    renderRecentProjects();
  });
  on("#deleteSelectedProjects", "click", deleteSelectedProjects);
  on("#deleteAllProjects", "click", deleteAllProjects);
  on("#closeProjects", "click", () => projectsDialog.close());
  on("#startNewProject", "click", () => { projectsDialog.close(); newProjectDialog.showModal(); });

  on("#openBackups", "click", () => {
    createBackup(serializeProject(), true);
    renderBackups();
    $("#backupsDialog").showModal();
  });
  on("#closeBackups", "click", () => $("#backupsDialog").close());
  on("#openShortcuts", "click", () => $("#shortcutsDialog").showModal());
  on("#closeShortcuts", "click", () => $("#shortcutsDialog").close());

  const challengesDialog = $("#challengesDialog");
  on("#openChallenges", "click", () => { renderChallengeList(); challengesDialog.showModal(); });
  on("#closeChallenges", "click", () => challengesDialog.close());
  on("#checkChallenge", "click", checkActiveChallenge);
  on("#leaveChallenge", "click", leaveChallenge);
  on("#openChallengeReference", "click", openChallengeReference);
  on("#closeChallengeReference", "click", () => $("#challengeReferenceDialog").close());
  on("#referenceZoomRange", "input", (event) => updateReferenceZoom(event.target.value));
  on("#referenceZoomOut", "click", () => updateReferenceZoom(state.referenceZoom - 2));
  on("#referenceZoomIn", "click", () => updateReferenceZoom(state.referenceZoom + 2));
  on("#referenceZoomFit", "click", fitReferenceZoom);
  on("#referenceGridVisible", "change", renderLargeChallengeReference);
  on("#victoryClose", "click", closeVictory);
  on("#challengeVictory", "click", (event) => {
    if (event.target === event.currentTarget) closeVictory();
  });
  on("#victoryNext", "click", () => {
    const next = CHALLENGES.find((challenge) => challenge.id === $("#victoryNext").dataset.challengeId);
    closeVictory();
    if (next) startChallenge(next);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#challengeVictory").hidden) return closeVictory();
    if (event.target.matches("input, textarea, select") || event.target.isContentEditable) return;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault(); return copyWholeFrame();
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
      event.preventDefault(); return pasteWholeFrame("after");
    }
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "v") {
      event.preventDefault(); return pasteWholeFrame("before");
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault(); return undo();
    }
    const tools = { p: "pencil", e: "eraser", f: "fill", i: "picker", l: "line", r: "rectangle", o: "ellipse", s: "select" };
    if (tools[event.key.toLowerCase()]) setTool(tools[event.key.toLowerCase()]);
    if (event.key === "?" || (event.shiftKey && event.key === "/")) {
      event.preventDefault();
      $("#shortcutsDialog").showModal();
    }
    if (event.key === "+" || event.key === "=") centeredZoom(2);
    if (event.key === "-" || event.key === "_") centeredZoom(-2);
    if (event.key === "0") { state.autoFit = true; fitZoom(); }
    const movement = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
    }[event.key];
    if (movement && state.selection) {
      event.preventDefault();
      nudgeSelection(...movement);
    }
    if (event.key === "Delete") clearSelection();
    if (event.key === "Escape") {
      state.selection = null;
      renderEditor();
    }
  });
}
