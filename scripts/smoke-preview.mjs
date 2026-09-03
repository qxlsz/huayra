import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { waitForOk } from "./smoke-http.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });
}

const build = spawn(process.execPath, ["scripts/build.mjs"], { cwd: root, stdio: "inherit" });
const [buildCode] = await once(build, "exit");
if (buildCode !== 0) {
  process.exit(buildCode ?? 1);
}

const port = await freePort();
const preview = spawn(process.execPath, ["scripts/preview.mjs", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "inherit",
});

const stop = () => {
  if (!preview.killed) {
    preview.kill("SIGTERM");
  }
};
process.on("exit", stop);

try {
  const html = await waitForOk(`http://127.0.0.1:${port}/`, { contains: "Huayra playground" });
  process.stdout.write(`smoke:preview ok (${html.length} bytes)\n`);
} finally {
  stop();
  await Promise.race([once(preview, "exit"), new Promise((resolve) => setTimeout(resolve, 1000))]);
}
