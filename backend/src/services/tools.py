"""
Tool definitions for the agent
"""
from langchain_core.tools import tool, BaseTool
from typing import List, Optional
from .rag import rag_system
from .advanced_rag import advanced_rag_system
from src.core import CustomRAGTool, DB_AVAILABLE


@tool("retrieve_dosiblog_context")
def retrieve_dosiblog_context(query: str) -> str:
    """Retrieves relevant context about DosiBlog projects and related topics."""
    print(f"🔍 Calling Enhanced RAG Tool for query: {query}")
    context = rag_system.retrieve_context(query)
    return f"Retrieved context:\n{context}"


def create_custom_rag_tool(tool_config: dict, user_id: int) -> BaseTool:
    """
    Dynamically create a LangChain tool from a custom RAG tool configuration
    
    Args:
        tool_config: Dictionary with 'name', 'description', 'collection_id'
        user_id: User ID for document retrieval
    
    Returns:
        LangChain BaseTool instance
    """
    tool_name = tool_config["name"]
    tool_description = tool_config["description"]
    collection_id = tool_config.get("collection_id")
    
    @tool(tool_name)
    def custom_rag_retriever(query: str) -> str:
        """Custom RAG tool for retrieving information from user's documents."""
        print(f"🔍 Calling Custom RAG Tool '{tool_name}' for query: {query}")
        
        try:
            # Use advanced RAG system to retrieve from user's documents
            results = advanced_rag_system.retrieve(
                query=query,
                user_id=user_id,
                k=5,
                use_reranking=True,
                use_hybrid=True,
                collection_id=collection_id
            )
            
            if not results:
                return f"No relevant documents found for query: {query}"
            
            context_parts = []
            for i, result in enumerate(results, 1):
                content = result["content"]
                metadata = result.get("metadata", {})
                source = metadata.get("original_filename", "Document")
                context_parts.append(f"[{source}]\n{content}\n")
            
            context = "\n".join(context_parts)
            return f"Retrieved context from {tool_name}:\n{context}"
        except Exception as e:
            return f"Error retrieving context: {str(e)}"
    
    # Update the tool's description
    custom_rag_retriever.description = tool_description
    
    return custom_rag_retriever


def load_custom_rag_tools(user_id: Optional[int], db=None) -> List[BaseTool]:
    """
    Load all enabled custom RAG tools for a user
    
    Args:
        user_id: User ID (None for unauthenticated users)
        db: Database session
    
    Returns:
        List of LangChain BaseTool instances
    """
    if not DB_AVAILABLE or CustomRAGTool is None or not user_id or not db:
        return []
    
    try:
        custom_tools = db.query(CustomRAGTool).filter(
            CustomRAGTool.user_id == user_id,
            CustomRAGTool.enabled == True
        ).all()
        
        langchain_tools = []
        for tool_config in custom_tools:
            try:
                tool_dict = tool_config.to_dict()
                langchain_tool = create_custom_rag_tool(tool_dict, user_id)
                langchain_tools.append(langchain_tool)
            except Exception as e:
                print(f"⚠️  Failed to create custom RAG tool '{tool_config.name}': {e}")
                continue
        
        return langchain_tools
    except Exception as e:
        print(f"⚠️  Error loading custom RAG tools: {e}")
        return []

