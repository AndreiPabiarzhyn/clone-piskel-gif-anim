import { challengeUi as translateChallengeUi, TRANSLATIONS } from "./modules/i18n.js";
import { STORAGE_KEYS, writeStoredJson } from "./modules/project-store.js";
import { bindAppEvents } from "./ui/app-events.js";
import { createChallengeController } from "./challenges/challenge-controller.js";
import { createProjectController } from "./projects/project-controller.js";
import { createEditorController } from "./editor/editor-controller.js";
import { createViewportController } from "./editor/viewport-controller.js";
import { createImageImporter } from "./projects/image-import.js";

const PALETTE = [
  "#f7d154", "#ed6473", "#5ccda4", "#5e9cff",
  "#af70e2", "#ff914a", "#ffffff", "#35313d",
  "#000000", "#8b5a2b", "#35d0e8", "#ff7eb6"
];
const SHAPE_TOOLS = new Set(["line", "rectangle", "ellipse"]);
const TOOL_TRANSLATION_KEYS = { select: "selection" };
const $ = (selector) => document.querySelector(selector);

const canvas = $("#editorCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const gridCanvas = $("#gridOverlay");
const gridCtx = gridCanvas.getContext("2d");
const interactionCanvas = $("#interactionOverlay");
const interactionCtx = interactionCanvas.getContext("2d");
const brushCursor = $("#brushCursor");
const toolCursorIcon = $("#toolCursorIcon");
const previewCanvas = $("#previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
document.documentElement.classList.toggle("embedded", window.self !== window.top);

function updateColorUi(color) {
  $("#colorPickerPreview").style.background = color;
}

function normalizeHexColor(value) {
  const compact = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(compact)) return `#${compact.split("").map((character) => character.repeat(2)).join("")}`.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(compact)) return `#${compact}`.toLowerCase();
  return null;
}

function setCurrentColor(color) {
  const normalized = normalizeHexColor(color);
  if (!normalized) return false;
  state.color = normalized;
  $("#colorPicker").value = normalized;
  updateColorUi(normalized);
  return true;
}

function updatePlaybackControl() {
  const button = $("#playPause");
  if (!button) return;
  button.classList.toggle("playing", state.playing);
  button.title = state.playing ? t("pause") : t("play");
  button.setAttribute("aria-label", button.title);
}

const state = {
  width: 32,
  height: 32,
  layers: [{ name: "Слой 1", visible: true, frames: [] }],
  activeLayer: 0,
  activeFrame: 0,
  tool: "pencil",
  color: "#f7d154",
  brushSize: 1,
  zoom: 16,
  fps: 8,
  playing: true,
  previewFrame: 0,
  drawing: false,
  lastPoint: null,
  gestureStart: null,
  gestureBase: null,
  onionSkin: false,
  gridVisible: true,
  autoFit: true,
  selection: null,
  movingSelection: false,
  selectionTransform: null,
  history: [],
  clipboard: null,
  frameClipboard: null,
  draggedFrame: null,
  hoverPoint: null,
  pointerPosition: null,
  pointerClient: null,
  pointerTool: null,
  canvasRect: null,
  editorBuffer: null,
  cursorFrame: 0,
  previewDirty: true,
  projectId: crypto.randomUUID(),
  language: "ru",
  activeChallenge: null,
  activeDailyDate: "",
  referenceZoom: 16,
  referenceFrame: 0,
  saveTimer: null,
  saveIdle: null,
  recoveryTimer: null,
  backupAt: 0,
  compositeCache: new Map(),
  touchPointers: new Map(),
  pinch: null,
  penActive: false,
  frameRenderGeneration: 0,
  thumbnailFrame: 0,
  paintRenderFrame: 0
};
const challengeUi = (key) => translateChallengeUi(state.language, key);

Object.defineProperty(state, "frames", {
  get() { return state.layers[state.activeLayer].frames; },
  set(frames) { state.layers[state.activeLayer].frames = frames; }
});

function createImage() {
  return new ImageData(state.width, state.height);
}

function invalidateComposite(frameIndex = null) {
  if (frameIndex === null) state.compositeCache.clear();
  else state.compositeCache.delete(frameIndex);
  state.previewDirty = true;
}

