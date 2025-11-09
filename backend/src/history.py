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

