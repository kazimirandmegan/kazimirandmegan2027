#!/usr/bin/env node
/**
 * Friendly launcher: quiet tooling, warm progress lines, clear public URL.
 * Keep this window open while testing. Ctrl+C stops everything.
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

const TIPS = [
  "Polishing the hydrangeas…",
  "Warming the wax seal…",
  "Teaching Connie a few new jokes…",
  "Counting sleeps until May 2027…",
  "Folding tiny paper aeroplanes for the guest atlas…",
  "Asking Kiko to stop eating the RSVP cards…",
  "Ironing a vyshyvanka (metaphorically)…",
  "Checking the last train times, just in case…",
  "Plumping the guestbook cushions…",
  "Whispering budmo to the servers…",
];

function log(msg = "") {
  console.log(msg);
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

function friendlyLog(msg) {
  if (/Using system Node/i.test(msg)) {
    log("  ✓ Found everything we need to run the site");
    return;
  }
  if (/No suitable system Node|Installing a portable|Downloading Node/i.test(msg)) {
    log("  … Borrowing a little toolkit for this computer (one-time setup)");
    return;
  }
  if (/Node ready|Using portable Node/i.test(msg)) {
    log("  ✓ Toolkit ready");
    return;
  }
  if (/Downloading Cloudflare|Downloading.*cloudflared/i.test(msg)) {
    log("  … Fetching the magic tunnel (one-time setup)");
    return;
  }
  if (/cloudflared ready|Using system cloudflared|Using portable cloudflared/i.test(msg)) {
    log("  ✓ Tunnel tools ready");
    return;
  }
  if (/^https?:\/\//i.test(String(msg).trim())) return;
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
  log("  … Gathering the party supplies");
  let npmCmd = nodeInfo.npm;
  if (!npmCmd || !existsSync(npmCmd)) npmCmd = portableNodePaths().npm;
  if (!existsSync(npmCmd)) {
    throw new Error(
      "We couldn’t find the package installer. Try installing Node.js from https://nodejs.org and run this again."
    );
  }

  const env = withNodeOnPath(nodeInfo);
  const npmArgs = ["install", "--no-fund", "--no-audit", "--loglevel=error"];
  try {
    if (process.platform === "win32") {
      execFileSync("cmd.exe", ["/c", npmCmd, ...npmArgs], {
        cwd: ROOT,
        stdio: ["ignore", "ignore", "pipe"],
        env,
      });
    } else {
      execFileSync(npmCmd, npmArgs, {
        cwd: ROOT,
        stdio: ["ignore", "ignore", "pipe"],
        env,
      });
    }
  } catch (err) {
    const detail = err.stderr ? String(err.stderr).trim() : "";
    throw new Error(
      detail
        ? `Couldn’t finish setting up packages.\n${detail.slice(0, 400)}`
        : "Couldn’t finish setting up packages. Check your internet connection and try again."
    );
  }
  log("  ✓ Party supplies gathered");
}

function startVite(nodeInfo) {
  const viteJs = join(ROOT, "node_modules", "vite", "bin", "vite.js");
  const env = withNodeOnPath(nodeInfo);

  let child;
  const viteArgs = ["--host", "0.0.0.0", "--port", String(PREFERRED_PORT)];
  if (existsSync(viteJs)) {
    child = spawn(nodeInfo.node, [viteJs, ...viteArgs], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } else {
    const npx = nodeInfo.npx || portableNodePaths().npx;
    if (process.platform === "win32") {
      child = spawn("cmd.exe", ["/c", npx, "vite", ...viteArgs], {
        cwd: ROOT,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      child = spawn(npx, ["vite", ...viteArgs], {
        cwd: ROOT,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  }

  let port = PREFERRED_PORT;
  let ready = false;
  const onData = (buf) => {
    const text = buf.toString();
    const m = text.match(/Local:\s+https?:\/\/[^:\s]+:(\d+)/i);
    if (m) {
      port = Number(m[1]);
      ready = true;
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  return { child, getPort: () => port, isReady: () => ready };
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
  };
  child.stdout.on("data", tryParse);
  child.stderr.on("data", tryParse);

  return { child, getUrl: () => publicUrl };
}

async function waitWithTips(pred, timeoutMs, heading) {
  log(`  … ${heading}`);
  const start = Date.now();
  let tipIndex = 0;
  let lastTipAt = 0;
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    const now = Date.now();
    if (now - lastTipAt > 2800) {
      log(`     ${TIPS[tipIndex % TIPS.length]}`);
      tipIndex += 1;
      lastTipAt = now;
    }
    await sleep(350);
  }
  throw new Error(`This step took too long (${heading}). Please try again.`);
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

function printReady(publicUrl, localUrl) {
  const line = "═".repeat(64);
  log("");
  log(line);
  log("");
  log("  YOU'RE ALL SET — the wedding site is live for testing");
  log("");
  log("  Open this link on ANY device (phone, tablet, laptop, anywhere):");
  log("");
  log(`      ${publicUrl}`);
  log("");
  log("  Copy that address into Safari, Chrome, or any browser.");
  log("  It works on other Wi‑Fi networks and on mobile data too.");
  log("");
  log(`  (On this computer only, you can also use: ${localUrl})`);
  log("");
  log("  Sign in with the invitation password from your invite.");
  log("  (Passwords live in src/config/settings.js if you need a reminder.)");
  log("");
  log("  Keep THIS window open while you browse.");
  log("  Closing it (or pressing Ctrl+C) turns the public link off.");
  log("");
  log(line);
  log("");
}

async function main() {
  process.chdir(ROOT);
  mkdirSync(TOOLS, { recursive: true });

  log("");
  log("  ♡  Kazimir & Megan — wedding site launcher");
  log("  A little setup, then a link you can open anywhere.");
  log("");

  const nodeInfo = await resolveNode(friendlyLog);
  if (!nodeInfo.npm) {
    const paths = portableNodePaths();
    nodeInfo.npm = paths.npm;
    nodeInfo.npx = paths.npx;
  }

  runNpmInstall(nodeInfo);
  const cloudflaredBin = await ensureCloudflared(friendlyLog);

  log("  … Lighting the candles (starting the website)");
  const vite = startVite(nodeInfo);

  try {
    await waitWithTips(
      () => vite.isReady(),
      45000,
      "Waiting for the site to wake up"
    );
  } catch {
    /* HTTP probe below */
  }

  const port = vite.getPort();
  const localUrl = `http://127.0.0.1:${port}`;
  if (!(await waitForHttp(localUrl, 60000))) {
    try {
      vite.child.kill("SIGTERM");
    } catch {}
    throw new Error(
      "The website didn’t start in time. Close other copies of this launcher and try again."
    );
  }
  log("  ✓ Website is awake on this computer");

  log("  … Opening a door to the internet");
  const tunnel = startTunnel(cloudflaredBin, port);
  await waitWithTips(
    () => !!tunnel.getUrl(),
    90000,
    "Creating your shareable link"
  );
  const publicUrl = tunnel.getUrl();

  writeFileSync(
    URL_FILE,
    `${publicUrl}\nlocal=${localUrl}\nstarted=${new Date().toISOString()}\n`,
    "utf8"
  );

  printReady(publicUrl, localUrl);
  openBrowser(publicUrl);

  const shutdown = () => {
    log("");
    log("  Closing the site and the public link. Goodbye for now.");
    log("");
    try {
      tunnel.child.kill("SIGTERM");
    } catch {}
    try {
      vite.child.kill("SIGTERM");
    } catch {}
    setTimeout(() => process.exit(0), 400);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  vite.child.on("exit", () => {
    try {
      tunnel.child.kill("SIGTERM");
    } catch {}
    process.exit(1);
  });
  tunnel.child.on("exit", () => {
    try {
      vite.child.kill("SIGTERM");
    } catch {}
    process.exit(1);
  });

  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    rl.on("line", () => {});
  }
}

main().catch((err) => {
  console.error("");
  console.error("  Something didn’t work — sorry about that.");
  console.error(`  ${err && err.message ? err.message : err}`);
  console.error("");
  console.error("  Tip: install Node.js 18+ from https://nodejs.org and try again.");
  console.error("");
  pauseOnError();
  process.exit(1);
});
