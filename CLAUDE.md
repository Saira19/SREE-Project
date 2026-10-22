# Project: Averon AI — AI-powered web app
Stack: FastAPI, SQLAlchemy 2.0, Alembic, MySQL 8, Pydantic v2, Jinja2,
vanilla HTML/CSS/JS, pytest.

## Structure rules
- Routes in app/api/v1 stay thin: validate, call crud/ or services/, return a schema.
- DB access only in app/crud. AI provider calls only in app/services/ai_service.py.
- models/ = DB tables; schemas/ = API shapes. Never return a model directly.
- Secrets only from app/core/config.py (reads .env). Never hardcode them.

## Frontend rules
- Pages are Jinja2 templates in app/templates; every page extends a layout in layouts/.
- Header and footer live only in partials/. Change them there, never per page.
- All API calls go through apiFetch() in app/static/js/api.js.
- Insert user or AI text with textContent, never innerHTML.
- Colours and spacing come from the CSS variables in :root (styles.css).
- No frontend frameworks or build tools.

## How to work with me
- I am learning. Before writing code, give a short plan and wait for my OK.
- After writing code, explain each new file and why, in plain language.
- Make small changes; one feature at a time.
- Tell me the exact command to run to verify the change.
