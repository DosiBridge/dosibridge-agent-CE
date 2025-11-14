"""
Custom RAG Tools API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from src.core import get_db, User, CustomRAGTool, DocumentCollection, DB_AVAILABLE
from src.core.auth import get_current_active_user

router = APIRouter()


class CustomRAGToolRequest(BaseModel):
    name: str
    description: str
    collection_id: Optional[int] = None
    enabled: bool = True


class CustomRAGToolResponse(BaseModel):
    id: int
    name: str
    description: str
    collection_id: Optional[int]
    enabled: bool
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True


@router.post("/custom-rag-tools", response_model=CustomRAGToolResponse)
async def create_custom_rag_tool(
    tool_request: CustomRAGToolRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new custom RAG tool"""
    if not DB_AVAILABLE or CustomRAGTool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    # Validate collection_id if provided
    if tool_request.collection_id:
        collection = db.query(DocumentCollection).filter(
            DocumentCollection.id == tool_request.collection_id,
            DocumentCollection.user_id == current_user.id
        ).first()
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check if tool name already exists for this user
    existing = db.query(CustomRAGTool).filter(
        CustomRAGTool.user_id == current_user.id,
        CustomRAGTool.name == tool_request.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tool with this name already exists")
    
    # Create new tool
    custom_tool = CustomRAGTool(
        user_id=current_user.id,
        name=tool_request.name,
        description=tool_request.description,
        collection_id=tool_request.collection_id,
        enabled=tool_request.enabled
    )
    
    db.add(custom_tool)
    db.commit()
    db.refresh(custom_tool)
    
    return custom_tool.to_dict()


@router.get("/custom-rag-tools", response_model=List[CustomRAGToolResponse])
async def list_custom_rag_tools(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all custom RAG tools for the current user"""
    if not DB_AVAILABLE or CustomRAGTool is None:
        return []
    
    tools = db.query(CustomRAGTool).filter(
        CustomRAGTool.user_id == current_user.id
    ).order_by(CustomRAGTool.created_at.desc()).all()
    
    return [tool.to_dict() for tool in tools]


@router.get("/custom-rag-tools/{tool_id}", response_model=CustomRAGToolResponse)
async def get_custom_rag_tool(
    tool_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific custom RAG tool"""
    if not DB_AVAILABLE or CustomRAGTool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    tool = db.query(CustomRAGTool).filter(
        CustomRAGTool.id == tool_id,
        CustomRAGTool.user_id == current_user.id
    ).first()
    
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    return tool.to_dict()


@router.put("/custom-rag-tools/{tool_id}", response_model=CustomRAGToolResponse)
async def update_custom_rag_tool(
    tool_id: int,
    tool_request: CustomRAGToolRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a custom RAG tool"""
    if not DB_AVAILABLE or CustomRAGTool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    tool = db.query(CustomRAGTool).filter(
        CustomRAGTool.id == tool_id,
        CustomRAGTool.user_id == current_user.id
    ).first()
    
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    # Validate collection_id if provided
    if tool_request.collection_id:
        collection = db.query(DocumentCollection).filter(
            DocumentCollection.id == tool_request.collection_id,
            DocumentCollection.user_id == current_user.id
        ).first()
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check if name is being changed and conflicts with another tool
    if tool_request.name != tool.name:
        existing = db.query(CustomRAGTool).filter(
            CustomRAGTool.user_id == current_user.id,
            CustomRAGTool.name == tool_request.name,
            CustomRAGTool.id != tool_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Tool with this name already exists")
    
    # Update tool
    tool.name = tool_request.name
    tool.description = tool_request.description
    tool.collection_id = tool_request.collection_id
    tool.enabled = tool_request.enabled
    
    db.commit()
    db.refresh(tool)
    
    return tool.to_dict()


@router.delete("/custom-rag-tools/{tool_id}")
async def delete_custom_rag_tool(
    tool_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a custom RAG tool"""
    if not DB_AVAILABLE or CustomRAGTool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    tool = db.query(CustomRAGTool).filter(
        CustomRAGTool.id == tool_id,
        CustomRAGTool.user_id == current_user.id
    ).first()
    
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    db.delete(tool)
    db.commit()
    
    return {"message": "Tool deleted successfully"}


@router.patch("/custom-rag-tools/{tool_id}/toggle")
async def toggle_custom_rag_tool(
    tool_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Toggle a custom RAG tool enabled/disabled"""
    if not DB_AVAILABLE or CustomRAGTool is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    tool = db.query(CustomRAGTool).filter(
        CustomRAGTool.id == tool_id,
        CustomRAGTool.user_id == current_user.id
    ).first()
    
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    
    tool.enabled = not tool.enabled
    db.commit()
    db.refresh(tool)
    
    return tool.to_dict()

