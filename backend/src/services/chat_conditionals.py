"""
Conditional expression helpers
Following Refactoring.Guru: Decompose Conditional, Replace Nested Conditional with Guard Clauses
"""
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

from src.core import DB_AVAILABLE


class ConditionalHelpers:
    """Helper methods for simplifying conditionals"""

    @staticmethod
    def should_use_database_history(user_id: Optional[int], db: Optional["Session"]) -> bool:
        """Check if database history should be used"""
        return DB_AVAILABLE and user_id is not None and db is not None

    @staticmethod
    def should_load_custom_rag_tools(user_id: Optional[int], db: Optional["Session"]) -> bool:
        """Check if custom RAG tools should be loaded"""
        return user_id is not None and db is not None

    @staticmethod
    def has_token_usage(input_tokens: int, output_tokens: int) -> bool:
        """Check if token usage data is available"""
        return input_tokens > 0 or output_tokens > 0

    @staticmethod
    def is_llm_config_valid(llm_config: Optional[dict]) -> bool:
        """Check if LLM config is valid"""
        return llm_config is not None

    @staticmethod
    def is_user_authenticated(user_id: Optional[int]) -> bool:
        """Check if user is authenticated"""
        return user_id is not None

    @staticmethod
    def should_use_advanced_rag(user_id: Optional[int]) -> bool:
        """Check if advanced RAG should be used"""
        return user_id is not None

    @staticmethod
    def should_use_react_agent(use_react: bool, user_id: Optional[int]) -> bool:
        """Check if ReAct agent should be used"""
        return use_react and user_id is not None


class GuardClauseHelpers:
    """Helper methods for guard clauses"""

    @staticmethod
    def validate_llm_config(llm_config: Optional[dict]) -> tuple[bool, Optional[str]]:
        """
        Validate LLM config with guard clause pattern
        Returns: (is_valid, error_message)
        """
        if not llm_config:
            return False, "No LLM configuration found. Please configure an LLM provider via environment variables or create a personal LLM config."
        return True, None

    @staticmethod
    def validate_rag_mode_authentication(mode: str, user_id: Optional[int]) -> tuple[bool, Optional[str]]:
        """
        Validate RAG mode authentication with guard clause pattern
        Returns: (is_valid, error_message)
        """
        if mode == "rag" and not user_id:
            return False, "Authentication required for RAG mode. Please log in to upload documents and query them."
        return True, None

    @staticmethod
    def validate_user_active(user) -> tuple[bool, Optional[str]]:
        """
        Validate user is active with guard clause pattern
        Returns: (is_valid, error_message)
        """
        if user and not user.is_active:
            return False, "User account is inactive"
        return True, None

