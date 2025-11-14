"""
Advanced RAG system with dynamic retrieval, re-ranking, hybrid search, and persistent storage
"""
import os
import json
import base64
import pickle
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
import numpy as np

try:
    from langchain_community.vectorstores import FAISS
    from langchain_openai import OpenAIEmbeddings
    from langchain_core.documents import Document as LangchainDocument
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("⚠️  FAISS not available")

try:
    from rank_bm25 import BM25Okapi
    BM25_AVAILABLE = True
except ImportError:
    BM25_AVAILABLE = False
    print("⚠️  rank-bm25 not available, BM25 search will be disabled")

try:
    from sentence_transformers import CrossEncoder
    RERANKER_AVAILABLE = True
except ImportError:
    RERANKER_AVAILABLE = False
    print("⚠️  sentence-transformers not available, re-ranking will be disabled")

from src.core import Config, DB_AVAILABLE
from src.core.database import get_db_context
from src.core.models import Document, DocumentChunk, DocumentCollection


class AdvancedRAGSystem:
    """
    Advanced RAG system with:
    - Dynamic retrieval (adaptive k based on query complexity)
    - Hybrid search (vector + BM25)
    - Re-ranking with cross-encoder
    - Persistent vector store
    - Per-user document collections
    """
    
    def __init__(self, vectorstore_dir: Optional[str] = None):
        """Initialize advanced RAG system"""
        if vectorstore_dir is None:
            vectorstore_dir = os.path.join(Config.ROOT_DIR, "vectorstores")
        
        self.vectorstore_dir = Path(vectorstore_dir)
        self.vectorstore_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize embeddings
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for embeddings")
        
        self.embeddings = OpenAIEmbeddings(api_key=openai_api_key) if FAISS_AVAILABLE else None
        
        # Initialize re-ranker (optional)
        self.reranker = None
        if RERANKER_AVAILABLE:
            try:
                # Use a lightweight cross-encoder for re-ranking
                self.reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')
                print("✓ Re-ranker initialized")
            except Exception as e:
                print(f"⚠️  Failed to initialize re-ranker: {e}")
        
        # Per-user vector stores (loaded on demand)
        self.vectorstores: Dict[int, Any] = {}
        self.bm25_indexes: Dict[int, BM25Okapi] = {}
        self.chunk_texts: Dict[int, List[str]] = {}
        
        print("✓ Advanced RAG System initialized")
    
    def _get_vectorstore_path(self, user_id: int) -> Path:
        """Get path to user's vectorstore"""
        return self.vectorstore_dir / f"user_{user_id}" / "faiss_index"
    
    def _load_vectorstore(self, user_id: int) -> Optional[Any]:
        """Load user's vectorstore from disk"""
        if user_id in self.vectorstores:
            return self.vectorstores[user_id]
        
        if not FAISS_AVAILABLE or not self.embeddings:
            return None
        
        vectorstore_path = self._get_vectorstore_path(user_id)
        
        if vectorstore_path.exists():
            try:
                vectorstore = FAISS.load_local(
                    str(vectorstore_path.parent),
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                self.vectorstores[user_id] = vectorstore
                print(f"✓ Loaded vectorstore for user {user_id}")
                return vectorstore
            except Exception as e:
                print(f"⚠️  Failed to load vectorstore for user {user_id}: {e}")
                return None
        
        return None
    
    def _build_bm25_index(self, user_id: int) -> Optional[BM25Okapi]:
        """Build BM25 index for user's documents"""
        if user_id in self.bm25_indexes:
            return self.bm25_indexes[user_id]
        
        if not BM25_AVAILABLE:
            return None
        
        if not DB_AVAILABLE:
            return None
        
        try:
            with get_db_context() as db:
                # Get all chunks for user
                chunks = db.query(DocumentChunk).join(Document).filter(
                    Document.user_id == user_id,
                    Document.status == "ready"
                ).order_by(DocumentChunk.document_id, DocumentChunk.chunk_index).all()
                
                if not chunks:
                    return None
                
                # Tokenize chunks for BM25
                chunk_texts = []
                for chunk in chunks:
                    text = chunk.content
                    chunk_texts.append(text)
                    # Tokenize (simple whitespace tokenization)
                    tokens = text.lower().split()
                    chunk_texts.append(tokens)
                
                # Keep only tokenized versions
                tokenized_chunks = [text.lower().split() for text in chunk_texts[::2]]
                
                if not tokenized_chunks:
                    return None
                
                bm25 = BM25Okapi(tokenized_chunks)
                self.bm25_indexes[user_id] = bm25
                self.chunk_texts[user_id] = chunk_texts[::2]  # Store original texts
                
                print(f"✓ Built BM25 index for user {user_id} ({len(tokenized_chunks)} chunks)")
                return bm25
        except Exception as e:
            print(f"⚠️  Failed to build BM25 index for user {user_id}: {e}")
            return None
    
    def add_documents(self, user_id: int, chunks: List[Dict[str, Any]], collection_id: Optional[int] = None) -> bool:
        """
        Add document chunks to vector store
        
        Args:
            user_id: User ID
            chunks: List of chunk dictionaries with 'content' and 'metadata'
            collection_id: Optional collection ID
        
        Returns:
            True if successful
        """
        if not FAISS_AVAILABLE or not self.embeddings:
            print("⚠️  FAISS not available, cannot add documents")
            return False
        
        try:
            # Convert chunks to LangChain documents
            documents = []
            for chunk in chunks:
                metadata = chunk.get('metadata', {})
                if collection_id:
                    metadata['collection_id'] = collection_id
                metadata['user_id'] = user_id
                
                doc = LangchainDocument(
                    page_content=chunk['content'],
                    metadata=metadata
                )
                documents.append(doc)
            
            # Load or create vectorstore
            vectorstore = self._load_vectorstore(user_id)
            
            if vectorstore:
                # Add to existing vectorstore
                vectorstore.add_documents(documents)
            else:
                # Create new vectorstore
                vectorstore = FAISS.from_documents(documents, self.embeddings)
                self.vectorstores[user_id] = vectorstore
            
            # Save to disk
            vectorstore_path = self._get_vectorstore_path(user_id)
            vectorstore_path.parent.mkdir(parents=True, exist_ok=True)
            vectorstore.save_local(str(vectorstore_path.parent))
            
            # Rebuild BM25 index
            self._build_bm25_index(user_id)
            
            print(f"✓ Added {len(documents)} chunks to vectorstore for user {user_id}")
            return True
        except Exception as e:
            print(f"❌ Failed to add documents: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _calculate_dynamic_k(self, query: str, base_k: int = 5, max_k: int = 20) -> int:
        """Calculate dynamic k based on query complexity"""
        # Simple heuristic: longer queries might need more context
        query_length = len(query.split())
        
        if query_length < 5:
            return base_k
        elif query_length < 10:
            return min(base_k + 2, max_k)
        elif query_length < 20:
            return min(base_k + 5, max_k)
        else:
            return min(base_k + 10, max_k)
    
    def retrieve(
        self,
        query: str,
        user_id: int,
        k: Optional[int] = None,
        use_reranking: bool = True,
        use_hybrid: bool = True,
        collection_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant documents using advanced techniques
        
        Args:
            query: Search query
            user_id: User ID
            k: Number of results (if None, uses dynamic k)
            use_reranking: Whether to use re-ranking
            use_hybrid: Whether to use hybrid search (vector + BM25)
            collection_id: Optional collection ID to filter
        
        Returns:
            List of relevant chunks with scores
        """
        if k is None:
            k = self._calculate_dynamic_k(query)
        
        results = []
        
        # Vector search
        vectorstore = self._load_vectorstore(user_id)
        if vectorstore:
            try:
                # Build filter if collection_id is provided
                search_kwargs = {"k": k * 2 if use_hybrid or use_reranking else k}  # Get more for re-ranking
                if collection_id:
                    search_kwargs["filter"] = {"collection_id": collection_id}
                
                vector_docs = vectorstore.similarity_search_with_score(query, **search_kwargs)
                
                for doc, score in vector_docs:
                    results.append({
                        "content": doc.page_content,
                        "metadata": doc.metadata,
                        "score": float(score),
                        "source": "vector"
                    })
            except Exception as e:
                print(f"⚠️  Vector search failed: {e}")
        
        # Hybrid search: combine with BM25
        if use_hybrid and BM25_AVAILABLE:
            bm25_index = self._build_bm25_index(user_id)
            if bm25_index and user_id in self.chunk_texts:
                try:
                    query_tokens = query.lower().split()
                    bm25_scores = bm25_index.get_scores(query_tokens)
                    
                    # Get top BM25 results
                    top_indices = np.argsort(bm25_scores)[::-1][:k * 2]
                    
                    # Normalize BM25 scores (0-1 range)
                    max_score = bm25_scores[top_indices[0]] if len(top_indices) > 0 and bm25_scores[top_indices[0]] > 0 else 1
                    normalized_scores = bm25_scores / max_score if max_score > 0 else bm25_scores
                    
                    # Get chunks from database
                    if DB_AVAILABLE:
                        with get_db_context() as db:
                            chunks = db.query(DocumentChunk).join(Document).filter(
                                Document.user_id == user_id,
                                Document.status == "ready"
                            ).order_by(DocumentChunk.document_id, DocumentChunk.chunk_index).all()
                            
                    for idx in top_indices:
                        if idx < len(chunks):
                            chunk = chunks[idx]
                            bm25_score = normalized_scores[idx]
                            
                            # Check if already in results
                            found = False
                            for result in results:
                                if result.get("metadata", {}).get("chunk_id") == chunk.id:
                                    # Combine scores (weighted average)
                                    result["score"] = 0.6 * result["score"] + 0.4 * bm25_score
                                    result["source"] = "hybrid"
                                    found = True
                                    break
                            
                            if not found:
                                metadata = chunk.chunk_metadata
                                if metadata:
                                    try:
                                        metadata = json.loads(metadata)
                                    except:
                                        metadata = {}
                                else:
                                    metadata = {}
                                        
                                        metadata["chunk_id"] = chunk.id
                                        metadata["document_id"] = chunk.document_id
                                        
                                        results.append({
                                            "content": chunk.content,
                                            "metadata": metadata,
                                            "score": bm25_score,
                                            "source": "bm25"
                                        })
                except Exception as e:
                    print(f"⚠️  BM25 search failed: {e}")
        
        # Re-ranking with cross-encoder
        if use_reranking and self.reranker and results:
            try:
                # Prepare pairs for re-ranking
                pairs = [[query, result["content"]] for result in results]
                rerank_scores = self.reranker.predict(pairs)
                
                # Update scores
                for i, result in enumerate(results):
                    # Combine original score with re-rank score (weighted)
                    original_score = result["score"]
                    rerank_score = float(rerank_scores[i])
                    # Normalize rerank score (sigmoid)
                    rerank_normalized = 1 / (1 + np.exp(-rerank_score))
                    result["score"] = 0.3 * original_score + 0.7 * rerank_normalized
                    result["rerank_score"] = rerank_normalized
                
                # Sort by combined score
                results.sort(key=lambda x: x["score"], reverse=True)
            except Exception as e:
                print(f"⚠️  Re-ranking failed: {e}")
        
        # Sort by score and return top k
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:k]
    
    def delete_documents(self, user_id: int, document_ids: List[int]) -> bool:
        """Delete documents from vector store"""
        # For simplicity, rebuild vectorstore without deleted documents
        # In production, you might want a more efficient approach
        try:
            if not DB_AVAILABLE:
                return False
            
            with get_db_context() as db:
                # Get all remaining chunks
                chunks = db.query(DocumentChunk).join(Document).filter(
                    Document.user_id == user_id,
                    Document.status == "ready",
                    ~Document.id.in_(document_ids)
                ).order_by(DocumentChunk.document_id, DocumentChunk.chunk_index).all()
                
                if not chunks:
                    # No chunks left, delete vectorstore
                    vectorstore_path = self._get_vectorstore_path(user_id)
                    if vectorstore_path.exists():
                        import shutil
                        shutil.rmtree(vectorstore_path.parent)
                    if user_id in self.vectorstores:
                        del self.vectorstores[user_id]
                    if user_id in self.bm25_indexes:
                        del self.bm25_indexes[user_id]
                    if user_id in self.chunk_texts:
                        del self.chunk_texts[user_id]
                    return True
                
                # Rebuild vectorstore
                documents = []
                for chunk in chunks:
                    metadata = chunk.chunk_metadata
                    if metadata:
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    else:
                        metadata = {}
                    
                    metadata["chunk_id"] = chunk.id
                    metadata["document_id"] = chunk.document_id
                    metadata["user_id"] = user_id
                    
                    doc = LangchainDocument(
                        page_content=chunk.content,
                        metadata=metadata
                    )
                    documents.append(doc)
                
                if documents and FAISS_AVAILABLE and self.embeddings:
                    vectorstore = FAISS.from_documents(documents, self.embeddings)
                    self.vectorstores[user_id] = vectorstore
                    
                    vectorstore_path = self._get_vectorstore_path(user_id)
                    vectorstore_path.parent.mkdir(parents=True, exist_ok=True)
                    vectorstore.save_local(str(vectorstore_path.parent))
                
                # Rebuild BM25 index
                self._build_bm25_index(user_id)
                
                return True
        except Exception as e:
            print(f"❌ Failed to delete documents: {e}")
            return False


# Global instance
advanced_rag_system = AdvancedRAGSystem()

