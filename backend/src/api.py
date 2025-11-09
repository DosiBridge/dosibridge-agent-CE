"""
FastAPI application with streaming chat endpoints
"""
import asyncio
import json
import contextlib
import os
from typing import AsyncGenerator, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import sys
from pathlib import Path
import logging

# Add project root to path for imports (if needed)
# Note: When run as module, parent.parent is project root

from src.config import Config
from src.history import history_manager
from src.agent import run_agent_mode, run_rag_mode
from src.mcp_client import MCPClientManager
from src.tools import retrieve_dosiblog_context
from src.llm_factory import create_llm_from_config
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage
from mcp_servers.registry import MCP_SERVERS, get_mcp_server, list_available_servers


def suppress_mcp_cleanup_errors(loop, context):
    """
    Suppress expected RuntimeError exceptions from MCP client cleanup.
    These occur when background tasks try to exit cancel scopes in different tasks.
    """
    exception = context.get('exception')
    if exception and isinstance(exception, RuntimeError):
        error_msg = str(exception).lower()
        # Suppress expected cancel scope errors from MCP cleanup
        if "cancel scope" in error_msg and "different task" in error_msg:
            # These are expected during MCP client cleanup - suppress them silently
            # The MCP library creates background tasks that can't properly exit
            # cancel scopes when cleanup happens in a different task context
            return
    
    # For all other exceptions, use the default handler
    loop.default_exception_handler(context)


# Create MCP lifespan context manager
@contextlib.asynccontextmanager
async def mcp_lifespan(app: FastAPI):
    """Lifespan context manager for MCP servers"""
    # Set up exception handler to suppress MCP cleanup errors
    try:
        loop = asyncio.get_running_loop()
        loop.set_exception_handler(suppress_mcp_cleanup_errors)
    except Exception:
        # If we can't set the handler, that's okay - errors will still be logged
        pass
    
    async with contextlib.AsyncExitStack() as stack:
        # Enter all MCP server session managers
        for server in MCP_SERVERS.values():
            if hasattr(server, 'session_manager'):
                await stack.enter_async_context(server.session_manager.run())
        yield


# Initialize FastAPI app with MCP lifespan
app = FastAPI(
    title="AI MCP Agent API",
    description="Intelligent agent with RAG, MCP tools, and conversation memory",
    version="1.0.0",
    lifespan=mcp_lifespan
)

# Configure CORS origins from environment variable
# Format: comma-separated list of origins, e.g., "http://localhost:3000,http://localhost:3001,https://example.com"
CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "")
if CORS_ORIGINS_ENV:
    # Parse comma-separated origins
    cors_origins = [origin.strip() for origin in CORS_ORIGINS_ENV.split(",") if origin.strip()]
else:
    # Default origins for development and common production setups
    cors_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://rag-mcp-htiw.onrender.com",
    ]

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,  # List of allowed origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers to the client
)


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    mode: str = "agent"  # "agent" or "rag"


class ChatResponse(BaseModel):
    response: str
    session_id: str
    mode: str
    tools_used: list = []


class SessionInfo(BaseModel):
    session_id: str
    message_count: int
    messages: list


# Health check
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "AI MCP Agent API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "rag_available": True,
        "mcp_servers": len(Config.load_mcp_servers())
    }


