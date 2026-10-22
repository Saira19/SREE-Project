/**
 * api.js — the ONE place the frontend talks to the backend.
 *
 * Every page that needs data calls apiFetch(). It:
 *   1. prefixes the path with /api/v1
 *   2. adds the JWT as "Authorization: Bearer <token>" if we have one
 *   3. sends/parses JSON
 *   4. turns any non-2xx response into a thrown ApiError with a readable message
 *   5. on 401 (token missing/expired) logs the user out and sends them to /login
 *
 * Keeping this in one file means auth and error handling are written once,
 * not copy-pasted into every page script.
 */
(function () {
  "use strict";

  const API_BASE = "/api/v1";
  const TOKEN_KEY = "averon_token";

  // ---- Token storage ------------------------------------------------------
  // localStorage keeps the token across browser restarts ("Remember me"),
  // sessionStorage forgets it when the tab closes.
  // NOTE: before going to production, move the token to an HttpOnly cookie
  // set by the backend (JavaScript can't read those, which protects against XSS).
  const auth = {
    getToken() {
      try {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      } catch { return null; }
    },
    setToken(token, remember = true) {
      try {
        auth.clear();
        (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
      } catch { /* storage blocked (private mode) — user must log in again next time */ }
    },
    clear() {
      try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    },
    isLoggedIn() { return Boolean(auth.getToken()); },
    /** Send the user to the login page, remembering where they were. */
    redirectToLogin() {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `/login?next=${next}`;
    },
  };

  // ---- Errors -------------------------------------------------------------
  class ApiError extends Error {
    constructor(message, status, data) {
      super(message);
      this.name = "ApiError";
      this.status = status; // HTTP status code, or 0 for network errors
      this.data = data;     // parsed response body, if any
    }
  }

  /**
   * FastAPI errors look like {"detail": "message"} or, for validation (422),
   * {"detail": [{"loc": [...], "msg": "..."}]}. Turn either into one sentence.
   */
  function errorMessage(data, status) {
    const detail = data && data.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map((d) => d.msg).filter(Boolean).join(". ");
    }
    if (status >= 500) return "Something went wrong on our side. Please try again.";
    return `Request failed (${status}).`;
  }

  // ---- The fetch wrapper --------------------------------------------------
  /**
   * @param {string} path     e.g. "/users/me" (API_BASE is added for you)
   * @param {object} options  fetch options; pass `body` as a plain object
   *                          and it is JSON-encoded. `auth: false` skips the token.
   * @returns parsed JSON, or null for 204 No Content
   */
  async function apiFetch(path, options = {}) {
    const { body, auth: useAuth = true, headers = {}, ...rest } = options;
    const init = { ...rest, headers: { Accept: "application/json", ...headers } };

    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const token = auth.getToken();
    if (useAuth && token) init.headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(API_BASE + path, init);
    } catch {
      throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
    }

    if (res.status === 204) return null;

    // Read the body once; it might not be JSON (e.g. an HTML error page).
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (res.status === 401 && useAuth) {
      auth.clear();
      auth.redirectToLogin();
    }
    if (!res.ok) throw new ApiError(errorMessage(data, res.status), res.status, data);
    return data;
  }

  // Make these available to the other scripts (auth.js, dashboard.js).
  window.Api = { apiFetch, ApiError, auth };
})();
