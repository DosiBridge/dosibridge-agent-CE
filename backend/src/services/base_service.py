"""
Base service class for common service functionality
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from src.utils.logger import app_logger


class BaseService:
    """Base service class with common functionality"""
    
    @staticmethod
    def log_operation(operation: str, context: Optional[Dict[str, Any]] = None):
        """Log an operation with context"""
        app_logger.info(operation, context or {})
    
    @staticmethod
    def log_error(operation: str, error: Exception, context: Optional[Dict[str, Any]] = None):
        """Log an error with context"""
        app_logger.error(
            operation,
            {**(context or {}), "error": str(error)},
            exc_info=True
        )
    
    @staticmethod
    def validate_db_session(db: Optional[Session], operation: str) -> bool:
        """Validate database session is available"""
        if db is None:
            app_logger.warning(f"{operation} attempted without database session")
            return False
        return True
    
    @staticmethod
    def safe_db_operation(operation_name: str, db: Optional[Session], operation_func):
        """Safely execute a database operation with error handling"""
        try:
            if not BaseService.validate_db_session(db, operation_name):
                return None
            return operation_func(db)
        except Exception as e:
            BaseService.log_error(operation_name, e)
            if db:
                db.rollback()
            raise

