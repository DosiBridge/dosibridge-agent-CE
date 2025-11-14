"""
Replace print statements with logger calls
This module provides a helper to migrate from print to logger
"""
import sys
from src.utils.logger import app_logger


class PrintToLogger:
    """Redirect print statements to logger"""
    
    def __init__(self):
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
    
    def write(self, message: str):
        """Write to logger instead of stdout"""
        if message.strip():
            # Determine log level based on message content
            if "❌" in message or "ERROR" in message.upper() or "FAILED" in message.upper():
                app_logger.error(message.strip())
            elif "⚠️" in message or "WARNING" in message.upper() or "WARN" in message.upper():
                app_logger.warning(message.strip())
            elif "✓" in message or "SUCCESS" in message.upper() or "✅" in message:
                app_logger.info(message.strip())
            elif "📝" in message or "📦" in message or "🔧" in message:
                app_logger.info(message.strip())
            else:
                app_logger.debug(message.strip())
    
    def flush(self):
        """Flush (no-op for logger)"""
        pass

