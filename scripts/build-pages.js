import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(projectRoot, "dist");
const assetDirectories = ["challenges", "editor", "modules", "projects", "styles", "ui"];

await rm(distRoot, { recursive: true, force: true });
await mkdir(join(distRoot, "assets"), { recursive: true });

await Promise.all([
  cp(join(projectRoot, "public", "index.html"), join(distRoot, "index.html")),
  cp(join(projectRoot, "public", "favicon.svg"), join(distRoot, "favicon.svg")),
  cp(join(projectRoot, "src", "app.js"), join(distRoot, "assets", "app.js")),
  ...assetDirectories.map((directory) =>
    cp(join(projectRoot, "src", directory), join(distRoot, "assets", directory), { recursive: true })
  )
]);

console.log("GitHub Pages artifact created in dist/");
