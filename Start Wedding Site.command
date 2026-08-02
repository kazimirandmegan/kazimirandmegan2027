#!/usr/bin/env bash
# Double-click on macOS (Finder) — opens Terminal and starts the site + tunnel.
cd "$(dirname "$0")"
exec bash "./scripts/bootstrap.sh"
