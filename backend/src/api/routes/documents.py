"""
Document upload and management endpoints
"""
import asyncio
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
import json

from src.core import get_db, DB_AVAILABLE, User
from src.core.auth import get_current_active_user
from src.core.models import Document, DocumentCollection, DocumentChunk
from src.services.document_processor import document_processor
from src.services.advanced_rag import advanced_rag_system
from src.services.human_in_loop import human_in_loop
from src.core.database import get_db_context

router = APIRouter()


@router.post("/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    collection_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Upload a document for RAG processing
    
    Args:
        file: Uploaded file
        collection_id: Optional collection ID
        current_user: Current authenticated user
        db: Database session
    
    Returns:
        Document information
    """
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Validate file
    file_content = await file.read()
    is_valid, error_msg = document_processor.validate_file(file_content, file.filename)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Get file type
    file_type = file.filename.split('.')[-1].lower()
    
    # Save file
    file_path, unique_filename = document_processor.save_file(
        file_content,
        file.filename,
        current_user.id
    )
    
    # Create document record
    document = Document(
        user_id=current_user.id,
        collection_id=collection_id,
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_type=file_type,
        file_size=len(file_content),
        status="pending"
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Process document in background
    background_tasks.add_task(
        process_document_task,
        document.id,
        current_user.id,
        file_path,
        file_type
    )
    
    return {
        "message": "Document uploaded successfully. Processing in background.",
        "document": document.to_dict()
    }


async def process_document_task(document_id: int, user_id: int, file_path: str, file_type: str):
    """Background task to process uploaded document"""
    with get_db_context() as db:
        try:
            document = db.query(Document).filter(Document.id == document_id).first()
            if not document:
                return
            
            # Update status to processing
            document.status = "processing"
            db.commit()
            
            # Extract text
            extracted_text, metadata = document_processor.extract_text(file_path, file_type)
            
            # Check if review is needed
            needs_review = human_in_loop.should_require_review(document, extracted_text)
            
            # Chunk text
            chunks = document_processor.chunk_text(extracted_text, chunk_size=1000, chunk_overlap=200)
            
            # Save chunks to database
            chunk_objects = []
            for chunk_data in chunks:
                chunk_metadata = json.dumps(chunk_data.get("metadata", {}))
                chunk = DocumentChunk(
                    document_id=document_id,
                    chunk_index=chunk_data["chunk_index"],
                    content=chunk_data["content"],
                    metadata=chunk_metadata
                )
                chunk_objects.append(chunk)
                db.add(chunk)
            
            # Update document
            document.chunk_count = len(chunks)
            document.document_metadata = json.dumps(metadata)
            document.status = "needs_review" if needs_review else "ready"
            document.embedding_status = "pending"
            
            db.commit()
            
            # Generate embeddings and add to vectorstore (if ready)
            if document.status == "ready":
                # Prepare chunks for vectorstore
                rag_chunks = []
                for chunk_obj in chunk_objects:
                    chunk_metadata = {}
                    if chunk_obj.chunk_metadata:
                        try:
                            chunk_metadata = json.loads(chunk_obj.chunk_metadata)
                        except:
                            pass
                    
                    rag_chunks.append({
                        "content": chunk_obj.content,
                        "metadata": {
                            **chunk_metadata,
                            "chunk_id": chunk_obj.id,
                            "document_id": document_id,
                            "original_filename": document.original_filename
                        }
                    })
                
                # Add to vectorstore
                success = advanced_rag_system.add_documents(
                    user_id=user_id,
                    chunks=rag_chunks,
                    collection_id=document.collection_id
                )
                
                if success:
                    document.embedding_status = "completed"
                else:
                    document.embedding_status = "failed"
                
                db.commit()
            
            print(f"✓ Processed document {document_id}: {len(chunks)} chunks")
        except Exception as e:
            print(f"❌ Error processing document {document_id}: {e}")
            import traceback
            traceback.print_exc()
            
            # Update document status to error
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.status = "error"
                error_metadata = {"error": str(e)}
                document.document_metadata = json.dumps(error_metadata)
                db.commit()


@router.get("/documents")
async def list_documents(
    collection_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List user's documents"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    query = db.query(Document).filter(Document.user_id == current_user.id)
    
    if collection_id:
        query = query.filter(Document.collection_id == collection_id)
    
    if status:
        query = query.filter(Document.status == status)
    
    documents = query.order_by(Document.created_at.desc()).all()
    
    return {
        "documents": [doc.to_dict() for doc in documents],
        "count": len(documents)
    }


@router.get("/documents/{document_id}")
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get document details"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"document": document.to_dict()}


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a document"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete from vectorstore
    advanced_rag_system.delete_documents(current_user.id, [document_id])
    
    # Delete file
    import os
    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except Exception as e:
            print(f"⚠️  Failed to delete file {document.file_path}: {e}")
    
    # Delete from database (cascade will delete chunks)
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted successfully"}


@router.post("/documents/{document_id}/approve")
async def approve_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Approve a document for use in RAG"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    success = human_in_loop.approve_document(document_id, current_user.id, db)
    
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Generate embeddings and add to vectorstore
    document = db.query(Document).filter(Document.id == document_id).first()
    if document:
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()
        
            if chunks:
                rag_chunks = []
                for chunk in chunks:
                    chunk_metadata = {}
                    if chunk.chunk_metadata:
                        try:
                            chunk_metadata = json.loads(chunk.chunk_metadata)
                        except:
                            pass
                
                rag_chunks.append({
                    "content": chunk.content,
                    "metadata": {
                        **chunk_metadata,
                        "chunk_id": chunk.id,
                        "document_id": document_id,
                        "original_filename": document.original_filename
                    }
                })
            
            success = advanced_rag_system.add_documents(
                user_id=current_user.id,
                chunks=rag_chunks,
                collection_id=document.collection_id
            )
            
            if success:
                document.embedding_status = "completed"
            else:
                document.embedding_status = "failed"
            
            db.commit()
    
    return {"message": "Document approved and added to RAG system"}


@router.post("/documents/{document_id}/reject")
async def reject_document(
    document_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Reject a document"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    success = human_in_loop.reject_document(document_id, current_user.id, reason, db)
    
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document rejected"}


@router.get("/documents/review/needed")
async def get_documents_needing_review(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get documents that need human review"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    documents = human_in_loop.get_documents_needing_review(current_user.id, db)
    
    return {
        "documents": documents,
        "count": len(documents)
    }


@router.get("/documents/review/statistics")
async def get_review_statistics(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get review statistics"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    stats = human_in_loop.get_review_statistics(current_user.id, db)
    
    return stats


# Collections endpoints
@router.post("/collections")
async def create_collection(
    name: str,
    description: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a document collection"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Check if collection with same name exists
    existing = db.query(DocumentCollection).filter(
        DocumentCollection.user_id == current_user.id,
        DocumentCollection.name == name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Collection with this name already exists")
    
    collection = DocumentCollection(
        user_id=current_user.id,
        name=name,
        description=description
    )
    
    db.add(collection)
    db.commit()
    db.refresh(collection)
    
    return {
        "message": "Collection created successfully",
        "collection": collection.to_dict()
    }


@router.get("/collections")
async def list_collections(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List user's collections"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    collections = db.query(DocumentCollection).filter(
        DocumentCollection.user_id == current_user.id
    ).order_by(DocumentCollection.created_at.desc()).all()
    
    return {
        "collections": [col.to_dict() for col in collections],
        "count": len(collections)
    }


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a collection"""
    if not DB_AVAILABLE:
        raise HTTPException(status_code=503, detail="Database not available")
    
    collection = db.query(DocumentCollection).filter(
        DocumentCollection.id == collection_id,
        DocumentCollection.user_id == current_user.id
    ).first()
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    db.delete(collection)
    db.commit()
    
    return {"message": "Collection deleted successfully"}

