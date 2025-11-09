"""
Agent creation and query execution
"""
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage

from .config import Config
from .history import history_manager
from .rag import rag_system
from .mcp_client import MCPClientManager
from .tools import retrieve_dosiblog_context


async def run_agent_query(agent_executor, question: str, session_id: str = "default"):
    """
    Run a query through the agent with history support
    
    Args:
        agent_executor: The agent to use
        question: User's question
        session_id: Session identifier for history
    """
    print(f"\n{'='*60}")
    print(f"💬 User Query: {question}")
    print(f"📝 Session ID: {session_id}")
    print(f"{'='*60}\n")
    
    # Get chat history for this session
    history = history_manager.get_session_messages(session_id)
    
    # Show conversation context if exists
    if history:
        print(f"📚 Conversation History: {len(history)} previous messages")
    
    # Build messages with history
    messages = list(history) + [HumanMessage(content=question)]
    inputs = {"messages": messages}

    final_answer = ""
    async for event in agent_executor.astream(inputs, stream_mode="values"):
        last_msg = event["messages"][-1]

        if isinstance(last_msg, AIMessage):
            if getattr(last_msg, "tool_calls", None):
                for call in last_msg.tool_calls:
                    tool_input = call.get('args', call.get('input', {}))
                    print(f"🤖 Agent calling tool: {call['name']}")
                    print(f"   Input: {tool_input}")
            else:
                print(f"\n✅ Final Answer: {last_msg.content}\n")
                final_answer = last_msg.content
        
        elif hasattr(last_msg, "tool_name"):
            print(f"🔧 Tool '{last_msg.tool_name}' output: {last_msg.content}")

    # Save to history
    session_history = history_manager.get_session_history(session_id)
    session_history.add_user_message(question)
    session_history.add_ai_message(final_answer)
    
    return final_answer


async def run_rag_query(question: str, session_id: str = "default"):
    """
    Run a RAG query with conversation history (without agent)
    
    Args:
        question: User's question
        session_id: Session identifier for history
    """
    print(f"\n{'='*60}")
    print(f"🔍 RAG Query: {question}")
    print(f"📝 Session ID: {session_id}")
    print(f"{'='*60}\n")
    
    # Get chat history for this session
    history = history_manager.get_session_messages(session_id)
    
    if history:
        print(f"📚 Conversation History: {len(history)} previous messages")
    
    # Use RAG system with history
    # Load LLM from config (includes API key)
    from src.llm_factory import create_llm_from_config
    llm_config = Config.load_llm_config()
    try:
        llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
    except Exception as e:
        error_msg = str(e)
        if "api_key" in error_msg.lower() or "OPENAI_API_KEY" in error_msg:
            raise ValueError(
                "OpenAI API key is not set. Please set OPENAI_API_KEY environment variable "
                "or configure it in config/llm_config.json"
            ) from e
        raise
    
    answer = rag_system.query_with_history(question, session_id, llm)
    
    print(f"\n✅ Answer: {answer}\n")
    
    return answer


async def run_agent_mode(
    query: str = None,
    additional_servers: list = None,
    session_id: str = "default"
):
    """
    Run agent mode with MCP tools
    
    Args:
        query: Query to execute
        additional_servers: Additional MCP servers to connect to
        session_id: Session ID for conversation history
    """
    # Load MCP servers configuration
    mcp_servers = Config.load_mcp_servers(additional_servers)
    
    print(f"📡 Connecting to {len(mcp_servers)} MCP server(s)...\n")
    
    # Use context manager to keep MCP sessions alive
    # Note: If servers are unavailable, we'll continue with available ones
    try:
        async with MCPClientManager(mcp_servers) as mcp_tools:
            # Combine with local DosiBlog RAG tool
            all_tools = [retrieve_dosiblog_context] + mcp_tools
            
            print(f"\n📦 Total tools available: {len(all_tools)}")
            print(f"   • Local RAG tools: 1 (DosiBlog)")
            print(f"   • Remote MCP tools: {len(mcp_tools)}")
            print(f"   • Session ID: {session_id}")
            print(f"   • History: {len(history_manager.get_session_messages(session_id))} messages\n")
            
            # Create the agent with all tools
            print("🔧 Creating agent...")
            # Load LLM from config (includes API key)
            from src.llm_factory import create_llm_from_config
            llm_config = Config.load_llm_config()
            try:
                llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
            except Exception as e:
                error_msg = str(e)
                if "api_key" in error_msg.lower() or "OPENAI_API_KEY" in error_msg:
                    raise ValueError(
                        "OpenAI API key is not set. Please set OPENAI_API_KEY environment variable "
                        "or configure it in config/llm_config.json"
                    ) from e
                raise
            
            agent_executor = create_agent(
                model=llm,
                tools=all_tools,
                system_prompt="You are a helpful AI assistant with access to various tools including DosiBlog knowledge base. Use the tools when needed to answer questions accurately."
            )
            print("✓ Agent created successfully!")
            
            # Run queries
            if query:
                await run_agent_query(agent_executor, query, session_id)
            else:
                # Default example queries with history
                print("\n📝 Running example queries with conversation history...\n")
                await run_agent_query(
                    agent_executor,
                    "My name is Abdullah and I want to know about DosiBlog",
                    session_id
                )
    except Exception as e:
        # If MCP connection fails completely, continue with just RAG tool
        print(f"\n⚠️  MCP connection failed: {str(e)}")
        print("   Continuing with RAG-only mode...\n")
        
        all_tools = [retrieve_dosiblog_context]
        print(f"📦 Total tools available: {len(all_tools)}")
        print(f"   • Local RAG tools: 1 (DosiBlog)")
        print(f"   • Remote MCP tools: 0 (connection failed)\n")
        
        # Create agent with just RAG tool
        print("🔧 Creating agent (RAG-only mode)...")
        # Load LLM from config (includes API key)
        from src.llm_factory import create_llm_from_config
        llm_config = Config.load_llm_config()
        try:
            llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
        except Exception as e:
            error_msg = str(e)
            if "api_key" in error_msg.lower() or "OPENAI_API_KEY" in error_msg:
                raise ValueError(
                    "OpenAI API key is not set. Please set OPENAI_API_KEY environment variable "
                    "or configure it in config/llm_config.json"
                ) from e
            raise
        
        agent_executor = create_agent(
            model=llm,
            tools=all_tools,
            system_prompt="You are a helpful AI assistant with access to DosiBlog knowledge base. Use the tools when needed to answer questions accurately."
        )
        print("✓ Agent created successfully!")
        
        # Run queries
        if query:
            await run_agent_query(agent_executor, query, session_id)
        else:
            # Default example queries with history
            print("\n📝 Running example queries with conversation history...\n")
            await run_agent_query(
                agent_executor,
                "My name is Abdullah and I want to know about DosiBlog",
                session_id
            )
            await run_agent_query(
                agent_executor,
                "What is my name?",
                session_id
            )
            await run_agent_query(
                agent_executor,
                "What technologies are used in that project?",
                session_id
            )
            
            # Show session summary
            history_manager.show_session_info(session_id)


async def run_rag_mode(query: str = None, session_id: str = "default"):
    """
    Run RAG-only mode (no MCP tools)
    
    Args:
        query: Query to execute
        session_id: Session ID for conversation history
    """
    if query:
        await run_rag_query(query, session_id)
    else:
        # Example RAG queries with history
        print("📝 Running example RAG queries with conversation history...\n")
        await run_rag_query("What is DosiBlog?", session_id)
        await run_rag_query("Who created it?", session_id)
        await run_rag_query("What technologies does it use?", session_id)
        history_manager.show_session_info(session_id)

