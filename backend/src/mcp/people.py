from typing import Any, Dict, Optional
import os
import httpx
from mcp.server.fastmcp import FastMCP
from .web import FIRECRAWL_API_KEY, FIRECRAWL_BASE_URL


mcp_people = FastMCP(name="people", stateless_http=True)


def _ok(data: Any):
    return {"ok": True, "data": data, "error": None, "meta": {}}


def _err(message: str, code: str = "ERROR"):
    return {"ok": False, "data": None, "error": {"message": message, "code": code}, "meta": {}}


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json",
    }


HARD_CODED = {
   
    "mihadul islam": {
        "name": "Mihadul Islam",
        "role": "Founder, DosiBridge",
        "summary": "Mihadul Islam is a founder and CEO of DosiBridge, leading engineering and operations.",
        "links": [
            {"title": "DosiBridge About", "url": "https://dosibridge.com/about"},
        ],
    },
     "abdullah al sazib": {
        "name": "Abdullah Al Sazib",
        "role": "Co-founder, DosiBridge",
        "summary": "Abdullah Al Sazib is a co-founder and CTO of DosiBridge, focusing on product and partnerships.",
        "links": [
            {"title": "DosiBridge About", "url": "https://dosibridge.com/about"},
        ],
    },
}


@mcp_people.tool()
def about_page_crawl() -> Dict[str, Any]:
    """Crawl/scrape the DosiBridge About page and return markdown content."""
    try:
        if not FIRECRAWL_API_KEY:
            return _err("FIRECRAWL_API_KEY env not set", code="CONFIG_ERROR")
        api = f"{FIRECRAWL_BASE_URL}/v1/scrape"
        payload = {"url": "https://dosibridge.com/about", "formats": ["markdown"], "onlyMainContent": True}
        with httpx.Client(timeout=60.0) as client:
            r = client.post(api, headers=_headers(), json=payload)
            r.raise_for_status()
            data = r.json()
            md = data.get("markdown") or data.get("content") or data
            return _ok({"url": "https://dosibridge.com/about", "markdown": md})
    except httpx.HTTPError as e:
        return _err(str(e), code="HTTP_ERROR")


def _fetch_about_markdown() -> str:
    if not FIRECRAWL_API_KEY:
        raise ValueError("FIRECRAWL_API_KEY env not set")
    api = f"{FIRECRAWL_BASE_URL}/v1/scrape"
    payload = {"url": "https://dosibridge.com/about", "formats": ["markdown"], "onlyMainContent": True}
    with httpx.Client(timeout=60.0) as client:
        r = client.post(api, headers=_headers(), json=payload)
        r.raise_for_status()
        data = r.json()
        md = data.get("markdown") or data.get("content") or ""
        return md if isinstance(md, str) else str(md)


def _extract_person_snippet(markdown: str, person_keywords: str) -> str:
    text = markdown
    lower = text.lower()
    key = person_keywords.lower()
    idx = lower.find(key)
    if idx == -1:
        return text[:600]
    # Expand to paragraph boundaries
    start = text.rfind("\n\n", 0, idx)
    end = text.find("\n\n", idx)
    start = 0 if start == -1 else start + 2
    end = len(text) if end == -1 else end
    snippet = text[start:end].strip()
    if len(snippet) < 200:
        snippet = text[idx: idx + 800]
    return snippet[:1200]


@mcp_people.tool()
def sazib_info() -> Dict[str, Any]:
    """Return hardcoded info for Abdullah Al Sazib and include About page snippet."""
    base = HARD_CODED["abdullah al sazib"]
    try:
        md = _fetch_about_markdown()
        snippet = _extract_person_snippet(md, "Abdullah Al Sazib")
        return _ok({**base, "about_markdown_snippet": snippet})
    except (httpx.HTTPError, ValueError):
        return _ok(base)


@mcp_people.tool()
def mihadul_info() -> Dict[str, Any]:
    """Return hardcoded info for Mihadul Islam and include About page snippet."""
    base = HARD_CODED["mihadul islam"]
    try:
        md = _fetch_about_markdown()
        snippet = _extract_person_snippet(md, "Mihadul Islam")
        return _ok({**base, "about_markdown_snippet": snippet})
    except (httpx.HTTPError, ValueError):
        return _ok(base)


@mcp_people.tool()
def dosibridge_people() -> Dict[str, Any]:
    """Return combined info for Abdullah Al Sazib and Mihadul Islam from About page."""
    try:
        md = _fetch_about_markdown()
        sazib_snippet = _extract_person_snippet(md, "Abdullah Al Sazib")
        mihadul_snippet = _extract_person_snippet(md, "Mihadul Islam")
        return _ok({
            "source_url": "https://dosibridge.com/about",
            "abdullah_al_sazib": {**HARD_CODED["abdullah al sazib"], "about_markdown_snippet": sazib_snippet},
            "mihadul_islam": {**HARD_CODED["mihadul islam"], "about_markdown_snippet": mihadul_snippet},
        })
    except (httpx.HTTPError, ValueError) as e:
        code = "HTTP_ERROR" if isinstance(e, httpx.HTTPError) else "CONFIG_ERROR"
        return _err(str(e), code=code)


