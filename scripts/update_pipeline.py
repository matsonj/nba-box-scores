#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path
from typing import List, Optional

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from lib.error_handler import ErrorHandler

class PipelineExecutor:
    def __init__(self):
        self.error_handler = ErrorHandler("update_pipeline")
        self.root_dir = Path(__file__).parent.parent

    def run_command(self, command: List[str], step_name: str) -> None:
        """Run a command and handle any errors."""
        try:
            print(f"\nExecuting {step_name}...")
            result = subprocess.run(
                command,
                cwd=self.root_dir,
                check=True,
                capture_output=True,
                text=True
            )
            print(result.stdout)
            if result.stderr:
                print(result.stderr, file=sys.stderr)
        except subprocess.CalledProcessError as e:
            self.error_handler.log_error(
                e,
                {
                    "step": step_name,
                    "command": " ".join(command),
                    "stdout": e.stdout,
                    "stderr": e.stderr,
                    "return_code": e.returncode
                }
            )

    def execute_pipeline(self) -> None:
        """Execute the full data pipeline."""
        steps = [
            {
                "name": "Fetch Schedule",
                "command": ["npm", "run", "fetch-schedule"]
            },
            {
                "name": "Load Schedule",
                "command": ["bash", "scripts/load-schedule.sh"]
            },
            {
                "name": "Fetch Box Scores",
                "command": ["npm", "run", "fetch-box-scores"]
            },
            {
                "name": "Load Box Scores",
                "command": ["bash", "scripts/load-box-scores.sh"]
            }
        ]

        print("Starting data update process...")
        for step in steps:
            self.run_command(step["command"], step["name"])
        print("\nData update process completed successfully!")

if __name__ == "__main__":
    try:
        pipeline = PipelineExecutor()
        pipeline.execute_pipeline()
    except Exception as e:
        error_handler = ErrorHandler("update_pipeline")
        error_handler.log_error(e)
