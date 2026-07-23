#!/usr/bin/env node
/**
 * Fully automatic local launcher:
 *  1. Ensure Node 18+ (system or portable under .tools/)
 *  2. npm install
 *  3. Start Vite on a free port
 *  4. Start a Cloudflare quick tunnel → public https://*.trycloudflare.com URL
 *
 * Keep this window open while testing. Ctrl+C (or close the window) stops both.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  ROOT,
  TOOLS,
  resolveNode,
  ensureCloudflared,
  portableNodePaths,
} from "./ensure-tools.mjs";

const PREFERRED_PORT = 5173;
const URL_FILE = join(ROOT, ".tools", "public-url.txt");

function log(msg = "") {
  console.log(msg);
}

function banner(lines) {
  const width = Math.min(72, Math.max(40, ...lines.map((l) => l.length)) + 4);
  const bar = "═".repeat(width);
  log("");
  log(bar);
  for (const line of lines) log(`  ${line}`);
  log(bar);
  log("");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pathDelimiter() {
  return process.platform === "win32" ? ";" : ":";
}

function withNodeOnPath(nodeInfo, env = process.env) {
  const next = { ...env };
  if (!nodeInfo.portable) return next;
  const extra =
    process.platform === "win32"
      ? portableNodePaths().dir
      : join(portableNodePaths().dir, "bin");
  next.PATH = `${extra}${pathDelimiter()}${next.PATH || ""}`;
  return next;
}

async function waitForHttp(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok || res.status === 404) return true;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  return false;
}

function runNpmInstall(nodeInfo) {
  log("Installing project dependencies (npm install)…");
  let npmCmd = nodeInfo.npm;
  if (!npmCmd || !existsSync(npmCmd)) {
    npmCmd = portableNodePaths().npm;
  }
  if (!existsSync(npmCmd)) {
    throw new Error("npm not found — cannot install dependencies");
  }

  const env = withNodeOnPath(nodeInfo);
  if (process.platform === "win32") {
    execFileSync("cmd.exe", ["/c", npmCmd, "install"], {
      cwd: ROOT,
      stdio: "inherit",
      env,
    });
  } else {
    execFileSync(npmCmd, ["install"], {
      cwd: ROOT,
      stdio: "inherit",
      env,
    });
  }
  log("Dependencies ready.");
}

function startVite(nodeInfo) {
  const viteJs = join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const env = withNodeOnPath(nodeInfo);

  let child;
  if (existsSync(viteJs)) {
    child = spawn(
      nodeInfo.node,
      [viteJs, "--host", "0.0.0.0", "--port", String(PREFERRED_PORT)],
      { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] }
    );
  } else {
    const npx = nodeInfo.npx || portableNodePaths().npx;
    if (process.platform === "win32") {
      child = spawn(
        "cmd.exe",
        ["/c", npx, "vite", "--host", "0.0.0.0", "--port", String(PREFERRED_PORT)],
        { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] }
      );
    } else {
      child = spawn(
        npx,
        ["vite", "--host", "0.0.0.0", "--port", String(PREFERRED_PORT)],
        { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] }
      );
    }
  }

  let port = PREFERRED_PORT;
  let ready = false;
  const onData = (buf) => {
    const text = buf.toString();
    process.stdout.write(text);
    const m =
      text.match(
        /Local:\s+https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/i
      ) || text.match(/http:\/\/0\.0\.0\.0:(\d+)/i);
    if (m) {
      port = Number(m[1]);
      ready = true;
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  return {
    child,
    getPort: () => port,
    isReady: () => ready,
  };
}

function startTunnel(cloudflaredBin, port) {
  const child = spawn(
    cloudflaredBin,
    ["tunnel", "--url", `http://127.0.0.1:${port}`, "--no-autoupdate"],
    { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] }
  );

  let publicUrl = null;
  const tryParse = (buf) => {
    const text = buf.toString();
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (m && !publicUrl) publicUrl = m[0].replace(/\/$/, "");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (/trycloudflare\.com|ERR |error|failed|Registered|Connected|INF /i.test(line)) {
        console.log(`[tunnel] ${line.trim()}`);
      }
    }
  };
  child.stdout.on("data", tryParse);
  child.stderr.on("data", tryParse);

  return { child, getUrl: () => publicUrl };
}

async function waitFor(pred, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function openBrowser(url) {
  try {
    if (process.platform === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    } else if (process.platform === "win32") {
      spawn("cmd.exe", ["/c", "start", "", url], {
        stdio: "ignore",
        detached: true,
      }).unref();
    } else {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
    }
  } catch {
    /* ignore */
  }
}

