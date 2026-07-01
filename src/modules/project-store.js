export const STORAGE_SCHEMA_VERSION = 3;

export const STORAGE_KEYS = {
  meta: "pixel-motion-storage-meta",
  projects: "pixel-motion-projects-v3",
  backups: "pixel-motion-backups-v3",
  recovery: "pixel-motion-recovery-v3",
  challenges: "pixel-motion-challenges-v3",
  language: "pixel-motion-language-v3"
};

const LEGACY_STORAGE_KEYS = {
  projects: ["pixel-motion-projects-v2", "pixel-motion-projects-v1"],
  backups: ["pixel-motion-backups-v1"],
  recovery: ["pixel-motion-recovery-v1"],
  challenges: ["pixel-motion-challenges-v1"],
  language: ["pixel-motion-language"]
};

function parseStoredValue(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function migrateStorage() {
  const meta = parseStoredValue(STORAGE_KEYS.meta, {});
  let migrated = meta.version !== STORAGE_SCHEMA_VERSION;

  for (const [name, legacyKeys] of Object.entries(LEGACY_STORAGE_KEYS)) {
    const currentKey = STORAGE_KEYS[name];
    if (localStorage.getItem(currentKey) !== null) continue;
    const legacyKey = legacyKeys.find((key) => localStorage.getItem(key) !== null);
    if (!legacyKey) continue;
    localStorage.setItem(currentKey, localStorage.getItem(legacyKey));
    migrated = true;
  }

  if (migrated) {
    localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({
      version: STORAGE_SCHEMA_VERSION,
      migratedAt: Date.now()
    }));
  }
  return migrated;
}

export function readStoredJson(key, fallback) {
  migrateStorage();
  return parseStoredValue(key, fallback);
}

export function writeStoredJson(key, value) {
  migrateStorage();
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
