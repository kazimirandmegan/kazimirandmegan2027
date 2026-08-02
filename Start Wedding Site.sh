#!/usr/bin/env bash
# Double-click / run on Linux — starts the site + Cloudflare Tunnel.
cd "$(dirname "$0")"
exec bash "./scripts/bootstrap.sh"
