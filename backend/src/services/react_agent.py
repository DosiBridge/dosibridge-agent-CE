"""
ReAct (Reasoning and Acting) Agent implementation
Combines reasoning with tool use for better problem-solving
"""
from typing import List, Dict, Optional, Any
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import BaseTool
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from src.services.advanced_rag import advanced_rag_system
from src.services.llm_factory import create_llm_from_config
from src.core import Config


class ReActAgent:
    """
    ReAct Agent that combines reasoning and acting
    
    ReAct pattern:
    1. Thought: Reason about what to do
    2. Action: Choose a tool/action
    3. Observation: Get result from tool
    4. Repeat until final answer
    """
    
    def __init__(self, llm_config: Optional[Dict] = None):
        """Initialize ReAct agent"""
        if llm_config is None:
            llm_config = Config.load_llm_config()
        
        self.llm_config = llm_config
        self.llm = create_llm_from_config(llm_config, streaming=False, temperature=0.1)
    
    def create_react_prompt(self) -> ChatPromptTemplate:
        """Create ReAct-style prompt"""
        return ChatPromptTemplate.from_messages([
            SystemMessage(content=(
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
                "You use a ReAct (Reasoning and Acting) approach:\n"
                "1. **Thought**: Think about what you need to do and what information you need\n"
                "2. **Action**: Use available tools to gather information or perform actions\n"
                "3. **Observation**: Analyze the results from tools\n"
                "4. **Final Answer**: Provide a clear, comprehensive answer based on your reasoning\n\n"
                "If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate.\n"
                "Do not claim affiliation with any external AI vendor unless explicitly instructed.\n\n"
                "Available tools:\n"
                "- retrieve_documents: Search through uploaded documents\n"
                "- calculate: Perform mathematical calculations\n"
                "- search_web: Search the web for information\n\n"
                "Always explain your reasoning process before taking actions."
            )),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])
    
    def create_react_tools(self, user_id: int, collection_id: Optional[int] = None) -> List[BaseTool]:
        """Create tools for ReAct agent
        
        NOTE: ReAct agent in RAG mode only uses document retrieval and calculation tools.
        It does NOT include MCP (Model Context Protocol) tools.
        MCP tools are only available in Agent mode, not RAG mode.
        """
        from langchain_core.tools import tool
        
        @tool
        def retrieve_documents(query: str) -> str:
            """Retrieve relevant documents from the knowledge base.
            
            Args:
                query: Search query to find relevant documents
            
            Returns:
                Relevant document chunks with context
            """
            try:
                results = advanced_rag_system.retrieve(
                    query=query,
                    user_id=user_id,
                    k=5,
                    use_reranking=True,
                    use_hybrid=True,
                    collection_id=collection_id
                )
                
                if not results:
                    return "No relevant documents found."
                
                context_parts = []
                for i, result in enumerate(results, 1):
                    content = result["content"]
                    metadata = result.get("metadata", {})
                    source = metadata.get("original_filename", "Unknown")
                    context_parts.append(f"[Document {i} - {source}]\n{content}\n")
                
                return "\n".join(context_parts)
            except Exception as e:
                return f"Error retrieving documents: {str(e)}"
        
        @tool
        def calculate(expression: str) -> str:
            """Perform mathematical calculations.
            
            Args:
                expression: Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")
            
            Returns:
                Calculation result
            """
            try:
                # Safe evaluation of mathematical expressions
                import math
                allowed_names = {
                    k: v for k, v in math.__dict__.items() if not k.startswith("__")
                }
                allowed_names.update({
                    "abs": abs,
                    "round": round,
                    "min": min,
                    "max": max,
                    "sum": sum,
                })
                result = eval(expression, {"__builtins__": {}}, allowed_names)
                return str(result)
            except Exception as e:
                return f"Calculation error: {str(e)}"
        
        return [retrieve_documents, calculate]
    
    async def run(
        self,
        query: str,
        user_id: int,
        session_id: str = "default",
        collection_id: Optional[int] = None,
        chat_history: Optional[List] = None,
        agent_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Run ReAct agent on a query
        
        Args:
            query: User's question
            user_id: User ID for document access
            session_id: Session ID
            collection_id: Optional collection ID to filter documents
            chat_history: Optional chat history
            agent_prompt: Optional custom system prompt for the agent
        
        Returns:
            Dictionary with answer, reasoning, and tool calls
        """
        # Create tools
        tools = self.create_react_tools(user_id, collection_id)
        
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
                "You use ReAct (Reasoning and Acting). Think step by step, use tools when needed, and provide clear answers.\n"
                "If a question is outside DOSIBridge's scope, respond professionally and redirect when appropriate.\n"
                "Do not claim affiliation with any external AI vendor unless explicitly instructed."
            )
        
        # Create agent
        agent = create_agent(
            model=self.llm,
            tools=tools,
            system_prompt=system_prompt
        )
        
        # Prepare messages
        messages = []
        if chat_history:
            messages.extend(chat_history)
        messages.append(HumanMessage(content=query))
        
        # Run agent
        result = await agent.ainvoke({"messages": messages})
        
        # Extract final answer
        final_message = result.get("messages", [])[-1] if isinstance(result, dict) else result
        if isinstance(final_message, AIMessage):
            answer = final_message.content
        else:
            answer = str(final_message)
        
        # Extract tool calls
        tool_calls = []
        if isinstance(final_message, AIMessage) and hasattr(final_message, "tool_calls"):
            tool_calls = [
                {
                    "name": call.get("name", "unknown"),
                    "args": call.get("args", {})
                }
                for call in final_message.tool_calls
            ]
        
        return {
            "answer": answer,
            "tool_calls": tool_calls,
            "reasoning": answer  # In ReAct, reasoning is part of the answer
        }


# Global instance factory
def create_react_agent(llm_config: Optional[Dict] = None) -> ReActAgent:
    """Create a ReAct agent instance"""
    return ReActAgent(llm_config)

