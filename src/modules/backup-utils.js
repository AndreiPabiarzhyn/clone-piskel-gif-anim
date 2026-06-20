export const MAX_BACKUPS_PER_PROJECT = 8;

export function projectFingerprint(project) {
  let hash = 2166136261;
  const update = (value) => {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  };
  for (const layer of project.layers) {
    update(layer.visible ? 1 : 0);
    for (const frame of layer.frames) {
      const step = Math.max(1, Math.floor(frame.length / 8192));
      for (let index = 0; index < frame.length; index += step) update(frame[index]);
    }
  }
  update(project.width);
  update(project.height);
  update(project.fps);
  return (hash >>> 0).toString(36);
}

export function addBackup(backups, project, createdAt = Date.now(), limit = MAX_BACKUPS_PER_PROJECT) {
  const fingerprint = projectFingerprint(project);
  const projectBackups = backups.filter((backup) => backup.projectId === project.id);
  if (projectBackups[0]?.fingerprint === fingerprint) return backups;
  const backup = {
    id: `${project.id}-${createdAt}`,
    projectId: project.id,
    name: project.name,
    createdAt,
    fingerprint,
    project
  };
  const others = backups.filter((item) => item.projectId !== project.id);
  return [backup, ...projectBackups].slice(0, limit).concat(others);
}

export function backupsForProject(backups, projectId) {
  return backups
    .filter((backup) => backup.projectId === projectId)
    .sort((first, second) => second.createdAt - first.createdAt);
}
