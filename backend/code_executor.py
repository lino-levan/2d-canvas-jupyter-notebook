import sys
import io
import traceback
import json
import base64
import ast
from typing import Dict, Any, List, Tuple, Set
from contextlib import redirect_stdout, redirect_stderr

from models import Ancestor

# Import and configure matplotlib at module level
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt

class CodeExecutor:
    def __init__(self):
        # Cache of execution results to avoid redundant computation
        self.execution_cache = {}

    def reset_cache(self):
        """Reset the execution cache."""
        self.execution_cache = {}

    def execute_with_dependencies(self, box_id: str, code: str, boxes: List[Dict], arrows: List[Dict]) -> Dict[str, Any]:
        """Execute code with dependencies determined from the DAG structure"""
        # Reset cache for new execution
        self.reset_cache()

        # Build the adjacency list (node -> its parents)
        graph = {}
        for box in boxes:
            graph[box['id']] = []

        for arrow in arrows:
            if arrow['end'] in graph:
                graph[arrow['end']].append(arrow['start'])

        # Find the box we're executing
        target_box = next((box for box in boxes if box['id'] == box_id), None)
        if not target_box:
            return {"output": f"Box with ID {box_id} not found", "error": True}

        # Box lookup table for faster access
        box_lookup = {box['id']: box for box in boxes}

        # Execute the box with its full dependency graph
        try:
            # Create execution environment by traversing the DAG
            env = self._execute_dag_node(box_id, graph, box_lookup, set())

            # Execute the target box with the prepared environment
            return self._execute_box_code(target_box['content'], env)
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}\n"
            error_msg += traceback.format_exc()
            return {"output": error_msg, "error": True}

    def _execute_dag_node(self, node_id: str, graph: Dict[str, List[str]],
                          box_lookup: Dict[str, Dict], visited: Set[str]) -> Dict[str, Any]:
        """Recursively execute a node in the DAG and return its environment."""
        # Check if we've already executed this node
        if node_id in self.execution_cache:
            return self.execution_cache[node_id]

        # Detect cycles
        if node_id in visited:
            raise ValueError(f"Cycle detected in dependency graph at node {node_id}")

        visited.add(node_id)

        # Get box content
        if node_id not in box_lookup:
            raise ValueError(f"Box with ID {node_id} not found in graph")

        box = box_lookup[node_id]

        # Get parents of this node
        parents = graph.get(node_id, [])

        # Base case: no parents, start with fresh environment
        if not parents:
            env = {}
            result = self._execute_single_box(box['content'], env)
            self.execution_cache[node_id] = result
            visited.remove(node_id)
            return result

        # Recursive case: merge environments from all parents
        merged_env = {}

        # Execute all parents and merge their environments
        for parent_id in parents:
            parent_env = self._execute_dag_node(parent_id, graph, box_lookup, visited.copy())
            # Update the merged environment with the parent's environment
            # Later parents can override earlier ones if there are conflicts
            merged_env.update(parent_env)

        # Execute this node with the merged environment
        result = self._execute_single_box(box['content'], merged_env)

        # Cache the result
        self.execution_cache[node_id] = result

        # Remove from visited set
        visited.remove(node_id)

        return result

    def _execute_single_box(self, code: str, env: Dict[str, Any]) -> Dict[str, Any]:
        """Execute code in a box with the given environment and return the updated environment."""
        try:
            # Execute the code in the environment
            self._execute_code(code, env)
            return env.copy()  # Return a copy to avoid unintended mutations
        except Exception as e:
            # Log the error but continue execution
            print(f"Warning: Box execution failed: {str(e)}")
            return env.copy()  # Return the unmodified environment

    def _execute_box_code(self, code: str, env: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the box code and return formatted results for the frontend."""
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
