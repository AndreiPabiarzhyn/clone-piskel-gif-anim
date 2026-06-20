export const PROJECT_FORMAT = "pixel-motion-project";
export const PROJECT_VERSION = 1;
export const PXM_EXTENSION = ".pxm";
export const PXM_MIME = "application/octet-stream";

const PXM_MAGIC = new Uint8Array([0x50, 0x58, 0x4d, 0x31]); // PXM1
const PXM_HEADER_SIZE = 44;
const PXM_FLAG_GZIP = 1;

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

async function transformBytes(bytes, format, decompress = false) {
  const Stream = decompress ? globalThis.DecompressionStream : globalThis.CompressionStream;
  if (!Stream) {
    if (decompress) throw new Error("PXM decompression is not available");
    return bytes;
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new Stream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is not available");
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
}

function bytesEqual(first, second) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

export async function encodeProjectBinary(project, appVersion = "1.0.0") {
  const source = new TextEncoder().encode(stringifyProject(project, appVersion));
  const canCompress = Boolean(globalThis.CompressionStream);
  const payload = canCompress ? await transformBytes(source, "gzip") : source;
  const checksum = await sha256(payload);
  const result = new Uint8Array(PXM_HEADER_SIZE + payload.length);
  result.set(PXM_MAGIC, 0);
  result[4] = canCompress ? PXM_FLAG_GZIP : 0;
  new DataView(result.buffer).setUint32(8, payload.length, true);
  result.set(checksum, 12);
  result.set(payload, PXM_HEADER_SIZE);
  return result;
}

export async function decodeProjectBinary(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < PXM_HEADER_SIZE || !bytesEqual(bytes.slice(0, 4), PXM_MAGIC)) {
    throw new Error("Unsupported PXM file");
  }
  const flags = bytes[4];
  if (flags & ~PXM_FLAG_GZIP) throw new Error("Unsupported PXM compression");
  const payloadLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8, true);
  if (payloadLength !== bytes.length - PXM_HEADER_SIZE) throw new Error("PXM file length is invalid");
  const expectedChecksum = bytes.slice(12, 44);
  const payload = bytes.slice(PXM_HEADER_SIZE);
  const actualChecksum = await sha256(payload);
  if (!bytesEqual(expectedChecksum, actualChecksum)) throw new Error("PXM checksum failed");
  const source = flags & PXM_FLAG_GZIP ? await transformBytes(payload, "gzip", true) : payload;
  return parseProject(new TextDecoder().decode(source));
}

export async function parseProjectFile(file) {
  const name = file.name?.toLowerCase() || "";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hasPXMHeader = bytes.length >= PXM_MAGIC.length &&
    bytesEqual(bytes.slice(0, PXM_MAGIC.length), PXM_MAGIC);
  if (name.endsWith(PXM_EXTENSION) || hasPXMHeader) return decodeProjectBinary(bytes);
  return parseProject(new TextDecoder().decode(bytes));
}
