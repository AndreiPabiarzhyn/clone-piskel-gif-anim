export const STORAGE_KEYS = {
  projects: "pixel-motion-projects-v2",
  backups: "pixel-motion-backups-v1",
  recovery: "pixel-motion-recovery-v1",
  challenges: "pixel-motion-challenges-v1",
  language: "pixel-motion-language"
};

export function readStoredJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadProjects() {
  return readStoredJson(STORAGE_KEYS.projects, []);
}

export function saveRecentProject(project, limit = 24) {
  const projects = loadProjects().filter((item) => item.id !== project.id);
  projects.unshift(project);
  writeStoredJson(STORAGE_KEYS.projects, projects.slice(0, limit));
  return projects.slice(0, limit);
}

export function removeProjects(projectIds) {
  const ids = new Set(projectIds);
  const projects = loadProjects().filter((project) => !ids.has(project.id));
  const backups = readStoredJson(STORAGE_KEYS.backups, []).filter((backup) => !ids.has(backup.projectId));
  writeStoredJson(STORAGE_KEYS.projects, projects);
  writeStoredJson(STORAGE_KEYS.backups, backups);
  return { projects, backups };
}

export function loadChallengeProgress(normalize) {
  return normalize(readStoredJson(STORAGE_KEYS.challenges, {}));
}
