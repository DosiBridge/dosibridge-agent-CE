from mcp.server.fastmcp import FastMCP
import httpx
from typing import Any, Dict, List, Optional
from .web import FIRECRAWL_API_KEY, FIRECRAWL_BASE_URL

# Initialize MCP server
mcp2 = FastMCP(name="jack", stateless_http=True)

def _ok(result):
    return {"ok": True, "data": result, "error": None, "meta": {}}

def _err(message: str, code: str = "ERROR"):
    return {"ok": False, "data": None, "error": {"message": message, "code": code}, "meta": {}}

def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json",
    }

# Define a simple tool
@mcp2.tool()
def showHello(name: str) -> dict:
    """Show a hello message"""
    return _ok({"result": f"Hello, {name}!"})


@mcp2.tool()
def jack_sparrow_info(limit: int = 5) -> Dict[str, Any]:
    """Search web for Captain Jack Sparrow and return structured history and short story.

    Returns fields: history_snippet, short_story_snippet, sources (title/url list).
    """
    try:
        query = "Captain Jack Sparrow history backstory biography short story summary"
        search_url = f"{FIRECRAWL_BASE_URL}/v1/search"
        with httpx.Client(timeout=30.0) as client:
            sr = client.post(search_url, headers=_headers(), json={"query": query, "limit": max(3, limit)})
            sr.raise_for_status()
            sdata = sr.json()
            results = sdata.get("data") or sdata.get("results") or sdata
            sources: List[Dict[str, str]] = []
            if isinstance(results, list):
                for item in results:
                    if isinstance(item, dict):
                        url = item.get("url")
                        title = item.get("title") or item.get("site_name") or ""
                        if url:
                            sources.append({"title": title, "url": url})
        history_snippet: Optional[str] = None
        short_story_snippet: Optional[str] = None
        scrape_url = f"{FIRECRAWL_BASE_URL}/v1/scrape"
        for src in sources[:2]:
            with httpx.Client(timeout=60.0) as client:
                rr = client.post(scrape_url, headers=_headers(), json={"url": src["url"], "formats": ["markdown"], "onlyMainContent": True})
                rr.raise_for_status()
                rdata = rr.json()
                md = rdata.get("markdown") or rdata.get("content") or rdata
                text = md if isinstance(md, str) else str(md)
                lower = text.lower()
                if not history_snippet:
                    idx = lower.find("history")
                    history_snippet = text[idx: idx + 800] if idx != -1 else text[:600]
                if not short_story_snippet:
                    for key in ["story", "plot", "summary"]:
                        j = lower.find(key)
                        if j != -1:
                            short_story_snippet = text[j: j + 800]
                            break
                if history_snippet and short_story_snippet:
                    break
        payload = {
            "history_snippet": history_snippet,
            "short_story_snippet": short_story_snippet,
            "sources": sources[:limit],
        }
        return _ok(payload)
    except httpx.HTTPError as e:
        return _err(str(e), code="HTTP_ERROR")

