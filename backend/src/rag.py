"""
RAG (Retrieval Augmented Generation) system with FAISS vectorstore
"""
import os
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_classic.chains import create_retrieval_chain, create_history_aware_retriever
from langchain_classic.chains.combine_documents import create_stuff_documents_chain

from .history import history_manager
from .config import Config


class EnhancedRAGSystem:
    """Enhanced RAG system with better context retrieval and history awareness"""
    
    def __init__(self):
        """Initialize the RAG system with DosiBlog context"""
        self.texts = [
            "DosiBlog is a web development project created by Abdullah Al Sazib.",
            "DosiBlog uses Node.js, Express, and MongoDB for backend development.",
            "The DosiBlog project was started in September 2025.",
            "DosiBlog features include user authentication, blog post creation, and commenting system.",
            "Abdullah Al Sazib is a full-stack developer specializing in MERN stack.",
            "The project uses RESTful API architecture for communication between frontend and backend.",
        ]
        
        try:
            # Use OpenAI API key from config or environment (default for embeddings)
            # This allows RAG to work even if the main LLM is Gemini/Ollama
            # Priority: 1) Environment variable, 2) Config file (if OpenAI), 3) Config.OPENAI_API_KEY
            openai_api_key = os.getenv("OPENAI_API_KEY")
            
            # If not in env, try to get from LLM config if it's OpenAI
            if not openai_api_key:
                llm_config = Config.load_llm_config()
                if llm_config.get("type", "").lower() == "openai":
                    openai_api_key = llm_config.get("api_key")
            
            # Fallback to Config class
            if not openai_api_key:
                openai_api_key = Config.OPENAI_API_KEY
            
            if not openai_api_key:
                raise ValueError(
                    "OpenAI API key is required for FAISS embeddings. "
                    "Please set OPENAI_API_KEY environment variable or configure it in config/llm_config.json"
                )
            
            self.embeddings = OpenAIEmbeddings(api_key=openai_api_key)
            self.vectorstore = FAISS.from_texts(self.texts, embedding=self.embeddings)
            self.retriever = self.vectorstore.as_retriever(search_kwargs={"k": 3})
            self.available = True
            print("✓ Enhanced RAG System initialized with FAISS vectorstore")
        except Exception as e:
            print(f"⚠️  FAISS not available, RAG tool disabled: {e}")
            self.available = False
    
    def retrieve_context(self, query: str) -> str:
        """Retrieve relevant context for a query"""
        if not self.available:
            return "RAG system not available."
        
        try:
            docs = self.retriever.invoke(query)
            if docs:
                contexts = [doc.page_content for doc in docs]
                return "\n".join(contexts)
            return "No relevant context found."
        except Exception as e:
            return f"Error retrieving context: {e}"
    
    def query_with_history(self, query: str, session_id: str, llm: ChatOpenAI) -> str:
        """
        Query the RAG system with conversation history
        
        Args:
            query: User's question
            session_id: Session identifier
            llm: Language model to use
            
        Returns:
            Answer with context from both RAG and history
        """
        if not self.available:
            return "RAG system not available."
        
        # Contextualization prompt for history-aware retrieval
        contextualize_prompt = ChatPromptTemplate.from_messages([
            ("system", 
             "Given a chat history and the latest user question, "
             "formulate a standalone question which can be understood without the chat history. "
             "Do NOT answer the question, just reformulate it if needed."),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])
        
        # Answer prompt
        answer_prompt = ChatPromptTemplate.from_messages([
            ("system", 
             "You are a helpful AI assistant. Use the following context to answer questions accurately and naturally.\n"
             "Context: {context}\n\n"
             "Rules:\n"
             "- Answer naturally without mentioning 'the context' or 'according to the context'\n"
             "- If you don't know, say so honestly\n"
             "- Be concise and helpful"),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])
        
        # Create history-aware retriever
        history_aware_retriever = create_history_aware_retriever(
            llm, self.retriever, contextualize_prompt
        )
        
        # Create question answering chain
        question_answer_chain = create_stuff_documents_chain(llm, answer_prompt)
        
        # Create retrieval chain
        rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)
        
        # Wrap with history
        conversational_rag_chain = RunnableWithMessageHistory(
            rag_chain,
            lambda sid: history_manager.get_session_history(sid),
            input_messages_key="input",
            history_messages_key="chat_history",
            output_messages_key="answer",
        )
        
        # Execute query
        result = conversational_rag_chain.invoke(
            {"input": query},
            config={"configurable": {"session_id": session_id}},
        )
        
        return result["answer"]


# Global RAG system instance
rag_system = EnhancedRAGSystem()

