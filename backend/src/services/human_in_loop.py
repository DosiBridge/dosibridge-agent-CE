"""
Human-in-the-Loop workflow for document review and approval
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session

from src.core import DB_AVAILABLE, get_db_context
from src.core.models import Document, DocumentCollection


class HumanInTheLoop:
    """
    Human-in-the-Loop workflow manager
    
    Workflow:
    1. Document uploaded -> status: "pending"
    2. Document processed -> status: "needs_review" (if confidence low) or "ready"
    3. Human reviews -> approves or rejects
    4. Approved documents -> status: "ready", available for RAG
    """
    
    @staticmethod
    def get_documents_needing_review(user_id: int, db: Session) -> List[Dict]:
        """Get documents that need human review"""
        if not DB_AVAILABLE:
            return []
        
        documents = db.query(Document).filter(
            Document.user_id == user_id,
            Document.status == "needs_review"
        ).order_by(Document.created_at.desc()).all()
        
        return [doc.to_dict() for doc in documents]
    
    @staticmethod
    def approve_document(document_id: int, user_id: int, db: Session) -> bool:
        """Approve a document for use in RAG"""
        if not DB_AVAILABLE:
            return False
        
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.user_id == user_id
        ).first()
        
        if not document:
            return False
        
        document.status = "ready"
        db.commit()
        
        return True
    
    @staticmethod
    def reject_document(document_id: int, user_id: int, reason: Optional[str], db: Session) -> bool:
        """Reject a document"""
        if not DB_AVAILABLE:
            return False
        
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.user_id == user_id
        ).first()
        
        if not document:
            return False
        
        document.status = "error"
        if reason:
            metadata = document.document_metadata or "{}"
            import json
            try:
                metadata_dict = json.loads(metadata)
            except:
                metadata_dict = {}
            metadata_dict["rejection_reason"] = reason
            document.document_metadata = json.dumps(metadata_dict)
        
        db.commit()
        
        return True
    
    @staticmethod
    def should_require_review(document: Document, extracted_text: str) -> bool:
        """
        Determine if document should require human review
        
        Heuristics:
        - Very short documents (< 100 chars)
        - Very long documents (> 1M chars)
        - Low text extraction confidence
        - Suspicious content patterns
        """
        text_length = len(extracted_text)
        
        # Very short or very long documents
        if text_length < 100:
            return True
        
        if text_length > 1_000_000:
            return True
        
        # Check extraction quality (simple heuristic)
        # If text is mostly whitespace or special characters, might need review
        non_whitespace_ratio = len([c for c in extracted_text if c.isalnum()]) / max(text_length, 1)
        if non_whitespace_ratio < 0.3:
            return True
        
        return False
    
    @staticmethod
    def get_review_statistics(user_id: int, db: Session) -> Dict[str, Any]:
        """Get statistics about documents needing review"""
        if not DB_AVAILABLE:
            return {
                "pending": 0,
                "needs_review": 0,
                "ready": 0,
                "error": 0,
                "total": 0
            }
        
        stats = {
            "pending": db.query(Document).filter(
                Document.user_id == user_id,
                Document.status == "pending"
            ).count(),
            "needs_review": db.query(Document).filter(
                Document.user_id == user_id,
                Document.status == "needs_review"
            ).count(),
            "ready": db.query(Document).filter(
                Document.user_id == user_id,
                Document.status == "ready"
            ).count(),
            "error": db.query(Document).filter(
                Document.user_id == user_id,
                Document.status == "error"
            ).count(),
        }
        
        stats["total"] = sum(stats.values())
        
        return stats


# Global instance
human_in_loop = HumanInTheLoop()

