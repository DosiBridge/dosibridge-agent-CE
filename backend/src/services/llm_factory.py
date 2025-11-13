"""
LLM Factory - Creates LLM instances based on configuration
"""
from langchain_openai import ChatOpenAI
from typing import Optional
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


def create_llm_from_config(config: dict, streaming: bool = False, temperature: float = 0):
    """
    Create an LLM instance based on configuration.
    
    Supported types:
    - openai: OpenAI models (requires api_key and model)
    - groq: Groq models (requires api_key and model)
    - ollama: Local Ollama models (requires base_url and model)
    - gemini: Google Gemini models (requires api_key and model)
    
    Args:
        config: LLM configuration dictionary with keys:
            - type: "openai", "groq", "ollama", or "gemini"
            - model: Model name
            - api_key: API key (for openai/groq/gemini)
            - base_url: Base URL (for ollama, defaults to http://localhost:11434)
            - api_base: Custom API base URL (optional, for openai/groq)
        streaming: Whether to enable streaming
        temperature: Temperature for the model
        
    Returns:
        LLM instance (ChatOpenAI, ChatOllama, etc.)
    """
    llm_type = config.get("type", "openai").lower()
    model = config.get("model", "gpt-4o")
    
    if llm_type == "ollama":
        # Local Ollama instance
        if ChatOllama is None:
            raise ImportError(
                "ChatOllama is not available. Ensure 'langchain-ollama' is in requirements.txt and redeploy."
            )
        
        base_url = config.get("base_url", "http://localhost:11434")
        try:
            return ChatOllama(
                model=model,
                base_url=base_url,
                temperature=temperature,
                streaming=streaming,
                timeout=60.0  # Increase timeout for Docker
            )
        except Exception as e:
            raise ValueError(
                f"Failed to connect to Ollama at {base_url}. "
                f"Make sure Ollama is running. Error: {str(e)}"
            )
    
    elif llm_type == "groq":
        # Groq API
        api_key = config.get("api_key") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("Groq API key is required")
        
        # Groq uses OpenAI-compatible API
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
            temperature=temperature,
            streaming=streaming
        )
    
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
                "gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.5-flash", "gemini-2.5-flash-lite",
                "gemini-2.5-pro"
            ]
            
            llm = ChatGoogleGenerativeAI(
                model=model,
                google_api_key=api_key,
                temperature=temperature,
                streaming=streaming
            )
            
            return llm
        except Exception as e:
            error_msg = str(e)
            
            # Provide helpful error messages based on error type
            if "INVALID_ARGUMENT" in error_msg or "model" in error_msg.lower():
                raise ValueError(
                    f"Invalid Gemini model name: '{model}'. "
                    f"Please check the model name. Common models: "
                    f"{', '.join(common_models)}. "
                    f"Error details: {error_msg}"
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
    
    else:  # Default to OpenAI
        # OpenAI API
        # Note: OPENAI_API_KEY from env is ONLY for embeddings (RAG), not for LLM model
        # The LLM model API key must be set in the database config
        api_key = config.get("api_key")
        if not api_key:
            raise ValueError(
                "OpenAI API key is required for the LLM model. "
                "Please set it in the LLM configuration. "
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
        
        return ChatOpenAI(**kwargs)

