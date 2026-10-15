export const USE_PROXY =
  import.meta.env.DEV && import.meta.env.VITE_USE_PROXY !== "0";

export const SITEID = "airboardgame";

export const API_BASE = USE_PROXY
  ? ""
  : import.meta.env.VITE_API_ENDPOINT ||
    window.location.origin ||
    "http://localhost:3001";

export const API_ENDPOINT = USE_PROXY
  ? `/${SITEID}`
  : `${
      import.meta.env.VITE_API_ENDPOINT ||
      window.location.origin ||
      "http://localhost:3001"
    }/${SITEID}`;

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  window.location.origin ||
  "http://localhost:3001";

export const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || "/socket.io";

export const SHOW_WELCOME = import.meta.env.VITE_NO_WELCOME !== "1";

// Set to "1" at build time to hide the login button, the game language filter and the About modal.
export const HIDE_LOGIN = import.meta.env.VITE_HIDE_LOGIN === "1";
export const HIDE_ABOUT = import.meta.env.VITE_HIDE_ABOUT === "1";
// Source code of this deployment, linked from the About dialog.
export const SOURCE_URL =
  import.meta.env.VITE_SOURCE_URL || "https://github.com/SexyNights/airboardgame";
// Plain black home page header instead of the game-box picture.
export const HIDE_HERO_IMAGE = import.meta.env.VITE_HIDE_HERO_IMAGE === "1";
// Hide the game search box and the player-count / duration sliders.
export const HIDE_GAME_FILTERS = import.meta.env.VITE_HIDE_GAME_FILTERS === "1";
export const HIDE_VASSAL_LINK = import.meta.env.VITE_HIDE_VASSAL_LINK === "1";
export const HIDE_LANGUAGE_FILTER =
  import.meta.env.VITE_HIDE_LANGUAGE_FILTER === "1";

export const GAMELIST_URL =
  import.meta.env.VITE_GAMELIST_URL || "/gamelist.json";

export const IS_PRODUCTION = import.meta.env.PROD;

export const SOCKET_OPTIONS = {
  forceNew: true,
  path: SOCKET_PATH,
  transports: ["websocket"],
};

export const WEBCONFERENCE = ["audio", "video"].includes(
  import.meta.env.VITE_WEBCONFERENCE
)
  ? import.meta.env.VITE_WEBCONFERENCE
  : false;

export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
export const SENTRY_ENVIRONMENT =
  import.meta.env.VITE_SENTRY_ENVIRONMENT || "Unknown";
