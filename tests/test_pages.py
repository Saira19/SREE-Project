"""Smoke tests for the frontend: every page renders and links its assets.

Run with:  pytest -q
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PAGES = {
    "/": "Get answers that",
    "/pricing": "Simple plans that grow with you",
    "/about": "Making AI feel like a helpful colleague",
    "/contact": "love to hear from you",  # ' is HTML-escaped
    "/login": "Welcome back",
    "/register": "Create your account",
    "/dashboard": "How can I help today?",
}


@pytest.mark.parametrize("path,heading", PAGES.items())
def test_page_renders(path, heading):
    res = client.get(path)
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert heading in res.text
    assert "/static/css/styles.css" in res.text


@pytest.mark.parametrize("path", ["/", "/pricing", "/about", "/contact"])
def test_marketing_pages_share_header_and_footer(path):
    html = client.get(path).text
    assert 'class="site-header"' in html
    assert 'class="site-footer"' in html


def test_active_nav_item_is_marked():
    html = client.get("/pricing").text
    assert 'href="/pricing" class="active" aria-current="page"' in html


@pytest.mark.parametrize("asset", [
    "/static/css/styles.css", "/static/js/main.js", "/static/js/api.js",
    "/static/js/auth.js", "/static/js/dashboard.js", "/static/img/favicon.svg",
])
def test_static_assets_are_served(asset):
    assert client.get(asset).status_code == 200


def test_health():
    assert client.get("/health").json() == {"status": "ok"}
