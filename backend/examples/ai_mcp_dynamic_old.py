"""
Dynamic MCP Agent - Pass MCP server URLs as arguments with RAG and History Maintenance
Usage examples:
    python ai_mcp_dynamic.py
    python ai_mcp_dynamic.py --add-server '{"name":"MyServer","url":"https://example.com/mcp"}'
    python ai_mcp_dynamic.py --query "What is DosiBlog?" --session-id "user123"
"""
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("⚠️  python-dotenv not available, using environment variables directly")
import asyncio
import json
import os
import argparse
from datetime import datetime
from typing import Dict, List, Optional

# LangChain imports
from langchain_core.tools import tool
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain.agents import create_agent  # New v1.0 agent API
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
# Note: In LangChain 1.0, chain functions are in langchain_classic
from langchain_classic.chains import create_retrieval_chain, create_history_aware_retriever
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

# MCP imports
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from langchain_mcp_adapters.tools import load_mcp_tools

# --- 1. History Management System ---

class ConversationHistoryManager:
    """Manages conversation history for multiple sessions"""
    
    def __init__(self):
        """Initialize the history store"""
        self.store: Dict[str, ChatMessageHistory] = {}
        print("✓ Conversation History Manager initialized")
    
    def get_session_history(self, session_id: str) -> BaseChatMessageHistory:
        """
        Get or create a chat history for a specific session
        
        Args:
            session_id: Unique identifier for the conversation session
            
        Returns:
            ChatMessageHistory for the session
        """
        if session_id not in self.store:
            self.store[session_id] = ChatMessageHistory()
            print(f"📝 Created new conversation session: {session_id}")
        return self.store[session_id]
    
    def get_session_messages(self, session_id: str) -> List[BaseMessage]:
        """Get all messages from a session"""
        if session_id in self.store:
            return self.store[session_id].messages
        return []
    
    def clear_session(self, session_id: str) -> None:
        """Clear history for a specific session"""
        if session_id in self.store:
            self.store[session_id].clear()
            print(f"🗑️  Cleared session: {session_id}")
    
    def list_sessions(self) -> List[str]:
        """List all active session IDs"""
        return list(self.store.keys())
    
    def get_session_summary(self, session_id: str) -> str:
        """Get a summary of the session"""
        messages = self.get_session_messages(session_id)
        return f"Session {session_id}: {len(messages)} messages"

# Global history manager
history_manager = ConversationHistoryManager()

# --- 2. Enhanced RAG System ---

