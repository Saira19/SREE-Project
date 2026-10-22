/**
 * main.js — small enhancements used on the public pages.
 * Loaded on every page; each block only runs if its elements exist.
 *   - mobile menu open/close
 *   - show "Log in / Get started" or "Open dashboard" in the header
 *   - pricing monthly/yearly switch
 *   - contact + newsletter forms (front-end validation only for now)
 */
(function () {
  "use strict";

  // ---- Mobile menu ---------------------------------------------------------
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-menu-toggle]");
  if (header && toggle) {
    const setOpen = (open) => {
      header.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    toggle.addEventListener("click", () => setOpen(!header.classList.contains("open")));
    // Close when a link is chosen or Escape is pressed
    header.querySelectorAll(".mobile-menu a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  // ---- Logged-in state in the header --------------------------------------
  // We only check whether a token exists; the dashboard verifies it with the API.
  let loggedIn = false;
  try {
    loggedIn = Boolean(localStorage.getItem("averon_token") || sessionStorage.getItem("averon_token"));
  } catch { /* storage blocked */ }
  if (loggedIn) {
    document.querySelectorAll(".guest-only").forEach((el) => { el.hidden = true; });
    document.querySelectorAll(".user-only").forEach((el) => { el.hidden = false; });
  }

  // ---- Pricing: monthly / yearly ------------------------------------------
  const billing = document.querySelector("[data-billing-toggle]");
  if (billing) {
    const note = document.querySelector("[data-billing-note]");
    billing.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-period]");
      if (!btn) return;
      const period = btn.dataset.period; // "monthly" | "yearly"
      billing.querySelectorAll("button").forEach((b) => {
        const on = b === btn;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      document.querySelectorAll("[data-monthly]").forEach((el) => {
        el.textContent = el.dataset[period];
      });
      if (note) note.textContent = `Prices in USD, billed ${period}. Cancel anytime.`;
    });
  }

  // ---- Simple form validation helper --------------------------------------
  // Uses the browser's built-in rules (required, type=email, minlength) and
  // shows our own error text under each field.
  function validate(form) {
    let firstInvalid = null;
    form.querySelectorAll("[data-error-for]").forEach((msg) => {
      const field = form.elements[msg.dataset.errorFor];
      if (!field) return;
      if (field.value.trim() === "") field.value = ""; // spaces alone don't count
      const ok = field.checkValidity();
      msg.hidden = ok;
      field.classList.toggle("is-invalid", !ok);
      field.setAttribute("aria-invalid", String(!ok));
      if (!ok && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }
  window.validateForm = validate; // reused by auth.js

  // ---- Contact form --------------------------------------------------------
  const contact = document.querySelector("[data-contact-form]");
  if (contact) {
    contact.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(contact)) return;
      // TODO (backend): send with Api.apiFetch("/contact", { method: "POST", body, auth: false })
      const msg = contact.querySelector("[data-form-msg]");
      const name = contact.elements.name.value.trim().split(" ")[0];
      msg.textContent = `Thanks, ${name}! Your message is ready to send — we'll connect this form to the server in a later phase.`;
      msg.hidden = false;
      contact.reset();
    });
  }

  // ---- Newsletter (footer) -------------------------------------------------
  const news = document.querySelector("[data-newsletter]");
  if (news) {
    const out = document.querySelector("[data-newsletter-msg]");
    news.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = news.elements.email;
      if (!email.checkValidity()) {
        out.style.color = "#F49A9A";
        out.textContent = "Please enter a valid email address.";
        email.focus();
        return;
      }
      // TODO (backend): POST /api/v1/newsletter
      out.style.color = "";
      out.textContent = "Thanks — you're on the list.";
      news.reset();
    });
  }
})();
