"""
Tool definitions for the agent
"""
from langchain_core.tools import tool, BaseTool
from typing import List, Optional
from .rag import rag_system
from .advanced_rag import advanced_rag_system
from src.core import CustomRAGTool, DB_AVAILABLE, AppointmentRequest
from src.utils.email_service import email_service
import json
from datetime import datetime
import threading


@tool("retrieve_dosiblog_context")
def retrieve_dosiblog_context(query: str) -> str:
    """Retrieves relevant context about DOSIBridge projects, services, and related topics."""
    print(f"🔍 Calling Enhanced RAG Tool for query: {query}")
    context = rag_system.retrieve_context(query)
    return f"Retrieved context:\n{context}"


def create_appointment_tool(user_id: Optional[int] = None, db=None) -> BaseTool:
    """
    Create an appointment scheduling tool with database access.
    
    Args:
        user_id: Optional user ID if authenticated
        db: Optional database session (will create new one if not provided)
    
    Returns:
        LangChain BaseTool instance for scheduling appointments
    """
    @tool("schedule_appointment_or_contact")
    def schedule_appointment_or_contact(
        name: str,
        email: str,
        message: str,
        request_type: str = "appointment",
        phone: Optional[str] = None,
        subject: Optional[str] = None,
        preferred_date: Optional[str] = None,
        preferred_time: Optional[str] = None,
    ) -> str:
        """
        Schedule an appointment or send a contact request to the DOSIBridge team.
        
        Args:
            name: Contact person's name (required)
            email: Contact email address (required)
            message: Message or request details (required)
            request_type: Type of request - 'appointment' (default), 'contact', or 'support'
            phone: Optional phone number
            subject: Optional subject/topic
            preferred_date: Preferred date in ISO format (YYYY-MM-DDTHH:MM:SS) for appointments
            preferred_time: Preferred time (e.g., 'morning', 'afternoon', 'evening', or specific time)
        
        Returns:
            Confirmation message with appointment request ID
        """
        print(f"📅 Scheduling appointment/contact request for: {name} ({email})")
        
        if not DB_AVAILABLE or AppointmentRequest is None:
            return "Error: Database not available. Cannot schedule appointment at this time."
        
        # Use provided db or create a new one
        db_session = db
        should_close_db = False
        if db_session is None:
            from src.core import get_db_context
            db_gen = get_db_context()
            db_session = next(db_gen)
            should_close_db = True
        
        try:
            # Validate request_type
            if request_type not in ['appointment', 'contact', 'support']:
                return f"Error: Invalid request_type '{request_type}'. Must be 'appointment', 'contact', or 'support'."
            
            # Parse preferred_date if provided
            preferred_date_obj = None
            if preferred_date:
                try:
                    preferred_date_obj = datetime.fromisoformat(preferred_date.replace('Z', '+00:00'))
                except ValueError:
                    return f"Error: Invalid date format '{preferred_date}'. Use ISO format (YYYY-MM-DDTHH:MM:SS)."
            
            # When called by AI agent, treat as confirmed and save directly
            # (The human-in-the-loop confirmation is handled at the API level, not tool level)
            appointment = AppointmentRequest(
                user_id=user_id,
                name=name,
                email=email,
                phone=phone,
                request_type=request_type,
                subject=subject,
                message=message,
                preferred_date=preferred_date_obj,
                preferred_time=preferred_time,
                status="pending"
            )
            
            db_session.add(appointment)
            db_session.commit()
            db_session.refresh(appointment)
            
            # Send emails in background thread (non-blocking)
            def send_emails():
                try:
                    email_service.send_appointment_confirmation(
                        to_email=email,
                        to_name=name,
                        appointment_id=appointment.id,
                        request_type=request_type,
                        preferred_date=preferred_date,
                        preferred_time=preferred_time
                    )
                    email_service.send_appointment_notification_to_team(
                        appointment_id=appointment.id,
                        name=name,
                        email=email,
                        phone=phone,
                        request_type=request_type,
                        subject=subject,
                        message=message,
                        preferred_date=preferred_date,
                        preferred_time=preferred_time,
                        user_id=user_id
                    )
                except Exception as e:
                    print(f"⚠️  Failed to send emails: {e}")
            
            # Start email sending in background thread
            email_thread = threading.Thread(target=send_emails, daemon=True)
            email_thread.start()
            
            result = (
                f"✅ Appointment/contact request created successfully!\n\n"
                f"**Request ID:** #{appointment.id}\n"
                f"**Name:** {name}\n"
                f"**Email:** {email}\n"
                f"**Type:** {request_type}\n"
                f"**Message:** {message}\n"
            )
            
            if preferred_date:
                result += f"**Preferred Date:** {preferred_date}\n"
            if preferred_time:
                result += f"**Preferred Time:** {preferred_time}\n"
            
            result += f"\nThe DOSIBridge team will be notified and a confirmation email will be sent to {email}."
            
            return result
        except Exception as e:
            if db_session:
                db_session.rollback()
            return f"Error scheduling appointment: {str(e)}"
        finally:
            if should_close_db and db_session:
                db_session.close()
    
    return schedule_appointment_or_contact