class EnhancedRAGSystem:
    """Enhanced RAG system with better context retrieval and history awareness"""
    
    def __init__(self):
        """Initialize the RAG system with DosiBlog context"""
        self.texts = [
            "DosiBlog is a web development project created by Abdullah Al Sazib.",
            "DosiBlog uses Node.js, Express, and MongoDB for backend development.",
            "The DosiBlog project was started in September 2025.",
            "DosiBlog features include user authentication, blog post creation, and commenting system.",
            "Abdullah Al Sazib is a full-stack developer specializing in MERN stack.",
            "The project uses RESTful API architecture for communication between frontend and backend.",
        ]
        
        try:
            self.embeddings = OpenAIEmbeddings()
            self.vectorstore = FAISS.from_texts(self.texts, embedding=self.embeddings)
            self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": 3})
            self.available = True
            print("✓ Enhanced RAG System initialized with FAISS vectorstore")
        except Exception as e:
            print(f"⚠️  FAISS not available, RAG tool disabled: {e}")
            self.available = False
    
    def retrieve_context(self, query: str) -> str:
        """Retrieve relevant context for a query"""
        if not self.available:
            return "RAG system not available."
        
        try:
            docs = self.retriever.invoke(query)
            if docs:
                contexts = [doc.page_content for doc in docs]
                return "\n".join(contexts)
            return "No relevant context found."
        except Exception as e:
            return f"Error retrieving context: {e}"
    
    def query_with_history(self, query: str, session_id: str, llm: ChatOpenAI) -> str:
        """
        Query the RAG system with conversation history
        
        Args:
            query: User's question
            session_id: Session identifier
            llm: Language model to use
            
        Returns:
            Answer with context from both RAG and history
        """
        if not self.available:
            return "RAG system not available."
        
        # Contextualization prompt for history-aware retrieval
        contextualize_prompt = ChatPromptTemplate.from_messages([
            ("system", 
             "Given a chat history and the latest user question, "
             "formulate a standalone question which can be understood without the chat history. "
             "Do NOT answer the question, just reformulate it if needed."),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])
        
        # Answer prompt
        answer_prompt = ChatPromptTemplate.from_messages([
            ("system", 
             "You are a helpful AI assistant. Use the following context to answer questions accurately and naturally.\n"
             "Context: {context}\n\n"
             "Rules:\n"
             "- Answer naturally without mentioning 'the context' or 'according to the context'\n"
             "- If you don't know, say so honestly\n"
             "- Be concise and helpful"),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])
        
        # Create history-aware retriever
        history_aware_retriever = create_history_aware_retriever(
            llm, self.retriever, contextualize_prompt
        )
        
        # Create question answering chain
        question_answer_chain = create_stuff_documents_chain(llm, answer_prompt)
        
        # Create retrieval chain
        rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)
        
        # Wrap with history
        conversational_rag_chain = RunnableWithMessageHistory(
            rag_chain,
            lambda sid: history_manager.get_session_history(sid),
            input_messages_key="input",
            history_messages_key="chat_history",
            output_messages_key="answer",
        )
        
        # Execute query
        result = conversational_rag_chain.invoke(
            {"input": query},
            config={"configurable": {"session_id": session_id}},
        )
        
        return result["answer"]

# Initialize RAG system
rag_system = EnhancedRAGSystem()

# Tool for RAG retrieval
@tool("retrieve_dosiblog_context")
def retrieve_dosiblog_context(query: str) -> str:
    """Retrieves relevant context about DosiBlog projects and related topics."""
    print(f"🔍 Calling Enhanced RAG Tool for query: {query}")
    context = rag_system.retrieve_context(query)
    return f"Retrieved context:\n{context}"

# --- 3. MCP Client Context Manager ---