function cloneImage(image) {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

function resetProject(width, height) {
  state.width = width;
  state.height = height;
  state.layers = [{ name: `${t("layer")} 1`, visible: true, frames: [createImage()] }];
  state.activeLayer = 0;
  state.activeFrame = 0;
  state.previewFrame = 0;
  state.history = [];
  state.selection = null;
  state.activeChallenge = null;
  state.activeDailyDate = "";
  state.editorBuffer = null;
  invalidateComposite();
  state.projectId = crypto.randomUUID();
  canvas.width = width;
  canvas.height = height;
  previewCanvas.width = width;
  previewCanvas.height = height;
  fitZoom();
  render();
}

function saveHistory() {
  state.history.push({ frame: state.activeFrame, layer: state.activeLayer, image: cloneImage(state.frames[state.activeFrame]) });
  if (state.history.length > 50) state.history.shift();
}

function t(key) {
  return TRANSLATIONS[state.language]?.[key] || TRANSLATIONS.ru[key] || key;
}

function applyLanguage(language) {
  const currentName = $("#projectName")?.value;
  const usesDefaultName = Object.values(TRANSLATIONS).some((translation) => translation.untitledProject === currentName);
  state.language = TRANSLATIONS[language] ? language : "ru";
  document.documentElement.lang = state.language;
  $("#languageSelect").value = state.language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll(".tool[data-tool]").forEach((button) => {
    const label = t(TOOL_TRANSLATION_KEYS[button.dataset.tool] || button.dataset.tool);
    button.dataset.tooltip = label;
    button.dataset.key = button.querySelector("kbd")?.textContent || "";
    button.setAttribute("aria-label", `${label} (${button.dataset.key})`);
  });
  $("#importFile").dataset.tooltip = t("import");
  $("#importFile").setAttribute("aria-label", t("import"));
  $("#newProject").dataset.tooltip = t("newProject");
  $("#newProject").setAttribute("aria-label", t("newProject"));
  updatePlaybackControl();
  localStorage.setItem(STORAGE_KEYS.language, state.language);
  if (usesDefaultName) $("#projectName").value = t("untitledProject");
  renderLayers();
  renderChallengeList();
  renderChallengeRunner();
}

let projectController;
let challengeController;
let viewportController;
const editorController = createEditorController({
  $, state, canvas, ctx, gridCanvas, gridCtx, interactionCanvas,
  interactionCtx, brushCursor, toolCursorIcon, t, createImage, cloneImage,
  saveHistory, invalidateComposite, shapeTools: SHAPE_TOOLS,
  scheduleBrushCursor: (...args) => viewportController?.scheduleBrushCursor(...args),
  renderInteraction: (...args) => viewportController?.renderInteraction(...args),
  scheduleAutosave: () => projectController?.scheduleAutosave(),
  scheduleRecoverySnapshot: () => projectController?.scheduleRecoverySnapshot(),
  renderChallengeRunner: () => challengeController?.renderChallengeRunner()
});
const {
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
} = editorController;

projectController = createProjectController({
  $, state, t, invalidateComposite, canvas, previewCanvas,
  fitZoom: (...args) => viewportController?.fitZoom(...args),
  render, showToast
});
const {
  serializeProject,
  createBackup,
  scheduleRecoverySnapshot,
  renderBackups,
  restoreLastProject,
  exportProjectFile,
  importProjectFile,
  selectedProjectIds,
  deleteSelectedProjects,
  deleteAllProjects,
  scheduleAutosave,
  loadProject,
  renderRecentProjects
} = projectController;

challengeController = createChallengeController({
  $, state, t, challengeUi, resetProject, updateColorUi,
  render, compositeFrame, showToast
});
const {
  renderChallengeList,
  renderChallengeRunner,
  renderLargeChallengeReference,
  updateReferenceZoom,
  fitReferenceZoom,
  openChallengeReference,
  startChallenge,
  checkActiveChallenge,
  leaveChallenge,
  closeVictory
} = challengeController;

viewportController = createViewportController({
  $, state, canvas, gridCanvas, gridCtx, interactionCanvas,
  interactionCtx, brushCursor, toolCursorIcon, updateCanvasRect
});
const {
  fitZoom,
  renderBrushCursor,
  scheduleBrushCursor,
  renderGrid,
  renderInteraction,
  resizeCanvas,
  zoomCanvasAt
} = viewportController;

const importImage = createImageImporter({
  $, state, t, canvas, previewCanvas, invalidateComposite,
  fitZoom, render, showToast
});

bindAppEvents({
  $, state, canvas, palette: PALETTE, t,
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
});

let lastPreview = 0;
function animate(timestamp) {
  let shouldRender = state.previewDirty;
  if (state.playing && timestamp - lastPreview >= 1000 / state.fps) {
    state.previewFrame = (state.previewFrame + 1) % state.layers[0].frames.length;
    lastPreview = timestamp;
    shouldRender = true;
  }
  if (shouldRender) {
    previewCtx.clearRect(0, 0, state.width, state.height);
    previewCtx.putImageData(compositeFrame(state.previewFrame % state.layers[0].frames.length), 0, 0);
    state.previewDirty = false;
  }
  requestAnimationFrame(animate);
}

const detectedLanguage = navigator.language.slice(0, 2).toLowerCase();
state.language = localStorage.getItem(STORAGE_KEYS.language) || (TRANSLATIONS[detectedLanguage] ? detectedLanguage : "ru");
resetProject(32, 32);
applyLanguage(state.language);
updateColorUi(state.color);
$("#projectName").value = t("untitledProject");
setTool("pencil");
restoreLastProject();
window.addEventListener("beforeunload", () => {
  clearTimeout(state.recoveryTimer);
  try {
    writeStoredJson(STORAGE_KEYS.recovery, serializeProject());
  } catch { /* Best-effort shutdown snapshot. */ }
});
const canvasResizeObserver = new ResizeObserver(() => {
  if (state.autoFit) fitZoom();
});
canvasResizeObserver.observe($("#canvasWrap"));
requestAnimationFrame(animate);
