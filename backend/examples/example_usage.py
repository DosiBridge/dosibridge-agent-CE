#!/usr/bin/env python
"""
Test agent with complex questions and memory in a single session
"""
import asyncio
import os

# Load environment
try:
    if os.path.exists('.env'):
        from dotenv import load_dotenv
        load_dotenv()
except ImportError:
    pass  # dotenv not required if env vars already set

import sys
from pathlib import Path
# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from examples.ai_mcp_dynamic import main

async def test_agent_memory():
    """Test agent with memory across multiple queries"""
    
    print("\n" + "="*80)
    print("🧪 AGENT MODE: Complex Questions with Memory Test")
    print("="*80 + "\n")
    
    session_id = "memory_test"
    
    # Query 1: Complex multi-part question
    print("📝 Query 1: Introduction + Knowledge Base Question")
    print("-"*80)
    await main(
        query="What is DosiBlog? Also, my name is Abdullah.",
        session_id=session_id,
        mode="agent"
    )
    
    # Query 2: Memory recall
    print("\n" + "="*80)
    print("📝 Query 2: Testing Memory - What is my name?")
    print("="*80 + "\n")
    await main(
        query="What is my name?",
        session_id=session_id,
        mode="agent"
    )
    
    # Query 3: Context recall
    print("\n" + "="*80)
    print("📝 Query 3: Testing Context - What technologies?")
    print("="*80 + "\n")
    await main(
        query="What technologies does it use?",
        session_id=session_id,
        mode="agent"
    )
    
    print("\n" + "="*80)
    print("✅ ALL TESTS COMPLETED")
    print("="*80 + "\n")

if __name__ == "__main__":
    asyncio.run(test_agent_memory())

