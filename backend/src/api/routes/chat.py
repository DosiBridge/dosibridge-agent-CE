"""
Chat endpoints (streaming and non-streaming)
"""
import asyncio
import json
import traceback
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from starlette.requests import Request
from fastapi.responses import StreamingResponse
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.tools import BaseTool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from src.core import Config, User, get_db, DB_AVAILABLE
from src.core.auth import get_current_active_user, get_current_user
from src.services import history_manager, MCPClientManager, create_llm_from_config, rag_system
from src.services.chat_service import ChatService
from src.services.tools import retrieve_dosiblog_context, load_custom_rag_tools, create_appointment_tool
from src.services.usage_tracker import usage_tracker
from typing import Optional
from sqlalchemy.orm import Session
from ..models import ChatRequest, ChatResponse
from ..exceptions import APIException, ValidationError, UnauthorizedError
from src.utils import sanitize_tools_for_gemini
from src.utils.utils import extract_token_usage, estimate_tokens
from src.utils.logger import app_logger
from src.core.constants import DAILY_REQUEST_LIMIT, DAILY_REQUEST_LIMIT_UNAUTHENTICATED

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ChatResponse:
    """
    Non-streaming chat endpoint
    
    Args:
        request: FastAPI Request object (for rate limiting)
        chat_request: ChatRequest with message, session_id, and mode
        background_tasks: FastAPI BackgroundTasks for async operations
        current_user: Optional authenticated user
        db: Database session
        
    Returns:
        ChatResponse with answer
    """
    try:
        user_id = current_user.id if current_user else None
        
        # Get IP address for unauthenticated users
        ip_address = usage_tracker.get_client_ip(request) if user_id is None else None
        
        # RAG mode requires authentication (Agent mode works without login)
        if chat_request.mode == "rag" and not current_user:
            app_logger.warning(
                "Unauthorized RAG mode access attempt",
                {"session_id": chat_request.session_id, "mode": chat_request.mode}
            )
            raise UnauthorizedError(
                "Authentication required for RAG mode. Please log in to upload documents and query them."
            )
        
        # Load user's LLM config to check if using default LLM
        llm_config = Config.load_llm_config(db=db, user_id=user_id)
        if not llm_config:
            error_msg = "No LLM configuration found. Please configure an LLM provider via the superadmin dashboard or create a personal LLM config."
            raise HTTPException(status_code=400, detail=error_msg)
        
        is_default_llm = llm_config.get("is_default", False) or (
            llm_config.get("type", "").lower() == "deepseek" and 
            not llm_config.get("api_key")  # Using system default DeepSeek
        )
        
        # Check daily rate limit
        # - Authenticated users: 100/day for default LLM, unlimited for custom keys
        # - Unauthenticated users: 30/day
        limit = DAILY_REQUEST_LIMIT_UNAUTHENTICATED if user_id is None else DAILY_REQUEST_LIMIT
        is_allowed, current_count, remaining = usage_tracker.check_daily_limit(
            user_id, db, is_default_llm=is_default_llm, ip_address=ip_address
        )
        if not is_allowed:
            limit_msg = limit if is_default_llm else "unlimited"
            app_logger.warning(
                "Daily rate limit exceeded",
                {"user_id": user_id, "ip_address": ip_address, "current_count": current_count, "limit": limit, "is_default_llm": is_default_llm}
            )
            error_msg = f"Daily request limit exceeded. You have used {current_count}/{limit} requests today."
            if user_id is None:
                error_msg += " Please create an account or log in to get 100 requests per day, or add your own API key for unlimited requests."
            else:
                error_msg += " Please add your own API key for unlimited requests or try again tomorrow."
            raise HTTPException(status_code=429, detail=error_msg)
        
        app_logger.info(
            "Processing chat request",
            {
                "user_id": user_id,
                "session_id": chat_request.session_id,
                "mode": chat_request.mode,
                "message_length": len(chat_request.message),
                "daily_usage": f"{current_count}/{DAILY_REQUEST_LIMIT}",
                "remaining": remaining
            }
        )
        
        # Use ChatService for processing
        result = await ChatService.process_chat(
            message=chat_request.message,
            session_id=chat_request.session_id,
            mode=chat_request.mode,
            user=current_user,
            db=db,
            collection_id=chat_request.collection_id,
            use_react=chat_request.use_react,
            agent_prompt=chat_request.agent_prompt
        )
        
        # Schedule async summary update in background (non-blocking)
        # Note: We pass user_id and session_id, not db session (will create new session)
        if current_user and DB_AVAILABLE:
            from src.services.db_history import db_history_manager
            from src.core import get_db_context
            
            async def update_summary_task():
                # Create new DB session for background task
                with get_db_context() as bg_db:
                    await db_history_manager.update_summary(
                        chat_request.session_id,
                        current_user.id,
                        bg_db
                    )
            
            background_tasks.add_task(update_summary_task)
        
        # Record usage with actual token counts from LLM response
        # llm_config already loaded above
        token_usage = result.get("token_usage", {})
        usage_tracker.record_request(
            user_id=user_id,
            db=db,
            llm_provider=llm_config.get("type"),
            llm_model=llm_config.get("model"),
            input_tokens=token_usage.get("input_tokens", 0),
            output_tokens=token_usage.get("output_tokens", 0),
            embedding_tokens=token_usage.get("embedding_tokens", 0),
            mode=chat_request.mode,
            session_id=chat_request.session_id,
            success=True,
            ip_address=ip_address
        )
        
        app_logger.info(
            "Chat request processed successfully",
            {"user_id": user_id, "session_id": chat_request.session_id}
        )
        
        return ChatResponse(**result)
    except (APIException, HTTPException):
        raise
    except Exception as e:
        app_logger.error(
            "Error processing chat request",
            {
                "user_id": user_id if current_user else None,
                "session_id": chat_request.session_id,
                "error": str(e)
            },
            exc_info=True
        )
        raise HTTPException(status_code=500, detail="An error occurred while processing your request")


