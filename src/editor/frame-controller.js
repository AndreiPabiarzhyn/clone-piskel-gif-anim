import { reorderFrameCollections } from "../modules/frame-utils.js";
import { frameInsertionIndex } from "../modules/selection-utils.js";

export function createFrameController(deps) {
  const {
    $, state, t, cloneImage, createImage, compositeFrame, invalidateComposite,
    saveHistory, showToast, render
  } = deps;

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
      button.title = `${t("frameLabel")} ${index + 1}`;
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
        document.querySelectorAll(".frame").forEach((frame) =>
          frame.classList.remove("dragging", "drop-before", "drop-after")
        );
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

  function addFrame(copy = false) {
    state.layers.forEach((layer) => {
      const source = layer.frames[state.activeFrame];
      layer.frames.splice(state.activeFrame + 1, 0, copy ? cloneImage(source) : createImage());
    });
    state.activeFrame += 1;
    state.selection = null;
    invalidateComposite();
    render();
    document.querySelector(`.frame[data-frame-index="${state.activeFrame}"]`)?.scrollIntoView({
      behavior: "smooth", block: "nearest", inline: "nearest"
    });
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
    document.querySelector(`.frame[data-frame-index="${to}"]`)?.scrollIntoView({
      behavior: "smooth", block: "nearest"
    });
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
    document.querySelector(`.frame[data-frame-index="${insertion}"]`)?.scrollIntoView({
      behavior: "smooth", block: "nearest"
    });
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

  return {
    renderFrames,
    addFrame,
    copyWholeFrame,
    pasteWholeFrame,
    clearFrame
  };
}
