#!/usr/bin/env bash
# Cross-platform bootstrap used by the double-click launchers (macOS + Linux).
# Finds or downloads Node, then runs scripts/start-local.mjs
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TOOLS="$ROOT/.tools"
NODE_VERSION="20.18.1"
mkdir -p "$TOOLS"

say() { printf '%s\n' "$*"; }
err() { printf 'ERROR: %s\n' "$*" >&2; }

pause() {
  printf '\nPress Enter to close…\n'
  # shellcheck disable=SC2034
  read -r _ || true
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

detect_arch() {
  local u
  u="$(uname -m)"
  case "$u" in
    arm64|aarch64) echo arm64 ;;
    x86_64|amd64) echo x64 ;;
    *) echo x64 ;;
  esac
}

system_node_ok() {
  if ! need_cmd node; then return 1; fi
  local major
  major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  [ "$major" -ge 18 ]
}

download() {
  local url="$1" dest="$2"
  if need_cmd curl; then
    curl -fsSL "$url" -o "$dest"
  elif need_cmd wget; then
    wget -qO "$dest" "$url"
  else
    err "Need curl or wget to download tools."
    return 1
  fi
}

ensure_portable_node() {
  local os arch dist url archive extract
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(detect_arch)"
  case "$os" in
    darwin) dist="node-v${NODE_VERSION}-darwin-${arch}" ;;
    linux) dist="node-v${NODE_VERSION}-linux-${arch}" ;;
    *) err "Unsupported OS: $os"; return 1 ;;
  esac

  NODE_BIN="$TOOLS/$dist/bin/node"
  if [ -x "$NODE_BIN" ]; then
    export PATH="$TOOLS/$dist/bin:$PATH"
    return 0
  fi

  say "Downloading portable Node.js ${NODE_VERSION} (one-time)…"
  url="https://nodejs.org/dist/v${NODE_VERSION}/${dist}.tar.gz"
  archive="$TOOLS/${dist}.tar.gz"
  download "$url" "$archive"
  extract="$TOOLS/_extract_node"
  rm -rf "$extract"
  mkdir -p "$extract"
  tar -xzf "$archive" -C "$extract"
  rm -f "$archive"
  rm -rf "$TOOLS/$dist"
  mv "$extract/$dist" "$TOOLS/$dist"
  rm -rf "$extract"
  chmod +x "$TOOLS/$dist/bin/node" || true
  export PATH="$TOOLS/$dist/bin:$PATH"
  NODE_BIN="$TOOLS/$dist/bin/node"
}

main() {
  say "Starting Kazimir & Megan wedding site…"
  if system_node_ok; then
    say "Found system Node $(node -v)"
  else
    say "No suitable Node.js on PATH — installing a portable copy into .tools/"
    ensure_portable_node
  fi

  if ! need_cmd node; then
    err "Node.js is still unavailable."
    pause
    exit 1
  fi

  # Run the full orchestrator (npm install + Vite + Cloudflare Tunnel)
  exec node "$ROOT/scripts/start-local.mjs"
}

trap 'ec=$?; if [ "$ec" -ne 0 ]; then pause; fi' EXIT
main "$@"
