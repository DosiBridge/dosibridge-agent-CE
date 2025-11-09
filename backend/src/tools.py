"""
Tool definitions for the agent
"""
from langchain_core.tools import tool
from .rag import rag_system


@tool("retrieve_dosiblog_context")
def retrieve_dosiblog_context(query: str) -> str:
    """Retrieves relevant context about DosiBlog projects and related topics."""
    print(f"🔍 Calling Enhanced RAG Tool for query: {query}")
    context = rag_system.retrieve_context(query)
    return f"Retrieved context:\n{context}"

