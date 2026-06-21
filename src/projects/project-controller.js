import { addBackup, backupsForProject } from "../modules/backup-utils.js";
import { encodeProjectBinary, parseProjectFile, PXM_EXTENSION, PXM_MIME } from "../modules/project-format.js";
import {
  loadProjects,
  readStoredJson,
  removeProjects,
  saveRecentProject,
  STORAGE_KEYS,
  writeStoredJson
} from "../modules/project-store.js";

export function createProjectController(deps) {
  const {
    $, state, t, invalidateComposite, canvas, previewCanvas,
    fitZoom, render, showToast
  } = deps;

  function serializeProject() {
    return {
      id: state.projectId,
      name: $("#projectName").value.trim() || "Pixel Motion",
      width: state.width,
      height: state.height,
      fps: state.fps,
      updatedAt: Date.now(),
      layers: state.layers.map((layer) => ({
        name: layer.name,
        visible: layer.visible,
        frames: layer.frames.map((frame) => Array.from(frame.data))
      }))
    };
  }
  
  function getBackups() {
    return readStoredJson(STORAGE_KEYS.backups, []);
  }
  
  function createBackup(project = serializeProject(), force = false) {
    const now = Date.now();
    if (!force && now - state.backupAt < 60000) return;
    const backups = addBackup(getBackups(), project, now);
    try {
      writeStoredJson(STORAGE_KEYS.backups, backups);
      state.backupAt = now;
    } catch {
      // Autosave remains available even when the optional version history is full.
    }
  }
  
  function scheduleRecoverySnapshot() {
    clearTimeout(state.recoveryTimer);
    state.recoveryTimer = setTimeout(() => {
      try { writeStoredJson(STORAGE_KEYS.recovery, serializeProject()); }
      catch { /* Recovery is best-effort. */ }
    }, 800);
  }
  
  function renderBackups() {
    const host = $("#backupList");
    const backups = backupsForProject(getBackups(), state.projectId);
    host.innerHTML = "";
    if (!backups.length) {
      host.innerHTML = `<p class="backup-empty">${t("noBackups")}</p>`;
      return;
    }
    backups.forEach((backup) => {
      const item = document.createElement("article");
      item.className = "backup-item";
      const copy = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = backup.name;
      const date = document.createElement("small");
      date.textContent = new Date(backup.createdAt).toLocaleString(state.language);
      copy.append(name, date);
      const restore = document.createElement("button");
      restore.className = "primary";
      restore.textContent = t("restoreVersion");
      restore.addEventListener("click", () => {
        createBackup(serializeProject(), true);
        loadProject(structuredClone(backup.project));
        $("#backupsDialog").close();
        showToast(t("restoreRecovery"));
      });
      item.append(copy, restore);
      host.append(item);
    });
  }
  
  function restoreLastProject() {
    const recovery = readStoredJson(STORAGE_KEYS.recovery, null);
    if (!recovery?.layers?.length) return false;
    try {
      loadProject(recovery);
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEYS.recovery);
      return false;
    }
  }
  
  function safeFileName(value) {
    return value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-|-$/g, "") || "pixel-motion";
  }
  
  async function exportProjectFile() {
    const bytes = await encodeProjectBinary(serializeProject(), "1.0.0");
    const blob = new Blob([bytes], { type: PXM_MIME });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeFileName($("#projectName").value)}${PXM_EXTENSION}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast(t("projectExported"));
  }
  
  async function importProjectFile(file) {
    const project = await parseProjectFile(file);
    project.id = crypto.randomUUID();
    project.updatedAt = Date.now();
    loadProject(project);
    scheduleAutosave();
    showToast(t("projectImported"));
  }
  
  function getProjects() {
    return loadProjects();
  }
  
  const selectedProjectIds = new Set();
  
  function removeProjectData(projectIds) {
    const ids = new Set(projectIds);
    removeProjects(ids);
    ids.forEach((id) => selectedProjectIds.delete(id));
    if (ids.has(state.projectId)) state.projectId = crypto.randomUUID();
  }
  
  function updateProjectSelectionUi(visibleProjects = null) {
    const count = selectedProjectIds.size;
    $("#selectedProjectsCount").value = `${count} ${t("selectedProjects")}`;
    $("#selectedProjectsCount").textContent = `${count} ${t("selectedProjects")}`;
    $("#deleteSelectedProjects").disabled = count === 0;
    const visible = visibleProjects || [...document.querySelectorAll(".project-card")].map((card) => card.dataset.projectId);
    const selectedVisible = visible.filter((id) => selectedProjectIds.has(id)).length;
    const selectAll = $("#selectAllProjects");
    selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }
  
  function deleteSelectedProjects() {
    if (!selectedProjectIds.size || !window.confirm(t("confirmDeleteSelected"))) return;
    clearTimeout(state.saveTimer);
    removeProjectData(selectedProjectIds);
    renderRecentProjects();
    showToast(t("projectsDeleted"));
  }
  
  function deleteAllProjects() {
    const projects = getProjects();
    if (!projects.length || !window.confirm(t("confirmDeleteAll"))) return;
    clearTimeout(state.saveTimer);
    removeProjectData(projects.map((project) => project.id));
    selectedProjectIds.clear();
    renderRecentProjects();
    showToast(t("projectsDeleted"));
  }
  
  function scheduleAutosave() {
    scheduleRecoverySnapshot();
    clearTimeout(state.saveTimer);
    if (state.saveIdle && "cancelIdleCallback" in window) cancelIdleCallback(state.saveIdle);
    state.saveTimer = setTimeout(() => {
      const save = () => {
        state.saveIdle = null;
        const project = serializeProject();
        try { saveRecentProject(project); }
        catch { showToast("Недостаточно места для автосохранения"); }
        createBackup(project);
      };
      if ("requestIdleCallback" in window) state.saveIdle = requestIdleCallback(save, { timeout: 1500 });
      else save();
    }, 500);
  }
  
  function loadProject(project) {
    state.activeChallenge = null;
    state.width = project.width;
    state.height = project.height;
    state.fps = project.fps || 8;
    state.projectId = project.id;
    state.layers = project.layers.map((layer) => ({
      name: layer.name,
      visible: layer.visible,
      frames: layer.frames.map((data) => new ImageData(new Uint8ClampedArray(data), project.width, project.height))
    }));
    state.activeLayer = 0;
    state.activeFrame = 0;
    state.editorBuffer = null;
    invalidateComposite();
    canvas.width = state.width;
    canvas.height = state.height;
    previewCanvas.width = state.width;
    previewCanvas.height = state.height;
    $("#projectName").value = project.name;
    $("#fpsRange").value = state.fps;
    $("#fpsValue").value = `${state.fps} FPS`;
    fitZoom();
    render();
  }
  
  function renderRecentProjects() {
    const host = $("#recentProjects");
    const empty = $("#projectsEmpty");
    host.innerHTML = "";
    empty.hidden = true;
    const query = ($("#projectSearch")?.value || "").trim().toLocaleLowerCase(state.language);
    const sort = $("#projectSort")?.value || "recent";
    const allProjects = getProjects();
    const projects = allProjects
      .filter((project) => project.name.toLocaleLowerCase(state.language).includes(query))
      .sort((first, second) => sort === "name"
        ? first.name.localeCompare(second.name, state.language)
        : (second.updatedAt || 0) - (first.updatedAt || 0));
    const knownIds = new Set(allProjects.map((project) => project.id));
    [...selectedProjectIds].forEach((id) => {
      if (!knownIds.has(id)) selectedProjectIds.delete(id);
    });
    $("#projectsCount").value = `${projects.length} / ${allProjects.length}`;
    $("#projectsCount").textContent = `${projects.length} / ${allProjects.length}`;
    $("#deleteAllProjects").disabled = allProjects.length === 0;
    if (!projects.length) {
      empty.textContent = allProjects.length ? t("noProjectMatches") : t("noProjects");
      empty.hidden = false;
      updateProjectSelectionUi([]);
      return;
    }
    projects.forEach((project) => {
      const card = document.createElement("div");
      card.className = `project-card${selectedProjectIds.has(project.id) ? " selected" : ""}`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.dataset.projectId = project.id;
      const selector = document.createElement("label");
      selector.className = "project-selector";
      selector.title = t("selectAllProjects");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selectedProjectIds.has(project.id);
      checkbox.setAttribute("aria-label", `${t("selectAllProjects")}: ${project.name}`);
      const checkmark = document.createElement("span");
      selector.append(checkbox, checkmark);
      selector.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedProjectIds.add(project.id);
        else selectedProjectIds.delete(project.id);
        card.classList.toggle("selected", checkbox.checked);
        updateProjectSelectionUi(projects.map((item) => item.id));
      });
      const thumb = document.createElement("canvas");
      thumb.width = project.width;
      thumb.height = project.height;
      const topLayer = project.layers.at(-1);
      if (topLayer?.frames[0]) thumb.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(topLayer.frames[0]), project.width, project.height), 0, 0);
      const title = document.createElement("strong");
      title.textContent = project.name;
      const date = document.createElement("small");
      date.textContent = new Date(project.updatedAt).toLocaleString(state.language);
      card.append(selector, thumb, title, date);
      const openProject = () => {
        loadProject(project);
        $("#projectsDialog").close();
      };
      card.addEventListener("click", openProject);
      card.addEventListener("keydown", (event) => {
        if (event.target !== card) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject();
        }
      });
      host.append(card);
    });
    updateProjectSelectionUi(projects.map((project) => project.id));
  }

  return {
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
  };
}
