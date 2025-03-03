import json
import logging
import os
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

class ErrorHandler:
    def __init__(self, script_name: str):
        self.script_name = script_name
        self.logs_dir = Path("logs")
        self.logs_dir.mkdir(exist_ok=True)
        
        # Configure logging
        log_file = self.logs_dir / f"{script_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.logger = logging.getLogger(script_name)
        self.logger.setLevel(logging.ERROR)
        
        # Prevent duplicate handlers
        if not self.logger.handlers:
            handler = logging.FileHandler(log_file)
            formatter = logging.Formatter('%(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)

    def capture_metadata(self) -> Dict[str, Any]:
        """Capture metadata about the current execution context."""
        return {
            "timestamp": datetime.now().isoformat(),
            "script_name": self.script_name,
            "python_version": sys.version,
            "working_directory": os.getcwd(),
            "user": os.getenv("USER", "unknown")
        }

    def log_error(self, error: Exception, additional_info: Optional[Dict[str, Any]] = None) -> None:
        """Log error details as JSON and halt execution."""
        tb = traceback.extract_tb(sys.exc_info()[2])
        error_location = f"{tb[-1].filename}:{tb[-1].lineno}"
        
        error_data = {
            **self.capture_metadata(),
            "error_type": error.__class__.__name__,
            "error_message": str(error),
            "error_location": error_location,
            "traceback": traceback.format_exc()
        }
        
        if additional_info:
            error_data.update(additional_info)
            
        self.logger.error(json.dumps(error_data, indent=2))
        self.halt_execution(error_data)

    def halt_execution(self, error_data: Dict[str, Any]) -> None:
        """Halt script execution with error details."""
        print(f"\nError in {self.script_name}:", file=sys.stderr)
        print(f"Type: {error_data['error_type']}", file=sys.stderr)
        print(f"Message: {error_data['error_message']}", file=sys.stderr)
        print(f"Location: {error_data['error_location']}", file=sys.stderr)
        print("\nFull error details have been logged to the logs directory.", file=sys.stderr)
        sys.exit(1)

# Example usage:
if __name__ == "__main__":
    error_handler = ErrorHandler("test_script")
    try:
        # Simulate an error
        raise ValueError("Test error message")
    except Exception as e:
        error_handler.log_error(e, {"additional_context": "test context"})
