#!/usr/bin/env bash
# Finds or downloads Node, then runs the friendly start-local launcher.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
TOOLS="$ROOT/.tools"
NODE_VERSION="20.18.1"
mkdir -p "$TOOLS"

say() { printf '%s\n' "$*"; }
err() { printf '%s\n' "$*" >&2; }

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
    err "  We need curl or wget to finish setup."
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
    *) err "  This computer’s system isn’t supported yet ($os)."; return 1 ;;
  esac

  NODE_BIN="$TOOLS/$dist/bin/node"
  if [ -x "$NODE_BIN" ]; then
    export PATH="$TOOLS/$dist/bin:$PATH"
    return 0
  fi

  say "  … Borrowing a little toolkit for this computer (one-time setup)"
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
  say "  ✓ Toolkit ready"
}

main() {
  say ""
  say "  ♡  Kazimir & Megan — wedding site launcher"
  if system_node_ok; then
    :
  else
    ensure_portable_node
  fi

  if ! need_cmd node; then
    err "  We still couldn’t find Node.js. Install it from https://nodejs.org and try again."
    pause
    exit 1
  fi

  exec node "$ROOT/scripts/start-local.mjs"
}

trap 'ec=$?; if [ "$ec" -ne 0 ]; then pause; fi' EXIT
main "$@"