class MCPClientManager:
    """Context manager to maintain MCP sessions"""
    def __init__(self, mcp_servers: list[dict]):
        """
        Initialize with a list of MCP server configurations
        
        Args:
            mcp_servers: List of server configs, each with 'name', 'url', and optional 'headers'
        """
        self.mcp_servers = mcp_servers
        self.sessions = []
        self.tools = []
        
    async def __aenter__(self):
        """Load tools from all configured MCP servers and keep sessions alive"""
        
        for server_config in self.mcp_servers:
            server_name = server_config.get("name", "Unknown")
            server_url = server_config["url"]
            server_headers = server_config.get("headers", {})
            
            print(f"Loading tools from {server_name} MCP server ({server_url})...")
            
            try:
                # Prepare server params
                server_params = {"url": server_url}
                if server_headers:
                    server_params["headers"] = server_headers
                
                # Connect to server
                client = streamablehttp_client(**server_params)
                read, write, _ = await client.__aenter__()
                session = ClientSession(read, write)
                await session.__aenter__()
                await session.initialize()
                
                # Load tools
                tools = await load_mcp_tools(session)
                self.tools.extend(tools)
                self.sessions.append((client, session))
                
                print(f"✓ Loaded {len(tools)} tool(s) from {server_name} MCP server")
                for tool in tools:
                    print(f"  - {tool.name}: {tool.description}")
            except Exception as e:
                print(f"✗ Failed to load {server_name} MCP tools: {e}")
            
            print()  # Empty line between servers
        
        return self.tools
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Clean up all sessions"""
        print("\n🔄 Closing MCP sessions...")
        for client, session in reversed(self.sessions):
            try:
                await session.__aexit__(None, None, None)
                await client.__aexit__(None, None, None)
            except Exception as e:
                print(f"Error closing session: {e}")
        print("✓ All MCP sessions closed")

# --- 4. Query Functions with History Support ---

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
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    answer = rag_system.query_with_history(question, session_id, llm)
    
    print(f"\n✅ Answer: {answer}\n")
    
    return answer

def show_session_info(session_id: str = None):
    """Display information about sessions"""
    print(f"\n{'='*60}")
    print("📊 Session Information")
    print(f"{'='*60}\n")
    
    if session_id:
        messages = history_manager.get_session_messages(session_id)
        print(f"Session: {session_id}")
        print(f"Messages: {len(messages)}\n")
        
        for i, msg in enumerate(messages, 1):
            role = "User" if isinstance(msg, HumanMessage) else "AI"
            content = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            print(f"  {i}. [{role}] {content}")
    else:
        sessions = history_manager.list_sessions()
        print(f"Active Sessions: {len(sessions)}\n")
        
        for session in sessions:
            print(f"  • {history_manager.get_session_summary(session)}")
    
    print()

# Backward compatibility
async def run_query(agent_executor, question: str):
    """Run a query through the agent (backward compatibility)"""
    return await run_agent_query(agent_executor, question, "default")

# --- 5. Load MCP Servers Configuration ---

def load_mcp_servers_config(additional_servers: list = None) -> list[dict]:
    """
    Load MCP servers from multiple sources:
    1. Environment variable MCP_SERVERS (JSON array)
    2. Config file mcp_servers.json
    3. Additional servers passed as argument
    """
    servers = []
    
    # Method 1: From environment variable
    env_servers = os.getenv("MCP_SERVERS")
    if env_servers:
        try:
            servers.extend(json.loads(env_servers))
            print(f"📝 Loaded {len(json.loads(env_servers))} server(s) from MCP_SERVERS env variable")
        except json.JSONDecodeError as e:
            print(f"⚠️  Failed to parse MCP_SERVERS env variable: {e}")
    
    # Method 2: From config file
    config_file = "mcp_servers.json"
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                file_servers = json.load(f)
                servers.extend(file_servers)
                print(f"📝 Loaded {len(file_servers)} server(s) from {config_file}")
        except Exception as e:
            print(f"⚠️  Failed to load {config_file}: {e}")
    
    # Method 3: Return empty list if none loaded (agent will work with local tools only)
    if not servers:
        print("📝 No MCP servers configured - agent will use local tools only")
    
    # Add any additional servers passed as argument
    if additional_servers:
        servers.extend(additional_servers)
        print(f"📝 Added {len(additional_servers)} additional server(s)")
    
    return servers

# --- 6. Main Function ---

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
        show_session_info(session_id if session_id != "default" else None)
        return
    
    if clear_history:
        history_manager.clear_session(session_id)
        return
    
    # RAG-only mode (no MCP tools)
    if mode == "rag":
        if query:
            await run_rag_query(query, session_id)
        else:
            # Example RAG queries with history
            print("📝 Running example RAG queries with conversation history...\n")
            await run_rag_query("What is DosiBlog?", session_id)
            await run_rag_query("Who created it?", session_id)
            await run_rag_query("What technologies does it use?", session_id)
            show_session_info(session_id)
        return
    
    # Agent mode with MCP tools
    # Load MCP servers configuration
    mcp_servers = load_mcp_servers_config(additional_servers)
    
    print(f"📡 Connecting to {len(mcp_servers)} MCP server(s)...\n")
    
    # Use context manager to keep MCP sessions alive
    async with MCPClientManager(mcp_servers) as mcp_tools:
        
        # Combine with local DosiBlog RAG tool
        all_tools = [retrieve_dosiblog_context] + mcp_tools
        
        print(f"\n📦 Total tools available: {len(all_tools)}")
        print(f"   • Local RAG tools: 1 (DosiBlog)")
        print(f"   • Remote MCP tools: {len(mcp_tools)}")
        print(f"   • Session ID: {session_id}")
        print(f"   • History: {len(history_manager.get_session_messages(session_id))} messages\n")
        
        # Create the agent with all tools
        print("🔧 Creating agent with GPT-4o...")
        agent_executor = create_agent(
            model="gpt-4o",
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
            show_session_info(session_id)

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