function pauseOnError() {
  console.error("\nPress Enter to close…");
  try {
    if (process.platform === "win32") {
      execFileSync("cmd.exe", ["/c", "pause"], { stdio: "inherit" });
    } else if (process.stdin.isTTY) {
      execFileSync("bash", ["-c", "read -r _"], { stdio: "inherit" });
    }
  } catch {
    /* ignore */
  }
}

async function main() {
  process.chdir(ROOT);
  mkdirSync(TOOLS, { recursive: true });

  banner([
    "Kazimir & Megan — local site + Cloudflare Tunnel",
    "This window must stay open while you test.",
    "Press Ctrl+C to stop.",
  ]);

  const nodeInfo = await resolveNode(log);
  if (!nodeInfo.npm) {
    const paths = portableNodePaths();
    nodeInfo.npm = paths.npm;
    nodeInfo.npx = paths.npx;
  }

  runNpmInstall(nodeInfo);
  const cloudflaredBin = await ensureCloudflared(log);

  log("Starting local website (Vite)…");
  const vite = startVite(nodeInfo);

  try {
    await waitFor(() => vite.isReady(), 45000, "Vite to print its local URL");
  } catch {
    log("Vite did not print a Local URL yet — probing the default port…");
  }

  const port = vite.getPort();
  const localUrl = `http://127.0.0.1:${port}`;
  if (!(await waitForHttp(localUrl, 60000))) {
    vite.child.kill("SIGTERM");
    throw new Error(
      `Local site did not become ready at ${localUrl}. Check the messages above.`
    );
  }
  log(`Local site is up: ${localUrl}`);

  log("Opening Cloudflare Tunnel (public HTTPS URL)…");
  const tunnel = startTunnel(cloudflaredBin, port);
  await waitFor(() => !!tunnel.getUrl(), 90000, "Cloudflare public URL");
  const publicUrl = tunnel.getUrl();

  writeFileSync(
    URL_FILE,
    `${publicUrl}\nlocal=${localUrl}\nstarted=${new Date().toISOString()}\n`,
    "utf8"
  );

  banner([
    "READY — open either address:",
    "",
    `  Phone / any device:  ${publicUrl}`,
    `  This computer:       ${localUrl}`,
    "",
    "Sign in with the invitation password (see src/config/settings.js).",
    "The public link works only while this window stays open.",
    "URL also saved to: .tools/public-url.txt",
  ]);

  openBrowser(publicUrl);

  const shutdown = (signal) => {
    log(`\nStopping (${signal})…`);
    try {
      tunnel.child.kill("SIGTERM");
    } catch {}
    try {
      vite.child.kill("SIGTERM");
    } catch {}
    setTimeout(() => process.exit(0), 500);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  vite.child.on("exit", (code) => {
    log(`Vite exited (code ${code}).`);
    try {
      tunnel.child.kill("SIGTERM");
    } catch {}
    process.exit(code || 1);
  });
  tunnel.child.on("exit", (code) => {
    log(`Cloudflare Tunnel exited (code ${code}).`);
    try {
      vite.child.kill("SIGTERM");
    } catch {}
    process.exit(code || 1);
  });

  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    rl.on("line", () => {});
  }
}

main().catch((err) => {
  console.error("\nSomething went wrong:");
  console.error(err && err.stack ? err.stack : err);
  console.error(
    "\nIf this keeps happening, install Node.js 18+ from https://nodejs.org and try again."
  );
  pauseOnError();
  process.exit(1);
});
