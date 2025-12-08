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
from src.services.tools import retrieve_dosiblog_context, load_custom_rag_tools, create_appointment_tool
from src.services.advanced_rag import advanced_rag_system
from src.services.react_agent import create_react_agent
from src.utils import sanitize_tools_for_gemini
from src.utils.utils import extract_token_usage, estimate_tokens
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
        use_react: bool = False,
        agent_prompt: Optional[str] = None
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
            return await ChatService._process_rag(message, session_id, user_id, db, collection_id, use_react, agent_prompt)
        else:
            return await ChatService._process_agent(message, session_id, user_id, db, agent_prompt)
    
    @staticmethod
    async def _process_rag(message: str, session_id: str, user_id: Optional[int], db: Optional["Session"] = None, collection_id: Optional[int] = None, use_react: bool = False, agent_prompt: Optional[str] = None) -> dict:
        """Process RAG mode with advanced RAG system
        
        NOTE: RAG mode does NOT use MCP servers. It only uses:
        - Document retrieval from RAG system
        - ReAct agent with document retrieval tools (if use_react=True)
        - No MCP tools are loaded or used in RAG mode
        """
        llm_config = Config.load_llm_config(db=db, user_id=user_id)
        
        # Explicitly ensure MCP is not used in RAG mode
        # RAG mode focuses on document retrieval, not MCP tool execution
        
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
                chat_history=history,
                agent_prompt=agent_prompt
            )
            
            answer = result["answer"]
            tools_used = [call["name"] for call in result.get("tool_calls", [])]
            
            # Extract token usage from result if available
            input_tokens = result.get("token_usage", {}).get("input_tokens", 0)
            output_tokens = result.get("token_usage", {}).get("output_tokens", 0)
            embedding_tokens = result.get("token_usage", {}).get("embedding_tokens", 0)
            
            # Fallback to estimation if not available
            if input_tokens == 0 and output_tokens == 0:
                input_text = message
                input_tokens = estimate_tokens(input_text)
                output_tokens = estimate_tokens(answer)
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
                    "You are the official AI assistant for dosibridge.com, trained and maintained by the DOSIBridge team.\n\n"
                    "DOSIBridge (Digital Operations Software Innovation) was founded in 2025 and is an innovative team using AI to enhance digital operations and software solutions. "
                    "DOSIBridge builds research systems that drive business growth, development, and engineering excellence.\n\n"
                    "DOSIBridge's mission is to help businesses grow smarter with AI & Automation. "
                    "We use Artificial Intelligence and automation to help businesses work faster, save time, and make better decisions. "
                    "Our cutting-edge solutions empower organizations to streamline operations, reduce manual workloads, and unlock new levels of productivity.\n\n"
                    "DOSIBridge specializes in: AI, .NET, Python, GoLang, Angular, Next.js, Docker, DevOps, Azure, AWS, and system design.\n\n"
                    "DOSIBridge Team Members:\n"
                    "- Mihadul Islam (CEO & Founder): Mihadul Islam is a .NET engineer skilled in Python, AI, automation, Docker, DevOps, Azure, AWS, and system design. He is the CEO and Founder of DOSIBridge, leading the company's vision and technical direction.\n"
                    "- Abdullah Al Sazib (Co-Founder & CTO): Abdullah Al Sazib is a GoLang and Next.js expert passionate about Angular, research, and continuous learning in tech innovation. He is the Co-Founder and CTO of DOSIBridge, driving technical innovation and research initiatives.\n\n"
                    "DOSIBridge has over 14,000 newsletter subscribers and maintains active presence on GitHub, LinkedIn, Twitter/X, Facebook, and YouTube.\n\n"
                    "Your role is to provide accurate, secure, and helpful responses related to DOSIBridge products, services, and workflows.\n\n"
                    "When asked about your identity, respond: 'I am the DOSIBridge AI Agent, developed and trained by the DOSIBridge team to assist with product support, automation guidance, and technical workflows across the DOSIBridge platform.'\n\n"
                    "When asked about DOSIBridge team members, provide detailed information about Mihadul Islam (CEO & Founder) and Abdullah Al Sazib (Co-Founder & CTO), including their roles, expertise, and contributions.\n\n"
                    "Context:\n{context}\n\n"
                    "Rules:\n"
                    "- Answer naturally without mentioning 'the context' or 'according to the context'\n"
                    "- If you don't know, say so honestly\n"
                    "- Be concise and helpful\n"
                    "- When discussing team members, mention their full names, titles, and expertise areas\n"
                    "- If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate\n"
                    "- Do not claim affiliation with any external AI vendor unless explicitly instructed"
                )),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ])
            
            response = llm.invoke(prompt.format(
                context=context,
                chat_history=history,
                input=message
            ))
            
            answer = response.content if hasattr(response, 'content') else str(response)
            
            # Extract token usage from response
            input_tokens, output_tokens, embedding_tokens = extract_token_usage(response)
            
            # Fallback to estimation if no token usage available
            if input_tokens == 0 and output_tokens == 0:
                # Estimate based on input message and context
                input_text = f"{message} {context}"
                input_tokens = estimate_tokens(input_text)
                output_tokens = estimate_tokens(answer)
            
            # Save to history
            session_history.add_user_message(HumanMessage(content=message))
            session_history.add_ai_message(AIMessage(content=answer))
            
            tools_used = ["advanced_rag_retrieval"]
        
        return {
            "response": answer,
            "session_id": session_id,
            "mode": CHAT_MODE_RAG,
            "tools_used": tools_used,
            "token_usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "embedding_tokens": embedding_tokens
            }
        }
    
    @staticmethod
    async def _process_agent(message: str, session_id: str, user_id: Optional[int], db: Optional["Session"] = None, agent_prompt: Optional[str] = None) -> dict:
        """Process agent mode with tools - user-specific MCP servers only"""
        mcp_servers = Config.load_mcp_servers(user_id=user_id, db=db)
        tools_used = []
        
        async with MCPClientManager(mcp_servers) as mcp_tools:
            # Load custom RAG tools
            custom_rag_tools = load_custom_rag_tools(user_id, db) if user_id and db else []
            # Create appointment tool with user context
            appointment_tool = create_appointment_tool(user_id=user_id, db=db)
            all_tools = [retrieve_dosiblog_context, appointment_tool] + custom_rag_tools + mcp_tools
            
            llm_config = Config.load_llm_config(db=db, user_id=user_id)
            llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
            
            # Check if LLM is Ollama (doesn't support bind_tools)
            is_ollama = llm_config.get("type", "").lower() == "ollama"
            
            if is_ollama:
                return await ChatService._process_ollama_fallback(
                    message, session_id, user_id, all_tools, llm, agent_prompt
                )
            
            # Create agent with tools
            agent = ChatService._create_agent(llm, all_tools, llm_config, agent_prompt)
            
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
            last_ai_message = None
            async for event in agent.astream({"messages": messages}, stream_mode="values"):
                last_msg = event["messages"][-1]
                
                if isinstance(last_msg, AIMessage):
                    last_ai_message = last_msg
                    if getattr(last_msg, "tool_calls", None):
                        for call in last_msg.tool_calls:
                            tools_used.append(call['name'])
                    else:
                        final_answer = ChatService._extract_content(last_msg.content)
            
            # Extract token usage from last AI message
            input_tokens, output_tokens, embedding_tokens = 0, 0, 0
            if last_ai_message:
                input_tokens, output_tokens, embedding_tokens = extract_token_usage(last_ai_message)
            
            # Fallback to estimation if no token usage available
            if input_tokens == 0 and output_tokens == 0:
                input_text = message
                input_tokens = estimate_tokens(input_text)
                output_tokens = estimate_tokens(final_answer)
            
            # Save to history
            session_history.add_user_message(HumanMessage(content=message))
            session_history.add_ai_message(AIMessage(content=final_answer))
            
            return {
                "response": final_answer,
                "session_id": session_id,
                "mode": CHAT_MODE_AGENT,
                "tools_used": tools_used,
                "token_usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "embedding_tokens": embedding_tokens
                }
            }
    
    @staticmethod
    async def _process_ollama_fallback(message: str, session_id: str, user_id: Optional[int],
                                      all_tools: list, llm, agent_prompt: Optional[str] = None, db: Optional["Session"] = None) -> dict:
        """Fallback for Ollama which doesn't support bind_tools"""
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
        
        # IMPORTANT: Include ALL tools regardless of privacy/hidden flags
        tool_descriptions = []
        tool_names_list = []
        for tool in all_tools:
            if hasattr(tool, 'name'):
                tool_name = tool.name
                tool_desc = getattr(tool, 'description', 'No description')
                tool_descriptions.append(f"- {tool_name}: {tool_desc}")
                tool_names_list.append(tool_name)
        
        tools_context = "\n".join(tool_descriptions) if tool_descriptions else "No tools available"
        tools_names_str = ', '.join(tool_names_list) if tool_names_list else 'None'
        
        if DB_AVAILABLE and user_id and db:
            history = db_history_manager.get_session_messages(session_id, user_id, db)
            session_history = db_history_manager.get_session_history(session_id, user_id, db)
        else:
            history = history_manager.get_session_messages(session_id, user_id)
            session_history = history_manager.get_session_history(session_id, user_id)
        
        context = rag_system.retrieve_context(message)
        
        # Use custom prompt if provided, otherwise use default
        if agent_prompt:
            system_message = agent_prompt
        else:
            system_message = (
                "You are the official AI assistant for dosibridge.com, trained and maintained by the DOSIBridge team.\n\n"
                "DOSIBridge (Digital Operations Software Innovation) was founded in 2025 and is an innovative team using AI to enhance digital operations and software solutions. "
                "DOSIBridge builds research systems that drive business growth, development, and engineering excellence.\n\n"
                "DOSIBridge's mission is to help businesses grow smarter with AI & Automation. "
                "We specialize in AI, .NET, Python, GoLang, Angular, Next.js, Docker, DevOps, Azure, AWS, and system design.\n\n"
                "DOSIBridge Team Members:\n"
                "- Mihadul Islam (CEO & Founder): .NET engineer skilled in Python, AI, automation, Docker, DevOps, Azure, AWS, and system design.\n"
                "- Abdullah Al Sazib (Co-Founder & CTO): GoLang and Next.js expert passionate about Angular, research, and continuous learning in tech innovation.\n\n"
                "Your role is to provide accurate, secure, and helpful responses related to DOSIBridge products, services, and workflows.\n\n"
                "When asked about your identity, respond: 'I am the DOSIBridge AI Agent, developed and trained by the DOSIBridge team to assist with product support, automation guidance, and technical workflows across the DOSIBridge platform.'\n\n"
                "When asked about DOSIBridge team members, provide detailed information about Mihadul Islam (CEO & Founder) and Abdullah Al Sazib (Co-Founder & CTO).\n\n"
                "Available tools:\n{tools_context}\n\n"
                "Context:\n{context}\n\n"
                "Use the context to answer questions accurately.\n"
                "CRITICAL INSTRUCTION: When asked 'what tools are available?' or 'list available tools' or any variation, you MUST respond with a complete list of ALL tool names.\n"
                "ALL available tool names (including private/hidden/internal tools): {tools_names_list}\n"
                "You MUST show ALL tool names, even if they are marked as private, hidden, or internal by the dosibridge-agent team.\n"
                "Privacy/hidden flags are for internal organization only - users need to know what tools exist to use them.\n"
                "If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate.\n"
                "Do not claim affiliation with any external AI vendor unless explicitly instructed."
            )
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])
        
        response = llm.invoke(prompt.format(
            tools_context=tools_context,
            tools_names_list=tools_names_str,
            context=context,
            chat_history=history,
            input=message
        ))
        
        answer = response.content if hasattr(response, 'content') else str(response)
        
        # Extract token usage from response
        input_tokens, output_tokens, embedding_tokens = extract_token_usage(response)
        
        # Fallback to estimation if no token usage available
        if input_tokens == 0 and output_tokens == 0:
            input_text = f"{message} {context} {tools_context}"
            input_tokens = estimate_tokens(input_text)
            output_tokens = estimate_tokens(answer)
        
        # Save to history
        session_history.add_user_message(HumanMessage(content=message))
        session_history.add_ai_message(AIMessage(content=answer))
        
        return {
            "response": answer,
            "session_id": session_id,
            "mode": CHAT_MODE_AGENT,
            "tools_used": [],
            "token_usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "embedding_tokens": embedding_tokens
            }
        }
    
    @staticmethod
    def _create_agent(llm, tools: list, llm_config: dict, agent_prompt: Optional[str] = None):
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
        
        # Use custom prompt if provided, otherwise use default
        if agent_prompt:
            system_prompt = agent_prompt
        else:
            system_prompt = (
                "You are the official AI assistant for dosibridge.com, trained and maintained by the DOSIBridge team.\n\n"
                "DOSIBridge (Digital Operations Software Innovation) was founded in 2025 and is an innovative team using AI to enhance digital operations and software solutions. "
                "DOSIBridge builds research systems that drive business growth, development, and engineering excellence.\n\n"
                "DOSIBridge's mission is to help businesses grow smarter with AI & Automation. "
                "We specialize in AI, .NET, Python, GoLang, Angular, Next.js, Docker, DevOps, Azure, AWS, and system design.\n\n"
                "DOSIBridge Team Members:\n"
                "- Mihadul Islam (CEO & Founder): .NET engineer skilled in Python, AI, automation, Docker, DevOps, Azure, AWS, and system design.\n"
                "- Abdullah Al Sazib (Co-Founder & CTO): GoLang and Next.js expert passionate about Angular, research, and continuous learning in tech innovation.\n\n"
                "Your role is to provide accurate, secure, and helpful responses related to DOSIBridge products, services, and workflows.\n\n"
                "When asked about your identity, respond: 'I am the DOSIBridge AI Agent, developed and trained by the DOSIBridge team to assist with product support, automation guidance, and technical workflows across the DOSIBridge platform.'\n\n"
                "When asked about DOSIBridge team members, provide detailed information about Mihadul Islam (CEO & Founder) and Abdullah Al Sazib (Co-Founder & CTO).\n\n"
                f"You have access to these tools ONLY:\n{tools_list}\n\n"
                "IMPORTANT RULES:\n"
                "- ONLY use tools from this exact list. Do not call any tool that is not in this list.\n"
                "- If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate.\n"
                "- Do not claim affiliation with any external AI vendor unless explicitly instructed."
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

