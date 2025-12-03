"""
Email service for sending notifications

Environment Variables Required:
    SMTP_HOST or EMAIL_HOST: SMTP server hostname (default: smtp.gmail.com)
    SMTP_PORT or EMAIL_PORT: SMTP server port (default: 587)
    SMTP_USER or EMAIL_USER: SMTP username/email
    SMTP_PASSWORD or EMAIL_PASSWORD: SMTP password or app password
    SMTP_FROM_EMAIL or EMAIL_FROM: From email address (defaults to SMTP_USER)
    CONTACT_EMAIL or ADMIN_EMAIL or EMAIL_ADMIN: Admin email for notifications (default: admin@dosibridge.com)

Example .env configuration:
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=your-email@gmail.com
    SMTP_PASSWORD=your-app-password
    SMTP_FROM_EMAIL=noreply@dosibridge.com
    CONTACT_EMAIL=admin@dosibridge.com

Note: For Gmail, you need to:
    1. Enable 2-factor authentication
    2. Generate an App Password: https://myaccount.google.com/apppasswords
    3. Use the app password as SMTP_PASSWORD
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
from src.utils.logger import app_logger

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, use environment variables directly


class EmailService:
    """Service for sending emails via SMTP"""
    
    def __init__(self):
        # Load SMTP configuration from environment variables
        # Support both SMTP_* and EMAIL_* prefixes for flexibility
        self.smtp_host = os.getenv("SMTP_HOST") or os.getenv("EMAIL_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT") or os.getenv("EMAIL_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER") or os.getenv("EMAIL_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD") or os.getenv("EMAIL_PASSWORD", "")
        # Set from_email after smtp_user is defined
        self.from_email = os.getenv("SMTP_FROM_EMAIL") or os.getenv("EMAIL_FROM") or self.smtp_user
        # Support CONTACT_EMAIL, ADMIN_EMAIL, or EMAIL_ADMIN for admin notifications
        self.admin_email = (
            os.getenv("CONTACT_EMAIL") or 
            os.getenv("ADMIN_EMAIL") or 
            os.getenv("EMAIL_ADMIN", "admin@dosibridge.com")
        )
        
        # Check if email service is enabled
        self.enabled = bool(self.smtp_user and self.smtp_password)
        
        if not self.enabled:
            app_logger.warning(
                "Email service disabled",
                {
                    "reason": "SMTP credentials not configured",
                    "smtp_user_set": bool(self.smtp_user),
                    "smtp_password_set": bool(self.smtp_password),
                    "smtp_host": self.smtp_host,
                    "smtp_port": self.smtp_port
                }
            )
        else:
            app_logger.info(
                "Email service initialized",
                {
                    "smtp_host": self.smtp_host,
                    "smtp_port": self.smtp_port,
                    "from_email": self.from_email,
                    "admin_email": self.admin_email,
                    "smtp_user": self.smtp_user[:3] + "***" if self.smtp_user else None
                }
            )
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        cc: Optional[List[str]] = None
    ) -> bool:
        """
        Send an email
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional)
            cc: List of CC email addresses (optional)
        
        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.enabled:
            app_logger.info(
                "Email not sent (email service disabled)",
                {"to": to_email, "subject": subject}
            )
            return False
        
        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = to_email
            if cc:
                msg["Cc"] = ", ".join(cc)
            
            # Add text and HTML parts
            if text_body:
                text_part = MIMEText(text_body, "plain")
                msg.attach(text_part)
            
            html_part = MIMEText(html_body, "html")
            msg.attach(html_part)
            
            # Send email - handle both TLS (587) and SSL (465) connections
            if self.smtp_port == 465:
                # SSL connection for port 465
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                    server.login(self.smtp_user, self.smtp_password)
                    recipients = [to_email]
                    if cc:
                        recipients.extend(cc)
                    server.send_message(msg, to_addrs=recipients)
            else:
                # TLS connection for port 587 or others
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    recipients = [to_email]
                    if cc:
                        recipients.extend(cc)
                    server.send_message(msg, to_addrs=recipients)
            
            app_logger.info(
                "Email sent successfully",
                {"to": to_email, "subject": subject}
            )
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            app_logger.error(
                "SMTP authentication failed",
                {
                    "to": to_email,
                    "subject": subject,
                    "error": str(e),
                    "smtp_host": self.smtp_host,
                    "smtp_port": self.smtp_port,
                    "smtp_user": self.smtp_user
                },
                exc_info=True
            )
            return False
        except smtplib.SMTPException as e:
            app_logger.error(
                "SMTP error occurred",
                {
                    "to": to_email,
                    "subject": subject,
                    "error": str(e),
                    "smtp_host": self.smtp_host,
                    "smtp_port": self.smtp_port
                },
                exc_info=True
            )
            return False
        except Exception as e:
            app_logger.error(
                "Failed to send email",
                {
                    "to": to_email,
                    "subject": subject,
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "smtp_host": self.smtp_host,
                    "smtp_port": self.smtp_port
                },
                exc_info=True
            )
            return False
    
    def send_appointment_confirmation(
        self,
        to_email: str,
        to_name: str,
        appointment_id: int,
        request_type: str,
        preferred_date: Optional[str] = None,
        preferred_time: Optional[str] = None
    ) -> bool:
        """
        Send appointment confirmation email to the user
        
        Args:
            to_email: User's email address
            to_name: User's name
            appointment_id: Appointment request ID
            request_type: Type of request (appointment, contact, support)
            preferred_date: Preferred date (optional)
            preferred_time: Preferred time (optional)
        
        Returns:
            True if email sent successfully, False otherwise
        """
        request_type_label = {
            "appointment": "Appointment",
            "contact": "Contact Request",
            "support": "Support Request"
        }.get(request_type, "Request")
        
        subject = f"✅ {request_type_label} Confirmation - DOSIBridge"
        
        # Build HTML body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }}
                .info-box {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4F46E5; border-radius: 4px; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>DOSIBridge</h1>
                </div>
                <div class="content">
                    <h2>Thank you, {to_name}!</h2>
                    <p>We've received your {request_type_label.lower()} and will get back to you soon.</p>
                    
                    <div class="info-box">
                        <strong>Request ID:</strong> #{appointment_id}<br>
                        <strong>Type:</strong> {request_type_label}
                        {f'<br><strong>Preferred Date:</strong> {preferred_date}' if preferred_date else ''}
                        {f'<br><strong>Preferred Time:</strong> {preferred_time}' if preferred_time else ''}
                    </div>
                    
                    <p>Our team will review your request and contact you at <strong>{to_email}</strong> within 24-48 hours.</p>
                    
                    <p>If you have any urgent questions, please don't hesitate to reach out to us directly.</p>
                </div>
                <div class="footer">
                    <p>© 2025 DOSIBridge. All rights reserved.</p>
                    <p>This is an automated confirmation email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_body = f"""
Thank you, {to_name}!

We've received your {request_type_label.lower()} and will get back to you soon.

Request ID: #{appointment_id}
Type: {request_type_label}
{f'Preferred Date: {preferred_date}' if preferred_date else ''}
{f'Preferred Time: {preferred_time}' if preferred_time else ''}

Our team will review your request and contact you at {to_email} within 24-48 hours.

If you have any urgent questions, please don't hesitate to reach out to us directly.

© 2025 DOSIBridge. All rights reserved.
This is an automated confirmation email.
        """
        
        return self.send_email(to_email, subject, html_body, text_body)
    
    def send_appointment_notification_to_team(
        self,
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
    ) -> bool:
        """
        Send notification email to DOSIBridge team about new appointment request
        
        Args:
            appointment_id: Appointment request ID
            name: Contact person's name
            email: Contact email
            phone: Contact phone (optional)
            request_type: Type of request
            subject: Request subject (optional)
            message: Request message
            preferred_date: Preferred date (optional)
            preferred_time: Preferred time (optional)
            user_id: User ID if authenticated (optional)
        
        Returns:
            True if email sent successfully, False otherwise
        """
        request_type_label = {
            "appointment": "Appointment",
            "contact": "Contact Request",
            "support": "Support Request"
        }.get(request_type, "Request")
        
        subject_line = f"🔔 New {request_type_label}: {name} - Request #{appointment_id}"
        
        # Build HTML body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #DC2626; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }}
                .info-box {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #DC2626; border-radius: 4px; }}
                .message-box {{ background-color: #fef2f2; padding: 15px; margin: 15px 0; border-radius: 4px; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New {request_type_label}</h1>
                </div>
                <div class="content">
                    <h2>Request #{appointment_id}</h2>
                    
                    <div class="info-box">
                        <strong>Name:</strong> {name}<br>
                        <strong>Email:</strong> <a href="mailto:{email}">{email}</a><br>
                        {f'<strong>Phone:</strong> {phone}<br>' if phone else ''}
                        <strong>Type:</strong> {request_type_label}
                        {f'<br><strong>Preferred Date:</strong> {preferred_date}' if preferred_date else ''}
                        {f'<br><strong>Preferred Time:</strong> {preferred_time}' if preferred_time else ''}
                        {f'<br><strong>User ID:</strong> {user_id}' if user_id else '<br><strong>User:</strong> Anonymous'}
                    </div>
                    
                    {f'<div class="info-box"><strong>Subject:</strong> {subject}</div>' if subject else ''}
                    
                    <div class="message-box">
                        <strong>Message:</strong><br>
                        {message.replace(chr(10), '<br>')}
                    </div>
                    
                    <p><a href="mailto:{email}">Reply to {name}</a></p>
                </div>
                <div class="footer">
                    <p>DOSIBridge Appointment System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text version
        text_body = f"""
New {request_type_label}: Request #{appointment_id}

Name: {name}
Email: {email}
{f'Phone: {phone}' if phone else ''}
Type: {request_type_label}
{f'Preferred Date: {preferred_date}' if preferred_date else ''}
{f'Preferred Time: {preferred_time}' if preferred_time else ''}
{f'User ID: {user_id}' if user_id else 'User: Anonymous'}

{f'Subject: {subject}' if subject else ''}

Message:
{message}

Reply to: {email}
        """
        
        return self.send_email(self.admin_email, subject_line, html_body, text_body)


# Global email service instance
email_service = EmailService()