@router.post("/chat/stream")
async def chat_stream(
    request: Request,
    chat_request: ChatRequest,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Streaming chat endpoint - returns chunks as they're generated
    
    Args:
        request: FastAPI Request object (for rate limiting)
        chat_request: ChatRequest with message, session_id, and mode
        current_user: Optional authenticated user
        
    Returns:
        StreamingResponse with Server-Sent Events
    """
    async def generate() -> AsyncGenerator[str, None]:
        stream_completed = False
        user_id = current_user.id if current_user else None
        
        # Get IP address for unauthenticated users
        ip_address = usage_tracker.get_client_ip(request) if user_id is None else None
        
        # RAG mode requires authentication (Agent mode works without login)
        if chat_request.mode == "rag" and not current_user:
            yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': 'Authentication required for RAG mode. Please log in to upload documents and query them.'})}\n\n"
            return
        
        # Load user's LLM config to check if using default LLM
        llm_config = Config.load_llm_config(db=db, user_id=user_id)
        if not llm_config:
            error_msg = "No LLM configuration found. Please configure an LLM provider via the superadmin dashboard or create a personal LLM config."
            yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': error_msg})}\n\n"
            return
        
        is_default_llm = llm_config.get("is_default", False) or (
            llm_config.get("type", "").lower() == "deepseek" and 
            not llm_config.get("api_key")  # Using system default DeepSeek
        )
        
        # Check daily rate limit
        # - Authenticated users: 100/day for default LLM, unlimited for custom keys
        # - Unauthenticated users: 30/day
        from src.core.constants import DAILY_REQUEST_LIMIT_UNAUTHENTICATED
        limit = DAILY_REQUEST_LIMIT_UNAUTHENTICATED if user_id is None else DAILY_REQUEST_LIMIT
        is_allowed, current_count, remaining = usage_tracker.check_daily_limit(
            user_id, db, is_default_llm=is_default_llm, ip_address=ip_address
        )
        if not is_allowed:
            app_logger.warning(
                "Daily rate limit exceeded (streaming)",
                {"user_id": user_id, "ip_address": ip_address, "current_count": current_count, "limit": limit, "is_default_llm": is_default_llm}
            )
            error_msg = f"Daily request limit exceeded. You have used {current_count}/{limit} requests today."
            if user_id is None:
                error_msg += " Please create an account or log in to get 100 requests per day, or add your own API key for unlimited requests."
            else:
                error_msg += " Please add your own API key for unlimited requests or try again tomorrow."
            yield f"data: {json.dumps({'chunk': '', 'done': True, 'error': error_msg})}\n\n"
            return
        
        try:
            # Send initial connection message to verify stream is working
            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'connected'})}\n\n"
            
            # Add a small delay to ensure connection is established
            await asyncio.sleep(0.1)
            
            if chat_request.mode == "rag":
                # RAG mode: Document retrieval only - NO MCP servers or tools
                # RAG mode focuses on retrieving and using documents from the knowledge base
                # It does NOT use MCP (Model Context Protocol) tools
                yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'thinking'})}\n\n"
                
                llm_config = Config.load_llm_config(db=db, user_id=user_id)
                try:
                    llm = create_llm_from_config(llm_config, streaming=True, temperature=0)
                except ImportError as e:
                    # Missing package - should be in requirements.txt
                    error_msg = (
                        f"Missing LLM package: {str(e)}\n\n"
                        "All required packages should be pre-installed from requirements.txt.\n"
                        "Please redeploy after ensuring requirements.txt includes all LLM provider packages."
                    )
                    yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                    stream_completed = True
                    return
                except Exception as e:
                    error_msg = f"Failed to initialize LLM: {str(e)}"
                    yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                    stream_completed = True
                    return
                
                # Get history (use database if available)
                from src.core import DB_AVAILABLE
                from src.services.db_history import db_history_manager
                
                if DB_AVAILABLE and user_id:
                    history = db_history_manager.get_session_messages(chat_request.session_id, user_id, db)
                else:
                    history = history_manager.get_session_messages(chat_request.session_id, user_id)
                
                # Build context
                prompt = ChatPromptTemplate.from_messages([
                    ("system", (
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
                        "Context: {context}\n\n"
                        "If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate.\n"
                        "Do not claim affiliation with any external AI vendor unless explicitly instructed."
                    )),
                    MessagesPlaceholder("chat_history"),
                    ("human", "{input}"),
                ])
                
                # Retrieve context
                context = rag_system.retrieve_context(chat_request.message)
                
                # Switch to answering status
                yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'answering'})}\n\n"
                
                # Stream response
                full_response = ""
                try:
                    prompt_messages = prompt.format(
                        context=context,
                        chat_history=history,
                        input=chat_request.message
                    )
                    async for chunk in llm.astream(prompt_messages):
                        if hasattr(chunk, 'content') and chunk.content:
                            # Handle different content types (string, list, dict)
                            content_raw = chunk.content
                            
                            # Convert content to string if needed
                            if isinstance(content_raw, str):
                                content_str = content_raw
                            elif isinstance(content_raw, list):
                                # Handle list of content blocks (e.g., from Gemini)
                                content_str = ""
                                for item in content_raw:
                                    if isinstance(item, dict):
                                        # Extract text from content blocks
                                        if "text" in item:
                                            content_str += item["text"]
                                        elif "type" in item and item.get("type") == "text":
                                            content_str += item.get("text", "")
                                    elif isinstance(item, str):
                                        content_str += item
                            elif isinstance(content_raw, dict):
                                # Handle dict content
                                if "text" in content_raw:
                                    content_str = content_raw["text"]
                                else:
                                    content_str = str(content_raw)
                            else:
                                content_str = str(content_raw)
                            
                            # Stream character by character for smooth display
                            if content_str:
                                for char in content_str:
                                    full_response += char
                                    yield f"data: {json.dumps({'chunk': char, 'done': False})}\n\n"
                                    await asyncio.sleep(0.005)  # Small delay for smooth streaming
                except Exception as e:
                    import traceback
                    error_details = str(e)
                    if not error_details or error_details == "":
                        error_details = repr(e)
                    tb_str = traceback.format_exc()
                    
                    # Provide helpful error messages
                    if "Connection" in tb_str or "timeout" in tb_str.lower() or "refused" in tb_str.lower():
                        error_details = (
                            f"Connection error to Ollama: {error_details}. "
                            "Please check:\n"
                            "- Ollama is running: docker ps | grep ollama\n"
                            "- Base URL is correct (try http://localhost:11434 or http://host.docker.internal:11434)\n"
                            "- Test connection: curl http://localhost:11434/api/tags"
                        )
                    elif "model" in tb_str.lower() and "not found" in tb_str.lower():
                        error_details = (
                            f"Model not found: {error_details}. "
                            "Please check the model name is correct and the model is available in Ollama."
                        )
                    else:
                        error_details = f"LLM streaming error: {error_details}"
                    
                    app_logger.error(
                        "RAG streaming error",
                        {
                            "session_id": chat_request.session_id,
                            "user_id": user_id,
                            "error": str(e),
                            "traceback": tb_str,
                        }
                    )
                    try:
                        yield f"data: {json.dumps({'error': error_details, 'done': True})}\n\n"
                        stream_completed = True
                    except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                        stream_completed = True
                    return
                
                # Save to history (use database if available)
                if full_response:
                    from src.core import DB_AVAILABLE
                    from src.services.db_history import db_history_manager
                    
                    if DB_AVAILABLE and user_id:
                        session_history = db_history_manager.get_session_history(chat_request.session_id, user_id, db)
                    else:
                        session_history = history_manager.get_session_history(chat_request.session_id, user_id)
                    
                    session_history.add_user_message(chat_request.message)
                    session_history.add_ai_message(full_response)
                    
                    # Record usage after successful response
                    llm_config = Config.load_llm_config(db=db, user_id=user_id)
                    # Try to estimate tokens (streaming doesn't always provide usage metadata)
                    input_tokens = estimate_tokens(chat_request.message)
                    output_tokens = estimate_tokens(full_response)
                    
                    # Only record usage if llm_config exists
                    if llm_config:
                        usage_tracker.record_request(
                            user_id=user_id,
                            db=db,
                            llm_provider=llm_config.get("type"),
                            llm_model=llm_config.get("model"),
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            embedding_tokens=0,
                            mode=chat_request.mode,
                            session_id=chat_request.session_id,
                            success=True,
                            ip_address=ip_address
                        )
                
                yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"
                stream_completed = True
                
            else:
                # Agent mode with streaming
                yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'thinking'})}\n\n"
                
                mcp_servers = Config.load_mcp_servers(user_id=user_id, db=db)
                
                # If no MCP servers, use only default tools (works without login)
                if not mcp_servers:
                    mcp_tools = []
                    # Load custom RAG tools if authenticated
                    custom_rag_tools = load_custom_rag_tools(user_id, db) if user_id and db else []
                    # Create appointment tool with user context
                    appointment_tool = create_appointment_tool(user_id=user_id, db=db)
                    all_tools = [retrieve_dosiblog_context, appointment_tool] + custom_rag_tools
                    
                    # Get LLM from config
                    llm_config = Config.load_llm_config(db=db, user_id=user_id)
                    if not llm_config:
                        error_msg = "No LLM configuration found. Please configure an LLM provider via the superadmin dashboard or create a personal LLM config."
                        yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                        stream_completed = True
                        return
                    
                    try:
                        llm = create_llm_from_config(llm_config, streaming=True, temperature=0)
                    except ImportError as e:
                        error_msg = (
                            f"Missing LLM package: {str(e)}\n\n"
                            "All required packages should be pre-installed from requirements.txt.\n"
                            "Please redeploy after ensuring requirements.txt includes all LLM provider packages."
                        )
                        yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                        stream_completed = True
                        return
                    except Exception as e:
                        error_msg = f"Failed to initialize LLM: {str(e)}"
                        yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                        stream_completed = True
                        return
                    
                    # Create agent with default tools only
                    # Use custom prompt if provided, otherwise use default
                    if chat_request.agent_prompt:
                        system_prompt = chat_request.agent_prompt
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
                            "You can help answer questions and provide information. Use the available tools when appropriate.\n\n"
                            "IMPORTANT: Do NOT mention or reveal the names of internal tools, MCP tools, or any technical implementation details in your responses. Focus on providing helpful answers without exposing internal system architecture.\n"
                            "If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate.\n"
                            "Do not claim affiliation with any external AI vendor unless explicitly instructed."
                        )
                    
                    # Ensure tools are properly formatted for LangChain
                    formatted_tools = []
                    for tool in all_tools:
                        if isinstance(tool, BaseTool):
                            formatted_tools.append(tool)
                        else:
                            formatted_tools.append(tool)
                    
                    # Sanitize tools for Gemini compatibility
                    sanitized_tools = sanitize_tools_for_gemini(formatted_tools, llm_config.get("type", ""))
                    
                    try:
                        agent = create_agent(
                            model=llm,
                            tools=sanitized_tools,
                            system_prompt=system_prompt
                        )
                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'agent_ready'})}\n\n"
                    except Exception as e:
                        import traceback
                        error_msg = f"Failed to create agent: {str(e)}\n{traceback.format_exc()[:300]}"
                        try:
                            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                            stream_completed = True
                        except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                            stream_completed = True
                        return
                    
                    # Get history
                    from src.core import DB_AVAILABLE
                    from src.services.db_history import db_history_manager
                    
                    if DB_AVAILABLE and user_id:
                        history = db_history_manager.get_session_messages(chat_request.session_id, user_id, db)
                    else:
                        history = history_manager.get_session_messages(chat_request.session_id, user_id)
                    messages = list(history) + [HumanMessage(content=chat_request.message)]
                    
                    # Stream agent responses
                    full_response = ""
                    tool_calls_made = []
                    seen_tools = set()
                    last_streamed_length = 0
                    is_thinking = True
                    is_answering = False
                    last_ai_message = None  # Track last AI message for token extraction
                    
                    try:
                        async for event in agent.astream({"messages": messages}, stream_mode="values"):
                            last_msg = event["messages"][-1]
                            
                            # Track last AI message for token usage extraction
                            if isinstance(last_msg, AIMessage):
                                last_ai_message = last_msg
                            
                            if isinstance(last_msg, AIMessage):
                                if getattr(last_msg, "tool_calls", None):
                                    # Tool calling phase
                                    if is_thinking:
                                        is_thinking = False
                                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'tool_calling'})}\n\n"
                                    
                                    for call in last_msg.tool_calls:
                                        tool_name = call.get('name') or call.get('tool_name', 'unknown')
                                        
                                        # Validate tool exists
                                        tool_exists = any(
                                            (hasattr(tool, 'name') and tool.name == tool_name) or
                                            (hasattr(tool, '__name__') and tool.__name__ == tool_name) or
                                            str(tool) == tool_name
                                            for tool in all_tools
                                        )
                                        
                                        if not tool_exists:
                                            error_msg = (
                                                "An internal error occurred while processing your request. "
                                                "Please try again or rephrase your question."
                                            )
                                            try:
                                                yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                                                stream_completed = True
                                            except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                                                stream_completed = True
                                            return
                                        
                                        if tool_name not in seen_tools:
                                            tool_calls_made.append(tool_name)
                                            seen_tools.add(tool_name)
                                            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'tool_calling'})}\n\n"
                                elif last_msg.content:
                                    # Answering phase
                                    if is_thinking:
                                        is_thinking = False
                                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'answering'})}\n\n"
                                    if not is_answering:
                                        is_answering = True
                                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'answering'})}\n\n"
                                    content_raw = last_msg.content
                                    
                                    if isinstance(content_raw, str):
                                        content = content_raw
                                    elif isinstance(content_raw, list):
                                        content = ""
                                        for item in content_raw:
                                            if isinstance(item, dict):
                                                if "text" in item:
                                                    content += item["text"]
                                                elif "type" in item and item.get("type") == "text":
                                                    content += item.get("text", "")
                                            elif isinstance(item, str):
                                                content += item
                                    elif isinstance(content_raw, dict):
                                        if "text" in content_raw:
                                            content = content_raw["text"]
                                        else:
                                            content = str(content_raw)
                                    else:
                                        content = str(content_raw)
                                    
                                    if content:
                                        # Update full_response to the latest content
                                        full_response = content
                                        # Stream only new characters (incremental)
                                        if len(full_response) > last_streamed_length:
                                            new_content = full_response[last_streamed_length:]
                                            for char in new_content:
                                                yield f"data: {json.dumps({'chunk': char, 'done': False})}\n\n"
                                                await asyncio.sleep(0.005)
                                            last_streamed_length = len(full_response)
                    except Exception as e:
                        import traceback
                        error_details = str(e)
                        tb_str = traceback.format_exc()
                        
                        if "API key not valid" in error_details or "API_KEY" in error_details:
                            error_details = (
                                "Invalid API key. Please check your API key in Settings. "
                                "Get a new one from: https://aistudio.google.com/app/apikey"
                            )
                        elif "tool call validation failed" in tb_str:
                            error_details = "An internal error occurred while processing your request. Please try again or rephrase your question."
                        elif "Connection" in tb_str or "timeout" in tb_str.lower():
                            error_details = "Connection error. Please check if Ollama is running and accessible."
                        elif not error_details or error_details == "":
                            error_details = f"Agent execution failed: {tb_str.split('Traceback')[-1].strip()[:200]}"
                        
                        error_msg = f"Error during agent execution: {error_details}"
                        app_logger.error(
                            "Agent execution error",
                            {
                                "session_id": chat_request.session_id,
                                "user_id": user_id,
                                "error": error_details,
                                "traceback": traceback.format_exc(),
                            }
                        )
                        try:
                            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                            stream_completed = True
                        except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                            stream_completed = True
                        return
                    
                    # If no response was received, send a helpful message
                    if not full_response:
                        error_msg = "No response received from agent. Please check your LLM configuration and API keys."
                        app_logger.warning(
                            "Agent returned no response",
                            {
                                "session_id": chat_request.session_id,
                                "user_id": user_id,
                                "message": chat_request.message,
                            }
                        )
                        yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                        stream_completed = True
                        return
                    
                    # Save to history
                    if full_response:
                        from src.core import DB_AVAILABLE
                        from src.services.db_history import db_history_manager
                        
                        if DB_AVAILABLE and user_id:
                            session_history = db_history_manager.get_session_history(chat_request.session_id, user_id, db)
                        else:
                            session_history = history_manager.get_session_history(chat_request.session_id, user_id)
                        
                        session_history.add_user_message(chat_request.message)
                        session_history.add_ai_message(full_response)
                        
                    # Record usage after successful response
                    llm_config = Config.load_llm_config(db=db, user_id=user_id)
                    # Try to extract token usage from last AI message
                    input_tokens, output_tokens, embedding_tokens = 0, 0, 0
                    if last_ai_message:
                        input_tokens, output_tokens, embedding_tokens = extract_token_usage(last_ai_message)
                    
                    # Fallback to estimation if not available
                    if input_tokens == 0 and output_tokens == 0:
                        input_tokens = estimate_tokens(chat_request.message)
                        output_tokens = estimate_tokens(full_response)
                        
                        usage_tracker.record_request(
                            user_id=user_id,
                            db=db,
                            llm_provider=llm_config.get("type"),
                            llm_model=llm_config.get("model"),
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            embedding_tokens=embedding_tokens,
                            mode=chat_request.mode,
                            session_id=chat_request.session_id,
                            success=True,
                            ip_address=ip_address
                        )
                    
                    yield f"data: {json.dumps({'chunk': '', 'done': True, 'tools_used': tool_calls_made})}\n\n"
                    stream_completed = True
                    return
                
                # If MCP servers exist, connect to them
                try:
                    async with MCPClientManager(mcp_servers) as mcp_tools:
                        # Load custom RAG tools if authenticated
                        custom_rag_tools = load_custom_rag_tools(user_id, db) if user_id and db else []
                        # Create appointment tool with user context
                        appointment_tool = create_appointment_tool(user_id=user_id, db=db)
                        all_tools = [retrieve_dosiblog_context, appointment_tool] + custom_rag_tools + mcp_tools
                        
                        # Get LLM from config
                        llm_config = Config.load_llm_config(db=db, user_id=user_id)
                        if not llm_config:
                            error_msg = "No LLM configuration found. Please configure an LLM provider via the superadmin dashboard or create a personal LLM config."
                            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                            stream_completed = True
                            return
                        
                        try:
                            llm = create_llm_from_config(llm_config, streaming=True, temperature=0)
                        except ImportError as e:
                            # Missing package - should be in requirements.txt
                            error_msg = (
                                f"Missing LLM package: {str(e)}\n\n"
                                "All required packages should be pre-installed from requirements.txt.\n"
                                "Please redeploy after ensuring requirements.txt includes all LLM provider packages."
                            )
                            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                            stream_completed = True
                            return
                        except Exception as e:
                            error_msg = f"Failed to initialize LLM: {str(e)}"
                            yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                            stream_completed = True
                            return
                        
                        # Check if LLM is Ollama (doesn't support bind_tools)
                        is_ollama = llm_config.get("type", "").lower() == "ollama"
                        
                        if is_ollama:
                            # Ollama doesn't support bind_tools, use RAG mode instead
                            # Get history (use database if available)
                            from src.core import DB_AVAILABLE
                            from src.services.db_history import db_history_manager
                            
                            if DB_AVAILABLE and user_id:
                                history = db_history_manager.get_session_messages(chat_request.session_id, user_id, db)
                            else:
                                history = history_manager.get_session_messages(chat_request.session_id, user_id)
                            context = rag_system.retrieve_context(chat_request.message)
                            
                            # Use custom prompt if provided, otherwise use default
                            if chat_request.agent_prompt:
                                system_message = chat_request.agent_prompt
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
                                    "Context from knowledge base:\n{context}\n\n"
                                    "When answering questions, reference the context when relevant.\n\n"
                                    "IMPORTANT: Do NOT mention or reveal the names of internal tools, MCP tools, or any technical implementation details in your responses. Focus on providing helpful answers without exposing internal system architecture.\n"
                                    "If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate.\n"
                                    "Do not claim affiliation with any external AI vendor unless explicitly instructed."
                                )
                            
                            prompt = ChatPromptTemplate.from_messages([
                                ("system", system_message),
                                MessagesPlaceholder("chat_history"),
                                ("human", "{input}"),
                            ])
                            
                            # Stream response from Ollama
                            full_response = ""
                            try:
                                prompt_messages = prompt.format(
                                    context=context,
                                    chat_history=history,
                                    input=chat_request.message
                                )
                                async for chunk in llm.astream(prompt_messages):
                                    if hasattr(chunk, 'content') and chunk.content:
                                        # Handle different content types (string, list, dict)
                                        content_raw = chunk.content
                                        
                                        # Convert content to string if needed
                                        if isinstance(content_raw, str):
                                            content_str = content_raw
                                        elif isinstance(content_raw, list):
                                            # Handle list of content blocks (e.g., from Gemini)
                                            content_str = ""
                                            for item in content_raw:
                                                if isinstance(item, dict):
                                                    # Extract text from content blocks
                                                    if "text" in item:
                                                        content_str += item["text"]
                                                    elif "type" in item and item.get("type") == "text":
                                                        content_str += item.get("text", "")
                                                elif isinstance(item, str):
                                                    content_str += item
                                        elif isinstance(content_raw, dict):
                                            # Handle dict content
                                            if "text" in content_raw:
                                                content_str = content_raw["text"]
                                            else:
                                                content_str = str(content_raw)
                                        else:
                                            content_str = str(content_raw)
                                        
                                        # Stream character by character
                                        if content_str:
                                            for char in content_str:
                                                full_response += char
                                                yield f"data: {json.dumps({'chunk': char, 'done': False})}\n\n"
                                                await asyncio.sleep(0.005)
                            except Exception as e:
                                import traceback
                                error_details = str(e)
                                if not error_details:
                                    error_details = repr(e)
                                tb_str = traceback.format_exc()
                                
                                if "Connection" in tb_str or "timeout" in tb_str.lower() or "refused" in tb_str.lower():
                                    error_details = (
                                        f"Connection error to Ollama: {error_details}. "
                                        "Please check Ollama is running: docker ps | grep ollama"
                                    )
                                else:
                                    error_details = f"LLM streaming error: {error_details}"
                                
                                app_logger.error(
                                    "Ollama streaming error",
                                    {
                                        "session_id": chat_request.session_id,
                                        "user_id": user_id,
                                        "error": str(e),
                                        "traceback": tb_str,
                                    }
                                )
                                try:
                                    yield f"data: {json.dumps({'error': error_details, 'done': True})}\n\n"
                                    stream_completed = True
                                except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                                    stream_completed = True
                                return
                            
                            # Save to history (use database if available)
                            if full_response:
                                from src.core import DB_AVAILABLE
                                from src.services.db_history import db_history_manager
                                
                                if DB_AVAILABLE and user_id:
                                    session_history = db_history_manager.get_session_history(chat_request.session_id, user_id, db)
                                else:
                                    session_history = history_manager.get_session_history(chat_request.session_id, user_id)
                                
                                session_history.add_user_message(chat_request.message)
                                session_history.add_ai_message(full_response)
                                
                                # Record usage after successful response
                                llm_config = Config.load_llm_config(db=db, user_id=user_id)
                                # Estimate tokens (Ollama streaming doesn't provide usage metadata)
                                input_tokens = estimate_tokens(chat_request.message)
                                output_tokens = estimate_tokens(full_response)
                                # Only record usage if llm_config exists
                                if llm_config:
                                    usage_tracker.record_request(
                                        user_id=user_id,
                                        db=db,
                                        llm_provider=llm_config.get("type"),
                                        llm_model=llm_config.get("model"),
                                        input_tokens=input_tokens,
                                        output_tokens=output_tokens,
                                        embedding_tokens=0,
                                        mode=chat_request.mode,
                                        session_id=chat_request.session_id,
                                        success=True
                                    )
                            
                            yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"
                            stream_completed = True
                            return
                        
                        # For OpenAI/Groq - use agent with tools
                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'creating_agent', 'tool_count': len(all_tools)})}\n\n"
                        
                        # Create agent - ensure tools are properly bound
                        try:
                            # Use custom prompt if provided, otherwise use default
                            if chat_request.agent_prompt:
                                system_prompt = chat_request.agent_prompt
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
                                    "You have access to various tools to help answer questions and perform tasks. Use them when appropriate.\n\n"
                                    "IMPORTANT RULES:\n"
                                    "- Do NOT mention or reveal the names of internal tools, MCP tools, or any technical implementation details in your responses\n"
                                    "- Do NOT list tool names when asked about capabilities - instead describe what you can help with in natural language\n"
                                    "- Focus on providing helpful answers without exposing internal system architecture\n"
                                    "- If asked about tools or capabilities, respond with what you can do, not how you do it\n"
                                    "- If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate\n"
                                    "- Do not claim affiliation with any external AI vendor unless explicitly instructed"
                                )
                            
                            # Ensure tools are properly formatted for LangChain
                            formatted_tools = []
                            for tool in all_tools:
                                if isinstance(tool, BaseTool):
                                    formatted_tools.append(tool)
                                else:
                                    formatted_tools.append(tool)
                            
                            # Sanitize tools for Gemini compatibility
                            sanitized_tools = sanitize_tools_for_gemini(formatted_tools, llm_config.get("type", ""))
                            
                            agent = create_agent(
                                model=llm,
                                tools=sanitized_tools,
                                system_prompt=system_prompt
                            )
                            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'agent_ready'})}\n\n"
                        except Exception as e:
                            import traceback
                            error_msg = f"Failed to create agent: {str(e)}\n{traceback.format_exc()[:300]}"
                            try:
                                yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                                stream_completed = True
                            except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                                stream_completed = True
                            return
                        
                        # Get history (use database if available)
                        from src.core import DB_AVAILABLE
                        from src.services.db_history import db_history_manager
                        
                        if DB_AVAILABLE and user_id:
                            history = db_history_manager.get_session_messages(chat_request.session_id, user_id, db)
                        else:
                            history = history_manager.get_session_messages(chat_request.session_id, user_id)
                        messages = list(history) + [HumanMessage(content=chat_request.message)]
                        
                        # Stream agent responses
                        full_response = ""
                        tool_calls_made = []
                        seen_tools = set()  # Track tools we've already sent
                        is_thinking = True
                        is_answering = False
                        last_ai_message = None  # Track last AI message for token extraction
                        
                        try:
                            async for event in agent.astream({"messages": messages}, stream_mode="values"):
                                last_msg = event["messages"][-1]
                                
                                # Track last AI message for token usage extraction
                                if isinstance(last_msg, AIMessage):
                                    last_ai_message = last_msg
                                
                                if isinstance(last_msg, AIMessage):
                                    if getattr(last_msg, "tool_calls", None):
                                        # Tool calling phase
                                        if is_thinking:
                                            is_thinking = False
                                            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'tool_calling'})}\n\n"
                                        
                                        for call in last_msg.tool_calls:
                                            tool_name = call.get('name') or call.get('tool_name', 'unknown')
                                            
                                            # Validate tool exists in our tools list
                                            tool_exists = any(
                                                (hasattr(tool, 'name') and tool.name == tool_name) or
                                                (hasattr(tool, '__name__') and tool.__name__ == tool_name) or
                                                str(tool) == tool_name
                                                for tool in all_tools
                                            )
                                            
                                            if not tool_exists:
                                                error_msg = (
                                                    "An internal error occurred while processing your request. "
                                                    "Please try again or rephrase your question."
                                                )
                                                try:
                                                    yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                                                    stream_completed = True
                                                except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                                                    stream_completed = True
                                                return
                                            
                                            if tool_name not in seen_tools:
                                                tool_calls_made.append(tool_name)
                                                seen_tools.add(tool_name)
                                                # Send tool metadata with status (without tool name)
                                                yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'tool_calling'})}\n\n"
                                    elif last_msg.content:
                                        # Answering phase
                                        if is_thinking:
                                            is_thinking = False
                                            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'answering'})}\n\n"
                                        if not is_answering:
                                            is_answering = True
                                            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'answering'})}\n\n"
                                        # Stream the actual response character by character for smooth streaming
                                        # Handle different content types (string, list, dict)
                                        content_raw = last_msg.content
                                        
                                        # Convert content to string if needed
                                        if isinstance(content_raw, str):
                                            content = content_raw
                                        elif isinstance(content_raw, list):
                                            # Handle list of content blocks (e.g., from Gemini)
                                            content = ""
                                            for item in content_raw:
                                                if isinstance(item, dict):
                                                    # Extract text from content blocks
                                                    if "text" in item:
                                                        content += item["text"]
                                                    elif "type" in item and item.get("type") == "text":
                                                        content += item.get("text", "")
                                                elif isinstance(item, str):
                                                    content += item
                                        elif isinstance(content_raw, dict):
                                            # Handle dict content (e.g., from some models)
                                            if "text" in content_raw:
                                                content = content_raw["text"]
                                            else:
                                                content = str(content_raw)
                                        else:
                                            content = str(content_raw)
                                        
                                        if content and content != full_response:  # Only stream new content
                                            new_content = content[len(full_response):]
                                            for char in new_content:
                                                full_response += char
                                                yield f"data: {json.dumps({'chunk': char, 'done': False})}\n\n"
                                                await asyncio.sleep(0.005)  # Small delay for smooth streaming
                        except Exception as e:
                            import traceback
                            error_details = str(e)
                            if not error_details or error_details == "":
                                # Try to get more details from exception
                                error_details = repr(e)
                            tb_str = traceback.format_exc()
                            # Extract more useful info from traceback and error message
                            if "quota" in error_details.lower() or "RESOURCE_EXHAUSTED" in error_details or "429" in error_details:
                                error_details = (
                                    "Gemini API quota exceeded. Your API key has reached its rate limit. "
                                    "Solutions: 1) Wait a few minutes, 2) Enable billing in Google Cloud Console, "
                                    "3) Try a different model (e.g., gemini-1.5-flash), "
                                    "4) Check quota: https://ai.dev/usage?tab=rate-limit"
                                )
                            elif "API key not valid" in error_details or "API_KEY" in error_details:
                                error_details = (
                                    "Invalid Google API key. Please check your API key in Settings. "
                                    "Get a new one from: https://aistudio.google.com/app/apikey"
                                )
                            elif "tool call validation failed" in tb_str:
                                error_details = "An internal error occurred while processing your request. Please try again or rephrase your question."
                            elif "Connection" in tb_str or "timeout" in tb_str.lower():
                                error_details = "Connection error. Please check if Ollama is running and accessible."
                            elif not error_details or error_details == "":
                                error_details = f"Agent execution failed: {tb_str.split('Traceback')[-1].strip()[:200]}"
                            
                            error_msg = f"Error during agent execution: {error_details}"
                            # Log full traceback for debugging
                            app_logger.error(
                                "Agent execution error",
                                {
                                    "session_id": chat_request.session_id,
                                    "user_id": user_id,
                                    "error": error_details,
                                    "traceback": traceback.format_exc(),
                                }
                            )
                            try:
                                yield f"data: {json.dumps({'error': error_msg, 'done': True})}\n\n"
                                stream_completed = True
                            except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                                stream_completed = True
                            return
                        
                            # Save to history (use database if available)
                        if full_response:
                                from src.core import DB_AVAILABLE
                                from src.services.db_history import db_history_manager
                                
                                if DB_AVAILABLE and user_id:
                                    session_history = db_history_manager.get_session_history(chat_request.session_id, user_id, db)
                                else:
                                    session_history = history_manager.get_session_history(chat_request.session_id, user_id)
                                
                                session_history.add_user_message(chat_request.message)
                                session_history.add_ai_message(full_response)
                                
                                # Record usage after successful response
                                llm_config = Config.load_llm_config(db=db, user_id=user_id)
                                # Try to extract token usage from last AI message
                                input_tokens, output_tokens, embedding_tokens = 0, 0, 0
                                if last_ai_message:
                                    input_tokens, output_tokens, embedding_tokens = extract_token_usage(last_ai_message)
                                
                                # Fallback to estimation if not available
                                if input_tokens == 0 and output_tokens == 0:
                                    input_tokens = estimate_tokens(chat_request.message)
                                    output_tokens = estimate_tokens(full_response)
                                
                                # Only record usage if llm_config exists
                                if llm_config:
                                    usage_tracker.record_request(
                                        user_id=user_id,
                                        db=db,
                                        llm_provider=llm_config.get("type"),
                                        llm_model=llm_config.get("model"),
                                        input_tokens=input_tokens,
                                        output_tokens=output_tokens,
                                        embedding_tokens=embedding_tokens,
                                        mode=chat_request.mode,
                                        session_id=chat_request.session_id,
                                        success=True
                                    )
                        
                        yield f"data: {json.dumps({'chunk': '', 'done': True, 'tools_used': tool_calls_made})}\n\n"
                        stream_completed = True
                except Exception as mcp_error:
                    # Handle MCP connection errors
                    import traceback
                    error_msg = f"Failed to connect to MCP servers: {str(mcp_error)}"
                    tb_str = traceback.format_exc()
                    app_logger.error(
                        "MCP connection error",
                        {
                            "session_id": chat_request.session_id,
                            "user_id": user_id,
                            "error": str(mcp_error),
                            "traceback": tb_str,
                        }
                    )
                    yield f"data: {json.dumps({'error': error_msg, 'traceback': tb_str[:300], 'done': True})}\n\n"
                    stream_completed = True
                    return
                    
        except asyncio.CancelledError:
            # Client disconnected - gracefully exit
            app_logger.warning(
                "Client disconnected during streaming",
                {"session_id": chat_request.session_id, "user_id": user_id}
            )
            stream_completed = True
            return
        except Exception as e:
            import traceback
            error_msg = f"Unexpected error: {str(e)}"
            tb_str = traceback.format_exc()
            app_logger.error(
                "Streaming error",
                {
                    "session_id": chat_request.session_id,
                    "user_id": user_id,
                    "error": str(e),
                    "traceback": tb_str,
                }
            )
            try:
                # Send detailed error through stream
                error_data = {
                    'error': error_msg,
                    'traceback': tb_str[:500] if len(tb_str) > 500 else tb_str,
                    'done': True
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                stream_completed = True
            except Exception as yield_error:
                # If we can't yield (client disconnected), log and exit
                app_logger.error(
                    "Could not send error to client",
                    {
                        "session_id": chat_request.session_id,
                        "user_id": user_id,
                        "error": str(yield_error),
                    }
                )
                stream_completed = True
        finally:
            # Ensure stream always completes
            if not stream_completed:
                try:
                    yield f"data: {json.dumps({'done': True})}\n\n"
                except (GeneratorExit, StopAsyncIteration, asyncio.CancelledError):
                    # Client disconnected - this is normal
                    pass
                except Exception:
                    # Ignore other errors in finally
                    pass
    
    # Create response with proper headers for SSE
    # Note: FastAPI Swagger UI doesn't display streaming responses properly
    # Use curl or the frontend to test streaming
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8"
        }
    )

