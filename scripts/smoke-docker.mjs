import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { waitForOk } from "./smoke-http.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const required = process.argv.includes("--require") || process.env.CI === "true";
const name = `huayra-ci-${process.pid}`;
const image = `${name}:smoke`;
const hostPort = process.env.HUAYRA_SMOKE_PORT || "18080";
const probeKey = "huayra-smoke-key-should-not-leak";

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", cwd: root, ...opts });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(`${cmd} ${args.join(" ")} failed (${result.status}): ${detail}`);
  }
  return result;
}

function dockerAvailable() {
  const result = spawnSync("docker", ["info"], { encoding: "utf8" });
  return result.status === 0;
}

if (!dockerAvailable()) {
  if (required) {
    throw new Error("docker is required for smoke:docker");
  }
  process.stdout.write("smoke:docker skipped (docker not available)\n");
  process.exit(0);
}

try {
  run("docker", ["build", "-f", "packaging/Dockerfile", "-t", image, "."], { stdio: "inherit" });
  run("docker", [
    "run",
    "-d",
    "--name",
    name,
    "-p",
    `127.0.0.1:${hostPort}:8080`,
    "-e",
    `XAI_API_KEY=${probeKey}`,
    image,
  ]);
  const html = await waitForOk(`http://127.0.0.1:${hostPort}/`, {
    contains: "Huayra playground",
    timeoutMs: 30000,
  });
  const logs = run("docker", ["logs", name]);
  const combined = `${logs.stdout}${logs.stderr}`;
  if (combined.includes(probeKey)) {
    throw new Error("container logs leaked XAI_API_KEY");
  }
  process.stdout.write(`smoke:docker ok (${html.length} bytes)\n`);
} finally {
  spawnSync("docker", ["rm", "-f", name], { encoding: "utf8" });
}
