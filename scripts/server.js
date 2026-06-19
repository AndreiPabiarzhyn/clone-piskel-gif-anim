import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 8080);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(projectRoot, "public");
const sourceRoot = join(projectRoot, "src");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const isAsset = pathname.startsWith("/assets/");
  const root = isAsset ? sourceRoot : publicRoot;
  let requested = pathname === "/" ? "index.html" : pathname.slice(1);
  if (isAsset) {
    requested = pathname.slice(8);
    if (requested === "main.css") requested = "styles/main.css";
  }
  const filePath = normalize(join(root, requested));

  if (!(filePath === root || filePath.startsWith(`${root}\\`) || filePath.startsWith(`${root}/`)) ||
      !existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": types[extname(filePath)] || "application/octet-stream"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Pixel Motion is running at http://127.0.0.1:${port}`);
});
