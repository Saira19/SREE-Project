/**
 * dashboard.js — the chat app.
 *
 * State lives in one small object (`state`). Every change goes:
 *   user action -> API call (api.js) -> update state -> re-render the part that changed
 *
 * API used (see README "API contract"):
 *   GET    /users/me
 *   GET    /conversations
 *   POST   /conversations                 {title}
 *   GET    /conversations/{id}            -> {..., messages: [...]}
 *   POST   /conversations/{id}/messages   {content} -> the assistant's reply
 *   DELETE /conversations/{id}
 *
 * SECURITY: user and AI text is always inserted with textContent, never
 * innerHTML, so a message containing <script> is shown as text, not run.
 */
(function () {
  "use strict";

  const { apiFetch, auth } = window.Api;

  // No token at all? Go log in before loading anything.
  if (!auth.isLoggedIn()) {
    auth.redirectToLogin();
    return;
  }

  // ---- Elements -------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const el = {
    app: $("[data-app]"),
    list: $("[data-conv-list]"),
    title: $("[data-conv-title]"),
    meta: $("[data-conv-meta]"),
    del: $("[data-delete-conv]"),
    thread: $("[data-thread]"),
    messages: $("[data-messages]"),
    empty: $("[data-empty]"),
    form: $("[data-composer]"),
    input: $("[data-input]"),
    send: $("[data-send]"),
    error: $("[data-error]"),
    errorText: $("[data-error-text]"),
    tplUser: $("#tpl-user"),
    tplAssistant: $("#tpl-assistant"),
    tplTyping: $("#tpl-typing"),
  };

  const state = {
    user: null,
    conversations: [], // [{id, title, created_at, updated_at?}]
    current: null,     // {id, title, messages: [...]} or null for a new chat
    sending: false,
  };

  // ---- Small helpers --------------------------------------------------------
  function showError(message) {
    el.errorText.textContent = message;
    el.error.hidden = false;
  }
  function hideError() { el.error.hidden = true; }

  function initials(name) {
    return (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  function scrollToBottom() {
    el.thread.scrollTop = el.thread.scrollHeight;
  }

  /** Keep the open conversation in the URL so a refresh re-opens it. */
  function setUrl(id) {
    const url = id ? `/dashboard?c=${encodeURIComponent(id)}` : "/dashboard";
    history.replaceState(null, "", url);
  }

  function groupLabel(dateString) {
    const d = new Date(dateString);
    const days = (Date.now() - d.getTime()) / 86_400_000;
    const sameDay = d.toDateString() === new Date().toDateString();
    if (sameDay) return "Today";
    if (days < 7) return "Previous 7 days";
    if (days < 30) return "Previous 30 days";
    return "Older";
  }

  // ---- Rendering ------------------------------------------------------------
  function renderUser() {
    $("[data-user-name]").textContent = state.user.full_name || "Your account";
    $("[data-user-email]").textContent = state.user.email;
    $("[data-user-initials]").textContent = initials(state.user.full_name || state.user.email);
  }

  function renderList() {
    el.list.replaceChildren();
    if (!state.conversations.length) {
      const p = document.createElement("p");
      p.className = "side-empty";
      p.textContent = "No conversations yet. Start one!";
      el.list.append(p);
      return;
    }
    // Newest first, grouped under Today / Previous 7 days / ...
    const sorted = [...state.conversations].sort(
      (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
    );
    let lastGroup = null;
    for (const c of sorted) {
      const group = groupLabel(c.updated_at || c.created_at);
      if (group !== lastGroup) {
        const h = document.createElement("h2");
        h.className = "conv-group";
        h.textContent = group;
        el.list.append(h);
        lastGroup = group;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "conv";
      btn.dataset.id = c.id;
      btn.textContent = c.title || "Untitled";
      btn.title = c.title || "Untitled";
      if (state.current && String(state.current.id) === String(c.id)) btn.setAttribute("aria-current", "true");
      el.list.append(btn);
    }
  }

  function addMessage(role, content) {
    const tpl = role === "user" ? el.tplUser : el.tplAssistant;
    const node = tpl.content.firstElementChild.cloneNode(true);
    node.querySelector("[data-text]").textContent = content;
    el.messages.append(node);
    return node;
  }

  function renderThread() {
    // Remove everything except the empty-state block, then add messages.
    [...el.messages.children].forEach((child) => { if (child !== el.empty) child.remove(); });
    const msgs = state.current ? state.current.messages : [];
    el.empty.hidden = msgs.length > 0;
    msgs.forEach((m) => addMessage(m.role, m.content));

    el.title.textContent = state.current ? state.current.title || "Untitled" : "New chat";
    el.meta.textContent = msgs.length ? `· ${msgs.length} message${msgs.length === 1 ? "" : "s"}` : "";
    el.del.hidden = !state.current;
    document.title = `${el.title.textContent} · Averon AI`;
    scrollToBottom();
  }

  function updateSendButton() {
    el.send.disabled = state.sending || el.input.value.trim() === "";
  }

  // ---- Actions --------------------------------------------------------------
  async function openConversation(id) {
    hideError();
    closeDrawer();
    try {
      state.current = await apiFetch(`/conversations/${encodeURIComponent(id)}`);
      state.current.messages = state.current.messages || [];
      setUrl(state.current.id);
    } catch (err) {
      state.current = null;
      setUrl(null);
      showError(err.status === 404 ? "That conversation doesn't exist any more." : err.message);
    }
    renderList();
    renderThread();
    el.input.focus();
  }

  function newChat() {
    hideError();
    closeDrawer();
    state.current = null;
    setUrl(null);
    renderList();
    renderThread();
    el.input.focus();
  }

  async function sendMessage(text) {
    if (state.sending) return;
    hideError();
    state.sending = true;
    updateSendButton();

    // Show the user's message and a typing indicator straight away
    el.empty.hidden = true;
    const userNode = addMessage("user", text);
    const typing = el.tplTyping.content.firstElementChild.cloneNode(true);
    el.messages.append(typing);
    scrollToBottom();

    try {
      // First message of a new chat: create the conversation, titled from the text
      if (!state.current) {
        const title = text.length > 60 ? `${text.slice(0, 57).trim()}…` : text;
        const conv = await apiFetch("/conversations", { method: "POST", body: { title } });
        state.current = { ...conv, messages: [] };
        state.conversations.unshift(conv);
        setUrl(conv.id);
      }
      const reply = await apiFetch(`/conversations/${encodeURIComponent(state.current.id)}/messages`, {
        method: "POST",
        body: { content: text },
      });
      state.current.messages.push({ role: "user", content: text }, reply);

      // Move this conversation to the top of the sidebar
      const c = state.conversations.find((x) => String(x.id) === String(state.current.id));
      if (c) c.updated_at = reply.created_at || new Date().toISOString();
      renderList();
      renderThread();
    } catch (err) {
      // Undo the optimistic bubble and give the text back so nothing is lost
      userNode.remove();
      el.input.value = text;
      autoGrow();
      el.empty.hidden = Boolean(state.current && state.current.messages.length);
      showError(err.status === 502 ? "The AI service didn't respond. Please try again." : err.message);
      renderList();
    } finally {
      typing.remove();
      state.sending = false;
      updateSendButton();
      el.input.focus();
    }
  }

  async function deleteConversation() {
    if (!state.current) return;
    if (!confirm(`Delete "${state.current.title || "this conversation"}"? This can't be undone.`)) return;
    try {
      await apiFetch(`/conversations/${encodeURIComponent(state.current.id)}`, { method: "DELETE" });
      state.conversations = state.conversations.filter((c) => String(c.id) !== String(state.current.id));
      newChat();
    } catch (err) {
      showError(err.message);
    }
  }

  // ---- Composer: auto-growing textarea, Enter to send ----------------------
  function autoGrow() {
    el.input.style.height = "auto";
    el.input.style.height = `${Math.min(el.input.scrollHeight, 200)}px`;
    updateSendButton();
  }
  el.input.addEventListener("input", autoGrow);
  el.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      el.form.requestSubmit();
    }
  });
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text || state.sending) return;
    el.input.value = "";
    autoGrow();
    sendMessage(text);
  });

  // ---- Other events (one listener per area, using data-* attributes) --------
  el.list.addEventListener("click", (e) => {
    const btn = e.target.closest(".conv");
    if (btn) openConversation(btn.dataset.id);
  });
  $("[data-new-chat]").addEventListener("click", newChat);
  el.del.addEventListener("click", deleteConversation);
  $("[data-error-close]").addEventListener("click", hideError);
  $("[data-logout]").addEventListener("click", () => { auth.clear(); location.href = "/login"; });

  el.messages.addEventListener("click", async (e) => {
    const suggest = e.target.closest("[data-suggest]");
    if (suggest) { el.input.value = suggest.textContent; autoGrow(); el.input.focus(); return; }

    const copy = e.target.closest("[data-copy]");
    if (copy) {
      const text = copy.closest(".answer").querySelector("[data-text]").textContent;
      try {
        await navigator.clipboard.writeText(text);
        copy.classList.add("done");
        setTimeout(() => copy.classList.remove("done"), 1500);
      } catch { showError("Couldn't copy. Select the text and copy it manually."); }
    }
  });

  // Mobile drawer
  function openDrawer() { el.app.classList.add("drawer-open"); }
  function closeDrawer() { el.app.classList.remove("drawer-open"); }
  document.querySelectorAll("[data-drawer-open]").forEach((b) => b.addEventListener("click", openDrawer));
  document.querySelectorAll("[data-drawer-close]").forEach((b) => b.addEventListener("click", closeDrawer));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

  // ---- Start-up -------------------------------------------------------------
  async function init() {
    try {
      // Load the user and the list at the same time
      const [user, conversations] = await Promise.all([apiFetch("/users/me"), apiFetch("/conversations")]);
      state.user = user;
      state.conversations = conversations || [];
      renderUser();
    } catch (err) {
      if (err.status === 401) return; // api.js is already redirecting to /login
      showError(err.message);
    }
    const id = new URLSearchParams(location.search).get("c");
    if (id) await openConversation(id);
    else { renderList(); renderThread(); }
    updateSendButton();
  }

  init();
})();
