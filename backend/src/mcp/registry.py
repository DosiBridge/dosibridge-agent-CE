"""Registry for MCP servers"""
from typing import Dict, Optional

# Import all MCP servers
from .math_server import mcp as math_mcp
from .weather import mcp_weather as weather_mcp
from .web import mcp_web as web_mcp
from .people import mcp_people as people_mcp
from .jack import mcp2 as jack_mcp

# Registry mapping server names to their FastMCP instances
MCP_SERVERS: Dict[str, any] = {
    "math": math_mcp,
    "weather": weather_mcp,
    "web": web_mcp,
    "people": people_mcp,
    "jack": jack_mcp,
}


def get_mcp_server(server_name: str) -> Optional[any]:
    """Get an MCP server by name"""
    return MCP_SERVERS.get(server_name.lower())


def list_available_servers() -> list:
    """List all available MCP server names"""
    return list(MCP_SERVERS.keys())


