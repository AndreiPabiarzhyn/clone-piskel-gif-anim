export function createLayerController(deps) {
  const { $, state, t, createImage, invalidateComposite, render } = deps;

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
        const next = window.prompt(t("layerNamePrompt"), layer.name);
        if (next?.trim()) {
          layer.name = next.trim();
          render();
        }
      });
      const up = actionButton("m7 14 5-5 5 5", t("moveLayerUp"), index === state.layers.length - 1, () => {
        [state.layers[index], state.layers[index + 1]] = [state.layers[index + 1], state.layers[index]];
        state.activeLayer = index + 1;
      });
      const down = actionButton("m7 10 5 5 5-5", t("moveLayerDown"), index === 0, () => {
        [state.layers[index], state.layers[index - 1]] = [state.layers[index - 1], state.layers[index]];
        state.activeLayer = index - 1;
      });
      const remove = actionButton("M6 6 18 18M18 6 6 18", t("delete"), state.layers.length === 1, () => {
        state.layers.splice(index, 1);
        if (index < state.activeLayer) state.activeLayer -= 1;
        else state.activeLayer = Math.min(state.activeLayer, state.layers.length - 1);
      }, "layer-remove");
      item.append(visibility, name, up, down, remove);
      host.append(item);
    });
    $("#layersCount").textContent = state.layers.length;
  }

  function actionButton(path, title, disabled, mutate, className = "") {
    const button = document.createElement("button");
    button.className = `layer-action ${className}`.trim();
    button.innerHTML = `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.disabled = disabled;
    button.addEventListener("click", () => {
      if (button.disabled) return;
      mutate();
      invalidateComposite();
      render();
    });
    return button;
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

  return { renderLayers, addLayer };
}
