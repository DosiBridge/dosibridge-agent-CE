"""
Refactored Chat Service
Following Refactoring.Guru: Introduce Parameter Object, Extract Method, Decompose Conditional, Replace Conditional with Polymorphism
"""
from typing import Optional
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, AIMessage

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from src.core import Config, User
from src.services import history_manager, create_llm_from_config, rag_system
from src.services.db_history import db_history_manager
from src.services.advanced_rag import advanced_rag_system
from src.services.react_agent import create_react_agent
from src.services.chat_models import ChatRequestParams, ChatResponseData, TokenUsage
from src.services.chat_conditionals import ConditionalHelpers, GuardClauseHelpers
from src.services.tool_manager import ToolManager
from src.services.llm_provider_factory import LLMProviderFactory
from src.services.chat_helpers import ChatHistoryManager, AgentPromptBuilder, RAGPromptBuilder
from src.utils import sanitize_tools_for_gemini
from src.utils.utils import extract_token_usage, estimate_tokens
from src.core.constants import CHAT_MODE_AGENT, CHAT_MODE_RAG
from src.core.chat_constants import DEFAULT_LLM_TEMPERATURE, DEFAULT_EMBEDDING_TOKENS


class ChatService:
    """Service for handling chat operations - Refactored"""

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
        Following Refactoring.Guru: Introduce Parameter Object
        """
        # Create parameter object
        params = ChatRequestParams(
            message=message,
            session_id=session_id,
            user_id=user.id if user else None,
            db=db,
            collection_id=collection_id,
            use_react=use_react,
            agent_prompt=agent_prompt
        )

        # Route to appropriate handler based on mode
        if mode == CHAT_MODE_RAG:
            return await ChatService._process_rag_mode(params)
        else:
            return await ChatService._process_agent_mode(params)

    @staticmethod
    async def _process_rag_mode(params: ChatRequestParams) -> dict:
        """Process RAG mode with advanced RAG system"""
        llm_config = Config.load_llm_config(db=params.db, user_id=params.user_id)

        # Use ReAct agent if requested
        if ConditionalHelpers.should_use_react_agent(params.use_react, params.user_id):
            return await ChatService._process_rag_with_react(params, llm_config)
        else:
            return await ChatService._process_rag_with_retrieval(params, llm_config)

    @staticmethod
    async def _process_rag_with_react(params: ChatRequestParams, llm_config: dict) -> dict:
        """Process RAG mode with ReAct agent"""
        react_agent = create_react_agent(llm_config)

        history = ChatHistoryManager.get_history(
            params.session_id, params.user_id, params.db
        )

        result = await react_agent.run(
            query=params.message,
            user_id=params.user_id,
            session_id=params.session_id,
            collection_id=params.collection_id,
            chat_history=history,
            agent_prompt=params.agent_prompt
        )

        answer = result["answer"]
        tools_used = [call["name"] for call in result.get("tool_calls", [])]

        token_usage = ChatService._extract_token_usage_from_result(result, params.message, answer)

        ChatHistoryManager.save_message(
            params.session_id, params.user_id, params.db,
            params.message, answer
        )

        return ChatService._build_response(
            answer, params.session_id, CHAT_MODE_RAG, tools_used, token_usage
        )

    @staticmethod
    async def _process_rag_with_retrieval(params: ChatRequestParams, llm_config: dict) -> dict:
        """Process RAG mode with document retrieval"""
        context = ChatService._retrieve_context(params)

        llm = create_llm_from_config(llm_config, streaming=False, temperature=DEFAULT_LLM_TEMPERATURE)

        history = ChatHistoryManager.get_history(
            params.session_id, params.user_id, params.db
        )
        session_history = ChatHistoryManager.get_session_history(
            params.session_id, params.user_id, params.db
        )

        prompt = RAGPromptBuilder.create_rag_prompt()
        response = llm.invoke(prompt.format(
            context=context,
            chat_history=history,
            input=params.message
        ))

        answer = response.content if hasattr(response, 'content') else str(response)

        token_usage = ChatService._extract_token_usage_from_response(
            response, params.message, context, answer
        )

        session_history.add_user_message(HumanMessage(content=params.message))
        session_history.add_ai_message(AIMessage(content=answer))

        return ChatService._build_response(
            answer, params.session_id, CHAT_MODE_RAG,
            ["advanced_rag_retrieval"], token_usage
        )

    @staticmethod
    def _retrieve_context(params: ChatRequestParams) -> str:
        """Retrieve context for RAG mode"""
        if ConditionalHelpers.should_use_advanced_rag(params.user_id):
            retrieved_docs = advanced_rag_system.retrieve(
                query=params.message,
                user_id=params.user_id,
                k=5,
                use_reranking=True,
                use_hybrid=True,
                collection_id=params.collection_id
            )

            context_parts = []
            for doc in retrieved_docs:
                content = doc["content"]
                metadata = doc.get("metadata", {})
                source = metadata.get("original_filename", "Document")
                context_parts.append(f"[{source}]\n{content}\n")

            return "\n".join(context_parts) if context_parts else "No relevant documents found."
        else:
            return rag_system.retrieve_context(params.message)

    @staticmethod
    async def _process_agent_mode(params: ChatRequestParams) -> dict:
        """Process agent mode with tools"""
        mcp_servers = Config.load_mcp_servers(user_id=params.user_id, db=params.db)

        tool_manager = ToolManager(user_id=params.user_id, db=params.db)
        all_tools = await tool_manager.load_all_tools(mcp_servers)

        llm_config = Config.load_llm_config(db=params.db, user_id=params.user_id)

        # Validate LLM config with guard clause
        is_valid, error_msg = GuardClauseHelpers.validate_llm_config(llm_config)
        if not is_valid:
            return ChatService._build_error_response(error_msg)

        # Create LLM provider
        provider = LLMProviderFactory.create_provider(llm_config)

        try:
            llm = provider.create_llm(streaming=False, temperature=DEFAULT_LLM_TEMPERATURE)
        except Exception as e:
            error_msg = ChatService._format_llm_error(e)
            return ChatService._build_error_response(error_msg)

        # Handle Ollama fallback (doesn't support tools)
        if not provider.supports_tools():
            return await ChatService._process_ollama_fallback(params, all_tools, llm)

        # Create agent with tools
        agent = ChatService._create_agent(llm, all_tools, llm_config, params.agent_prompt)

        # Get history and run agent
        history = ChatHistoryManager.get_history(
            params.session_id, params.user_id, params.db
        )
        session_history = ChatHistoryManager.get_session_history(
            params.session_id, params.user_id, params.db
        )

        normalized_history = ChatService._normalize_messages(history)
        messages = normalized_history + [HumanMessage(content=params.message)]

        # Run agent
        final_answer, tools_used = await ChatService._run_agent(agent, messages)

        # Extract token usage
        token_usage = ChatService._extract_token_usage_from_message(
            final_answer, params.message
        )

        # Save to history
        session_history.add_user_message(HumanMessage(content=params.message))
        session_history.add_ai_message(AIMessage(content=final_answer))

        return ChatService._build_response(
            final_answer, params.session_id, CHAT_MODE_AGENT, tools_used, token_usage
        )

    @staticmethod
    async def _run_agent(agent, messages: list) -> tuple[str, list]:
        """Run agent and extract answer and tools used"""
        from src.services.chat_helpers import ContentNormalizer

        final_answer = ""
        tools_used = []
        last_ai_message = None

        async for event in agent.astream({"messages": messages}, stream_mode="values"):
            event_messages = event.get("messages", [])
            normalized_event_messages = ChatService._normalize_messages(event_messages)
            event["messages"] = normalized_event_messages

            last_msg = normalized_event_messages[-1] if normalized_event_messages else None

            if isinstance(last_msg, AIMessage):
                last_ai_message = last_msg
                if getattr(last_msg, "tool_calls", None):
                    for call in last_msg.tool_calls:
                        tools_used.append(call['name'])
                else:
                    final_answer = ContentNormalizer.normalize_content(last_msg.content)

        return final_answer, tools_used

    @staticmethod
    async def _process_ollama_fallback(params: ChatRequestParams, all_tools: list, llm) -> dict:
        """Fallback for Ollama which doesn't support bind_tools"""
        from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

        history = ChatHistoryManager.get_history(
            params.session_id, params.user_id, params.db
        )
        session_history = ChatHistoryManager.get_session_history(
            params.session_id, params.user_id, params.db
        )

        context = rag_system.retrieve_context(params.message)

        system_message = AgentPromptBuilder.create_agent_prompt(params.agent_prompt)
        system_message = system_message.replace("{context}", context)

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_message),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])

        response = llm.invoke(prompt.format(
            context=context,
            chat_history=history,
            input=params.message
        ))

        answer = response.content if hasattr(response, 'content') else str(response)

        token_usage = ChatService._extract_token_usage_from_response(
            response, params.message, context, answer
        )

        session_history.add_user_message(HumanMessage(content=params.message))
        session_history.add_ai_message(AIMessage(content=answer))

        return ChatService._build_response(
            answer, params.session_id, CHAT_MODE_AGENT, [], token_usage
        )

    @staticmethod
    def _create_agent(llm, tools: list, llm_config: dict, agent_prompt: Optional[str] = None):
        """Create LangChain agent with tools"""
        system_prompt = AgentPromptBuilder.create_agent_prompt(agent_prompt)
        sanitized_tools = sanitize_tools_for_gemini(tools, llm_config.get("type", ""))

        return create_agent(
            model=llm,
            tools=sanitized_tools,
            system_prompt=system_prompt
        )

    @staticmethod
    def _extract_token_usage_from_result(result: dict, message: str, answer: str) -> TokenUsage:
        """Extract token usage from ReAct result"""
        input_tokens = result.get("token_usage", {}).get("input_tokens", 0)
        output_tokens = result.get("token_usage", {}).get("output_tokens", 0)
        embedding_tokens = result.get("token_usage", {}).get("embedding_tokens", 0)

        if not ConditionalHelpers.has_token_usage(input_tokens, output_tokens):
            input_tokens = estimate_tokens(message)
            output_tokens = estimate_tokens(answer)

        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            embedding_tokens=embedding_tokens
        )

    @staticmethod
    def _extract_token_usage_from_response(response, message: str, context: str, answer: str) -> TokenUsage:
        """Extract token usage from LLM response"""
        input_tokens, output_tokens, embedding_tokens = extract_token_usage(response)

        if not ConditionalHelpers.has_token_usage(input_tokens, output_tokens):
            input_text = f"{message} {context}"
            input_tokens = estimate_tokens(input_text)
            output_tokens = estimate_tokens(answer)

        return TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            embedding_tokens=embedding_tokens
        )

    @staticmethod
    def _extract_token_usage_from_message(answer: str, message: str) -> TokenUsage:
        """Extract token usage by estimation"""
        return TokenUsage(
            input_tokens=estimate_tokens(message),
            output_tokens=estimate_tokens(answer),
            embedding_tokens=DEFAULT_EMBEDDING_TOKENS
        )

    @staticmethod
    def _format_llm_error(error: Exception) -> str:
        """Format LLM initialization error"""
        error_msg = f"Failed to initialize LLM: {str(error)}"
        if "api_key" in str(error).lower():
            error_msg = "LLM API key is invalid or missing. Please configure a valid API key via environment variables or create a personal LLM config."
        return error_msg

    @staticmethod
    def _build_response(
        response: str,
        session_id: str,
        mode: str,
        tools_used: list,
        token_usage: TokenUsage
    ) -> dict:
        """Build response dictionary"""
        return {
            "response": response,
            "session_id": session_id,
            "mode": mode,
            "tools_used": tools_used,
            "token_usage": token_usage.to_dict()
        }

    @staticmethod
    def _build_error_response(error_msg: str) -> dict:
        """Build error response"""
        return {
            "response": error_msg,
            "session_id": "",
            "mode": "",
            "tools_used": [],
            "token_usage": TokenUsage().to_dict()
        }

    @staticmethod
    def _normalize_messages(messages):
        """Normalize a list of messages to ensure all contents are strings"""
        from src.services.chat_helpers import ContentNormalizer
        from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage

        normalized = []
        for msg in messages:
            if not isinstance(msg, BaseMessage):
                normalized.append(msg)
                continue

            if isinstance(msg.content, str):
                normalized.append(msg)
                continue

            normalized_content = ContentNormalizer.normalize_content(msg.content)

            if isinstance(msg, HumanMessage):
                normalized.append(HumanMessage(content=normalized_content))
            elif isinstance(msg, AIMessage):
                new_msg = AIMessage(content=normalized_content)
                if hasattr(msg, 'tool_calls'):
                    new_msg.tool_calls = msg.tool_calls
                normalized.append(new_msg)
            elif isinstance(msg, SystemMessage):
                normalized.append(SystemMessage(content=normalized_content))
            else:
                msg.content = normalized_content
                normalized.append(msg)

        return normalized

