import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await mkdir(dist, { recursive: true });
await copyFile(join(root, "playground", "index.html"), join(dist, "index.html"));
await copyFile(join(root, "playground", "app.js"), join(dist, "app.js"));
await copyFile(join(root, "playground", "app-part-0.js"), join(dist, "app-part-0.js"));
await copyFile(join(root, "playground", "app-part-1.js"), join(dist, "app-part-1.js"));
await copyFile(join(root, "playground", "app-part-2.js"), join(dist, "app-part-2.js"));
await copyFile(join(root, "playground", "session-sync.js"), join(dist, "session-sync.js"));
