import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(projectRoot, "dist");

await rm(distRoot, { recursive: true, force: true });
await mkdir(join(distRoot, "assets", "modules"), { recursive: true });

await Promise.all([
  cp(join(projectRoot, "public", "index.html"), join(distRoot, "index.html")),
  cp(join(projectRoot, "src", "app.js"), join(distRoot, "assets", "app.js")),
  cp(join(projectRoot, "src", "styles", "main.css"), join(distRoot, "assets", "main.css")),
  cp(join(projectRoot, "src", "modules"), join(distRoot, "assets", "modules"), { recursive: true })
]);

console.log("GitHub Pages artifact created in dist/");
