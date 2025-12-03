"""
Appointment and Contact Request Management Endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Union
from pydantic import BaseModel, Field, EmailStr, validator
from datetime import datetime
from src.core import get_db, AppointmentRequest, DB_AVAILABLE, User
from src.core.auth import get_current_user, get_current_active_user
from src.utils.logger import app_logger
from src.utils.email_service import email_service

router = APIRouter()


def send_appointment_emails(
    appointment_id: int,
    name: str,
    email: str,
    phone: Optional[str],
    request_type: str,
    subject: Optional[str],
    message: str,
    preferred_date: Optional[str] = None,
    preferred_time: Optional[str] = None,
    user_id: Optional[int] = None
):
    """
    Background task to send appointment confirmation and notification emails
    
    Args:
        appointment_id: Appointment request ID
        name: Contact person's name
        email: Contact email
        phone: Contact phone (optional)
        request_type: Type of request
        subject: Request subject (optional)
        message: Request message
        preferred_date: Preferred date as ISO string (optional)
        preferred_time: Preferred time (optional)
        user_id: User ID if authenticated (optional)
    """
    try:
        # Send confirmation email to user
        email_service.send_appointment_confirmation(
            to_email=email,
            to_name=name,
            appointment_id=appointment_id,
            request_type=request_type,
            preferred_date=preferred_date,
            preferred_time=preferred_time
        )
        
        # Send notification email to team
        email_service.send_appointment_notification_to_team(
            appointment_id=appointment_id,
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
        
        app_logger.info(
            "Appointment emails sent",
            {"appointment_id": appointment_id, "email": email}
        )
    except Exception as e:
        app_logger.error(
            "Failed to send appointment emails",
            {"appointment_id": appointment_id, "error": str(e)},
            exc_info=True
        )


class AppointmentRequestCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Contact name")
    email: EmailStr = Field(..., description="Contact email")
    phone: Optional[str] = Field(None, max_length=50, description="Contact phone number")
    request_type: str = Field(default="appointment", description="Type: 'appointment', 'contact', or 'support'")
    subject: Optional[str] = Field(None, max_length=255, description="Subject/topic")
    message: str = Field(..., min_length=1, description="Message or request details")
    preferred_date: Optional[str] = Field(None, description="Preferred date (ISO format)")
    preferred_time: Optional[str] = Field(None, max_length=50, description="Preferred time (e.g., 'morning', 'afternoon', 'evening', or specific time)")
    confirm: bool = Field(default=False, description="Set to true to confirm and save to database. If false, returns preview only.")
    
    @validator('request_type')
    def validate_request_type(cls, v):
        if v not in ['appointment', 'contact', 'support']:
            raise ValueError("request_type must be 'appointment', 'contact', or 'support'")
        return v


class AppointmentPreviewResponse(BaseModel):
    """Preview response before confirmation"""
    preview: dict = Field(..., description="Appointment data preview")
    requires_confirmation: bool = Field(True, description="Whether confirmation is required")
    message: str = Field(..., description="Preview message")
    
    class Config:
        from_attributes = True


class AppointmentRequestResponse(BaseModel):
    id: int
    user_id: Optional[int]
    name: str
    email: str
    phone: Optional[str]
    request_type: str
    subject: Optional[str]
    message: str
    preferred_date: Optional[str]
    preferred_time: Optional[str]
    status: str
    notes: Optional[str]
    created_at: str
    updated_at: Optional[str]
    
    class Config:
        from_attributes = True


class AppointmentConfirmationRequest(BaseModel):
    """Request model for confirming a previewed appointment"""
    name: str = Field(..., min_length=1, max_length=255, description="Contact name")
    email: EmailStr = Field(..., description="Contact email")
    phone: Optional[str] = Field(None, max_length=50, description="Contact phone number")
    request_type: str = Field(..., description="Type: 'appointment', 'contact', or 'support'")
    subject: Optional[str] = Field(None, max_length=255, description="Subject/topic")
    message: str = Field(..., min_length=1, description="Message or request details")
    preferred_date: Optional[str] = Field(None, description="Preferred date (ISO format)")
    preferred_time: Optional[str] = Field(None, max_length=50, description="Preferred time")
    
    @validator('request_type')
    def validate_request_type(cls, v):
        if v not in ['appointment', 'contact', 'support']:
            raise ValueError("request_type must be 'appointment', 'contact', or 'support'")
        return v


class AppointmentRequestUpdate(BaseModel):
    status: Optional[str] = Field(None, description="Status: 'pending', 'confirmed', 'cancelled', 'completed'")
    notes: Optional[str] = Field(None, description="Internal notes")
    
    @validator('status')
    def validate_status(cls, v):
        if v and v not in ['pending', 'confirmed', 'cancelled', 'completed']:
            raise ValueError("status must be 'pending', 'confirmed', 'cancelled', or 'completed'")
        return v


@router.post("/appointments")
async def create_appointment_request(
    request: AppointmentRequestCreate,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new appointment or contact request. Works for both authenticated and anonymous users.
    
    If confirm=False (default), returns a preview without saving to database.
    If confirm=True, saves to database and sends emails.
    """
    if not DB_AVAILABLE or AppointmentRequest is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Parse preferred_date if provided
        preferred_date_obj = None
        if request.preferred_date:
            try:
                preferred_date_obj = datetime.fromisoformat(request.preferred_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")
        
        # If not confirmed, return preview only
        if not request.confirm:
            preview_data = {
                "name": request.name,
                "email": request.email,
                "phone": request.phone,
                "request_type": request.request_type,
                "subject": request.subject,
                "message": request.message,
                "preferred_date": request.preferred_date,
                "preferred_time": request.preferred_time,
                "user_id": current_user.id if current_user else None,
                "status": "pending"
            }
            
            app_logger.info(
                "Appointment preview requested",
                {
                    "user_id": current_user.id if current_user else None,
                    "request_type": request.request_type,
                    "email": request.email
                }
            )
            
            # Return preview response as JSON
            return JSONResponse(
                status_code=200,
                content={
                    "preview": preview_data,
                    "requires_confirmation": True,
                    "message": "Please review the appointment details and confirm to submit.",
                    "confirmed": False
                }
            )
        
        # Confirmed - save to database
        appointment = AppointmentRequest(
            user_id=current_user.id if current_user else None,
            name=request.name,
            email=request.email,
            phone=request.phone,
            request_type=request.request_type,
            subject=request.subject,
            message=request.message,
            preferred_date=preferred_date_obj,
            preferred_time=request.preferred_time,
            status="pending"
        )
        
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        
        app_logger.info(
            "Appointment request created",
            {
                "id": appointment.id,
                "user_id": appointment.user_id,
                "request_type": appointment.request_type,
                "email": appointment.email
            }
        )
        
        # Schedule email notifications in background
        preferred_date_str = request.preferred_date if request.preferred_date else None
        background_tasks.add_task(
            send_appointment_emails,
            appointment_id=appointment.id,
            name=request.name,
            email=request.email,
            phone=request.phone,
            request_type=request.request_type,
            subject=request.subject,
            message=request.message,
            preferred_date=preferred_date_str,
            preferred_time=request.preferred_time,
            user_id=current_user.id if current_user else None
        )
        
        # Return confirmed appointment response
        return JSONResponse(
            status_code=201,
            content={
                **appointment.to_dict(),
                "confirmed": True,
                "message": "Appointment request created successfully!"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error("Error creating appointment request", {"error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while creating the appointment request")


@router.post("/appointments/confirm", response_model=AppointmentRequestResponse)
async def confirm_appointment_request(
    request: AppointmentConfirmationRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirm and save an appointment request after preview.
    This endpoint saves the appointment to the database and sends emails.
    """
    if not DB_AVAILABLE or AppointmentRequest is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        # Parse preferred_date if provided
        preferred_date_obj = None
        if request.preferred_date:
            try:
                preferred_date_obj = datetime.fromisoformat(request.preferred_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DDTHH:MM:SS)")
        
        # Save to database
        appointment = AppointmentRequest(
            user_id=current_user.id if current_user else None,
            name=request.name,
            email=request.email,
            phone=request.phone,
            request_type=request.request_type,
            subject=request.subject,
            message=request.message,
            preferred_date=preferred_date_obj,
            preferred_time=request.preferred_time,
            status="pending"
        )
        
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        
        app_logger.info(
            "Appointment request confirmed and created",
            {
                "id": appointment.id,
                "user_id": appointment.user_id,
                "request_type": appointment.request_type,
                "email": appointment.email
            }
        )
        
        # Schedule email notifications in background
        preferred_date_str = request.preferred_date if request.preferred_date else None
        background_tasks.add_task(
            send_appointment_emails,
            appointment_id=appointment.id,
            name=request.name,
            email=request.email,
            phone=request.phone,
            request_type=request.request_type,
            subject=request.subject,
            message=request.message,
            preferred_date=preferred_date_str,
            preferred_time=request.preferred_time,
            user_id=current_user.id if current_user else None
        )
        
        return appointment.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        app_logger.error("Error confirming appointment request", {"error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while confirming the appointment request")


@router.get("/appointments", response_model=List[AppointmentRequestResponse])
async def list_appointment_requests(
    current_user: User = Depends(get_current_active_user),
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List appointment requests. Admin users see all, regular users see only their own."""
    if not DB_AVAILABLE or AppointmentRequest is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        query = db.query(AppointmentRequest)
        
        # Regular users only see their own requests
        # Admin users (you can add admin check here) see all
        # For now, users see their own + anonymous requests
        query = query.filter(
            (AppointmentRequest.user_id == current_user.id) | (AppointmentRequest.user_id.is_(None))
        )
        
        if status:
            query = query.filter(AppointmentRequest.status == status)
        if request_type:
            query = query.filter(AppointmentRequest.request_type == request_type)
        
        appointments = query.order_by(AppointmentRequest.created_at.desc()).all()
        return [app.to_dict() for app in appointments]
    except Exception as e:
        app_logger.error("Error listing appointment requests", {"error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while listing appointment requests")


@router.get("/appointments/{appointment_id}", response_model=AppointmentRequestResponse)
async def get_appointment_request(
    appointment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific appointment request by ID."""
    if not DB_AVAILABLE or AppointmentRequest is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    appointment = db.query(AppointmentRequest).filter(AppointmentRequest.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment request not found")
    
    # Users can only see their own requests or anonymous requests
    if appointment.user_id and appointment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this appointment request")
    
    return appointment.to_dict()


@router.put("/appointments/{appointment_id}", response_model=AppointmentRequestResponse)
async def update_appointment_request(
    appointment_id: int,
    update: AppointmentRequestUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update an appointment request (status, notes)."""
    if not DB_AVAILABLE or AppointmentRequest is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    appointment = db.query(AppointmentRequest).filter(AppointmentRequest.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment request not found")
    
    # Users can only update their own requests
    if appointment.user_id and appointment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this appointment request")
    
    try:
        if update.status:
            appointment.status = update.status
        if update.notes is not None:
            appointment.notes = update.notes
        
        db.commit()
        db.refresh(appointment)
        
        app_logger.info(
            "Appointment request updated",
            {
                "id": appointment.id,
                "status": appointment.status,
                "user_id": current_user.id
            }
        )
        
        return appointment.to_dict()
    except Exception as e:
        db.rollback()
        app_logger.error("Error updating appointment request", {"error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while updating the appointment request")


@router.delete("/appointments/{appointment_id}")
async def delete_appointment_request(
    appointment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete an appointment request."""
    if not DB_AVAILABLE or AppointmentRequest is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    appointment = db.query(AppointmentRequest).filter(AppointmentRequest.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment request not found")
    
    # Users can only delete their own requests
    if appointment.user_id and appointment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this appointment request")
    
    try:
        db.delete(appointment)
        db.commit()
        
        app_logger.info(
            "Appointment request deleted",
            {
                "id": appointment_id,
                "user_id": current_user.id
            }
        )
        
        return {"status": "success", "message": "Appointment request deleted successfully"}
    except Exception as e:
        db.rollback()
        app_logger.error("Error deleting appointment request", {"error": str(e)}, exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while deleting the appointment request")

