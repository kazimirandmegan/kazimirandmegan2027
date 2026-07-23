/**
 * Ensure portable Node.js + cloudflared exist under .tools/
 * Used by the double-click launchers when the system has no Node yet,
 * and by start-local.mjs for cloudflared.
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  chmodSync,
  renameSync,
  rmSync,
  copyFileSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFileSync, spawnSync } from "node:child_process";
import { createGunzip } from "node:zlib";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..");
export const TOOLS = join(ROOT, ".tools");

export const NODE_VERSION = "20.18.1";

export function detectPlatform() {
  const platform = process.platform; // darwin | linux | win32
  let arch = process.arch; // x64 | arm64 | ia32
  if (arch === "ia32") arch = "x64"; // we only ship x64 for win32 ia32 fallbacks
  return { platform, arch };
}

function nodeDistName({ platform, arch }) {
  if (platform === "win32") {
    return `node-v${NODE_VERSION}-win-x64`;
  }
  if (platform === "darwin") {
    const a = arch === "arm64" ? "arm64" : "x64";
    return `node-v${NODE_VERSION}-darwin-${a}`;
  }
  // linux
  const a = arch === "arm64" ? "arm64" : "x64";
  return `node-v${NODE_VERSION}-linux-${a}`;
}

function nodeDownloadUrl(distName, { platform }) {
  const ext = platform === "win32" ? "zip" : "tar.gz";
  return `https://nodejs.org/dist/v${NODE_VERSION}/${distName}.${ext}`;
}

export function portableNodePaths() {
  const { platform, arch } = detectPlatform();
  const dist = nodeDistName({ platform, arch });
  if (platform === "win32") {
    return {
      dir: join(TOOLS, dist),
      node: join(TOOLS, dist, "node.exe"),
      npm: join(TOOLS, dist, "npm.cmd"),
      npx: join(TOOLS, dist, "npx.cmd"),
      dist,
      platform,
      arch,
    };
  }
  return {
    dir: join(TOOLS, dist),
    node: join(TOOLS, dist, "bin", "node"),
    npm: join(TOOLS, dist, "bin", "npm"),
    npx: join(TOOLS, dist, "bin", "npx"),
    dist,
    platform,
    arch,
  };
}

export function cloudflaredPath() {
  const { platform, arch } = detectPlatform();
  if (platform === "win32") return join(TOOLS, "cloudflared.exe");
  return join(TOOLS, "cloudflared");
}

function cloudflaredDownload({ platform, arch }) {
  const base =
    "https://github.com/cloudflare/cloudflared/releases/latest/download";
  if (platform === "win32") {
    return {
      url: `${base}/cloudflared-windows-amd64.exe`,
      kind: "bin",
    };
  }
  if (platform === "darwin") {
    const a = arch === "arm64" ? "arm64" : "amd64";
    return {
      url: `${base}/cloudflared-darwin-${a}.tgz`,
      kind: "tgz",
    };
  }
  const a = arch === "arm64" ? "arm64" : "amd64";
  return {
    url: `${base}/cloudflared-linux-${a}`,
    kind: "bin",
  };
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function which(cmd) {
  const finder = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(finder, [cmd], { encoding: "utf8" });
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || null;
}

export function findSystemNode() {
  const node = which("node");
  if (!node) return null;
  try {
    const v = execFileSync(node, ["-p", "process.versions.node"], {
      encoding: "utf8",
    }).trim();
    const major = Number(v.split(".")[0]);
    if (major < 18) return null;
    return { node, version: v };
  } catch {
    return null;
  }
}

export function findSystemCloudflared() {
  return which("cloudflared");
}

function extractTarGz(archive, destDir) {
  mkdirSync(destDir, { recursive: true });
  execFileSync("tar", ["-xzf", archive, "-C", destDir], { stdio: "inherit" });
}

function extractZip(archive, destDir) {
  mkdirSync(destDir, { recursive: true });
  if (process.platform === "win32") {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${archive.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "inherit" }
    );
    return;
  }
  // unzip if available
  execFileSync("unzip", ["-o", archive, "-d", destDir], { stdio: "inherit" });
}

export async function ensurePortableNode(log = console.log) {
  const paths = portableNodePaths();
  if (existsSync(paths.node)) {
    log(`Using portable Node at ${paths.node}`);
    return paths;
  }

  mkdirSync(TOOLS, { recursive: true });
  const url = nodeDownloadUrl(paths.dist, paths);
  const tmp = join(
    tmpdir(),
    `km-node-${Date.now()}.${paths.platform === "win32" ? "zip" : "tar.gz"}`
  );
  log(`Downloading Node.js ${NODE_VERSION}…`);
  log(url);
  await download(url, tmp);

  const extractRoot = join(TOOLS, "_extract_node");
  rmSync(extractRoot, { recursive: true, force: true });
  mkdirSync(extractRoot, { recursive: true });

  if (paths.platform === "win32") {
    extractZip(tmp, extractRoot);
  } else {
    extractTarGz(tmp, extractRoot);
  }
  rmSync(tmp, { force: true });

  const extracted = join(extractRoot, paths.dist);
  if (!existsSync(extracted)) {
    throw new Error(`Node extract missing expected folder: ${extracted}`);
  }
  rmSync(paths.dir, { recursive: true, force: true });
  renameSync(extracted, paths.dir);
  rmSync(extractRoot, { recursive: true, force: true });

  if (paths.platform !== "win32") {
    chmodSync(paths.node, 0o755);
  }
  log(`Node ready: ${paths.node}`);
  return paths;
}

export async function ensureCloudflared(log = console.log) {
  const system = findSystemCloudflared();
  if (system) {
    log(`Using system cloudflared: ${system}`);
    return system;
  }

  const dest = cloudflaredPath();
  if (existsSync(dest)) {
    log(`Using portable cloudflared: ${dest}`);
    return dest;
  }

  mkdirSync(TOOLS, { recursive: true });
  const { platform, arch } = detectPlatform();
  const spec = cloudflaredDownload({ platform, arch });
  log("Downloading Cloudflare Tunnel (cloudflared)…");
  log(spec.url);

  if (spec.kind === "bin") {
    const tmp = dest + ".partial";
    await download(spec.url, tmp);
    renameSync(tmp, dest);
    if (platform !== "win32") chmodSync(dest, 0o755);
  } else {
    const tmp = join(tmpdir(), `km-cf-${Date.now()}.tgz`);
    await download(spec.url, tmp);
    const extractRoot = join(TOOLS, "_extract_cf");
    rmSync(extractRoot, { recursive: true, force: true });
    mkdirSync(extractRoot, { recursive: true });
    execFileSync("tar", ["-xzf", tmp, "-C", extractRoot], { stdio: "inherit" });
    rmSync(tmp, { force: true });
    // tarball usually contains a single `cloudflared` binary
    const candidate = join(extractRoot, "cloudflared");
    if (!existsSync(candidate)) {
      throw new Error("cloudflared binary not found inside download");
    }
    copyFileSync(candidate, dest);
    chmodSync(dest, 0o755);
    rmSync(extractRoot, { recursive: true, force: true });
  }

  log(`cloudflared ready: ${dest}`);
  return dest;
}

export async function resolveNode(log = console.log) {
  const system = findSystemNode();
  if (system) {
    log(`Using system Node ${system.version}: ${system.node}`);
    return {
      node: system.node,
      npm:
        process.platform === "win32"
          ? which("npm.cmd") || which("npm")
          : which("npm"),
      npx:
        process.platform === "win32"
          ? which("npx.cmd") || which("npx")
          : which("npx"),
      portable: false,
    };
  }
  log("No suitable system Node found (need 18+). Installing a portable copy…");
  const paths = await ensurePortableNode(log);
  return {
    node: paths.node,
    npm: paths.npm,
    npx: paths.npx,
    portable: true,
  };
}
