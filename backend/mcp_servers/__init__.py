"""MCP Server implementations"""
from .math_server import mcp as math_mcp
from .weather import mcp_weather as weather_mcp
from .web import mcp_web as web_mcp
from .people import mcp_people as people_mcp
from .jack import mcp2 as jack_mcp

__all__ = ['math_mcp', 'weather_mcp', 'web_mcp', 'people_mcp', 'jack_mcp']

