#!/usr/bin/env python
"""
Dynamic MCP Agent - Clean entry point with modular architecture

Usage examples:
    python ai_mcp_dynamic.py
    python ai_mcp_dynamic.py --add-server '{"name":"MyServer","url":"https://example.com/mcp"}'
    python ai_mcp_dynamic.py --query "What is DosiBlog?" --session-id "user123"
"""
import asyncio
import argparse
import json

from src.config import Config
from src.history import history_manager
from src.agent import run_agent_mode, run_rag_mode


async def main(
    query: str = None,
    additional_servers: list = None,
    session_id: str = "default",
    mode: str = "agent",
    show_history: bool = False,
    clear_history: bool = False
):
    """
    Main function to set up and run the agent with RAG and history support
    
    Args:
        query: Query to execute
        additional_servers: Additional MCP servers to connect to
        session_id: Session ID for conversation history
        mode: 'agent' for agent with tools, 'rag' for RAG-only mode
        show_history: Show session history information
        clear_history: Clear the session history
    """
    
    print("\n" + "="*60)
    print("🚀 AI Agent with RAG & History Maintenance")
    print("="*60 + "\n")
    
    # Handle history commands
    if show_history:
        history_manager.show_session_info(session_id if session_id != "default" else None)
        return
    
    if clear_history:
        history_manager.clear_session(session_id)
        return
    
    # Run in selected mode
    if mode == "rag":
        await run_rag_mode(query, session_id)
    else:
        await run_agent_mode(query, additional_servers, session_id)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='AI Agent with RAG, History Maintenance, and Dynamic MCP Tools',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with default examples
  python ai_mcp_dynamic.py
  
  # Query with specific session
  python ai_mcp_dynamic.py --query "What is DosiBlog?" --session-id user123
  
  # Continue conversation in same session
  python ai_mcp_dynamic.py --query "Who created it?" --session-id user123
  
  # RAG-only mode (no MCP tools)
  python ai_mcp_dynamic.py --mode rag --query "Tell me about DosiBlog"
  
  # Show session history
  python ai_mcp_dynamic.py --show-history --session-id user123
  
  # Clear session history
  python ai_mcp_dynamic.py --clear-history --session-id user123
  
  # Add custom MCP server
  python ai_mcp_dynamic.py --add-server '{"name":"MyServer","url":"https://example.com/mcp"}'
        """
    )
    
    # Query options
    parser.add_argument('--query', '-q', type=str, 
                        help='Query to send to the agent')
    parser.add_argument('--mode', '-m', type=str, choices=['agent', 'rag'], default='agent',
                        help='Mode: "agent" (with MCP tools) or "rag" (RAG only)')
    
    # Session management
    parser.add_argument('--session-id', '--sid', type=str, default='default',
                        help='Session ID for conversation history (default: "default")')
    parser.add_argument('--show-history', action='store_true',
                        help='Show conversation history for session')
    parser.add_argument('--clear-history', action='store_true',
                        help='Clear conversation history for session')
    
    # MCP server configuration
    parser.add_argument('--add-server', '-s', type=str, action='append',
                        help='Add MCP server as JSON: \'{"name":"Name","url":"https://..."}\'')
    
    args = parser.parse_args()
    
    # Parse additional servers
    additional_servers = []
    if args.add_server:
        for server_json in args.add_server:
            try:
                additional_servers.append(json.loads(server_json))
            except json.JSONDecodeError as e:
                print(f"⚠️  Invalid server JSON: {e}")
    
    # Run main function with all options
    asyncio.run(main(
        query=args.query,
        additional_servers=additional_servers,
        session_id=args.session_id,
        mode=args.mode,
        show_history=args.show_history,
        clear_history=args.clear_history
    ))

