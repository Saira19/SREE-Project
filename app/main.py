"""Application entry point.

Creates the FastAPI app, serves static files (CSS/JS/images) and renders the
HTML pages. The JSON API (auth, conversations) is added in Phase 2 and Phase 4
under /api/v1 — the frontend JavaScript is already written against it.
"""
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Averon AI")

# /static/css/styles.css -> app/static/css/styles.css
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

templates = Jinja2Templates(directory=BASE_DIR / "templates")

# Page routes: (url path, template file, nav item to highlight, page title)
PAGES = [
    ("/", "index.html", "Home", "Your AI assistant"),
    ("/pricing", "pricing.html", "Pricing", "Pricing"),
    ("/about", "about.html", "About", "About"),
    ("/contact", "contact.html", "Contact", "Contact"),
    ("/login", "login.html", None, "Log in"),
    ("/register", "register.html", None, "Sign up"),
    ("/dashboard", "dashboard.html", None, "Dashboard"),
]


def _make_page_route(template: str, active: str | None, title: str):
    async def page(request: Request):
        return templates.TemplateResponse(
            request, template, {"active": active, "title": title}
        )
    return page


for path, template, active, title in PAGES:
    app.add_api_route(
        path,
        _make_page_route(template, active, title),
        methods=["GET"],
        response_class=HTMLResponse,
        include_in_schema=False,  # keep /docs for the JSON API only
        name=template.removesuffix(".html"),
    )


@app.get("/health")
async def health():
    """Used by Docker / the host to check the app is alive."""
    return {"status": "ok"}