# Chat endpoint (non-streaming)
@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Non-streaming chat endpoint
    
    Args:
        request: ChatRequest with message, session_id, and mode
        
    Returns:
        ChatResponse with answer
    """
    try:
        if request.mode == "rag":
            # RAG-only mode
            from src.rag import rag_system
            
            llm_config = Config.load_llm_config()
            try:
                llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
            except ImportError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Missing LLM package: {str(e)}\n\nAll required packages should be in requirements.txt. Please redeploy after ensuring requirements.txt includes all LLM provider packages."
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to initialize LLM: {str(e)}")
            answer = rag_system.query_with_history(
                request.message, 
                request.session_id, 
                llm
            )
            
            return ChatResponse(
                response=answer,
                session_id=request.session_id,
                mode="rag",
                tools_used=["retrieve_dosiblog_context"]
            )
        else:
            # Agent mode
            mcp_servers = Config.load_mcp_servers()
            tools_used = []
            
            async with MCPClientManager(mcp_servers) as mcp_tools:
                all_tools = [retrieve_dosiblog_context] + mcp_tools
                
                # Get LLM from config
                llm_config = Config.load_llm_config()
                try:
                    llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
                except ImportError as e:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Missing LLM package: {str(e)}\n\nAll required packages should be in requirements.txt. Please redeploy after ensuring requirements.txt includes all LLM provider packages."
                    )
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to initialize LLM: {str(e)}")
                
                # Check if LLM is Ollama (doesn't support bind_tools)
                is_ollama = llm_config.get("type", "").lower() == "ollama"
                
                if is_ollama:
                    # For Ollama, fall back to RAG mode with tool descriptions
                    from src.rag import rag_system
                    tool_descriptions = []
                    for tool in all_tools:
                        if hasattr(tool, 'name'):
                            tool_desc = getattr(tool, 'description', 'No description')
                            tool_descriptions.append(f"- {tool.name}: {tool_desc}")
                    
                    tools_context = "\n".join(tool_descriptions) if tool_descriptions else "No tools available"
                    
                    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
                    history = history_manager.get_session_messages(request.session_id)
                    context = rag_system.retrieve_context(request.message)
                    
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
                        input=request.message
                    )).content
                    
                    # Save to history
                    session_history = history_manager.get_session_history(request.session_id)
                    session_history.add_user_message(request.message)
                    session_history.add_ai_message(answer)
                    
                    return ChatResponse(
                        response=answer,
                        session_id=request.session_id,
                        mode="agent",
                        tools_used=[]
                    )
                
                # For OpenAI/Groq - use agent with tools
                # Create agent - ensure tools are properly bound
                try:
                    # Build a system prompt that lists available tools to prevent hallucination
                    tool_names = []
                    tool_descriptions = []
                    for tool in all_tools:
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
                    
                    agent = create_agent(
                        model=llm,
                        tools=all_tools,
                        system_prompt=system_prompt
                    )
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to create agent: {str(e)}")
                
                # Get history
                history = history_manager.get_session_messages(request.session_id)
                messages = list(history) + [HumanMessage(content=request.message)]
                
                # Run agent
                final_answer = ""
                async for event in agent.astream({"messages": messages}, stream_mode="values"):
                    last_msg = event["messages"][-1]
                    
                    if isinstance(last_msg, AIMessage):
                        if getattr(last_msg, "tool_calls", None):
                            for call in last_msg.tool_calls:
                                tools_used.append(call['name'])
                        else:
                            # Handle different content types (string, list, dict)
                            content_raw = last_msg.content
                            if isinstance(content_raw, str):
                                final_answer = content_raw
                            elif isinstance(content_raw, list):
                                # Handle list of content blocks (e.g., from Gemini)
                                final_answer = ""
                                for item in content_raw:
                                    if isinstance(item, dict):
                                        if "text" in item:
                                            final_answer += item["text"]
                                        elif "type" in item and item.get("type") == "text":
                                            final_answer += item.get("text", "")
                                    elif isinstance(item, str):
                                        final_answer += item
                            elif isinstance(content_raw, dict):
                                # Handle dict content
                                if "text" in content_raw:
                                    final_answer = content_raw["text"]
                                else:
                                    final_answer = str(content_raw)
                            else:
                                final_answer = str(content_raw)
                
                # Save to history
                session_history = history_manager.get_session_history(request.session_id)
                session_history.add_user_message(request.message)
                session_history.add_ai_message(final_answer)
                
                return ChatResponse(
                    response=final_answer,
                    session_id=request.session_id,
                    mode="agent",
                    tools_used=tools_used
                )
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Streaming chat endpoint
@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Streaming chat endpoint - returns chunks as they're generated
    
    Args:
        request: ChatRequest with message, session_id, and mode
        
    Returns:
        StreamingResponse with Server-Sent Events
    """
    async def generate() -> AsyncGenerator[str, None]:
        stream_completed = False
        try:
            # Send initial connection message to verify stream is working
            yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'connected'})}\n\n"
            
            # Add a small delay to ensure connection is established
            await asyncio.sleep(0.1)
            
            if request.mode == "rag":
                # For RAG mode, we'll stream the response
                from src.rag import rag_system
                
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
                
                # Get history
                history = history_manager.get_session_messages(request.session_id)
                
                # Build context
                from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
                prompt = ChatPromptTemplate.from_messages([
                    ("system", "You are a helpful AI assistant. Use the following context to answer questions.\nContext: {context}"),
                    MessagesPlaceholder("chat_history"),
                    ("human", "{input}"),
                ])
                
                # Retrieve context
                context = rag_system.retrieve_context(request.message)
                
                # Stream response
                full_response = ""
                try:
                    prompt_messages = prompt.format(
                        context=context,
                        chat_history=history,
                        input=request.message
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
                
                # Save to history
                if full_response:
                    session_history = history_manager.get_session_history(request.session_id)
                    session_history.add_user_message(request.message)
                    session_history.add_ai_message(full_response)
                
                yield f"data: {json.dumps({'chunk': '', 'done': True})}\n\n"
                stream_completed = True
                
            else:
                # Agent mode with streaming
                yield f"data: {json.dumps({'chunk': '', 'done': False, 'status': 'initializing_agent'})}\n\n"
                
                mcp_servers = Config.load_mcp_servers()
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
                            from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
                            from src.rag import rag_system
                            
                            history = history_manager.get_session_messages(request.session_id)
                            context = rag_system.retrieve_context(request.message)
                            
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
                                    input=request.message
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
                            
                            # Save to history
                            if full_response:
                                session_history = history_manager.get_session_history(request.session_id)
                                session_history.add_user_message(request.message)
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
                            from langchain_core.tools import BaseTool
                            formatted_tools = []
                            for tool in all_tools:
                                if isinstance(tool, BaseTool):
                                    formatted_tools.append(tool)
                                else:
                                    formatted_tools.append(tool)
                            
                            agent = create_agent(
                                model=llm,
                                tools=formatted_tools,
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
                        history = history_manager.get_session_messages(request.session_id)
                        messages = list(history) + [HumanMessage(content=request.message)]
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
                                # Extract more useful info from traceback
                                if "tool call validation failed" in tb_str:
                                    error_details = "Tool validation failed. The model tried to call a tool that doesn't exist in the available tools list."
                                elif "Connection" in tb_str or "timeout" in tb_str.lower():
                                    error_details = "Connection error. Please check if Ollama is running and accessible."
                                else:
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
                        
                        # Save to history
                        if full_response:
                            session_history = history_manager.get_session_history(request.session_id)
                            session_history.add_user_message(request.message)
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


# Session management endpoints
@app.get("/api/session/{session_id}", response_model=SessionInfo)
async def get_session(session_id: str):
    """Get session information"""
    messages = history_manager.get_session_messages(session_id)
    
    return SessionInfo(
        session_id=session_id,
        message_count=len(messages),
        messages=[
            {
                "role": "user" if isinstance(msg, HumanMessage) else "assistant",
                "content": msg.content
            }
            for msg in messages
        ]
    )


@app.delete("/api/session/{session_id}")
async def clear_session(session_id: str):
    """Clear session history"""
    history_manager.clear_session(session_id)
    return {"status": "success", "message": f"Session {session_id} cleared"}


@app.get("/api/sessions")
async def list_sessions():
    """List all active sessions"""
    sessions = history_manager.list_sessions()
    return {
        "sessions": [
            {
                "session_id": sid,
                "message_count": len(history_manager.get_session_messages(sid))
            }
            for sid in sessions
        ]
    }


# MCP tools info
@app.get("/api/tools")
async def get_tools_info():
    """Get information about available tools"""
    mcp_servers = Config.load_mcp_servers()
    
    tools_info = {
        "local_tools": [
            {
                "name": "retrieve_dosiblog_context",
                "description": "Retrieves information about DosiBlog project",
                "type": "rag"
            }
        ],
        "mcp_servers": []
    }
    
    # We can't easily get MCP tools without connecting, so just return server info
    for server in mcp_servers:
        tools_info["mcp_servers"].append({
            "name": server.get("name"),
            "url": server.get("url"),
            "status": "configured"
        })
    
    return tools_info


# MCP Server Management Endpoints
class MCPServerRequest(BaseModel):
    name: str
    url: str
    api_key: Optional[str] = None  # Optional API key/auth key for MCP server
    enabled: Optional[bool] = True  # Whether the server is enabled


@app.get("/api/mcp-servers")
async def list_mcp_servers():
    """List all configured MCP servers"""
    try:
        servers = Config.load_mcp_servers()
        # Don't send api_key in response for security
        safe_servers = []
        for server in servers:
            safe_server = {k: v for k, v in server.items() if k != "api_key"}
            safe_server["has_api_key"] = bool(server.get("api_key"))
            # Ensure enabled field exists (default to True if not present)
            if "enabled" not in safe_server:
                safe_server["enabled"] = True
            safe_servers.append(safe_server)
        
        return {
            "status": "success",
            "count": len(servers),
            "servers": safe_servers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/mcp-servers")
async def add_mcp_server(server: MCPServerRequest):
    """Add a new MCP server to the configuration"""
    try:
        # Read existing servers
        config_file = Config.ROOT_DIR / Config.MCP_SERVERS_FILE
        
        # Normalize URL: remove /sse and ensure /mcp endpoint
        normalized_url = server.url.rstrip('/')
        if normalized_url.endswith('/sse'):
            normalized_url = normalized_url[:-4]  # Remove /sse
        if not normalized_url.endswith('/mcp'):
            # If URL doesn't end with /mcp, append it
            normalized_url = normalized_url.rstrip('/') + '/mcp'
        
        # Prepare server config (include api_key and enabled if provided)
        server_config = {
            "name": server.name,
            "url": normalized_url,
            "enabled": server.enabled if server.enabled is not None else True
        }
        if server.api_key:
            server_config["api_key"] = server.api_key
        
        if config_file.exists():
            with open(config_file, 'r') as f:
                servers = json.load(f)
        else:
            servers = []
        
        # Check if server already exists
        for existing_server in servers:
            if existing_server.get("name") == server.name or existing_server.get("url") == server.url:
                raise HTTPException(
                    status_code=400, 
                    detail=f"MCP server with name '{server.name}' or URL '{server.url}' already exists"
                )
        
        # Add new server (use server_config which includes api_key if provided)
        servers.append(server_config)
        
        # Save to file
        with open(config_file, 'w') as f:
            json.dump(servers, f, indent=2)
        
        # Don't send api_key in response for security
        safe_server = {k: v for k, v in server_config.items() if k != "api_key"}
        safe_server["has_api_key"] = bool(server_config.get("api_key"))
        # Ensure enabled field exists
        if "enabled" not in safe_server:
            safe_server["enabled"] = True
        
        return {
            "status": "success",
            "message": f"MCP server '{server.name}' added successfully",
            "server": safe_server,
            "total_servers": len(servers)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/mcp-servers/{server_name}")
async def delete_mcp_server(server_name: str):
    """Delete an MCP server from the configuration"""
    try:
        config_file = Config.ROOT_DIR / Config.MCP_SERVERS_FILE
        
        if not config_file.exists():
            raise HTTPException(status_code=404, detail="No MCP servers configured")
        
        # Read existing servers
        with open(config_file, 'r') as f:
            servers = json.load(f)
        
        # Find and remove server
        initial_count = len(servers)
        servers = [s for s in servers if s.get("name") != server_name]
        
        if len(servers) == initial_count:
            raise HTTPException(status_code=404, detail=f"MCP server '{server_name}' not found")
        
        # Save updated list
        with open(config_file, 'w') as f:
            json.dump(servers, f, indent=2)
        
        return {
            "status": "success",
            "message": f"MCP server '{server_name}' deleted successfully",
            "remaining_servers": len(servers)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/mcp-servers/{server_name}")
async def update_mcp_server(server_name: str, server: MCPServerRequest):
    """Update an existing MCP server"""
    try:
        config_file = Config.ROOT_DIR / Config.MCP_SERVERS_FILE
        
        # Normalize URL: remove /sse and ensure /mcp endpoint
        normalized_url = server.url.rstrip('/')
        if normalized_url.endswith('/sse'):
            normalized_url = normalized_url[:-4]  # Remove /sse
        if not normalized_url.endswith('/mcp'):
            # If URL doesn't end with /mcp, append it
            normalized_url = normalized_url.rstrip('/') + '/mcp'
        
        # Prepare server config (include api_key and enabled if provided)
        server_config = {
            "name": server.name,
            "url": normalized_url,
            "enabled": server.enabled if server.enabled is not None else True
        }
        if server.api_key:
            server_config["api_key"] = server.api_key
        
        if not config_file.exists():
            raise HTTPException(status_code=404, detail="No MCP servers configured")
        
        # Read existing servers
        with open(config_file, 'r') as f:
            servers = json.load(f)
        
        # Find and update server
        found = False
        updated_index = -1
        for i, s in enumerate(servers):
            if s.get("name") == server_name:
                servers[i] = server_config  # Use server_config which includes api_key if provided
                found = True
                updated_index = i
                break
        
        if not found:
            raise HTTPException(status_code=404, detail=f"MCP server '{server_name}' not found")
        
        # Save updated list
        with open(config_file, 'w') as f:
            json.dump(servers, f, indent=2)
        
        # Don't send api_key in response for security
        safe_server = {k: v for k, v in servers[updated_index].items() if k != "api_key"}
        safe_server["has_api_key"] = bool(servers[updated_index].get("api_key"))
        # Ensure enabled field exists
        if "enabled" not in safe_server:
            safe_server["enabled"] = True
        
        return {
            "status": "success",
            "message": f"MCP server '{server_name}' updated successfully",
            "server": safe_server
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/mcp-servers/{server_name}/toggle")
async def toggle_mcp_server(server_name: str):
    """Toggle the enabled status of an MCP server"""
    try:
        config_file = Config.ROOT_DIR / Config.MCP_SERVERS_FILE
        
        if not config_file.exists():
            raise HTTPException(status_code=404, detail="No MCP servers configured")
        
        # Read existing servers
        with open(config_file, 'r') as f:
            servers = json.load(f)
        
        # Find and toggle server
        found = False
        updated_index = -1
        for i, s in enumerate(servers):
            if s.get("name") == server_name:
                # Toggle enabled status (default to True if not present)
                current_enabled = s.get("enabled", True)
                servers[i]["enabled"] = not current_enabled
                found = True
                updated_index = i
                break
        
        if not found:
            raise HTTPException(status_code=404, detail=f"MCP server '{server_name}' not found")
        
        # Save updated list
        with open(config_file, 'w') as f:
            json.dump(servers, f, indent=2)
        
        # Don't send api_key in response for security
        safe_server = {k: v for k, v in servers[updated_index].items() if k != "api_key"}
        safe_server["has_api_key"] = bool(servers[updated_index].get("api_key"))
        # Ensure enabled field exists
        if "enabled" not in safe_server:
            safe_server["enabled"] = True
        
        return {
            "status": "success",
            "message": f"MCP server '{server_name}' {'enabled' if safe_server['enabled'] else 'disabled'}",
            "server": safe_server
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# LLM Model Management Endpoints
class LLMConfigRequest(BaseModel):
    type: str  # "openai", "groq", "ollama", or "gemini"
    model: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None  # For Ollama
    api_base: Optional[str] = None  # Custom API base for OpenAI/Groq


@app.get("/api/llm-config")
async def get_llm_config():
    """Get current LLM configuration"""
    try:
        config = Config.load_llm_config()
        # Don't send API key in response for security
        safe_config = {k: v for k, v in config.items() if k != "api_key" or not v}
        return {
            "status": "success",
            "config": safe_config,
            "has_api_key": bool(config.get("api_key"))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/llm-config")
async def set_llm_config(config: LLMConfigRequest):
    """Set LLM configuration"""
    try:
        # Validate required fields based on type
        if config.type.lower() == "ollama":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Ollama")
            config_dict = {
                "type": "ollama",
                "model": config.model,
                "base_url": config.base_url or "http://localhost:11434",
                "active": True
            }
        elif config.type.lower() == "gemini":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Gemini")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for Gemini")
            config_dict = {
                "type": "gemini",
                "model": config.model,
                "api_key": config.api_key,
                "active": True
            }
        elif config.type.lower() == "groq":
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for Groq")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for Groq")
            config_dict = {
                "type": "groq",
                "model": config.model,
                "api_key": config.api_key,
                "active": True
            }
        else:  # OpenAI or default
            if not config.model:
                raise HTTPException(status_code=400, detail="Model name is required for OpenAI")
            if not config.api_key:
                raise HTTPException(status_code=400, detail="API key is required for OpenAI")
            config_dict = {
                "type": "openai",
                "model": config.model,
                "api_key": config.api_key,
                "active": True
            }
            if config.api_base:
                config_dict["api_base"] = config.api_base
        
        # Trim model name before saving
        if config_dict.get("model"):
            config_dict["model"] = config_dict["model"].strip()
        
        # Save configuration
        if Config.save_llm_config(config_dict):
            # Test the configuration by creating an LLM instance
            try:
                test_llm = create_llm_from_config(config_dict, streaming=False, temperature=0)
                return {
                    "status": "success",
                    "message": f"LLM configuration saved and validated successfully. Model: {config_dict['model']}",
                    "config": {
                        "type": config_dict["type"],
                        "model": config_dict["model"],
                        "has_api_key": bool(config_dict.get("api_key"))
                    }
                }
            except ImportError as e:
                # Missing package - but still save the config
                error_msg = str(e)
                return {
                    "status": "warning",
                    "message": f"Configuration saved, but package is missing: {error_msg}",
                    "config": {
                        "type": config_dict["type"],
                        "model": config_dict["model"],
                        "has_api_key": bool(config_dict.get("api_key"))
                    }
                }
            except Exception as e:
                # Configuration saved but test failed
                error_msg = str(e)
                # Don't fail the save, but warn the user
                return {
                    "status": "warning",
                    "message": f"Configuration saved, but validation failed: {error_msg}",
                    "config": {
                        "type": config_dict["type"],
                        "model": config_dict["model"],
                        "has_api_key": bool(config_dict.get("api_key"))
                    }
                }
        else:
            raise HTTPException(status_code=500, detail="Failed to save LLM configuration")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# MCP Server endpoints
@app.get("/api/mcp-servers/available")
async def list_local_mcp_servers():
    """List all locally available MCP servers"""
    try:
        servers = list_available_servers()
        return {
            "status": "success",
            "servers": servers,
            "count": len(servers)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mcp/{server_name}/info")
async def get_mcp_server_info(server_name: str):
    """Get information about a specific MCP server"""
    try:
        server = get_mcp_server(server_name)
        if not server:
            raise HTTPException(
                status_code=404, 
                detail=f"MCP server '{server_name}' not found. Available servers: {', '.join(list_available_servers())}"
            )
        
        # Try to get server info
        info = {
            "name": server_name,
            "available": True,
        }
        
        # Try to get tools if available
        if hasattr(server, 'list_tools'):
            try:
                tools = server.list_tools()
                info["tools"] = [{"name": tool.get("name"), "description": tool.get("description")} for tool in tools]
            except:
                pass
        
        return {
            "status": "success",
            "server": info
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Mount MCP servers at /api/mcp/{server_name}
# This creates dynamic routes for each MCP server
def setup_mcp_routes():
    """Setup dynamic routes for MCP servers"""
    from mcp_servers.registry import MCP_SERVERS
    
    for server_name, server_instance in MCP_SERVERS.items():
        # Create a mount point for each server
        if hasattr(server_instance, 'streamable_http_app'):
            http_app = server_instance.streamable_http_app()
            app.mount(f"/api/mcp/{server_name}", http_app, name=f"mcp_{server_name}")

# Setup MCP routes
setup_mcp_routes()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

