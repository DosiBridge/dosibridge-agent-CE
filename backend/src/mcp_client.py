"""
MCP (Model Context Protocol) client management
"""
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from langchain_mcp_adapters.tools import load_mcp_tools
from typing import List
from langchain_core.tools import BaseTool


class MCPClientManager:
    """Context manager to maintain MCP sessions - supports both local and remote servers"""
    
    def __init__(self, mcp_servers: list[dict], prefer_local: bool = True):
        """
        Initialize with a list of MCP server configurations
        
        Args:
            mcp_servers: List of server configs, each with 'name', 'url', and optional 'headers'
            prefer_local: If True, use local MCP servers when available instead of external ones
        """
        self.mcp_servers = mcp_servers
        self.prefer_local = prefer_local
        self.sessions = []
        self.tools: List[BaseTool] = []
        self.local_servers_used = set()
        
    async def __aenter__(self):
        """Load tools from all configured MCP servers and keep sessions alive"""
        
        # Only use servers from config - no auto-discovery
        # If prefer_local is True, optimize to use local server URLs when available
        if self.prefer_local:
            try:
                import os
                from mcp_servers.registry import get_mcp_server
                
                # Get base URL for local servers
                # For local server connections, ALWAYS use localhost - this is more efficient
                # and avoids unnecessary external network round-trips
                port = os.environ.get("PORT", "8000")
                base_url = f"http://localhost:{port}"
                
                if base_url.endswith("/"):
                    base_url = base_url.rstrip("/")
                
                # OPTIMIZATION: If a configured server name matches a local server,
                # replace external URL with local URL for efficiency
                # This only affects servers that are ALREADY in the config
                for server_config in self.mcp_servers:
                    config_name = server_config.get("name", "").lower()
                    local_server = get_mcp_server(config_name)
                    if local_server:
                        # Replace external URL with local URL (optimization)
                        local_url = f"{base_url}/api/mcp/{config_name}/mcp"
                        old_url = server_config.get("url", "")
                        server_config["url"] = local_url
                        self.local_servers_used.add(config_name)
                        print(f"🔄 Using local MCP server for {config_name} (was: {old_url})")
            except Exception as e:
                print(f"Note: Could not optimize to local servers: {e}")
        
        # Now load all configured servers (only from config, no auto-discovery)
        # Filter out disabled servers
        for server_config in self.mcp_servers:
            # Skip disabled servers
            if server_config.get("enabled", True) is False:
                server_name = server_config.get("name", "Unknown")
                print(f"⏭️  Skipping disabled MCP server: {server_name}")
                continue
            
            server_name = server_config.get("name", "Unknown")
            server_name_lower = server_name.lower()
            server_url = server_config["url"]
            server_headers = server_config.get("headers", {})
            api_key = server_config.get("api_key")
            
            # Normalize URL: remove /sse and ensure /mcp endpoint
            final_url = server_url.rstrip('/')
            if final_url.endswith('/sse'):
                final_url = final_url[:-4]  # Remove /sse
            if not final_url.endswith('/mcp'):
                # If URL doesn't end with /mcp, append it
                final_url = final_url.rstrip('/') + '/mcp'
            
            print(f"Loading tools from {server_name} MCP server ({final_url})...")
            
            try:
                # Prepare server params
                server_params = {"url": final_url}
                
                # Build headers: start with existing headers
                headers = dict(server_headers) if server_headers else {}
                
                # Add API key header if provided
                # Support custom header name via api_key_header, default to x-api-key
                if api_key:
                    api_key_header = server_config.get("api_key_header", "x-api-key")
                    headers[api_key_header] = api_key
                
                if headers:
                    server_params["headers"] = headers
                
                # Connect to server with timeout and better error handling
                client = streamablehttp_client(**server_params)
                read, write, _ = await client.__aenter__()
                session = ClientSession(read, write)
                await session.__aenter__()
                await session.initialize()
                
                # Load tools
                tools = await load_mcp_tools(session)
                self.tools.extend(tools)
                self.sessions.append((client, session))
                
                print(f"✓ Loaded {len(tools)} tool(s) from {server_name} MCP server")
                for tool in tools:
                    print(f"  - {tool.name}: {tool.description}")
            except Exception as e:
                error_msg = str(e)
                # Don't fail completely on 502/connection errors - just log and continue
                if "502" in error_msg or "Bad Gateway" in error_msg:
                    print(f"⚠️  {server_name} MCP server unavailable (502): {server_url}")
                    print(f"   This is likely a temporary server issue. Consider using local servers.")
                elif "cancel scope" in error_msg.lower():
                    print(f"⚠️  Connection issue with {server_name}: async context error")
                else:
                    print(f"✗ Failed to load {server_name} MCP tools: {error_msg}")
            
            print()  # Empty line between servers
        
        return self.tools
    
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Clean up all sessions - improved error handling"""
        if not self.sessions:
            return  # No sessions to close
        
        print("\n🔄 Closing MCP sessions...")
        import asyncio
        
        # Suppress all errors during cleanup - they're expected due to async context manager
        # limitations when cleanup happens in different tasks
        for client, session in reversed(self.sessions):
            # Close session first - suppress all errors
            if session:
                try:
                    # Use wait_for with short timeout to prevent hanging
                    await asyncio.wait_for(
                        session.__aexit__(exc_type, exc_val, exc_tb),
                        timeout=1.0
                    )
                except Exception:
                    # Suppress all exceptions during cleanup - they're expected
                    # The MCP library creates background tasks that can't be properly
                    # closed when cleanup happens in a different task context
                    pass
            
            # Then close client - suppress all errors
            if client:
                try:
                    await asyncio.wait_for(
                        client.__aexit__(exc_type, exc_val, exc_tb),
                        timeout=1.0
                    )
                except Exception:
                    # Suppress all exceptions during cleanup
                    pass
        
        self.sessions.clear()
        print("✓ All MCP sessions closed")

