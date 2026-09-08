import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const playground = join(root, "playground");

await mkdir(dist, { recursive: true });
await copyFile(join(playground, "index.html"), join(dist, "index.html"));
await copyFile(join(playground, "app.js"), join(dist, "app.js"));
await copyFile(join(playground, "session-sync.js"), join(dist, "session-sync.js"));
for (const name of await readdir(playground)) {
  if (name === "index.html" || name === "app.js" || name === "session-sync.js") continue;
  if (name.endsWith(".js") || name.endsWith(".css") || name.endsWith(".svg")) {
    await copyFile(join(playground, name), join(dist, name));
  }
}
