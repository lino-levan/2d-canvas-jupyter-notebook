from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class Box(BaseModel):
    id: str
    x: float
    y: float
    width: float
    height: float
    content: str
    results: Optional[Dict[str, Any]] = None

class Arrow(BaseModel):
    id: str
    source: str
    target: str

class Workspace(BaseModel):
    boxes: List[Box]
    arrows: List[Arrow]

class Ancestor(BaseModel):
    id: str
    content: str
    results: Optional[Dict[str, Any]] = None

class ExecutionRequest(BaseModel):
    boxId: str
    code: str

class ExecutionResult(BaseModel):
    output: Any
    error: bool = False