def create_custom_rag_tool(tool_config: dict, user_id: int) -> BaseTool:
    """
    Dynamically create a LangChain tool from a custom RAG tool configuration
    
    Args:
        tool_config: Dictionary with 'name', 'description', 'collection_id'
        user_id: User ID for document retrieval
    
    Returns:
        LangChain BaseTool instance
    """
    tool_name = tool_config["name"]
    tool_description = tool_config["description"]
    collection_id = tool_config.get("collection_id")
    
    @tool(tool_name)
    def custom_rag_retriever(query: str) -> str:
        """Custom RAG tool for retrieving information from user's documents."""
        print(f"🔍 Calling Custom RAG Tool '{tool_name}' for query: {query}")
        
        try:
            # Use advanced RAG system to retrieve from user's documents
            results = advanced_rag_system.retrieve(
                query=query,
                user_id=user_id,
                k=5,
                use_reranking=True,
                use_hybrid=True,
                collection_id=collection_id
            )
            
            if not results:
                return f"No relevant documents found for query: {query}"
            
            context_parts = []
            for i, result in enumerate(results, 1):
                content = result["content"]
                metadata = result.get("metadata", {})
                source = metadata.get("original_filename", "Document")
                context_parts.append(f"[{source}]\n{content}\n")
            
            context = "\n".join(context_parts)
            return f"Retrieved context from {tool_name}:\n{context}"
        except Exception as e:
            return f"Error retrieving context: {str(e)}"
    
    # Update the tool's description
    custom_rag_retriever.description = tool_description
    
    return custom_rag_retriever


def load_custom_rag_tools(user_id: Optional[int], db=None) -> List[BaseTool]:
    """
    Load all enabled custom RAG tools for a user
    
    Args:
        user_id: User ID (None for unauthenticated users)
        db: Database session
    
    Returns:
        List of LangChain BaseTool instances
    """
    if not DB_AVAILABLE or CustomRAGTool is None or not user_id or not db:
        return []
    
    try:
        custom_tools = db.query(CustomRAGTool).filter(
            CustomRAGTool.user_id == user_id,
            CustomRAGTool.enabled == True
        ).all()
        
        langchain_tools = []
        for tool_config in custom_tools:
            try:
                tool_dict = tool_config.to_dict()
                langchain_tool = create_custom_rag_tool(tool_dict, user_id)
                langchain_tools.append(langchain_tool)
            except Exception as e:
                print(f"⚠️  Failed to create custom RAG tool '{tool_config.name}': {e}")
                continue
        
        return langchain_tools
    except Exception as e:
        print(f"⚠️  Error loading custom RAG tools: {e}")
        return []

