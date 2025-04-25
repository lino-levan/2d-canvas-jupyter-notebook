import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { fetchWorkspace, saveWorkspace } from "./hooks/useApi";
import { MousePointer, Plus } from "lucide-react";
import "./styles.css";
import CodeBoxNode from "./components/CodeBoxNode";
import { LinkingManager } from "./utils/LinkingManager";

// Define node types
const nodeTypes = {
  codeBox: CodeBoxNode,
};

function App() {
  // Initialize states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<"edit" | "create">(
    "edit",
  );
  const [saving, setSaving] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  const saveTimeoutRef = useRef<number | null>(null);

  // Handle node content change
  const handleNodeContentChange = useCallback(
    (nodeId: string, newContent: string) => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                content: newContent,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes],
  );

  // Handle node resize - Added this function
  const handleNodeResize = useCallback(
    (nodeId: string, newWidth: number, newHeight: number) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                width: newWidth,
                height: newHeight,
              },
              style: { width: newWidth, height: newHeight },
            };
          }
          return node;
        })
      );
    },
    [setNodes],
  );

  // Load workspace data
  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const workspace = await fetchWorkspace();

        // Transform boxes into ReactFlow nodes format
        const flowNodes = workspace.boxes.map((box) => ({
          id: box.id,
          type: "codeBox",
          position: { x: box.x, y: box.y },
          data: {
            width: box.width,
            height: box.height,
            content: box.content,
            results: box.results,
            onExecute: (boxId: string, content: string) =>
              handleExecuteCode(boxId, content),
            onContentChange: (content: string) =>
              handleNodeContentChange(box.id, content),
            onResize: (width: number, height: number) =>
              handleNodeResize(box.id, width, height), // Added this
          },
          // Set dimensions for proper rendering
          style: { width: box.width, height: box.height },
        }));

        // Transform arrows into ReactFlow edges format
        const flowEdges = workspace.arrows.map((arrow) => ({
          id: arrow.id,
          source: arrow.start,
          target: arrow.end,
          type: "bezier",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
          style: { stroke: "#3498db" },
        }));

        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch (err) {
        console.error("Failed to load workspace:", err);
        setError("Failed to load workspace. Starting with empty canvas.");

        // Initialize with an empty box if no workspace exists
        const newBox = createNewBox();
        setNodes([newBox]);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [setNodes, setEdges]);

  // Save workspace when changes occur (with debounce)
  useEffect(() => {
    if (!loading && nodes.length > 0) {
      // Clear any existing timeout
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      // Set a new timeout for saving
      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          setSaving(true);

          // Transform ReactFlow nodes back to our backend format
          const boxes = nodes.map((node) => ({
            id: node.id,
            x: node.position.x,
            y: node.position.y,
            width: node.data.width,
            height: node.data.height,
            content: node.data.content,
            results: node.data.results,
          }));

          // Transform ReactFlow edges back to our backend format
          const arrows = edges.map((edge) => ({
            id: edge.id,
            start: edge.source,
            end: edge.target,
          }));

          await saveWorkspace({ boxes, arrows });
        } catch (err) {
          console.error("Failed to save workspace:", err);
          setError(
            "Failed to save workspace. Your changes may not be persisted.",
          );
        } finally {
          setSaving(false);
        }
      }, 1000); // Debounce save calls
    }

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, loading]);

  // Handle connections between nodes
  const onConnect = useCallback((params) => {
    // Check for circular dependencies
    if (
      LinkingManager.isCircularDependency(params.source, params.target, edges)
    ) {
      setError("Cannot create circular dependency");
      return;
    }

    // Check for duplicate connections
    if (LinkingManager.isDuplicateArrow(params.source, params.target, edges)) {
      setError("Connection already exists");
      return;
    }

    // Add the new edge with our custom styling
    setEdges((eds) =>
      addEdge({
        ...params,
        type: "bezier",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
        },
        style: { stroke: "#3498db" },
        id: LinkingManager.createArrowId(),
      }, eds)
    );
  }, [edges, setEdges]);

  // Handle adding a new node on canvas click
  const onPaneClick = useCallback(
    (event) => {
      if (interactionMode !== "create") return;

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - (reactFlowBounds?.left || 0),
        y: event.clientY - (reactFlowBounds?.top || 0),
      });

      const newNode = createNewBox(position.x, position.y);
      setNodes((nds) => nds.concat(newNode));
    },
    [interactionMode, reactFlowInstance, setNodes],
  );

  // Create a new box node - Updated with onResize callback
  const createNewBox = (x: number = 50, y: number = 50) => {
    const id = `box-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
      id,
      type: "codeBox",
      position: { x, y },
      data: {
        width: 500,
        height: 400,
        content: '# New Python Code\nprint("Hello, World!")',
        results: null,
        onExecute: (boxId: string, content: string) =>
          handleExecuteCode(boxId, content),
        onContentChange: (content: string) =>
          handleNodeContentChange(id, content),
        onResize: (width: number, height: number) =>
          handleNodeResize(id, width, height), // Added this
      },
      style: { width: 500, height: 400 },
    };
  };

  console.log("HALF", nodes, edges);
  const nodeRef = useRef([]);
  nodeRef.current = nodes;
  const edgeRef = useRef([]);
  edgeRef.current = edges;

  // Execute code in a node
  const handleExecuteCode = useCallback(async (boxId: string, code: string) => {
    const nodes = nodeRef.current;
    const edges = edgeRef.current;
    console.log("HALFSASD", nodes, edges);
    try {
      const { executeCode } = await import("./hooks/useApi");

      // Get ancestors for this box
      const boxNodes = nodes.map((node) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.data.width,
        height: node.data.height,
        content: node.data.content,
        results: node.data.results,
      }));

      const arrowConnections = edges.map((edge) => ({
        id: edge.id,
        start: edge.source,
        end: edge.target,
      }));

      const ancestors = LinkingManager.getAncestors(
        boxId,
        arrowConnections,
        boxNodes,
      );
      const results = await executeCode(boxId, code, ancestors);

      // Update using functional state update
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id === boxId) {
            return {
              ...node,
              data: {
                ...node.data,
                results,
              },
            };
          }
          return node;
        })
      );
    } catch (err: any) {
      console.error("Execution failed:", err);

      // Also update this error handler with functional update
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id === boxId) {
            return {
              ...node,
              data: {
                ...node.data,
                results: {
                  error: true,
                  output: err.message || "Execution failed",
                },
              },
            };
          }
          return node;
        })
      );
    }
  }, [nodes, edges, setNodes]);

  // Handle node deletion
  const onNodesDelete = useCallback((deleted) => {
    // Remove any edges connected to deleted nodes
    setEdges((eds) =>
      eds.filter(
        (e) =>
          !deleted.some((node) => node.id === e.source || node.id === e.target),
      )
    );
  }, [setEdges]);

  // Get info message based on current interaction mode
  const getModeInfoMessage = () => {
    switch (interactionMode) {
      case "create":
        return "Click anywhere on canvas to create a new box";
      case "edit":
        return "Drag to move nodes, interact with boxes to edit content";
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin">
          </div>
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex justify-between items-center p-2.5 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex gap-1">
          <button
            className={`flex items-center gap-2 border-none py-2 px-3 rounded cursor-pointer transition ${
              interactionMode === "edit"
                ? "bg-blue-100 text-primary"
                : "bg-transparent text-gray-600 hover:bg-blue-50"
            }`}
            onClick={() => setInteractionMode("edit")}
            title="Edit mode"
          >
            <MousePointer size={18} />
            <span className="text-sm md:block hidden">Edit</span>
          </button>
          <button
            className={`flex items-center gap-2 border-none py-2 px-3 rounded cursor-pointer transition ${
              interactionMode === "create"
                ? "bg-blue-100 text-primary"
                : "bg-transparent text-gray-600 hover:bg-blue-50"
            }`}
            onClick={() => setInteractionMode("create")}
            title="Create mode"
          >
            <Plus size={18} />
            <span className="text-sm md:block hidden">Create Box</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50/50 px-3 py-1.5 rounded">
            {getModeInfoMessage()}
          </div>

          {saving && (
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin">
              </div>
              <span>Saving...</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 px-4 py-3 mb-2">
          <div className="flex">
            <div className="py-1">
              <svg
                className="h-6 w-6 text-red-500 mr-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-red-700 text-sm">{error}</p>
              <button
                className="text-xs text-red-600 underline mt-1"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onNodesDelete={onNodesDelete}
          nodeTypes={nodeTypes}
          deleteKeyCode={"Backspace"}
          multiSelectionKeyCode={"Control"}
          selectionOnDrag={interactionMode === "edit"}
          panOnDrag={interactionMode !== "create"}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ stroke: "#3498db" }}
          snapToGrid={true}
          snapGrid={[20, 20]}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#aaa" gap={20} variant={BackgroundVariant.Dots} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              if (node.data?.results?.error) return "#ff0072";
              return "#3498db";
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function WrappedApp() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}
