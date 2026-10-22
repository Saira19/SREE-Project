# SREE-Project — Averon AI

Software Re-engineering course design: an AI-powered web app built with
**FastAPI**, **MySQL**, **REST APIs** and a plain **HTML / CSS / JavaScript** frontend.

> Status: **Phase 3 (frontend) done.** The pages, styles and JavaScript are complete.
> The JSON API (`/api/v1/...`) arrives in Phase 2 (auth) and Phase 4 (AI chat), so
> log in and the dashboard will show "Can't reach the server"/404 errors until then.

## Run it locally

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate     macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000 · health check at `/health` · tests: `pytest -q`

## Pages

| URL | Template | What it is |
| --- | --- | --- |
| `/` | `index.html` | Home: hero, features, how it works, CTA |
| `/pricing` | `pricing.html` | Plans with a monthly/yearly switch, FAQ |
| `/about` | `about.html` | Story and principles |
| `/contact` | `contact.html` | Contact form (validates on the page; no backend yet) |
| `/login` | `login.html` | Log in |
| `/register` | `register.html` | Sign up with password-strength meter |
| `/dashboard` | `dashboard.html` | The AI chat app (needs the API) |

## How the frontend is put together

```
app/
├── main.py                 # FastAPI app: serves /static and renders each page
├── templates/
│   ├── base.html           # <head>, stylesheet, scripts — every page extends this
│   ├── layouts/
│   │   ├── marketing.html  # base + header + footer (public pages)
│   │   └── auth.html       # base + brand panel (log in / sign up)
│   ├── partials/
│   │   ├── header.html     # the ONE header (desktop nav + mobile menu)
│   │   ├── footer.html     # the ONE footer
│   │   ├── cta_band.html   # reusable "Get started" banner
│   │   └── icons.html      # icon() and logo() macros (inline SVG)
│   └── index / pricing / about / contact / login / register / dashboard .html
└── static/
    ├── css/styles.css      # one stylesheet; colours/spacing are CSS variables in :root
    ├── js/
    │   ├── api.js          # apiFetch(): the only code that calls the backend
    │   ├── main.js         # mobile menu, pricing switch, contact/newsletter forms
    │   ├── auth.js         # log in / sign up forms
    │   └── dashboard.js    # chat: load, send, render, delete
    └── img/favicon.svg
```

**Template inheritance.** `pricing.html` extends `layouts/marketing.html`, which
extends `base.html`. The header and footer exist once, in `partials/`, so changing
them there changes every page.

**One request, end to end (sending a chat message):**
1. `dashboard.js` adds your message to the screen and shows a typing indicator.
2. It calls `apiFetch("/conversations/7/messages", {method: "POST", body: {content}})`.
3. `api.js` adds `Authorization: Bearer <token>`, sends JSON, and checks the response.
4. The reply is added with `textContent`, so any HTML inside it is shown as text, never run.
5. On a 401, `api.js` clears the token and sends you to `/login?next=/dashboard`.

**Mobile.** Below 960 px the nav collapses into a menu button; below 760 px every
grid becomes one column and the dashboard sidebar becomes a slide-in drawer.

## API contract the frontend expects

Build Phase 2 and Phase 4 to match this, and the frontend works with no changes.
Errors use FastAPI's default shape `{"detail": "message"}`.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | `{full_name, email, password}` | 201 · user |
| POST | `/api/v1/auth/login` | `{email, password}` (JSON) | `{access_token, token_type}` |
| GET | `/api/v1/users/me` | — | `{id, email, full_name}` |
| GET | `/api/v1/conversations` | — | `[{id, title, created_at, updated_at?}]` |
| POST | `/api/v1/conversations` | `{title}` | 201 · conversation |
| GET | `/api/v1/conversations/{id}` | — | `{id, title, messages: [{role, content, created_at}]}` |
| POST | `/api/v1/conversations/{id}/messages` | `{content}` | 201 · the **assistant** message `{role, content, created_at}` |
| DELETE | `/api/v1/conversations/{id}` | — | 204 |

Note: login takes **JSON**, not FastAPI's `OAuth2PasswordRequestForm` form data.

## Still to connect (later phases)
- Contact form → `POST /api/v1/contact`; newsletter → `POST /api/v1/newsletter` (marked `TODO` in the code).
- Before production: move the token from `localStorage` to an HttpOnly cookie.
- Placeholder content to replace: brand name "Averon AI", prices, `hello@averon.ai`, office address.

Project plan and prompts: see the project guide and Jira backlog (`labels = ai-web-app`).
