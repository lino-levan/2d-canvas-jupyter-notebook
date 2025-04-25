import sys
import io
import traceback
import json
import base64
import ast
from typing import Dict, Any, List, Tuple
from contextlib import redirect_stdout, redirect_stderr

from models import Ancestor

# Import and configure matplotlib at module level
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

class CodeExecutor:
    def __init__(self):
        self.global_env = {}
        
    def reset_environment(self):
        """Reset the execution environment."""
        self.global_env = {}
        
    def prepare_environment(self, ancestors: List[Ancestor]):
        """Prepare the execution environment by running ancestor code."""
        # Reset environment first
        self.reset_environment()
        
        # Execute each ancestor code in order
        for ancestor in ancestors:
            try:
                self._execute_code(ancestor.content, self.global_env)
            except Exception as e:
                print(f"Warning: Ancestor {ancestor.id} execution failed: {str(e)}")
                
        return self.global_env
        
    def execute(self, code: str, ancestors: List[Ancestor] = None) -> Dict[str, Any]:
        """Execute the provided Python code with the given ancestors."""
        if ancestors:
            # Prepare environment with ancestors
            env = self.prepare_environment(ancestors)
        else:
            # Start with a fresh environment
            self.reset_environment()
            env = self.global_env
            
        # Execute the code
        try:
            stdout = io.StringIO()
            stderr = io.StringIO()
            
            with redirect_stdout(stdout), redirect_stderr(stderr):
                last_expr = self._execute_code(code, env)
                
            # Get stdout/stderr output
            stdout_output = stdout.getvalue()
            stderr_output = stderr.getvalue()
            
            # Combine stdout and stderr for text output
            text_output = ""
            if stdout_output:
                text_output += stdout_output
            if stderr_output:
                text_output += f"\nError: {stderr_output}"
            
            # Check if the last expression is a matplotlib figure
            if isinstance(last_expr, matplotlib.figure.Figure):
                # Convert figure to PNG
                buf = io.BytesIO()
                last_expr.savefig(buf, format='png', bbox_inches='tight', dpi=100)
                buf.seek(0)
                png_data = buf.getvalue()
                png_base64 = base64.b64encode(png_data).decode('utf-8')
                
                return {
                    "output": {
                        "text_output": text_output.strip() if text_output else None,
                        "data": {"image/png": png_base64}
                    },
                    "error": False
                }
            
            # Check for objects with HTML representation (like pandas DataFrame)
            elif hasattr(last_expr, '_repr_html_'):
                html = last_expr._repr_html_()
                return {
                    "output": {
                        "text_output": text_output.strip() if text_output else None,
                        "data": {"text/html": html, "text/plain": str(last_expr)}
                    },
                    "error": False
                }
            
            # For regular results
            elif last_expr is not None:
                # Handle other objects
                return {
                    "output": {
                        "text_output": text_output.strip() if text_output else None,
                        "data": {"text/plain": str(last_expr)}
                    },
                    "error": False
                }
            
            # No last expression value, just text output
            else:
                return {
                    "output": text_output.strip(),
                    "error": False
                }
            
        except Exception as e:
            # Handle execution errors
            error_msg = f"{type(e).__name__}: {str(e)}\n"
            error_msg += traceback.format_exc()
            return {"output": error_msg, "error": True}
    
    def _execute_code(self, code: str, env: Dict[str, Any]) -> Any:
        """Execute the code and return the result of the last expression if any."""
        # Create a variable to store the last expression result
        env['_last_expr_result'] = None
        
        # Check if the last statement is an expression
        try:
            parsed = ast.parse(code)
            last_node = parsed.body[-1] if parsed.body else None
            
            if isinstance(last_node, ast.Expr):
                # Modify the code to capture the last expression result
                last_line_no = last_node.lineno
                lines = code.splitlines()
                
                # Replace the last expression with an assignment to our special variable
                if last_line_no <= len(lines):
                    last_line = lines[last_line_no - 1]
                    lines[last_line_no - 1] = f"_last_expr_result = {last_line}"
                    modified_code = "\n".join(lines)
                    
                    # Execute the modified code
                    exec(modified_code, env)
                    return env.get('_last_expr_result')
        except:
            # If there's any issue with AST parsing, fall back to normal execution
            pass
        
        # If we couldn't modify the code or it wasn't an expression, execute normally
        exec(code, env)
        return None
