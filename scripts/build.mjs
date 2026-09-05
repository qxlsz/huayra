import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await mkdir(dist, { recursive: true });
await copyFile(join(root, "playground", "index.html"), join(dist, "index.html"));
