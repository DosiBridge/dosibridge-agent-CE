"""
Utility function to test MCP server connections
"""
import asyncio
import os
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


async def test_mcp_connection(
    url: str,
    connection_type: str = "http",
    api_key: Optional[str] = None,
    headers: Optional[dict] = None,
    timeout: float = 5.0
) -> Tuple[bool, str]:
    """
    Test if an MCP server is accessible and responding.
    Uses the actual MCP client to establish a real connection.
    
    Args:
        url: MCP server URL or command (for stdio)
        connection_type: Connection type - "stdio", "http", or "sse" (default: "http")
        api_key: Optional API key for authentication
        headers: Optional custom headers as key-value pairs
        timeout: Connection timeout in seconds (default: 5.0)
        
    Returns:
        Tuple of (success: bool, message: str)
    """
    try:
        from mcp import ClientSession
        
        # Normalize connection type
        connection_type = connection_type.lower() if connection_type else "http"
        if connection_type not in ("stdio", "http", "sse"):
            return False, f"Invalid connection type: {connection_type}. Must be 'stdio', 'http', or 'sse'"
        
        # Normalize URL based on connection type
        if connection_type == "stdio":
            # For stdio, url is the command to run
            normalized_url = url.strip()
            if not normalized_url:
                return False, "Command is required for stdio connection type"
        else:
            # For http/sse, normalize URL
            normalized_url = url.rstrip('/')
            
            # If testing a local server (same host), try using internal network URL
            # This helps avoid reverse proxy issues when testing your own backend
            try:
                from urllib.parse import urlparse
                parsed = urlparse(normalized_url)
                url_host = parsed.hostname
                
                # Check if URL points to localhost, same host, or contains /api/mcp/ (likely our own backend)
                is_local = (
                    url_host in ('localhost', '127.0.0.1', 'agent-backend', 'agent-backend.agent-dosi-network') or
                    '/api/mcp/' in normalized_url  # If URL contains /api/mcp/, it's likely our own backend
                )
                
                # Use internal container network URL if in Docker and testing local server
                if is_local and (os.getenv('DOCKER_CONTAINER') or os.path.exists('/.dockerenv')):
                    # Replace with internal network URL
                    if url_host not in ('agent-backend', 'agent-backend.agent-dosi-network', 'localhost', '127.0.0.1'):
                        # Extract the path from the original URL
                        path = parsed.path
                        normalized_url = f'http://agent-backend:8000{path}'
                        logger.info(f"Using internal network URL for local server: {normalized_url}")
            except Exception as e:
                # If detection fails, continue with original URL
                logger.debug(f"Could not detect local server: {e}")
                pass
            
            if connection_type == "sse" and not normalized_url.endswith('/sse'):
                if normalized_url.endswith('/mcp'):
                    normalized_url = normalized_url[:-4] + '/sse'
                else:
                    normalized_url = normalized_url.rstrip('/') + '/sse'
            elif connection_type == "http":
                if normalized_url.endswith('/sse'):
                    normalized_url = normalized_url[:-4]
                if not normalized_url.endswith('/mcp'):
                    normalized_url = normalized_url.rstrip('/') + '/mcp'
        
        # Try to establish MCP connection based on type
        client = None
        session = None
        try:
            if connection_type == "stdio":
                # For stdio, use stdio client
                from mcp.client.stdio import stdio_client
                import shlex
                
                # Parse command
                command_parts = shlex.split(normalized_url)
                if not command_parts:
                    return False, "Invalid command for stdio connection"
                
                server_params = {"command": command_parts}
                client = stdio_client(**server_params)
                
            elif connection_type == "sse":
                # For SSE, use SSE client
                from mcp.client.sse import sse_client
                
                server_params = {"url": normalized_url}
                # Start with custom headers if provided
                header_dict = dict(headers) if headers else {}
                # Add API key header if provided
                if api_key:
                    header_dict["x-api-key"] = api_key
                if header_dict:
                    server_params["headers"] = header_dict
                
                client = sse_client(**server_params)
                
            else:  # http
                # For HTTP, use streamable HTTP client
                from mcp.client.streamable_http import streamablehttp_client
                
                server_params = {"url": normalized_url}
                # Start with custom headers if provided
                header_dict = dict(headers) if headers else {}
                # Add API key header if provided
                if api_key:
                    header_dict["x-api-key"] = api_key
                if header_dict:
                    server_params["headers"] = header_dict
                
                client = streamablehttp_client(**server_params)
            
            # Try to connect with timeout
            try:
                read, write, _ = await asyncio.wait_for(
                    client.__aenter__(),
                    timeout=timeout
                )
            except Exception as e:
                error_str = str(e)
                if "closed" in error_str.lower() or "Connection closed" in error_str:
                    return False, "Connection closed immediately - server may be rejecting the connection. If testing your own backend, ensure the endpoint is accessible and not blocked by a reverse proxy."
                raise
            
            # Create session
            try:
                session = ClientSession(read, write)
                await asyncio.wait_for(
                    session.__aenter__(),
                    timeout=3.0
                )
            except Exception as e:
                error_str = str(e)
                if "closed" in error_str.lower() or "Connection closed" in error_str:
                    return False, "Connection closed during session creation - server may not support MCP protocol or is rejecting the connection."
                raise
            
            # Try to initialize (this is the real test)
            try:
                await asyncio.wait_for(
                    session.initialize(),
                    timeout=timeout
                )
            except Exception as e:
                error_str = str(e)
                if "closed" in error_str.lower() or "Connection closed" in error_str:
                    return False, "Connection closed during initialization - server may not be a valid MCP server or is rejecting the initialization request."
                raise
            
            # Connection successful!
            return True, f"Connection successful ({connection_type}) - MCP server is reachable and responding"
            
        except asyncio.TimeoutError:
            return False, f"Connection timeout after {timeout}s - server may be unreachable or slow"
        except ConnectionError as e:
            error_str = str(e)
            if "closed" in error_str.lower() or "Connection closed" in error_str:
                return False, "Connection closed - server may be behind a reverse proxy or firewall. Try checking if the endpoint is accessible directly."
            return False, f"Connection failed - {error_str}"
        except FileNotFoundError as e:
            return False, f"Command not found for stdio connection: {str(e)}"
        except Exception as e:
            error_msg = str(e)
            # Provide more helpful error messages
            if "closed" in error_msg.lower() or "Connection closed" in error_msg:
                return False, "Connection closed - the server closed the connection. This may be due to: 1) Reverse proxy blocking the connection, 2) Server not accepting the MCP protocol, 3) Network/firewall issues. Try accessing the endpoint directly to verify it's reachable."
            elif "404" in error_msg or "Not Found" in error_msg:
                return False, "MCP endpoint not found - check URL and ensure it ends with /mcp"
            elif "401" in error_msg or "Unauthorized" in error_msg:
                return False, "Authentication failed - check API key"
            elif "403" in error_msg or "Forbidden" in error_msg:
                return False, "Access forbidden - check API key permissions or CORS configuration"
            elif "406" in error_msg or "Not Acceptable" in error_msg:
                return False, "Server does not accept the connection format - may not be a valid MCP server"
            elif "502" in error_msg or "Bad Gateway" in error_msg:
                return False, "Bad Gateway - the server is unreachable or the reverse proxy cannot connect to it"
            elif "503" in error_msg or "Service Unavailable" in error_msg:
                return False, "Service Unavailable - the server may be down or overloaded"
            else:
                return False, f"Connection failed: {error_msg}"
        finally:
            # Clean up connections
            try:
                if session:
                    await session.__aexit__(None, None, None)
                if client:
                    await client.__aexit__(None, None, None)
            except Exception:
                pass  # Ignore cleanup errors
                
    except ImportError as e:
        logger.error(f"MCP library not available: {e}")
        return False, "MCP library not available - cannot test connection"
    except Exception as e:
        logger.error(f"Error testing MCP connection: {e}")
        return False, f"Connection test failed: {str(e)}"


async def test_mcp_connection_sync(
    url: str,
    connection_type: str = "http",
    api_key: Optional[str] = None,
    headers: Optional[dict] = None,
    timeout: float = 5.0
) -> Tuple[bool, str]:
    """
    Synchronous wrapper for test_mcp_connection.
    Use this in non-async contexts.
    """
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return await test_mcp_connection(url, connection_type, api_key, headers, timeout)

