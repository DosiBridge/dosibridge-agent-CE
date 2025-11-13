"""
Conversation summarization service
Generates summaries from conversation messages (first 50 messages)
"""
from typing import List, Optional
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from src.core import Config
from src.services import create_llm_from_config


async def generate_conversation_summary(
    messages: List[BaseMessage],
    max_messages: int = 50
) -> str:
    """
    Generate a summary of conversation from messages (first max_messages)
    
    Args:
        messages: List of conversation messages
        max_messages: Maximum number of messages to include in summary (default: 50)
        
    Returns:
        Summary string
    """
    if not messages:
        return "Empty conversation"
    
    # Take first max_messages
    messages_to_summarize = messages[:max_messages]
    
    # Format messages for summary
    conversation_text = ""
    for msg in messages_to_summarize:
        if isinstance(msg, HumanMessage):
            conversation_text += f"User: {msg.content}\n\n"
        elif isinstance(msg, AIMessage):
            conversation_text += f"Assistant: {msg.content}\n\n"
    
    # If conversation is very short, just return it
    if len(messages_to_summarize) <= 3:
        return conversation_text.strip()[:500]  # First 500 chars
    
    # Generate summary using LLM
    try:
        llm_config = Config.load_llm_config()
        llm = create_llm_from_config(llm_config, streaming=False, temperature=0)
        
        prompt = f"""Please provide a concise summary of the following conversation in 2-3 sentences. Focus on the main topics discussed and key information exchanged.

Conversation:
{conversation_text}

Summary:"""
        
        summary = llm.invoke(prompt).content
        
        # Limit summary length
        if len(summary) > 1000:
            summary = summary[:1000] + "..."
        
        return summary.strip()
    
    except Exception as e:
        # Fallback: return first 500 chars of conversation
        print(f"⚠️  Failed to generate summary: {e}")
        return conversation_text.strip()[:500]


def generate_simple_summary(messages: List[BaseMessage], max_messages: int = 50) -> str:
    """
    Generate a simple summary without LLM (faster, for fallback)
    
    Args:
        messages: List of conversation messages
        max_messages: Maximum number of messages to include
        
    Returns:
        Simple summary string
    """
    if not messages:
        return "Empty conversation"
    
    messages_to_summarize = messages[:max_messages]
    
    # Count message types
    user_count = sum(1 for msg in messages_to_summarize if isinstance(msg, HumanMessage))
    ai_count = sum(1 for msg in messages_to_summarize if isinstance(msg, AIMessage))
    
    # Get first user message as title/summary
    first_user_msg = None
    for msg in messages_to_summarize:
        if isinstance(msg, HumanMessage):
            first_user_msg = msg.content[:200]
            break
    
    summary = f"Conversation with {user_count} user messages and {ai_count} assistant responses"
    if first_user_msg:
        summary += f". Started with: {first_user_msg}..."
    
    return summary

