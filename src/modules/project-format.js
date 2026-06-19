export const PROJECT_FORMAT = "pixel-motion-project";
export const PROJECT_VERSION = 1;

function integerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export function validateProjectDocument(document) {
  if (!document || typeof document !== "object") throw new Error("Invalid project document");
  if (document.format !== PROJECT_FORMAT) throw new Error("Unsupported project format");
  if (document.version !== PROJECT_VERSION) throw new Error(`Unsupported project version: ${document.version}`);

  const project = document.project;
  if (!project || typeof project !== "object") throw new Error("Project data is missing");
  if (!integerInRange(project.width, 1, 128) || !integerInRange(project.height, 1, 128)) {
    throw new Error("Canvas dimensions must be between 1 and 128 pixels");
  }
  if (!integerInRange(project.fps, 1, 60)) throw new Error("FPS must be between 1 and 60");
  if (!Array.isArray(project.layers) || project.layers.length < 1 || project.layers.length > 64) {
    throw new Error("Project must contain between 1 and 64 layers");
  }

  const expectedPixels = project.width * project.height * 4;
  const frameCount = project.layers[0]?.frames?.length;
  if (!integerInRange(frameCount, 1, 1000)) throw new Error("Project must contain between 1 and 1000 frames");

  project.layers.forEach((layer) => {
    if (!layer || typeof layer !== "object" || !Array.isArray(layer.frames) || layer.frames.length !== frameCount) {
      throw new Error("Every layer must contain the same number of frames");
    }
    layer.frames.forEach((frame) => {
      if (!Array.isArray(frame) || frame.length !== expectedPixels || frame.some((value) => !integerInRange(value, 0, 255))) {
        throw new Error("Frame pixel data is invalid");
      }
    });
  });
  return project;
}

export function createProjectDocument(project, appVersion = "1.0.0") {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    app: { name: "Pixel Motion", version: appVersion },
    exportedAt: new Date().toISOString(),
    project
  };
}

export function stringifyProject(project, appVersion) {
  const document = createProjectDocument(project, appVersion);
  validateProjectDocument(document);
  return JSON.stringify(document);
}

export function parseProject(text) {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("Project file is not valid JSON");
  }
  return validateProjectDocument(document);
}
