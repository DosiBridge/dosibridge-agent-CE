"""
LLM Factory - Creates LLM instances based on configuration
"""
from langchain_openai import ChatOpenAI
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from typing import Optional, List, Any, AsyncIterator
import os

# Try to import ChatOllama from langchain_ollama (preferred) or fallback to langchain_community
try:
    from langchain_ollama import ChatOllama
except ImportError:
    try:
        from langchain_community.chat_models import ChatOllama
    except ImportError:
        ChatOllama = None

# Try to import ChatGoogleGenerativeAI for Gemini support
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    try:
        from langchain_community.chat_models import ChatGoogleGenerativeAI
    except ImportError:
        # Try to add common installation paths
        import sys
        import os
        common_paths = [
            '/home/jack/.local/share/uv/lib/python3.13/site-packages',
            os.path.expanduser('~/.local/lib/python3.13/site-packages'),
            '/usr/local/lib/python3.13/site-packages',
        ]
        for path in common_paths:
            if os.path.exists(path) and path not in sys.path:
                sys.path.insert(0, path)
        
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError:
            ChatGoogleGenerativeAI = None


class MessageNormalizingLLM(BaseChatModel):
    """
    Wrapper LLM that normalizes message contents to strings before sending to the underlying LLM.
    This ensures that list/dict content is converted to strings to prevent API errors.
    """
    
    def __init__(self, llm: BaseChatModel):
        super().__init__()
        self.llm = llm
    
    @property
    def _llm_type(self) -> str:
        return f"normalized_{self.llm._llm_type}"
    
    def _normalize_message_content(self, content: Any) -> str:
        """Normalize message content to string"""
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
                    else:
                        result += str(item)
                elif isinstance(item, str):
                    result += item
                else:
                    result += str(item)
            return result
        elif isinstance(content, dict):
            if "text" in content:
                return content["text"]
            return str(content)
        else:
            return str(content)
    
    def _normalize_message(self, message: BaseMessage) -> BaseMessage:
        """Normalize a single message's content"""
        # Skip if content is already a string
        if isinstance(message.content, str):
            return message
        
        # Normalize the content
        normalized_content = self._normalize_message_content(message.content)
        
        # Create a new message of the same type with normalized content
        try:
            if isinstance(message, HumanMessage):
                return HumanMessage(content=normalized_content)
            elif isinstance(message, AIMessage):
                new_msg = AIMessage(content=normalized_content)
                # Preserve tool_calls if they exist
                if hasattr(message, 'tool_calls') and message.tool_calls:
                    new_msg.tool_calls = message.tool_calls
                # Preserve response_metadata if it exists
                if hasattr(message, 'response_metadata'):
                    new_msg.response_metadata = message.response_metadata
                return new_msg
            elif isinstance(message, SystemMessage):
                return SystemMessage(content=normalized_content)
            elif isinstance(message, ToolMessage):
                # Preserve tool_call_id for ToolMessage
                tool_call_id = getattr(message, 'tool_call_id', None)
                new_msg = ToolMessage(content=normalized_content, tool_call_id=tool_call_id)
                return new_msg
            else:
                # For other message types, try to create a new instance
                msg_class = type(message)
                # Try to preserve common attributes
                kwargs = {'content': normalized_content}
                if hasattr(message, 'tool_call_id'):
                    kwargs['tool_call_id'] = message.tool_call_id
                if hasattr(message, 'name'):
                    kwargs['name'] = message.name
                if hasattr(message, 'id'):
                    kwargs['id'] = message.id
                
                try:
                    return msg_class(**kwargs)
                except:
                    # Fallback: try with just content
                    try:
                        return msg_class(content=normalized_content)
                    except:
                        # Last resort: modify in place
                        message.content = normalized_content
                        return message
        except Exception as e:
            # If normalization fails, log and return original message
            import logging
            logging.warning(f"Failed to normalize message: {e}, using original message")
            # Try to at least convert content to string
            try:
                message.content = str(message.content) if not isinstance(message.content, str) else message.content
            except:
                pass
            return message
    
    def _normalize_messages(self, messages: List[BaseMessage]) -> List[BaseMessage]:
        """Normalize a list of messages"""
        normalized = []
        for msg in messages:
            try:
                normalized.append(self._normalize_message(msg))
            except Exception as e:
                # If normalization fails for a message, try to at least convert content to string
                import logging
                logging.warning(f"Failed to normalize message in list: {e}, converting content to string")
                try:
                    if hasattr(msg, 'content') and not isinstance(msg.content, str):
                        msg.content = str(msg.content)
                except:
                    pass
                normalized.append(msg)
        return normalized
    
    def invoke(self, input: Any, config: Optional[Any] = None, **kwargs: Any) -> Any:
        """Invoke the LLM with normalized messages"""
        if isinstance(input, list):
            # Normalize messages before invoking
            normalized_input = self._normalize_messages(input)
            return self.llm.invoke(normalized_input, config=config, **kwargs)
        elif isinstance(input, dict) and 'messages' in input:
            # Input is a dict with messages key
            normalized_messages = self._normalize_messages(input['messages'])
            normalized_input = {**input, 'messages': normalized_messages}
            return self.llm.invoke(normalized_input, config=config, **kwargs)
        elif hasattr(input, 'messages') and isinstance(input.messages, list):
            # Input is an object with messages attribute - create a copy
            import copy
            normalized_input = copy.deepcopy(input) if hasattr(copy, 'deepcopy') else input
            normalized_messages = self._normalize_messages(input.messages)
            normalized_input.messages = normalized_messages
            return self.llm.invoke(normalized_input, config=config, **kwargs)
        else:
            return self.llm.invoke(input, config=config, **kwargs)
    
    async def ainvoke(self, input: Any, config: Optional[Any] = None, **kwargs: Any) -> Any:
        """Async invoke the LLM with normalized messages"""
        try:
            if isinstance(input, list):
                # Normalize messages before invoking
                normalized_input = self._normalize_messages(input)
                return await self.llm.ainvoke(normalized_input, config=config, **kwargs)
            elif isinstance(input, dict) and 'messages' in input:
                # Input is a dict with messages key
                normalized_messages = self._normalize_messages(input['messages'])
                normalized_input = {**input, 'messages': normalized_messages}
                return await self.llm.ainvoke(normalized_input, config=config, **kwargs)
            elif hasattr(input, 'messages') and isinstance(input.messages, list):
                # Input is an object with messages attribute - create a copy
                import copy
                normalized_input = copy.deepcopy(input) if hasattr(copy, 'deepcopy') else input
                normalized_messages = self._normalize_messages(input.messages)
                normalized_input.messages = normalized_messages
                return await self.llm.ainvoke(normalized_input, config=config, **kwargs)
            else:
                return await self.llm.ainvoke(input, config=config, **kwargs)
        except Exception as e:
            # If ainvoke fails, try to normalize and retry
            import logging
            logging.warning(f"Error in ainvoke, attempting message normalization: {e}")
            if isinstance(input, list):
                try:
                    normalized_input = self._normalize_messages(input)
                    return await self.llm.ainvoke(normalized_input, config=config, **kwargs)
                except:
                    raise
            raise
    
    def stream(self, input: Any, config: Optional[Any] = None, **kwargs: Any) -> Any:
        """Stream the LLM with normalized messages"""
        if isinstance(input, list):
            normalized_input = self._normalize_messages(input)
            return self.llm.stream(normalized_input, config=config, **kwargs)
        elif isinstance(input, dict) and 'messages' in input:
            normalized_messages = self._normalize_messages(input['messages'])
            normalized_input = {**input, 'messages': normalized_messages}
            return self.llm.stream(normalized_input, config=config, **kwargs)
        elif hasattr(input, 'messages') and isinstance(input.messages, list):
            import copy
            normalized_input = copy.deepcopy(input) if hasattr(copy, 'deepcopy') else input
            normalized_messages = self._normalize_messages(input.messages)
            normalized_input.messages = normalized_messages
            return self.llm.stream(normalized_input, config=config, **kwargs)
        else:
            return self.llm.stream(input, config=config, **kwargs)
    
    async def astream(self, input: Any, config: Optional[Any] = None, **kwargs: Any) -> AsyncIterator[Any]:
        """Async stream the LLM with normalized messages"""
        if isinstance(input, list):
            normalized_input = self._normalize_messages(input)
            async for chunk in self.llm.astream(normalized_input, config=config, **kwargs):
                yield chunk
        elif isinstance(input, dict) and 'messages' in input:
            normalized_messages = self._normalize_messages(input['messages'])
            normalized_input = {**input, 'messages': normalized_messages}
            async for chunk in self.llm.astream(normalized_input, config=config, **kwargs):
                yield chunk
        elif hasattr(input, 'messages') and isinstance(input.messages, list):
            import copy
            normalized_input = copy.deepcopy(input) if hasattr(copy, 'deepcopy') else input
            normalized_messages = self._normalize_messages(input.messages)
            normalized_input.messages = normalized_messages
            async for chunk in self.llm.astream(normalized_input, config=config, **kwargs):
                yield chunk
        else:
            async for chunk in self.llm.astream(input, config=config, **kwargs):
                yield chunk
    
    def bind_tools(self, tools: Any, **kwargs: Any) -> Any:
        """Bind tools to the underlying LLM"""
        bound_llm = self.llm.bind_tools(tools, **kwargs)
        # Wrap the bound LLM to ensure messages are still normalized
        # Check if it's already wrapped to avoid double-wrapping
        if isinstance(bound_llm, MessageNormalizingLLM):
            return bound_llm
        return MessageNormalizingLLM(bound_llm)
    
    def _generate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None, run_manager: Optional[Any] = None, **kwargs: Any) -> Any:
        """Core generation method - normalize messages before calling underlying LLM"""
        try:
            normalized_messages = self._normalize_messages(messages)
            return self.llm._generate(normalized_messages, stop=stop, run_manager=run_manager, **kwargs)
        except Exception as e:
            # If normalization fails, try to normalize each message individually
            import logging
            logging.warning(f"Error in _generate normalization: {e}, attempting individual message normalization")
            try:
                safe_messages = []
                for msg in messages:
                    try:
                        safe_messages.append(self._normalize_message(msg))
                    except:
                        # If individual normalization fails, try to convert content to string
                        if hasattr(msg, 'content') and not isinstance(msg.content, str):
                            msg.content = str(msg.content)
                        safe_messages.append(msg)
                return self.llm._generate(safe_messages, stop=stop, run_manager=run_manager, **kwargs)
            except:
                # Last resort: pass through and let the underlying LLM handle it
                return self.llm._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
    
    async def _agenerate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None, run_manager: Optional[Any] = None, **kwargs: Any) -> Any:
        """Async core generation method - normalize messages before calling underlying LLM"""
        try:
            normalized_messages = self._normalize_messages(messages)
            return await self.llm._agenerate(normalized_messages, stop=stop, run_manager=run_manager, **kwargs)
        except Exception as e:
            # If normalization fails, try to normalize each message individually
            import logging
            logging.warning(f"Error in _agenerate normalization: {e}, attempting individual message normalization")
            try:
                safe_messages = []
                for msg in messages:
                    try:
                        safe_messages.append(self._normalize_message(msg))
                    except:
                        # If individual normalization fails, try to convert content to string
                        if hasattr(msg, 'content') and not isinstance(msg.content, str):
                            msg.content = str(msg.content)
                        safe_messages.append(msg)
                return await self.llm._agenerate(safe_messages, stop=stop, run_manager=run_manager, **kwargs)
            except:
                # Last resort: pass through and let the underlying LLM handle it
                return await self.llm._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)
    
    @property
    def _identifying_params(self) -> dict:
        """Return identifying parameters"""
        return self.llm._identifying_params
    
    def __getattr__(self, name: str) -> Any:
        """Delegate any other attribute access to the underlying LLM"""
        return getattr(self.llm, name)


