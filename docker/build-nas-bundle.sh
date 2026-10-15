#!/usr/bin/env bash
# Build the app on this PC and package it for an ARM NAS (e.g. Synology DS223j).
#
# Usage: docker/build-nas-bundle.sh [OUTPUT_DIR]     (default: ~/abg-arm)
#
# UI toggles (1 = hide, 0 = show):
#   ABG_HIDE_LOGIN (default 1: login only on /members), ABG_HIDE_LANGUAGE_FILTER (1), ABG_HIDE_ABOUT (0),
#   ABG_HIDE_VASSAL_LINK (1), ABG_HIDE_HERO_IMAGE (1),
#   ABG_HIDE_GAME_FILTERS (1)
#
# Produces OUTPUT_DIR/ (html, nginx.conf, backend, compose.yaml, .env.docker)
# and OUTPUT_DIR.tar.gz to copy to the NAS. An existing OUTPUT_DIR/.env.docker
# is kept so NAS settings (CLIENT_URL, ABG_SECRET) survive rebuilds.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$HOME/abg-arm}"
out="${out%/}"

cd "$repo"

env_backup=""
if [ -f "$out/.env.docker" ]; then
  env_backup="$(mktemp)"
  cp "$out/.env.docker" "$env_backup"
fi

echo ">> Building frontend (login hidden: ${ABG_HIDE_LOGIN:-1})"
docker build -f docker/frontend.Dockerfile \
  --build-arg VITE_HIDE_LOGIN="${ABG_HIDE_LOGIN:-1}" \
  --build-arg VITE_HIDE_LANGUAGE_FILTER="${ABG_HIDE_LANGUAGE_FILTER:-1}" \
  --build-arg VITE_HIDE_ABOUT="${ABG_HIDE_ABOUT:-0}" \
  --build-arg VITE_HIDE_VASSAL_LINK="${ABG_HIDE_VASSAL_LINK:-1}" \
  --build-arg VITE_HIDE_HERO_IMAGE="${ABG_HIDE_HERO_IMAGE:-1}" \
  --build-arg VITE_HIDE_GAME_FILTERS="${ABG_HIDE_GAME_FILTERS:-1}" \
  -t abg/frontend:nas .

echo ">> Building backend"
docker build -t abg/backend:nas ./backend

echo ">> Extracting files into $out"
rm -rf "$out"
mkdir -p "$out"

cid="$(docker create abg/frontend:nas)"
docker cp "$cid:/usr/share/nginx/html" "$out/html"
docker cp "$cid:/etc/nginx/conf.d/default.conf" "$out/nginx.conf"
docker rm "$cid" >/dev/null

cid="$(docker create abg/backend:nas)"
docker cp "$cid:/app" "$out/backend"
docker rm "$cid" >/dev/null

cp docker/nas/compose.yaml "$out/compose.yaml"

if [ -n "$env_backup" ]; then
  mv "$env_backup" "$out/.env.docker"
  echo ">> Kept existing .env.docker"
else
  cp .env.docker.example "$out/.env.docker"
  echo "!! Created $out/.env.docker from the example: edit CLIENT_URL and ABG_SECRET,"
  echo "!! then run this script again to repackage."
fi

# nginx inside the container must be able to read everything
chmod -R a+rX "$out"

if grep -qE '^CLIENT_URL=.*localhost' "$out/.env.docker"; then
  echo "!! CLIENT_URL in .env.docker points to localhost; set it to the NAS address."
fi
if grep -qE '^ABG_SECRET=change-me' "$out/.env.docker"; then
  echo "!! ABG_SECRET in .env.docker is still change-me; replace it (openssl rand -hex 32)."
fi

tar -C "$out" -czf "$out.tar.gz" .
echo ">> Done: $out.tar.gz"
