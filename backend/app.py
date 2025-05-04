import os
import json
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import jsonpickle

from models import Workspace, ExecutionRequest, ExecutionResult
from code_executor import CodeExecutor

# Initialize FastAPI app
app = FastAPI(title="2D Canvas Jupyter")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize code executor
executor = CodeExecutor()

# Define storage path
STORAGE_DIR = "storage"
WORKSPACE_FILE = os.path.join(STORAGE_DIR, "workspace.json")

# Ensure storage directory exists
os.makedirs(STORAGE_DIR, exist_ok=True)

# Helper functions
def save_workspace_to_file(workspace: Dict[str, Any]) -> None:
    """Save workspace data to file"""
    with open(WORKSPACE_FILE, "w") as f:
        # Use jsonpickle to handle complex objects
        json.dump(workspace, f, indent=2)

def load_workspace_from_file() -> Dict[str, Any]:
    """Load workspace data from file"""
    try:
        with open(WORKSPACE_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # Return empty workspace if file doesn't exist or is invalid
        return {"boxes": [], "arrows": []}

# API Endpoints
@app.get("/")
async def read_root():
    return {"message": "2D Canvas Jupyter API"}

@app.get("/workspace", response_model=Workspace)
async def get_workspace():
    """Get the current workspace"""
    return load_workspace_from_file()

@app.post("/workspace", response_model=Dict[str, str])
async def update_workspace(workspace: Workspace):
    """Update the workspace"""
    save_workspace_to_file(workspace.dict())
    return {"status": "success"}

@app.post("/execute", response_model=ExecutionResult)
async def execute_code(request: ExecutionRequest):
    """Execute Python code"""
    try:
        # Load current workspace
        workspace = load_workspace_from_file()

        # Execute the code
        result = executor.execute_with_dependencies(
            request.boxId,
            request.code,
            workspace["boxes"],
            workspace["arrows"]
        )
        return result
    except Exception as e:
        # Return error information
        return ExecutionResult(output=str(e), error=True)

# Start the server if running as a script
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
