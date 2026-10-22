/**
 * auth.js — log in and sign up forms.
 *
 * Flow (login):
 *   form submit -> validate fields -> POST /api/v1/auth/login {email, password}
 *   -> receive {access_token} -> store token -> go to /dashboard (or ?next=)
 *
 * Flow (register):
 *   POST /api/v1/auth/register {full_name, email, password} -> 201
 *   -> log in automatically with the same credentials -> /dashboard
 *
 * Depends on: api.js (window.Api) and main.js (window.validateForm).
 */
(function () {
  "use strict";

  const { apiFetch, auth } = window.Api;
  const form = document.querySelector("[data-auth-form]");
  if (!form) return;

  const mode = form.dataset.authForm; // "login" | "register"
  const submitBtn = form.querySelector("[data-submit]");
  const errorBox = document.querySelector("[data-form-error]");
  const errorText = document.querySelector("[data-form-error-text]");
  const submitLabel = submitBtn.textContent;

  // Only allow redirects to our own pages (never to another website).
  function nextUrl() {
    const next = new URLSearchParams(location.search).get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  }

  // Already logged in? Skip the form.
  if (auth.isLoggedIn()) {
    location.replace(nextUrl());
    return;
  }

  function showError(message) {
    errorText.textContent = message; // textContent: never insert server text as HTML
    errorBox.hidden = false;
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.textContent = loading ? (mode === "login" ? "Logging in…" : "Creating account…") : submitLabel;
  }

  // ---- Show / hide password -----------------------------------------------
  form.querySelectorAll("[data-pw-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  // ---- Password strength meter (sign up only) -----------------------------
  const meter = form.querySelector("[data-pw-meter]");
  if (meter) {
    const hint = form.querySelector("[data-pw-hint]");
    const labels = ["At least 8 characters.", "Weak password", "Okay password", "Strong password", "Very strong password"];
    form.elements.password.addEventListener("input", (e) => {
      const v = e.target.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/\d/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v) || v.length >= 14) score++;
      if (!v) score = 0;
      meter.dataset.score = String(score);
      hint.textContent = labels[score];
    });
  }

  // Clear a field's error as soon as the user edits it
  form.addEventListener("input", (e) => {
    const msg = form.querySelector(`[data-error-for="${e.target.name}"]`);
    if (msg && e.target.checkValidity()) {
      msg.hidden = true;
      e.target.classList.remove("is-invalid");
      e.target.removeAttribute("aria-invalid");
    }
  });

  async function logIn(email, password, remember) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    auth.setToken(data.access_token, remember);
  }

  // ---- Submit -------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    if (!window.validateForm(form)) return;

    const email = form.elements.email.value.trim().toLowerCase();
    const password = form.elements.password.value;
    const remember = mode === "login" ? form.elements.remember.checked : true;

    setLoading(true);
    try {
      if (mode === "register") {
        await apiFetch("/auth/register", {
          method: "POST",
          auth: false,
          body: { full_name: form.elements.full_name.value.trim(), email, password },
        });
      }
      await logIn(email, password, remember);
      location.href = nextUrl();
    } catch (err) {
      showError(err.message || "Something went wrong. Please try again.");
      if (mode === "login") form.elements.password.select();
      setLoading(false);
    }
  });
})();
