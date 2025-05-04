import { useCallback, useEffect, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
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

// Interface for clipboard data
interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

function App() {
  // ===== STATE DEFINITIONS =====

  // Canvas and ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<"edit" | "create">(
    "edit",
  );
  const [saving, setSaving] = useState(false);

  // Clipboard functionality
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [isInEditor, setIsInEditor] = useState(false);

  // Refs for async operations
  const saveTimeoutRef = useRef<number | null>(null);
  const nodeRef = useRef<Node[]>([]);
  const edgeRef = useRef<Edge[]>([]);

  // ===== FLOW EVENT HANDLERS =====

  /**
   * Handle connections between nodes
   */
  const onConnect = useCallback(
    (params) => {
      // Check for circular dependencies
      if (
        LinkingManager.isCircularDependency(params.source, params.target, edges)
      ) {
        setError("Cannot create circular dependency");
        return;
      }

      // Check for duplicate connections
      if (
        LinkingManager.isDuplicateArrow(params.source, params.target, edges)
      ) {
        setError("Connection already exists");
        return;
      }

      // Add the new edge with our custom styling
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "bezier",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
            style: { stroke: "#3498db" },
            id: LinkingManager.createArrowId(),
          },
          eds,
        )
      );
    },
    [edges, setEdges, setError],
  );

  /**
   * Handle node deletion and remove connected edges
   */
  const onNodesDelete = useCallback(
    (deleted) => {
      // Remove any edges connected to deleted nodes
      setEdges((eds) =>
        eds.filter(
          (e) =>
            !deleted.some(
              (node) => node.id === e.source || node.id === e.target,
            ),
        )
      );
    },
    [setEdges],
  );

  // ===== NODE EVENT HANDLERS =====

  /**
   * Update node content when changed in editor
   */
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

  /**
   * Update node dimensions when resized
   */
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

  /**
   * Track editor focus state to manage clipboard behavior
   */
  const handleEditorFocus = useCallback((isFocused: boolean) => {
    setIsInEditor(isFocused);
  }, []);

  // Update refs for async operations
  useEffect(() => {
    nodeRef.current = nodes;
    edgeRef.current = edges;
  }, [nodes, edges]);

  /**
   * Execute code in a node and update results
   */
  /**
   * Execute code in a node and update results
   */
  const handleExecuteCode = useCallback(
    async (boxId: string, code: string) => {
      try {
        // First, explicitly save the workspace
        const { saveWorkspace, executeCode } = await import("./hooks/useApi");

        // Clear any pending auto-save timeout
        if (saveTimeoutRef.current !== null) {
          window.clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }

        // Transform ReactFlow nodes to backend format
        const boxes = nodeRef.current.map((node) => ({
          id: node.id,
          x: node.position.x,
          y: node.position.y,
          width: node.data.width,
          height: node.data.height,
          content: node.data.content,
          results: node.data.results,
        }));

        // Transform ReactFlow edges to backend format
        const arrows = edgeRef.current.map((edge) => ({
          id: edge.id,
          start: edge.source,
          end: edge.target,
        }));

        // Set saving indicator
        setSaving(true);

        // Save the workspace immediately
        await saveWorkspace({ boxes, arrows });

        // Now execute the code
        const results = await executeCode(boxId, code);
        setSaving(false);

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
        setSaving(false);

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
    },
    [setNodes],
  );

  // ===== NODE CREATION =====

  /**
   * Create a new code box with default settings
   */
  const createNewBox = useCallback(
    (x: number = 50, y: number = 50) => {
      const id = `box-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      return {
        id,
        type: "codeBox",
        position: { x, y },
        dragHandle: ".node-drag-handle",
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
            handleNodeResize(id, width, height),
          onEditorFocus: handleEditorFocus,
        },
        style: { width: 500, height: 400 },
      };
    },
    [
      handleNodeContentChange,
      handleNodeResize,
      handleExecuteCode,
      handleEditorFocus,
    ],
  );

  /**
   * Add new node on canvas click when in create mode
   */
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
    [interactionMode, reactFlowInstance, setNodes, createNewBox],
  );

  // ===== CLIPBOARD OPERATIONS =====

  /**
   * Copy selected nodes and their connecting edges to clipboard
   */
  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);

    if (selectedNodes.length === 0) {
      console.log("No nodes selected to copy");
      return;
    }

    // Get all edges that connect only between the selected nodes
    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const relevantEdges = edges.filter(
      (edge) =>
        selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
    );

    // Store in clipboard
    setClipboard({
      nodes: selectedNodes,
      edges: relevantEdges,
    });

    console.log(
      `Copied ${selectedNodes.length} nodes and ${relevantEdges.length} edges`,
    );
  }, [nodes, edges]);

  /**
   * Cut selected nodes and their connecting edges (copy then delete)
   */
  const handleCut = useCallback(() => {
    // First copy
    handleCopy();

    // Then delete selected nodes
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length > 0) {
      // Handle edge deletion
      onNodesDelete(selectedNodes);

      // Also remove the nodes themselves
      setNodes((prevNodes) =>
        prevNodes.filter(
          (node) =>
            !selectedNodes.some((selectedNode) => selectedNode.id === node.id),
        )
      );
    }
  }, [handleCopy, nodes, onNodesDelete, setNodes]);

  /**
   * Paste previously copied nodes and edges
   */
  const handlePaste = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) {
      console.log("Nothing to paste");
      return;
    }

    // Generate a unique ID mapping for pasted nodes
    const idMapping = new Map<string, string>();
    clipboard.nodes.forEach((node) => {
      idMapping.set(
        node.id,
        `${node.id}-copy-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      );
    });

    // Get current viewport center
    const { x: viewportX, y: viewportY } = reactFlowInstance
      .screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

    // Calculate bounds of selected nodes to find their center
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    clipboard.nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (node.data.width || 0));
      maxY = Math.max(maxY, node.position.y + (node.data.height || 0));
    });

    const selectionCenterX = (minX + maxX) / 2;
    const selectionCenterY = (minY + maxY) / 2;

    // Calculate offset to center nodes around cursor
    const offsetX = viewportX - selectionCenterX;
    const offsetY = viewportY - selectionCenterY;

    // Create new nodes with updated IDs and positions
    const newNodes = clipboard.nodes.map((node) => {
      const newId = idMapping.get(node.id)!;

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY,
        },
        data: {
          ...node.data,
          onExecute: (boxId: string, content: string) =>
            handleExecuteCode(boxId, content),
          onContentChange: (content: string) =>
            handleNodeContentChange(newId, content),
          onResize: (width: number, height: number) =>
            handleNodeResize(newId, width, height),
          onEditorFocus: handleEditorFocus,
        },
        selected: true, // Select newly pasted nodes
      };
    });

    // Create new edges with updated node IDs
    const newEdges = clipboard.edges.map((edge) => {
      const newSourceId = idMapping.get(edge.source)!;
      const newTargetId = idMapping.get(edge.target)!;

      return {
        ...edge,
        id: LinkingManager.createArrowId(),
        source: newSourceId,
        target: newTargetId,
        selected: true, // Select newly pasted edges
      };
    });

    // Add new nodes and edges to the flow
    setNodes((prevNodes) => {
      // First deselect all existing nodes
      const updatedNodes = prevNodes.map((node) => ({
        ...node,
        selected: false,
      }));
      return [...updatedNodes, ...newNodes];
    });

    setEdges((prevEdges) => {
      // First deselect all existing edges
      const updatedEdges = prevEdges.map((edge) => ({
        ...edge,
        selected: false,
      }));
      return [...updatedEdges, ...newEdges];
    });

    console.log(`Pasted ${newNodes.length} nodes and ${newEdges.length} edges`);
  }, [
    clipboard,
    reactFlowInstance,
    setNodes,
    setEdges,
    handleNodeContentChange,
    handleNodeResize,
    handleExecuteCode,
    handleEditorFocus,
  ]);

  // Handle keyboard shortcuts for clipboard operations
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if we're focused in an editor - this prevents breaking normal copy/paste in text
      if (isInEditor) {
        return;
      }

      // Only handle events from document body or flow container, not from the editor
      const target = event.target as HTMLElement;
      if (target.closest(".monaco-editor")) {
        return;
      }

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case "c": // Copy
            handleCopy();
            break;
          case "x": // Cut
            handleCut();
            break;
          case "v": // Paste
            handlePaste();
            break;
          default:
            return; // Don't prevent default for other key combinations
        }

        // Only prevent default if we're handling the event
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [nodes, edges, clipboard, isInEditor, handleCopy, handleCut, handlePaste]);

  // ===== UI HELPERS =====

  /**
   * Get UI message based on current interaction mode
   */
  const getModeInfoMessage = useCallback(() => {
    switch (interactionMode) {
      case "create":
        return "Click anywhere on canvas to create a new box";
      case "edit":
        return "Drag to move nodes, interact with boxes to edit content";
      default:
        return null;
    }
  }, [interactionMode]);

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
          dragHandle: ".node-drag-handle",
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
              handleNodeResize(box.id, width, height),
            onEditorFocus: handleEditorFocus,
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
  }, [
    setNodes,
    setEdges,
    handleNodeContentChange,
    handleNodeResize,
    handleExecuteCode,
    handleEditorFocus,
    createNewBox,
  ]);

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
