"""
Database models for LLM config, MCP servers, and Users
"""
from typing import Optional
from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

# Import Base from database (may be None if database is not available)
try:
    from .database import Base
    if Base is None:
        raise ImportError("Base is None - database not available")
except (ImportError, AttributeError):
    # Database not available - models won't be used
    Base = None  # type: ignore

# Only define models if Base is available
if Base is not None:
    class LLMConfig(Base):
        """LLM Configuration model"""
        __tablename__ = "llm_config"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
        type = Column(String(50), nullable=False, default="openai")  # openai, gemini, ollama, groq, deepseek, openrouter
        model = Column(String(200), nullable=False)
        api_key = Column(Text, nullable=True)  # Encrypted or stored securely
        base_url = Column(String(500), nullable=True)  # For custom API endpoints
        api_base = Column(String(500), nullable=True)  # Alternative base URL field
        active = Column(Boolean, default=True, nullable=False)
        is_default = Column(Boolean, default=False, nullable=False)  # True if using default DeepSeek LLM (100 requests/day limit)
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationship
        user = relationship("User", backref="llm_configs")
        
        def to_dict(self, include_api_key: bool = False) -> dict:
            """Convert model to dictionary"""
            from src.utils.encryption import decrypt_value
            
            result = {
                "id": self.id,
                "user_id": self.user_id,
                "type": self.type,
                "model": self.model,
                "base_url": self.base_url,
                "api_base": self.api_base,
                "active": self.active,
                "is_default": self.is_default,
                "has_api_key": bool(self.api_key),
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }
            if include_api_key and self.api_key:
                # Decrypt API key when returning
                result["api_key"] = decrypt_value(self.api_key)
            return result

    class EmbeddingConfig(Base):
        """Embedding Configuration model for RAG/document embeddings"""
        __tablename__ = "embedding_config"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # None for global
        provider = Column(String(50), nullable=False, default="openai")  # openai, etc.
        model = Column(String(200), nullable=False, default="text-embedding-3-small")
        api_key = Column(Text, nullable=True)  # Encrypted or stored securely
        base_url = Column(String(500), nullable=True)  # For custom API endpoints
        active = Column(Boolean, default=True, nullable=False)
        is_default = Column(Boolean, default=False, nullable=False)  # True if this is the default embedding config
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationship
        user = relationship("User", backref="embedding_configs")
        
        def to_dict(self, include_api_key: bool = False) -> dict:
            """Convert model to dictionary"""
            from src.utils.encryption import decrypt_value
            
            result = {
                "id": self.id,
                "user_id": self.user_id,
                "provider": self.provider,
                "model": self.model,
                "base_url": self.base_url,
                "active": self.active,
                "is_default": self.is_default,
                "has_api_key": bool(self.api_key),
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }
            if include_api_key and self.api_key:
                # Decrypt API key when returning
                result["api_key"] = decrypt_value(self.api_key)
            return result

    class MCPServer(Base):
        """MCP Server configuration model"""
        __tablename__ = "mcp_servers"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # Nullable for global servers
        name = Column(String(100), nullable=False, index=True)  # Removed unique constraint - now per-user
        url = Column(String(500), nullable=False)
        connection_type = Column(String(20), nullable=False, default="http")  # "stdio", "http", or "sse"
        api_key = Column(Text, nullable=True)  # Optional API key for the MCP server
        headers = Column(Text, nullable=True)  # Optional custom headers as JSON string
        enabled = Column(Boolean, default=True, nullable=False)
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationship
        user = relationship("User", backref="mcp_servers")
        
        # Unique constraint on user_id + name combination
        # Note: For global servers (user_id=None), this allows multiple globals with same name in some DBs, 
        # but we should enforce uniqueness in application logic or use a partial index if needed.
        __table_args__ = (
            UniqueConstraint('user_id', 'name', name='uq_mcp_server_user_name'),
        )
        
        def to_dict(self, include_api_key: bool = False) -> dict:
            """Convert model to dictionary"""
            import json
            from src.utils.encryption import decrypt_value
            
            result = {
                "id": self.id,
                "name": self.name,
                "url": self.url,
                "connection_type": self.connection_type or "http",
                "enabled": self.enabled,
                "has_api_key": bool(self.api_key),
                "user_id": self.user_id
            }
            if include_api_key and self.api_key:
                # Decrypt API key when returning
                result["api_key"] = decrypt_value(self.api_key)
            
            # Parse headers JSON if present
            if self.headers:
                try:
                    result["headers"] = json.loads(self.headers)
                except (json.JSONDecodeError, TypeError):
                    result["headers"] = {}
            else:
                result["headers"] = {}
            
            return result
        
        def set_api_key(self, api_key: Optional[str]) -> None:
            """Set API key with automatic encryption"""
            from src.utils.encryption import encrypt_value, is_encrypted
            
            if not api_key:
                self.api_key = None
            elif is_encrypted(api_key):
                # Already encrypted, store as-is
                self.api_key = api_key
            else:
                # Encrypt before storing
                self.api_key = encrypt_value(api_key)
        
        def get_api_key(self) -> Optional[str]:
            """Get decrypted API key"""
            from src.utils.encryption import decrypt_value
            return decrypt_value(self.api_key) if self.api_key else None
        
        def set_headers(self, headers: Optional[dict]) -> None:
            """Set headers as JSON string"""
            import json
            if not headers:
                self.headers = None
            else:
                self.headers = json.dumps(headers)
        
        def get_headers(self) -> dict:
            """Get headers as dictionary"""
            import json
            if not self.headers:
                return {}
            try:
                return json.loads(self.headers)
            except (json.JSONDecodeError, TypeError):
                return {}

    class User(Base):
        """User model for authentication"""
        __tablename__ = "users"
        
        id = Column(Integer, primary_key=True, index=True)
        email = Column(String(255), unique=True, nullable=False, index=True)
        name = Column(String(255), nullable=False)
        hashed_password = Column(String(255), nullable=True) # made nullable for OAuth/OTP users
        otp_hash = Column(String(255), nullable=True)
        otp_expires_at = Column(DateTime(timezone=True), nullable=True)
        is_active = Column(Boolean, default=True, nullable=False)
        role = Column(String(50), default="user", nullable=False)  # "user" or "superadmin"
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        def to_dict(self) -> dict:
            """Convert model to dictionary (without password)"""
            return {
                "id": self.id,
                "email": self.email,
                "name": self.name,
                "is_active": self.is_active,
                "role": getattr(self, 'role', 'user'),  # Support both old and new schemas
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }
        
        def is_superadmin(self) -> bool:
            """Check if user is a superadmin"""
            return getattr(self, 'role', 'user') == "superadmin"

    class UserGlobalConfigPreference(Base):
        """User preferences for global configurations (enable/disable for personal use)"""
        __tablename__ = "user_global_config_preferences"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        config_type = Column(String(50), nullable=False)  # "llm", "embedding", "mcp"
        config_id = Column(Integer, nullable=False)  # ID of the global config
        enabled = Column(Boolean, default=True, nullable=False)  # Whether user has enabled this config for themselves
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationship
        user = relationship("User", backref="global_config_preferences")
        
        # Unique constraint on user_id + config_type + config_id
        __table_args__ = (
            UniqueConstraint('user_id', 'config_type', 'config_id', name='uq_user_global_config_pref'),
        )
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            return {
                "id": self.id,
                "user_id": self.user_id,
                "config_type": self.config_type,
                "config_id": self.config_id,
                "enabled": self.enabled,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    class Conversation(Base):
        """Conversation model for storing chat sessions with summary"""
        __tablename__ = "conversations"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        session_id = Column(String(255), nullable=False, index=True)
        title = Column(String(500), nullable=True)  # Auto-generated from first message
        summary = Column(Text, nullable=True)  # Summary of conversation (first 50 messages)
        message_count = Column(Integer, default=0, nullable=False)  # Total message count
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationships
        user = relationship("User", backref="conversations")
        messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")
        
        # Unique constraint on user_id + session_id
        __table_args__ = (
            UniqueConstraint('user_id', 'session_id', name='uq_conversation_user_session'),
        )
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            return {
                "id": self.id,
                "session_id": self.session_id,
                "title": self.title or f"Conversation {self.session_id}",
                "summary": self.summary,
                "message_count": self.message_count,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    class Message(Base):
        """Message model for storing individual chat messages (optional - can be deleted after summary)"""
        __tablename__ = "messages"
        
        id = Column(Integer, primary_key=True, index=True)
        conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
        role = Column(String(50), nullable=False)  # "user", "assistant", "system"
        content = Column(Text, nullable=False)
        tool_calls = Column(Text, nullable=True)  # JSON string of tool calls
        created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
        
        # Relationship
        conversation = relationship("Conversation", back_populates="messages")
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            import json
            tool_calls_data = None
            if self.tool_calls:
                try:
                    tool_calls_data = json.loads(self.tool_calls)
                except json.JSONDecodeError:
                    tool_calls_data = None
            
            return {
                "id": self.id,
                "role": self.role,
                "content": self.content,
                "tool_calls": tool_calls_data,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }

    class DocumentCollection(Base):
        """Document collection model for organizing documents"""
        __tablename__ = "document_collections"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        name = Column(String(255), nullable=False)
        description = Column(Text, nullable=True)
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationships
        user = relationship("User", backref="document_collections")
        documents = relationship("Document", back_populates="collection", cascade="all, delete-orphan")
        
        # Unique constraint on user_id + name
        __table_args__ = (
            UniqueConstraint('user_id', 'name', name='uq_collection_user_name'),
        )
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            return {
                "id": self.id,
                "name": self.name,
                "description": self.description,
                "document_count": len(self.documents) if self.documents else 0,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    class Document(Base):
        """Document model for storing uploaded files"""
        __tablename__ = "documents"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        collection_id = Column(Integer, ForeignKey("document_collections.id", ondelete="SET NULL"), nullable=True, index=True)
        filename = Column(String(500), nullable=False)
        original_filename = Column(String(500), nullable=False)
        file_path = Column(String(1000), nullable=False)  # Path to stored file
        file_type = Column(String(50), nullable=False)  # pdf, txt, docx, etc.
        file_size = Column(Integer, nullable=False)  # Size in bytes
        status = Column(String(50), nullable=False, default="pending")  # pending, processing, ready, error, needs_review
        document_metadata = Column(Text, nullable=True)  # JSON string for additional metadata (renamed from metadata to avoid SQLAlchemy conflict)
        chunk_count = Column(Integer, default=0, nullable=False)
        embedding_status = Column(String(50), nullable=False, default="pending")  # pending, processing, completed, failed
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationships
        user = relationship("User", backref="documents")
        collection = relationship("DocumentCollection", back_populates="documents")
        chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            import json
            metadata_dict = None
            if self.document_metadata:
                try:
                    metadata_dict = json.loads(self.document_metadata)
                except json.JSONDecodeError:
                    metadata_dict = None
            
            return {
                "id": self.id,
                "filename": self.filename,
                "original_filename": self.original_filename,
                "file_type": self.file_type,
                "file_size": self.file_size,
                "status": self.status,
                "metadata": metadata_dict,
                "chunk_count": self.chunk_count,
                "embedding_status": self.embedding_status,
                "collection_id": self.collection_id,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    class DocumentChunk(Base):
        """Document chunk model for storing text chunks with embeddings"""
        __tablename__ = "document_chunks"
        
        id = Column(Integer, primary_key=True, index=True)
        document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
        chunk_index = Column(Integer, nullable=False)  # Order of chunk in document
        content = Column(Text, nullable=False)
        chunk_metadata = Column(Text, nullable=True)  # JSON string for chunk metadata (page number, etc.) (renamed from metadata to avoid SQLAlchemy conflict)
        embedding = Column(Text, nullable=True)  # Base64 encoded embedding vector
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        
        # Relationships
        document = relationship("Document", back_populates="chunks")
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            import json
            metadata_dict = None
            if self.chunk_metadata:
                try:
                    metadata_dict = json.loads(self.chunk_metadata)
                except json.JSONDecodeError:
                    metadata_dict = None
            
            return {
                "id": self.id,
                "chunk_index": self.chunk_index,
                "content": self.content,
                "metadata": metadata_dict,
                "has_embedding": bool(self.embedding),
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }

    class CustomRAGTool(Base):
        """Custom RAG tool model for user-defined retrieval tools"""
        __tablename__ = "custom_rag_tools"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
        name = Column(String(255), nullable=False)  # Tool name (e.g., "retrieve_my_docs")
        description = Column(Text, nullable=False)  # Tool description
        collection_id = Column(Integer, ForeignKey("document_collections.id", ondelete="SET NULL"), nullable=True, index=True)
        enabled = Column(Boolean, default=True, nullable=False)
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationships
        user = relationship("User", backref="custom_rag_tools")
        collection = relationship("DocumentCollection", backref="custom_rag_tools")
        
        # Unique constraint on user_id + name
        __table_args__ = (
            UniqueConstraint('user_id', 'name', name='uq_custom_rag_tool_user_name'),
        )
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            return {
                "id": self.id,
                "name": self.name,
                "description": self.description,
                "collection_id": self.collection_id,
                "enabled": self.enabled,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    class AppointmentRequest(Base):
        """Appointment and contact request model"""
        __tablename__ = "appointment_requests"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # Nullable for anonymous requests
        name = Column(String(255), nullable=False)
        email = Column(String(255), nullable=False, index=True)
        phone = Column(String(50), nullable=True)
        request_type = Column(String(50), nullable=False, default="appointment")  # "appointment", "contact", "support"
        subject = Column(String(255), nullable=True)
        message = Column(Text, nullable=False)
        preferred_date = Column(DateTime(timezone=True), nullable=True)  # For appointments
        preferred_time = Column(String(50), nullable=True)  # e.g., "morning", "afternoon", "evening", or specific time
        status = Column(String(50), nullable=False, default="pending")  # "pending", "confirmed", "cancelled", "completed"
        notes = Column(Text, nullable=True)  # Internal notes
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationship
        user = relationship("User", backref="appointment_requests")
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            return {
                "id": self.id,
                "user_id": self.user_id,
                "name": self.name,
                "email": self.email,
                "phone": self.phone,
                "request_type": self.request_type,
                "subject": self.subject,
                "message": self.message,
                "preferred_date": self.preferred_date.isoformat() if self.preferred_date else None,
                "preferred_time": self.preferred_time,
                "status": self.status,
                "notes": self.notes,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    class APIUsage(Base):
        """API usage tracking model for monitoring and rate limiting"""
        __tablename__ = "api_usage"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # Nullable for anonymous users
        guest_email = Column(String(255), nullable=True, index=True)  # Email for guest users
        ip_address = Column(String(45), nullable=True, index=True)  # IP address for anonymous users (IPv6 max length)
        usage_date = Column(DateTime(timezone=True), nullable=False, index=True)  # Date of usage (normalized to start of day)
        request_count = Column(Integer, default=0, nullable=False)  # Number of requests today
        llm_provider = Column(String(50), nullable=True)  # Which LLM provider was used (deepseek, openai, gemini, etc.)
        llm_model = Column(String(100), nullable=True)  # Which model was used
        input_tokens = Column(Integer, default=0, nullable=False)  # Total input tokens used
        output_tokens = Column(Integer, default=0, nullable=False)  # Total output tokens used
        embedding_tokens = Column(Integer, default=0, nullable=False)  # Embedding tokens (OpenAI)
        mode = Column(String(20), nullable=True)  # "agent" or "rag"
        created_at = Column(DateTime(timezone=True), server_default=func.now())
        updated_at = Column(DateTime(timezone=True), onupdate=func.now())
        
        # Relationship
        user = relationship("User", backref="api_usage")
        
        # Unique constraint: user_id + usage_date (for authenticated) or ip_address + usage_date (for anonymous)
        __table_args__ = (
            UniqueConstraint('user_id', 'usage_date', name='uq_api_usage_user_date'),
            UniqueConstraint('ip_address', 'usage_date', name='uq_api_usage_ip_date'),
            UniqueConstraint('guest_email', 'usage_date', name='uq_api_usage_guest_email_date'),
        )
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            return {
                "id": self.id,
                "user_id": self.user_id,
                "guest_email": self.guest_email,
                "ip_address": self.ip_address,
                "usage_date": self.usage_date.isoformat() if self.usage_date else None,
                "request_count": self.request_count,
                "llm_provider": self.llm_provider,
                "llm_model": self.llm_model,
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
                "embedding_tokens": self.embedding_tokens,
                "total_tokens": self.input_tokens + self.output_tokens + self.embedding_tokens,
                "mode": self.mode,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            }

    class APIRequest(Base):
        """Individual API request tracking model for per-request analytics"""
        __tablename__ = "api_requests"
        
        id = Column(Integer, primary_key=True, index=True)
        user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)  # Nullable for anonymous users
        guest_email = Column(String(255), nullable=True, index=True)  # Email for guest users
        request_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)  # Exact timestamp of the request
        llm_provider = Column(String(50), nullable=True)  # Which LLM provider was used
        llm_model = Column(String(100), nullable=True)  # Which model was used
        input_tokens = Column(Integer, default=0, nullable=False)  # Input tokens for this request
        output_tokens = Column(Integer, default=0, nullable=False)  # Output tokens for this request
        embedding_tokens = Column(Integer, default=0, nullable=False)  # Embedding tokens for this request
        total_tokens = Column(Integer, default=0, nullable=False)  # Total tokens for this request
        mode = Column(String(20), nullable=True)  # "agent" or "rag"
        session_id = Column(String(255), nullable=True, index=True)  # Session ID if available
        success = Column(Boolean, default=True, nullable=False)  # Whether the request was successful
        created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
        
        # Relationship
        user = relationship("User", backref="api_requests")
        
        def to_dict(self) -> dict:
            """Convert model to dictionary"""
            return {
                "id": self.id,
                "user_id": self.user_id,
                "guest_email": self.guest_email,
                "request_timestamp": self.request_timestamp.isoformat() if self.request_timestamp else None,
                "llm_provider": self.llm_provider,
                "llm_model": self.llm_model,
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
                "embedding_tokens": self.embedding_tokens,
                "total_tokens": self.total_tokens,
                "mode": self.mode,
                "session_id": self.session_id,
                "success": self.success,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            }
else:
    # Dummy classes when database is not available
    LLMConfig = None  # type: ignore
    MCPServer = None  # type: ignore
    User = None  # type: ignore
    Conversation = None  # type: ignore
    Message = None  # type: ignore
    DocumentCollection = None  # type: ignore
    APIRequest = None  # type: ignore
    Document = None  # type: ignore
    DocumentChunk = None  # type: ignore
    CustomRAGTool = None  # type: ignore
    AppointmentRequest = None  # type: ignore
    APIUsage = None  # type: ignore
