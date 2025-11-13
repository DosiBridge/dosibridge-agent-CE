"""
Database-backed conversation history management
Replaces in-memory history with persistent database storage
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory

from src.core import get_db_context, DB_AVAILABLE, Conversation, Message, User
from src.core.constants import (
    SUMMARY_UPDATE_MILESTONES,
    SUMMARY_MAX_MESSAGES,
    SUMMARY_MAX_MESSAGES_LONG,
    ENABLE_MESSAGE_CLEANUP,
    KEEP_LAST_N_MESSAGES
)


class DatabaseChatMessageHistory(BaseChatMessageHistory):
    """Database-backed chat message history"""
    
    def __init__(self, session_id: str, user_id: int, db: Session):
        self.session_id = session_id
        self.user_id = user_id
        self.db = db
        self._conversation: Optional[Conversation] = None
    
    @property
    def conversation(self) -> Conversation:
        """
        Get or create conversation in database.
        Only called when user is authenticated (user_id is not None).
        """
        if self._conversation is None:
            self._conversation = self.db.query(Conversation).filter(
                and_(
                    Conversation.user_id == self.user_id,
                    Conversation.session_id == self.session_id
                )
            ).first()
            
            if not self._conversation:
                # Create new conversation in database
                self._conversation = Conversation(
                    user_id=self.user_id,
                    session_id=self.session_id,
                    title=None,  # Will be set from first message
                    message_count=0
                )
                self.db.add(self._conversation)
                self.db.commit()
                self.db.refresh(self._conversation)
                print(f"📝 Created new DB conversation: {self.session_id} for user {self.user_id}")
        
        return self._conversation
    
    @property
    def messages(self) -> List[BaseMessage]:
        """Get all messages from database"""
        conv = self.conversation
        db_messages = self.db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at).all()
        
        # Convert to LangChain messages
        langchain_messages = []
        for msg in db_messages:
            if msg.role == "user":
                langchain_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                langchain_messages.append(AIMessage(content=msg.content))
            elif msg.role == "system":
                langchain_messages.append(SystemMessage(content=msg.content))
        
        return langchain_messages
    
    def add_message(self, message: BaseMessage) -> None:
        """Add a message to the conversation"""
        import json
        
        conv = self.conversation
        
        # Determine role
        if isinstance(message, HumanMessage):
            role = "user"
        elif isinstance(message, AIMessage):
            role = "assistant"
        elif isinstance(message, SystemMessage):
            role = "system"
        else:
            role = "assistant"  # Default
        
        # Extract tool calls if present
        tool_calls_json = None
        if hasattr(message, "tool_calls") and message.tool_calls:
            try:
                tool_calls_json = json.dumps(message.tool_calls)
            except Exception:
                pass
        
        # Create message (only if we want to store full messages - optional)
        # For now, we'll store messages but focus on summary
        db_message = Message(
            conversation_id=conv.id,
            role=role,
            content=message.content,
            tool_calls=tool_calls_json
        )
        self.db.add(db_message)
        
        # Update conversation title from first user message if not set
        if not conv.title and role == "user":
            # Use first 100 chars of first message as title
            title = message.content[:100].strip()
            if len(message.content) > 100:
                title += "..."
            conv.title = title
        
        # Update message count
        conv.message_count = (conv.message_count or 0) + 1
        
        # Update summary at milestones: 10, 25, 50, 100, 200...
        # Smart strategy: more frequent updates early, less frequent later
        should_update = conv.message_count in SUMMARY_UPDATE_MILESTONES
        
        # Also update if summary is missing and we have enough messages
        if not conv.summary and conv.message_count >= SUMMARY_UPDATE_MILESTONES[0]:
            should_update = True
        
        if should_update:
            # Determine how many messages to include in summary
            messages_to_include = min(conv.message_count, SUMMARY_MAX_MESSAGES)
            if conv.message_count > 100:
                messages_to_include = SUMMARY_MAX_MESSAGES_LONG  # Expand for longer conversations
            
            # Generate summary from messages (non-blocking simple summary)
            # For async LLM-based summary, use background task
            all_messages = self.messages[:messages_to_include]
            if all_messages:
                from src.services.conversation_summary import generate_simple_summary
                try:
                    conv.summary = generate_simple_summary(all_messages, max_messages=messages_to_include)
                except Exception as e:
                    print(f"⚠️  Failed to generate summary: {e}")
        
        # Optional: Cleanup old messages after summary is generated
        # Keep only last N messages for context, delete older ones
        if (ENABLE_MESSAGE_CLEANUP and 
            conv.summary and 
            conv.message_count > KEEP_LAST_N_MESSAGES + 10):  # Only cleanup if we have enough messages
            
            # Count total messages
            total_messages = self.db.query(Message).filter(
                Message.conversation_id == conv.id
            ).count()
            
            if total_messages > KEEP_LAST_N_MESSAGES:
                # Delete old messages, keep only last N
                messages_to_delete = total_messages - KEEP_LAST_N_MESSAGES
                old_messages = self.db.query(Message).filter(
                    Message.conversation_id == conv.id
                ).order_by(Message.created_at).limit(messages_to_delete).all()
                
                for msg in old_messages:
                    self.db.delete(msg)
                
                # Update message count
                conv.message_count = KEEP_LAST_N_MESSAGES
                print(f"🗑️  Cleaned up {messages_to_delete} old messages from conversation {conv.session_id}")
        
        # Update conversation updated_at
        from sqlalchemy.sql import func
        conv.updated_at = func.now()
        
        self.db.commit()
        self.db.refresh(db_message)
    
    def add_user_message(self, content: str) -> None:
        """Add a user message (convenience method)"""
        self.add_message(HumanMessage(content=content))
    
    def add_ai_message(self, content: str) -> None:
        """Add an AI message (convenience method)"""
        self.add_message(AIMessage(content=content))
    
    def clear(self) -> None:
        """Clear all messages and delete the conversation"""
        conv = self.conversation
        if conv:
            # Delete all messages (cascade will handle this, but explicit delete is cleaner)
            self.db.query(Message).filter(Message.conversation_id == conv.id).delete()
            # Delete the conversation itself
            self.db.delete(conv)
            self.db.commit()
            print(f"🗑️  Deleted conversation {self.session_id} and all messages for user {self.user_id}")


class DatabaseConversationHistoryManager:
    """Manages conversation history using database"""
    
    def __init__(self):
        """Initialize the history manager"""
        if DB_AVAILABLE:
            print("✓ Database Conversation History Manager initialized")
        else:
            print("⚠️  Database not available, conversation history will not persist")
    
    def get_session_history(self, session_id: str, user_id: Optional[int] = None, db: Optional[Session] = None) -> BaseChatMessageHistory:
        """
        Get or create a chat history for a specific session
        
        Args:
            session_id: Unique identifier for the conversation session
            user_id: User ID (required for database storage)
            db: Optional database session (if None, creates a new one)
            
        Returns:
            BaseChatMessageHistory for the session
        """
        if not DB_AVAILABLE:
            # Fallback to in-memory if DB not available
            from .history import history_manager
            return history_manager.get_session_history(session_id, user_id)
        
        if user_id is None:
            # Without login: use temporary in-memory storage (not persisted to DB)
            from .history import history_manager
            return history_manager.get_session_history(session_id, user_id)
        
        # With login: use database storage (persistent)
        # Use provided session or create new one
        if db:
            return DatabaseChatMessageHistory(session_id, user_id, db)
        else:
            # Create a context manager that provides the session
            from contextlib import contextmanager
            
            @contextmanager
            def get_db_session():
                with get_db_context() as session:
                    yield session
            
            # For now, create a new session (caller should manage it)
            # This is a limitation - ideally we'd use a session manager
            with get_db_context() as session:
                return DatabaseChatMessageHistory(session_id, user_id, session)
    
    def get_session_messages(self, session_id: str, user_id: Optional[int] = None, db: Optional[Session] = None) -> List[BaseMessage]:
        """
        Get all messages from a session
        
        Note:
            - If user_id is None: Returns from in-memory storage (temporary, lost on server restart)
            - If user_id is provided: Returns from database (persistent)
        """
        if not DB_AVAILABLE or user_id is None:
            # Without login: use temporary in-memory storage
            from .history import history_manager
            return history_manager.get_session_messages(session_id, user_id)
        
        if db:
            history = DatabaseChatMessageHistory(session_id, user_id, db)
        else:
            with get_db_context() as session:
                history = DatabaseChatMessageHistory(session_id, user_id, session)
        
        return history.messages
    
    def clear_session(self, session_id: str, user_id: Optional[int] = None, db: Optional[Session] = None) -> None:
        """
        Clear history for a specific session - deletes conversation and all messages.
        For authenticated users: deletes from database.
        For unauthenticated users: falls back to in-memory storage (temporary).
        """
        if not DB_AVAILABLE or user_id is None:
            # Without login: use in-memory storage (temporary, browser reload will clear)
            from .history import history_manager
            history_manager.clear_session(session_id, user_id)
            print(f"🗑️  Cleared temporary session {session_id} (not logged in - will be lost on reload)")
            return
        
        # With login: delete from database (permanent)
        if db:
            # Use provided session
            conv = db.query(Conversation).filter(
                and_(
                    Conversation.user_id == user_id,
                    Conversation.session_id == session_id
                )
            ).first()
            
            if conv:
                # Delete all messages (cascade will handle this automatically, but explicit is cleaner)
                message_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
                db.query(Message).filter(Message.conversation_id == conv.id).delete()
                # Delete the conversation itself
                db.delete(conv)
                db.commit()
                print(f"🗑️  Deleted conversation {session_id} and {message_count} messages from database for user {user_id}")
            else:
                print(f"⚠️  Conversation {session_id} not found for user {user_id}")
        else:
            # Create new session
            with get_db_context() as session:
                conv = session.query(Conversation).filter(
                    and_(
                        Conversation.user_id == user_id,
                        Conversation.session_id == session_id
                    )
                ).first()
                
                if conv:
                    # Delete all messages
                    message_count = session.query(Message).filter(Message.conversation_id == conv.id).count()
                    session.query(Message).filter(Message.conversation_id == conv.id).delete()
                    # Delete the conversation
                    session.delete(conv)
                    session.commit()
                    print(f"🗑️  Deleted conversation {session_id} and {message_count} messages from database for user {user_id}")
                else:
                    print(f"⚠️  Conversation {session_id} not found for user {user_id}")
    
    def list_sessions(self, user_id: Optional[int] = None, db: Optional[Session] = None) -> List[dict]:
        """
        List all conversations for a user (with summary, not full messages)
        
        Note:
            - If user_id is None: Returns from in-memory storage (temporary sessions)
            - If user_id is provided: Returns from database (persistent conversations)
        """
        if not DB_AVAILABLE or user_id is None:
            # Without login: return temporary in-memory sessions
            from .history import history_manager
            session_ids = history_manager.list_sessions(user_id)
            return [{"session_id": sid, "message_count": len(history_manager.get_session_messages(sid, user_id))} for sid in session_ids]
        
        if db:
            conversations = db.query(Conversation).filter(
                Conversation.user_id == user_id
            ).order_by(Conversation.updated_at.desc()).all()
        else:
            with get_db_context() as session:
                conversations = session.query(Conversation).filter(
                    Conversation.user_id == user_id
                ).order_by(Conversation.updated_at.desc()).all()
        
        # Return conversations with summary, not full messages
        return [conv.to_dict() for conv in conversations]
    
    async def update_summary(self, session_id: str, user_id: int, db: Session) -> None:
        """
        Update conversation summary from messages (async, for background tasks)
        Uses LLM-based summarization for better quality
        """
        try:
            conv = db.query(Conversation).filter(
                Conversation.user_id == user_id,
                Conversation.session_id == session_id
            ).first()
            
            if not conv:
                return
            
            # Check if update is needed
            if conv.message_count not in SUMMARY_UPDATE_MILESTONES:
                if conv.summary:  # Already has summary
                    return
            
            # Determine how many messages to include
            messages_to_include = min(conv.message_count, SUMMARY_MAX_MESSAGES)
            if conv.message_count > 100:
                messages_to_include = SUMMARY_MAX_MESSAGES_LONG
            
            # Get messages
            messages = db.query(Message).filter(
                Message.conversation_id == conv.id
            ).order_by(Message.created_at).limit(messages_to_include).all()
            
            if not messages:
                return
            
            # Convert to LangChain messages
            from langchain_core.messages import HumanMessage, AIMessage
            langchain_messages = []
            for msg in messages:
                if msg.role == "user":
                    langchain_messages.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant":
                    langchain_messages.append(AIMessage(content=msg.content))
            
            # Generate summary using LLM (async)
            from src.services.conversation_summary import generate_conversation_summary
            try:
                summary = await generate_conversation_summary(
                    langchain_messages, 
                    max_messages=messages_to_include
                )
                conv.summary = summary
                db.commit()
                print(f"✓ Updated summary for conversation {session_id} ({conv.message_count} messages)")
            except Exception as e:
                # Fallback to simple summary
                print(f"⚠️  LLM summary failed, using simple summary: {e}")
                from src.services.conversation_summary import generate_simple_summary
                conv.summary = generate_simple_summary(langchain_messages, max_messages=messages_to_include)
                db.commit()
        except Exception as e:
            print(f"⚠️  Failed to update summary: {e}")
            db.rollback()


# Global database history manager instance
db_history_manager = DatabaseConversationHistoryManager()

