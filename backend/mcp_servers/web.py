from typing import Any, Dict, List, Optional
import os
import httpx
from mcp.server.fastmcp import FastMCP

# Firecrawl API key comes from environment
FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")

FIRECRAWL_BASE_URL = "https://api.firecrawl.dev"


# Initialize MCP server for web utilities
mcp_web = FastMCP(name="web", stateless_http=True)


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json",
    }


def _ok(data: Any, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": True, "data": data, "error": None, "meta": meta or {}}


def _err(message: str, code: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": False, "data": None, "error": {"message": message, "code": code}, "meta": meta or {}}


@mcp_web.tool()
def web_search(query: str, limit: int = 5) -> Dict[str, Any]:
    """Search the web using Firecrawl's search API.

    Args:
        query: Search query string.
        limit: Max number of results to return (default 5).
    """
    if not query:
        return _err("query is required", code="VALIDATION_ERROR")
    if not FIRECRAWL_API_KEY:
        return _err("FIRECRAWL_API_KEY env not set", code="CONFIG_ERROR")

    url = f"{FIRECRAWL_BASE_URL}/v1/search"
    payload = {"query": query, "limit": limit}
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, headers=_headers(), json=payload)
            resp.raise_for_status()
            data = resp.json()
            return _ok({"results": data})
    except httpx.HTTPError as e:
        return _err(str(e), code="HTTP_ERROR")


@mcp_web.tool()
def web_scrape(url: str) -> Dict[str, Any]:
    """Scrape a single URL using Firecrawl.

    Args:
        url: Absolute URL to scrape.
    """
    if not url:
        return _err("url is required", code="VALIDATION_ERROR")
    if not FIRECRAWL_API_KEY:
        return _err("FIRECRAWL_API_KEY env not set", code="CONFIG_ERROR")

    api = f"{FIRECRAWL_BASE_URL}/v1/scrape"
    payload = {"url": url, "formats": ["markdown"], "onlyMainContent": True}
    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(api, headers=_headers(), json=payload)
            resp.raise_for_status()
            data = resp.json()
            return _ok({"content": data})
    except httpx.HTTPError as e:
        return _err(str(e), code="HTTP_ERROR")


@mcp_web.tool()
def web_crawl(start_url: str, limit: int = 10) -> Dict[str, Any]:
    """Crawl a website starting from start_url using Firecrawl (limited pages).

    Args:
        start_url: Starting URL to crawl.
        limit: Maximum number of pages to crawl (default 10).
    """
    if not start_url:
        return _err("start_url is required", code="VALIDATION_ERROR")
    if not FIRECRAWL_API_KEY:
        return _err("FIRECRAWL_API_KEY env not set", code="CONFIG_ERROR")

    api = f"{FIRECRAWL_BASE_URL}/v1/crawl"
    payload = {
        "url": start_url,
        "limit": limit,
        "scrapeOptions": {"formats": ["markdown"], "onlyMainContent": True},
    }
    try:
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(api, headers=_headers(), json=payload)
            resp.raise_for_status()
            data = resp.json()
            return _ok({"crawl": data})
    except httpx.HTTPError as e:
        return _err(str(e), code="HTTP_ERROR")


