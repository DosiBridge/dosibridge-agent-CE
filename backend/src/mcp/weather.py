from datetime import datetime
from typing import Any, Dict, Optional

import httpx
from mcp.server.fastmcp import FastMCP


mcp_weather = FastMCP(name="weather", stateless_http=True)


GEOCODE_API = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_API = "https://api.open-meteo.com/v1/forecast"


def _http_client(timeout: float = 20.0) -> httpx.Client:
    return httpx.Client(timeout=timeout)


def _ok(data: Any, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": True, "data": data, "error": None, "meta": meta or {}}


def _err(message: str, code: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"ok": False, "data": None, "error": {"message": message, "code": code}, "meta": meta or {}}


@mcp_weather.tool()
def current_time(tz: Optional[str] = None) -> Dict[str, Any]:
    """Get current time. Optionally specify IANA timezone (e.g., 'UTC', 'Europe/London')."""
    try:
        now = datetime.utcnow()
        # Keep simple UTC for reliability; include provided tz as echo
        return _ok({"utc": now.isoformat() + "Z", "timezone": tz or "UTC"})
    except Exception as e:
        return _err(str(e), code="INTERNAL_ERROR")


def _geocode_city(city: str) -> Optional[Dict[str, Any]]:
    params = {"name": city, "count": 1, "language": "en", "format": "json"}
    with _http_client() as client:
        r = client.get(GEOCODE_API, params=params)
        r.raise_for_status()
        data = r.json()
        results = data.get("results") or []
        return results[0] if results else None


@mcp_weather.tool()
def weather_by_city(city: str) -> Dict[str, Any]:
    """Get current weather for a city name using Open-Meteo (no API key)."""
    if not city:
        return _err("city is required", code="VALIDATION_ERROR")
    try:
        location = _geocode_city(city)
        if not location:
            return _err(f"city not found: {city}", code="NOT_FOUND")
        lat = location["latitude"]
        lon = location["longitude"]
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": ["temperature_2m", "relative_humidity_2m", "wind_speed_10m"],
        }
        with _http_client() as client:
            r = client.get(FORECAST_API, params=params)
            r.raise_for_status()
            data = r.json()
            current = data.get("current") or {}
            return _ok({
                "city": location.get("name"),
                "lat": lat,
                "lon": lon,
                "current": current,
            })
    except httpx.HTTPError as e:
        return _err(str(e), code="HTTP_ERROR")


@mcp_weather.tool()
def weather_by_coords(latitude: float, longitude: float) -> Dict[str, Any]:
    """Get current weather by coordinates (latitude, longitude)."""
    try:
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": ["temperature_2m", "relative_humidity_2m", "wind_speed_10m"],
        }
        with _http_client() as client:
            r = client.get(FORECAST_API, params=params)
            r.raise_for_status()
            data = r.json()
            current = data.get("current") or {}
            return _ok({"lat": latitude, "lon": longitude, "current": current})
    except httpx.HTTPError as e:
        return _err(str(e), code="HTTP_ERROR")


