# --- build stage ---
# The build output is static files, so build on the host platform even when
# targeting another one (e.g. linux/arm64 for an ARM NAS): fast, no emulation.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Cypress is a devDependency; skip its binary download
ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci
COPY . .
# API/Socket URLs are left empty so the client uses window.location.origin
# (nginx proxies the backend on the same origin). VITE_USE_PROXY must be
# empty: vite.config.mjs treats any non-empty value (even "0") as "on".
# UI toggles; override with --build-arg (or ABG_HIDE_* in docker-compose).
ARG VITE_HIDE_LOGIN=1
ARG VITE_HIDE_LANGUAGE_FILTER=1
ARG VITE_HIDE_ABOUT=0
ARG VITE_HIDE_VASSAL_LINK=1
ARG VITE_HIDE_HERO_IMAGE=1
ARG VITE_HIDE_GAME_FILTERS=1
ENV VITE_USE_PROXY= \
    VITE_NO_WELCOME=0 \
    VITE_HIDE_LOGIN=$VITE_HIDE_LOGIN \
    VITE_HIDE_LANGUAGE_FILTER=$VITE_HIDE_LANGUAGE_FILTER \
    VITE_HIDE_ABOUT=$VITE_HIDE_ABOUT \
    VITE_HIDE_VASSAL_LINK=$VITE_HIDE_VASSAL_LINK \
    VITE_HIDE_HERO_IMAGE=$VITE_HIDE_HERO_IMAGE \
    VITE_HIDE_GAME_FILTERS=$VITE_HIDE_GAME_FILTERS
RUN npm run build

# --- runtime stage ---
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
