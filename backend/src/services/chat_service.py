"""
Chat service - business logic for chat operations
"""
from typing import Optional, AsyncGenerator
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from src.core import Config, User, DB_AVAILABLE
from src.services import history_manager, MCPClientManager, create_llm_from_config, rag_system
from src.services.db_history import db_history_manager
from src.services.tools import retrieve_dosiblog_context
from src.services.advanced_rag import advanced_rag_system
from src.services.react_agent import create_react_agent
from src.utils import sanitize_tools_for_gemini
from src.core.constants import CHAT_MODE_AGENT, CHAT_MODE_RAG


class ChatService:
    """Service for handling chat operations"""
    
    @staticmethod
    async def process_chat(
        message: str,
        session_id: str,
        mode: str,
        user: Optional[User] = None,
        db: Optional["Session"] = None,
        collection_id: Optional[int] = None,
        use_react: bool = False
    ) -> dict:
        """
        Process a chat message and return response
        
        Args:
            message: User's message
            session_id: Session identifier
            mode: Chat mode ("agent" or "rag")
            user: Optional authenticated user
            db: Database session
            collection_id: Optional collection ID for RAG
            use_react: Whether to use ReAct agent for RAG mode
            
        Returns:
            Dictionary with response, session_id, mode, and tools_used
        """
        user_id = user.id if user else None
        
        if mode == CHAT_MODE_RAG:
            return await ChatService._process_rag(message, session_id, user_id, db, collection_id, use_react)
        else:
            return await ChatService._process_agent(message, session_id, user_id, db)
    
    @staticmethod
    async def _process_rag(message: str, session_id: str, user_id: Optional[int], db: Optional["Session"] = None, collection_id: Optional[int] = None, use_react: bool = False) -> dict:
        """Process RAG mode with advanced RAG system"""
        llm_config = Config.load_llm_config()
        
        # Use ReAct agent if requested
        if use_react and user_id:
            react_agent = create_react_agent(llm_config)
            
            # Get chat history
            if DB_AVAILABLE and user_id and db:
                history = db_history_manager.get_session_messages(session_id, user_id, db)
            else:
                history = history_manager.get_session_messages(session_id, user_id)
            
            result = await react_agent.run(
                query=message,
                user_id=user_id,
                session_id=session_id,
                collection_id=collection_id,
                chat_history=history
            )
            
            answer = result["answer"]
            tools_used = [call["name"] for call in result.get("tool_calls", [])]
        else:
            # Use advanced RAG with retrieval
            if user_id:
                # Retrieve relevant documents
                retrieved_docs = advanced_rag_system.retrieve(
                    query=message,
                    user_id=user_id,
                    k=5,
                    use_reranking=True,
                    use_hybrid=True,
                    collection_id=collection_id
                )
                
                # Build context from retrieved documents
                context_parts = []
                for doc in retrieved_docs:
                    content = doc["content"]
                    metadata = doc.get("metadata", {})
                    source = metadata.get("original_filename", "Document")
                    context_parts.append(f"[{source}]\n{content}\n")
                
                context = "\n".join(context_parts) if context_parts else "No relevant documents found."
            else:
                # Fallback to basic RAG
                context = rag_system.retrieve_context(message)
            
            llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
            
            # Get history
            if DB_AVAILABLE and user_id and db:
                history = db_history_manager.get_session_messages(session_id, user_id, db)
                session_history = db_history_manager.get_session_history(session_id, user_id, db)
            else:
                history = history_manager.get_session_messages(session_id, user_id)
                session_history = history_manager.get_session_history(session_id, user_id)
            
            # Build prompt
            prompt = ChatPromptTemplate.from_messages([
                ("system", (
                    "You are a helpful AI assistant. Use the following context to answer questions accurately.\n\n"
                    "Context:\n{context}\n\n"
                    "Rules:\n"
                    "- Answer naturally without mentioning 'the context' or 'according to the context'\n"
                    "- If you don't know, say so honestly\n"
                    "- Be concise and helpful"
                )),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ])
            
            answer = llm.invoke(prompt.format(
                context=context,
                chat_history=history,
                input=message
            )).content
            
            # Save to history
            session_history.add_user_message(HumanMessage(content=message))
            session_history.add_ai_message(AIMessage(content=answer))
            
            tools_used = ["advanced_rag_retrieval"]
        
        return {
            "response": answer,
            "session_id": session_id,
            "mode": CHAT_MODE_RAG,
            "tools_used": tools_used
        }
    
    @staticmethod
    async def _process_agent(message: str, session_id: str, user_id: Optional[int], db: Optional["Session"] = None) -> dict:
        """Process agent mode with tools - user-specific MCP servers only"""
        mcp_servers = Config.load_mcp_servers(user_id=user_id, db=db)
        tools_used = []
        
        async with MCPClientManager(mcp_servers) as mcp_tools:
            all_tools = [retrieve_dosiblog_context] + mcp_tools
            
            llm_config = Config.load_llm_config()
            llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
            
            # Check if LLM is Ollama (doesn't support bind_tools)
            is_ollama = llm_config.get("type", "").lower() == "ollama"
            
            if is_ollama:
                return await ChatService._process_ollama_fallback(
                    message, session_id, user_id, all_tools, llm
                )
            
            # Create agent with tools
            agent = ChatService._create_agent(llm, all_tools, llm_config)
            
            # Get history and run agent
            if DB_AVAILABLE and user_id and db:
                history = db_history_manager.get_session_messages(session_id, user_id, db)
                session_history = db_history_manager.get_session_history(session_id, user_id, db)
            else:
                history = history_manager.get_session_messages(session_id, user_id)
                session_history = history_manager.get_session_history(session_id, user_id)
            
            messages = list(history) + [HumanMessage(content=message)]
            
            # Run agent
            final_answer = ""
            async for event in agent.astream({"messages": messages}, stream_mode="values"):
                last_msg = event["messages"][-1]
                
                if isinstance(last_msg, AIMessage):
                    if getattr(last_msg, "tool_calls", None):
                        for call in last_msg.tool_calls:
                            tools_used.append(call['name'])
                    else:
                        final_answer = ChatService._extract_content(last_msg.content)
            
            # Save to history
            session_history.add_user_message(HumanMessage(content=message))
            session_history.add_ai_message(AIMessage(content=final_answer))
            
            return {
                "response": final_answer,
                "session_id": session_id,
                "mode": CHAT_MODE_AGENT,
                "tools_used": tools_used
            }
    
    @staticmethod
    async def _process_ollama_fallback(message: str, session_id: str, user_id: Optional[int],
                                      all_tools: list, llm, db: Optional["Session"] = None) -> dict:
        """Fallback for Ollama which doesn't support bind_tools"""
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
        
        tool_descriptions = []
        for tool in all_tools:
            if hasattr(tool, 'name'):
                tool_desc = getattr(tool, 'description', 'No description')
                tool_descriptions.append(f"- {tool.name}: {tool_desc}")
        
        tools_context = "\n".join(tool_descriptions) if tool_descriptions else "No tools available"
        
        if DB_AVAILABLE and user_id and db:
            history = db_history_manager.get_session_messages(session_id, user_id, db)
            session_history = db_history_manager.get_session_history(session_id, user_id, db)
        else:
            history = history_manager.get_session_messages(session_id, user_id)
            session_history = history_manager.get_session_history(session_id, user_id)
        
        context = rag_system.retrieve_context(message)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are a helpful AI assistant.\n\n"
                "Available tools:\n{tools_context}\n\n"
                "Context:\n{context}\n\n"
                "Use the context to answer questions accurately."
            )),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])
        
        answer = llm.invoke(prompt.format(
            tools_context=tools_context,
            context=context,
            chat_history=history,
            input=message
        )).content
        
        # Save to history
        session_history.add_user_message(HumanMessage(content=message))
        session_history.add_ai_message(AIMessage(content=answer))
        
        return {
            "response": answer,
            "session_id": session_id,
            "mode": CHAT_MODE_AGENT,
            "tools_used": []
        }
    
    @staticmethod
    def _create_agent(llm, tools: list, llm_config: dict):
        """Create LangChain agent with tools"""
        tool_names = []
        tool_descriptions = []
        for tool in tools:
            if hasattr(tool, 'name'):
                tool_names.append(tool.name)
                tool_desc = getattr(tool, 'description', '')
                if tool_desc:
                    tool_descriptions.append(f"- {tool.name}: {tool_desc}")
            elif hasattr(tool, '__name__'):
                tool_names.append(tool.__name__)
        
        tools_list = '\n'.join(tool_descriptions) if tool_descriptions else ', '.join(tool_names)
        system_prompt = (
            "You are a helpful AI assistant with access to these tools ONLY:\n"
            f"{tools_list}\n\n"
            "ONLY use tools from this exact list. Do not call any tool that is not in this list."
        )
        
        # Sanitize tools for Gemini compatibility
        sanitized_tools = sanitize_tools_for_gemini(tools, llm_config.get("type", ""))
        
        return create_agent(
            model=llm,
            tools=sanitized_tools,
            system_prompt=system_prompt
        )
    
    @staticmethod
    def _extract_content(content) -> str:
        """Extract text content from various content types"""
        if isinstance(content, str):
            return content
        elif isinstance(content, list):
            result = ""
            for item in content:
                if isinstance(item, dict):
                    if "text" in item:
                        result += item["text"]
                    elif "type" in item and item.get("type") == "text":
                        result += item.get("text", "")
                elif isinstance(item, str):
                    result += item
            return result
        elif isinstance(content, dict):
            if "text" in content:
                return content["text"]
            return str(content)
        else:
            return str(content)

