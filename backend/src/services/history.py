"""
Conversation history management
"""
from typing import Dict, List
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import BaseMessage, HumanMessage


class ConversationHistoryManager:
    """Manages conversation history for multiple sessions"""
    
    def __init__(self):
        """Initialize the history store"""
        self.store: Dict[str, ChatMessageHistory] = {}
        print("✓ Conversation History Manager initialized")
    
    def get_session_history(self, session_id: str, user_id: int = None) -> BaseChatMessageHistory:
        """
        Get or create a chat history for a specific session
        
        Args:
            session_id: Unique identifier for the conversation session
            user_id: Optional user ID to make sessions user-specific
            
        Returns:
            ChatMessageHistory for the session
        """
        # Create user-specific session key if user_id is provided
        if user_id is not None:
            session_key = f"user_{user_id}_{session_id}"
        else:
            session_key = session_id
        
        if session_key not in self.store:
            self.store[session_key] = ChatMessageHistory()
            print(f"📝 Created new conversation session: {session_key}")
        return self.store[session_key]
    
    def get_session_messages(self, session_id: str, user_id: int = None) -> List[BaseMessage]:
        """Get all messages from a session"""
        if user_id is not None:
            session_key = f"user_{user_id}_{session_id}"
        else:
            session_key = session_id
        
        if session_key in self.store:
            return self.store[session_key].messages
        return []
    
    def clear_session(self, session_id: str, user_id: int = None) -> None:
        """Clear history for a specific session"""
        if user_id is not None:
            session_key = f"user_{user_id}_{session_id}"
        else:
            session_key = session_id
        
        if session_key in self.store:
            self.store[session_key].clear()
            print(f"🗑️  Cleared session: {session_key}")
    
    def list_sessions(self, user_id: int = None) -> List[str]:
        """List all active session IDs for a user (or all if user_id is None)"""
        if user_id is not None:
            prefix = f"user_{user_id}_"
            return [
                key.replace(prefix, "") 
                for key in self.store.keys() 
                if key.startswith(prefix)
            ]
        return list(self.store.keys())
    
    def get_session_summary(self, session_id: str) -> str:
        """Get a summary of the session"""
        messages = self.get_session_messages(session_id)
        return f"Session {session_id}: {len(messages)} messages"
    
    def show_session_info(self, session_id: str = None) -> None:
        """Display information about sessions"""
        print(f"\n{'='*60}")
        print("📊 Session Information")
        print(f"{'='*60}\n")
        
        if session_id:
            messages = self.get_session_messages(session_id)
            print(f"Session: {session_id}")
            print(f"Messages: {len(messages)}\n")
            
            for i, msg in enumerate(messages, 1):
                role = "User" if isinstance(msg, HumanMessage) else "AI"
                content = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
                print(f"  {i}. [{role}] {content}")
        else:
            sessions = self.list_sessions()
            print(f"Active Sessions: {len(sessions)}\n")
            
            for session in sessions:
                print(f"  • {self.get_session_summary(session)}")
        
        print()


# Global history manager instance
history_manager = ConversationHistoryManager()