def create_llm_from_config(config: dict, streaming: bool = False, temperature: float = 0):
    """
    Create an LLM instance based on configuration.
    
    Supported types:
    - openai: OpenAI models (requires api_key and model)
    - deepseek: DeepSeek models (requires api_key and model, uses OpenAI-compatible API)
    - groq: Groq models (requires api_key and model)
    - ollama: Local Ollama models (requires base_url and model)
    - gemini: Google Gemini models (requires api_key and model)
    - openrouter: OpenRouter models (requires api_key and model, uses OpenAI-compatible API)
    
    Args:
        config: LLM configuration dictionary with keys:
            - type: "openai", "deepseek", "groq", "ollama", "gemini", or "openrouter"
            - model: Model name
            - api_key: API key (for openai/deepseek/groq/gemini)
            - base_url: Base URL (for ollama, defaults to http://localhost:11434)
            - api_base: Custom API base URL (optional, for openai/groq/deepseek)
        streaming: Whether to enable streaming
        temperature: Temperature for the model
        
    Returns:
        LLM instance (ChatOpenAI, ChatOllama, etc.)
    """
    llm_type = config.get("type", "deepseek").lower()
    model = config.get("model", "deepseek-chat")
    
    if llm_type == "ollama":
        # Local Ollama instance
        if ChatOllama is None:
            raise ImportError(
                "ChatOllama is not available. Ensure 'langchain-ollama' is in requirements.txt and redeploy."
            )
        
        base_url = config.get("base_url", "http://localhost:11434")
        try:
            llm = ChatOllama(
                model=model,
                base_url=base_url,
                temperature=temperature,
                streaming=streaming,
                timeout=60.0  # Increase timeout for Docker
            )
            return MessageNormalizingLLM(llm)
        except Exception as e:
            raise ValueError(
                f"Failed to connect to Ollama at {base_url}. "
                f"Make sure Ollama is running. Error: {str(e)}"
            )
    
    elif llm_type == "deepseek":
        # DeepSeek API (OpenAI-compatible)
        api_key = config.get("api_key") or os.getenv("DEEPSEEK_KEY")
        if not api_key:
            raise ValueError(
                "DeepSeek API key is required. "
                "Please set DEEPSEEK_KEY environment variable or configure it in the database. "
                "Get an API key from: https://platform.deepseek.com"
            )
        
        # DeepSeek uses OpenAI-compatible API
        api_base = config.get("api_base") or "https://api.deepseek.com"
        llm = ChatOpenAI(
            model=model or "deepseek-chat",
            api_key=api_key,
            base_url=api_base,
            temperature=temperature,
            streaming=streaming
        )
        return MessageNormalizingLLM(llm)
    
    elif llm_type == "groq":
        # Groq API
        api_key = config.get("api_key") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("Groq API key is required")
        
        # Groq uses OpenAI-compatible API
        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
            temperature=temperature,
            streaming=streaming
        )
        return MessageNormalizingLLM(llm)
    
    elif llm_type == "gemini":
        # Google Gemini API
        if ChatGoogleGenerativeAI is None:
            raise ImportError(
                "ChatGoogleGenerativeAI is not available. Ensure 'langchain-google-genai' is in requirements.txt and redeploy."
            )
        
        api_key = config.get("api_key") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "Google API key is required for Gemini. "
                "Please set GOOGLE_API_KEY environment variable or configure it in the database. "
                "Get an API key from: https://aistudio.google.com/app/apikey"
            )
        
        try:
            # Common Gemini model names for validation hints
            common_models = [
                "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro",
                "gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-2.5-flash-lite",
                "gemini-2.5-pro"
            ]
            
            # Try to initialize with the model
            # Note: Some models may require specific API versions
            llm = ChatGoogleGenerativeAI(
                model=model,
                google_api_key=api_key,
                temperature=temperature,
                streaming=streaming
            )
            
            return MessageNormalizingLLM(llm)
        except Exception as e:
            error_msg = str(e)
            
            # Check for NotFound/404 errors - model not available for current API version
            if "NotFound" in error_msg or "404" in error_msg or "not found" in error_msg.lower():
                raise ValueError(
                    f"Gemini model '{model}' is not available or not found for the current API version. "
                    f"Try using one of these models instead:\n"
                    f"- gemini-1.5-pro (most stable)\n"
                    f"- gemini-1.5-flash (if available in your region)\n"
                    f"- gemini-pro (legacy)\n"
                    f"- gemini-2.0-flash-exp (experimental)\n\n"
                    f"Error details: {error_msg[:300]}"
                )
            # Provide helpful error messages based on error type
            elif "INVALID_ARGUMENT" in error_msg or "model" in error_msg.lower():
                raise ValueError(
                    f"Invalid Gemini model name: '{model}'. "
                    f"Please check the model name. Common models: "
                    f"{', '.join(common_models)}. "
                    f"Error details: {error_msg[:300]}"
                )
            elif "API_KEY" in error_msg or "authentication" in error_msg.lower() or "API key not valid" in error_msg:
                raise ValueError(
                    f"Invalid Google API key. Please check your API key. "
                    f"Get a new one from: https://aistudio.google.com/app/apikey. "
                    f"Error: {error_msg}"
                )
            elif "RESOURCE_EXHAUSTED" in error_msg or "quota" in error_msg.lower() or "429" in error_msg:
                raise ValueError(
                    f"Gemini API quota exceeded. Your API key has reached its rate limit or quota. "
                    f"Solutions:\n"
                    f"1. Wait a few minutes and try again\n"
                    f"2. Enable billing in Google Cloud Console: https://console.cloud.google.com/billing\n"
                    f"3. Check your quota limits: https://ai.dev/usage?tab=rate-limit\n"
                    f"4. Try a different model (e.g., gemini-1.5-flash instead of gemini-2.0-flash)\n"
                    f"Error details: {error_msg[:200]}"
                )
            else:
                raise ValueError(
                    f"Failed to initialize Gemini model '{model}': {error_msg}. "
                    f"Please check:\n"
                    f"- API key is valid (from https://aistudio.google.com/app/apikey)\n"
                    f"- Model name is correct (try: gemini-1.5-flash or gemini-1.5-pro)\n"
                    f"- Internet connection is working"
                )
    
    elif llm_type == "openai":
        # OpenAI API
        # Note: OPENAI_API_KEY from env is ONLY for embeddings (RAG), not for LLM model
        # The LLM model API key must be set in the database config or use OPENAI_LLM_API_KEY env var
        api_key = config.get("api_key") or os.getenv("OPENAI_LLM_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key is required for the LLM model. "
                "Please set it in the LLM configuration or set OPENAI_LLM_API_KEY environment variable. "
                "Note: OPENAI_API_KEY environment variable is only used for embeddings (RAG), not for the LLM model."
            )
        
        api_base = config.get("api_base")
        kwargs = {
            "model": model,
            "api_key": api_key,
            "temperature": temperature,
            "streaming": streaming
        }
        
        if api_base:
            kwargs["base_url"] = api_base
        
        llm = ChatOpenAI(**kwargs)
        return MessageNormalizingLLM(llm)
    
    elif llm_type == "openrouter":
        # OpenRouter API (OpenAI-compatible)
        api_key = config.get("api_key") or os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenRouter API key is required. "
                "Please set it in the LLM configuration or set OPENROUTER_API_KEY environment variable. "
                "Get an API key from: https://openrouter.ai/"
            )
        
        # OpenRouter uses OpenAI-compatible API
        api_base = config.get("api_base") or "https://openrouter.ai/api/v1"
        
        # OpenRouter requires HTTP Referer header (passed via default_headers)
        # Note: ChatOpenAI uses default_headers parameter
        llm = ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url=api_base,
            temperature=temperature,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": config.get("http_referer", "https://dosibridge.com"),
                "X-Title": config.get("app_name", "DOSIBridge Agent")
            }
        )
        return MessageNormalizingLLM(llm)
    
    else:  # Default to DeepSeek
        # DeepSeek API (default fallback)
        api_key = config.get("api_key") or os.getenv("DEEPSEEK_KEY")
        if not api_key:
            raise ValueError(
                "DeepSeek API key is required. "
                "Please set DEEPSEEK_KEY environment variable or configure it in the database. "
                "Get an API key from: https://platform.deepseek.com"
            )
        
        api_base = config.get("api_base") or "https://api.deepseek.com"
        llm = ChatOpenAI(
            model=model or "deepseek-chat",
            api_key=api_key,
            base_url=api_base,
            temperature=temperature,
            streaming=streaming
        )
        return MessageNormalizingLLM(llm)

