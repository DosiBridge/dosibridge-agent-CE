"""
Chat endpoints (streaming and non-streaming)
"""
import asyncio
import json
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.tools import BaseTool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from src.core import Config, User, get_db, DB_AVAILABLE
from src.core.auth import get_current_active_user, get_current_user
from src.services import history_manager, MCPClientManager, create_llm_from_config, rag_system
from src.services.chat_service import ChatService
from src.services.tools import retrieve_dosiblog_context
from typing import Optional
from sqlalchemy.orm import Session
from ..models import ChatRequest, ChatResponse
from src.utils import sanitize_tools_for_gemini

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
        # Use ChatService for processing
        result = await ChatService.process_chat(
            message=chat_request.message,
            session_id=chat_request.session_id,
            mode=chat_request.mode,
            user=current_user,
            db=db
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
        
        return ChatResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        try:
            # Send initial connection message to verify stream is working
            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'connected'})}\n\n"
            
            # Add a small delay to ensure connection is established
            await asyncio.sleep(0.1)
            
            if chat_request.mode == "rag":
                # For RAG mode, we'll stream the response
                llm_config = Config.load_llm_config()
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
                    ("system", "You are a helpful AI assistant. Use the following context to answer questions.\nContext: {context}"),
                    MessagesPlaceholder("chat_history"),
                    ("human", "{input}"),
                ])
                
                # Retrieve context
                context = rag_system.retrieve_context(chat_request.message)
                
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
                    
                    print(f"❌ RAG streaming error:\n{tb_str}")
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
                
                yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"
                stream_completed = True
                
            else:
                # Agent mode with streaming
                yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'initializing_agent'})}\n\n"
                
                mcp_servers = Config.load_mcp_servers(user_id=user_id)
                yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'connecting_mcp_servers', 'server_count': len(mcp_servers)})}\n\n"
                
                try:
                    async with MCPClientManager(mcp_servers) as mcp_tools:
                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'mcp_connected', 'tool_count': len(mcp_tools)})}\n\n"
                        
                        all_tools = [retrieve_dosiblog_context] + mcp_tools
                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'loading_llm_config'})}\n\n"
                        
                        # Get LLM from config
                        llm_config = Config.load_llm_config()
                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'initializing_llm', 'llm_type': llm_config.get('type', 'unknown')})}\n\n"
                        
                        try:
                            llm = create_llm_from_config(llm_config, streaming=True, temperature=0)
                            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'llm_ready'})}\n\n"
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
                            # Ollama doesn't support bind_tools, use RAG mode instead with tool descriptions
                            # For Ollama, we'll provide tool info in context but use simpler approach
                            tool_descriptions = []
                            for tool in all_tools:
                                if hasattr(tool, 'name'):
                                    tool_desc = getattr(tool, 'description', 'No description')
                                    tool_descriptions.append(f"- {tool.name}: {tool_desc}")
                            
                            tools_context = "\n".join(tool_descriptions) if tool_descriptions else "No tools available"
                            
                            # Build enhanced prompt with tool information
                            # Get history (use database if available)
                            from src.core import DB_AVAILABLE
                            from src.services.db_history import db_history_manager
                            
                            if DB_AVAILABLE and user_id:
                                history = db_history_manager.get_session_messages(chat_request.session_id, user_id, db)
                            else:
                                history = history_manager.get_session_messages(chat_request.session_id, user_id)
                            context = rag_system.retrieve_context(chat_request.message)
                            
                            prompt = ChatPromptTemplate.from_messages([
                                ("system", (
                                    "You are a helpful AI assistant.\n\n"
                                    "Available tools:\n{tools_context}\n\n"
                                    "Context from knowledge base:\n{context}\n\n"
                                    "When answering questions, reference the context when relevant. "
                                    "For calculations or specific operations, you can mention available tools, "
                                    "but note that tool calling is limited with this model."
                                )),
                                MessagesPlaceholder("chat_history"),
                                ("human", "{input}"),
                            ])
                            
                            # Stream response from Ollama
                            full_response = ""
                            try:
                                prompt_messages = prompt.format(
                                    tools_context=tools_context,
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
                                
                                print(f"❌ Ollama streaming error:\n{tb_str}")
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
                            
                            yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"
                            stream_completed = True
                            return
                        
                        # For OpenAI/Groq - use agent with tools
                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'creating_agent', 'tool_count': len(all_tools)})}\n\n"
                        
                        # Create agent - ensure tools are properly bound
                        try:
                            # Build a system prompt that lists available tools to prevent hallucination
                            tool_names = []
                            tool_descriptions = []
                            for tool in all_tools:
                                tool_name = None
                                tool_desc = None
                                if hasattr(tool, 'name'):
                                    tool_name = tool.name
                                    tool_desc = getattr(tool, 'description', 'No description')
                                elif hasattr(tool, '__name__'):
                                    tool_name = tool.__name__
                                else:
                                    tool_name = str(tool)
                                
                                if tool_name:
                                    tool_names.append(tool_name)
                                    if tool_desc:
                                        tool_descriptions.append(f"- {tool_name}: {tool_desc}")
                            
                            # Create detailed system prompt
                            tools_list = '\n'.join(tool_descriptions) if tool_descriptions else ', '.join(tool_names)
                            system_prompt = (
                                "You are a helpful AI assistant with access to these tools ONLY:\n"
                                f"{tools_list}\n\n"
                                "IMPORTANT RULES:\n"
                                "- ONLY use tools from the list above\n"
                                "- Do NOT call any tool that is not in this list\n"
                                "- If you need a tool that is not available, inform the user\n"
                                "- Do not make up or hallucinate tool names\n"
                                "- Available tool names are: " + ', '.join(tool_names)
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
                        yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'starting_agent_execution', 'message_count': len(messages)})}\n\n"
                        
                        # Stream agent responses
                        full_response = ""
                        tool_calls_made = []
                        seen_tools = set()  # Track tools we've already sent
                        
                        try:
                            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'streaming_response'})}\n\n"
                            async for event in agent.astream({"messages": messages}, stream_mode="values"):
                                last_msg = event["messages"][-1]
                                
                                if isinstance(last_msg, AIMessage):
                                    if getattr(last_msg, "tool_calls", None):
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
                                                    f"Tool '{tool_name}' not found. Available tools are: "
                                                    f"{', '.join(tool_names)}. "
                                                    f"Please only use tools from the available list."
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
                                                # Only send tool metadata, no text chunk
                                                yield f"data: {json.dumps({'chunk': '', 'done': False, 'tool': tool_name})}\n\n"
                                    elif last_msg.content:
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
                                error_details = "Tool validation failed. The model tried to call a tool that doesn't exist in the available tools list."
                            elif "Connection" in tb_str or "timeout" in tb_str.lower():
                                error_details = "Connection error. Please check if Ollama is running and accessible."
                            elif not error_details or error_details == "":
                                error_details = f"Agent execution failed: {tb_str.split('Traceback')[-1].strip()[:200]}"
                            
                            error_msg = f"Error during agent execution: {error_details}"
                            # Log full traceback for debugging
                            print(f"❌ Agent execution error:\n{traceback.format_exc()}")
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
                        
                        yield f"data: {json.dumps({'chunk': '', 'done': True, 'tools_used': tool_calls_made})}\n\n"
                        stream_completed = True
                except Exception as mcp_error:
                    # Handle MCP connection errors
                    import traceback
                    error_msg = f"Failed to connect to MCP servers: {str(mcp_error)}"
                    tb_str = traceback.format_exc()
                    print(f"❌ MCP connection error:\n{tb_str}")
                    yield f"data: {json.dumps({'error': error_msg, 'traceback': tb_str[:300], 'done': True})}\n\n"
                    stream_completed = True
                    return
                    
        except asyncio.CancelledError:
            # Client disconnected - gracefully exit
            print("⚠️  Client disconnected during streaming")
            stream_completed = True
            return
        except Exception as e:
            import traceback
            error_msg = f"Unexpected error: {str(e)}"
            tb_str = traceback.format_exc()
            print(f"❌ Streaming error:\n{tb_str}")
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
                print(f"❌ Could not send error to client: {yield_error}")
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

