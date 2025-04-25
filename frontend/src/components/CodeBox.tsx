import { useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import { ResizableBox } from "react-resizable";
import Editor from "@monaco-editor/react";
import Results from "./Results";
import { Link, Play, Trash2 } from "lucide-react";
import "react-resizable/css/styles.css";

interface CodeBoxProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  results: any;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onContentChange: (content: string) => void;
  onDelete: () => void;
  onExecute: () => void;
  // Linking props
  interactionMode: string;
  isLinkSource: boolean;
  isLinkTarget: boolean;
  onLinkStart: () => void;
  onLinkEnd: () => void;
  // Scale prop
  scale: number;
}

const CodeBox = ({
  id,
  x,
  y,
  width,
  height,
  content,
  results,
  onMove,
  onResize,
  onContentChange,
  onDelete,
  onExecute,
  interactionMode,
  isLinkSource,
  isLinkTarget,
  onLinkStart,
  onLinkEnd,
  scale = 1,
}: CodeBoxProps) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Local position state for managing drag updates
  const [boxPosition, setBoxPosition] = useState({ x, y });

  // Update local position when props change (but not during drag)
  useEffect(() => {
    if (!isDragging) {
      setBoxPosition({ x, y });
    }
  }, [x, y, isDragging]);

  // Determine interaction mode states
  const isLinkMode = interactionMode === "link";
  const isEditMode = interactionMode === "edit";

  // Whether dragging is allowed (only in edit mode and not when resizing)
  const isDraggingEnabled = isEditMode && !isResizing;

  // Whether editing is allowed (in edit or link mode)
  const isEditable = isEditMode || isLinkMode;

  const handleDragStart = (e: any) => {
    // Stop propagation to prevent panzoom from catching this event
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrag = (e: any, data: { x: number; y: number }) => {
    // Stop propagation to prevent panzoom from catching this event
    e.stopPropagation();

    // Account for scale when updating position
    // This compensates for how react-draggable handles positions when parent is scaled
    setBoxPosition({
      x: data.x,
      y: data.y,
    });
  };

  const handleDragStop = (e: any, data: { x: number; y: number }) => {
    // Stop propagation to prevent panzoom from catching this event
    e.stopPropagation();
    setIsDragging(false);

    // Account for scale when reporting final position
    onMove(data.x, data.y);
  };

  const handleResizeStart = (e: any) => {
    // Stop propagation to prevent panzoom from catching this event
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleResizeStop = (
    e: any,
    { size }: { size: { width: number; height: number } },
  ) => {
    // Stop propagation to prevent panzoom from catching this event
    e.stopPropagation();
    setIsResizing(false);
    onResize(size.width, size.height);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onContentChange(value);
    }
  };

  // Handle link interaction based on whether this box is a source or target
  const handleLinkInteraction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLinkSource) {
      onLinkStart();
    } else if (isLinkTarget) {
      onLinkEnd();
    }
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".box-header"
      position={boxPosition}
      onStart={handleDragStart}
      onDrag={handleDrag}
      onStop={handleDragStop}
      disabled={!isDraggingEnabled}
      // This is critical for scale support - adjust the draggable behavior
      scale={scale}
    >
      <div
        ref={nodeRef}
        className={`absolute bg-white rounded-md shadow-md z-10 overflow-hidden transition-all codebox
          ${isDragging ? "opacity-80 z-20" : ""}
          ${isLinkTarget ? "ring-2 ring-[#3498db]" : ""}
          ${isLinkSource ? "ring-2 ring-[#2ecc71]" : ""}
          hover:shadow-lg`}
        style={{ width: `${width}px`, height: `${height}px` }}
        id={id}
        onMouseDown={(e) => {
          // Prevent canvas events when interacting with box
          e.stopPropagation();
        }}
        onClick={(e) => {
          // Prevent canvas events when clicking box
          e.stopPropagation();
        }}
      >
        <ResizableBox
          width={width}
          height={height}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          minConstraints={[200, 100]}
          maxConstraints={[1000, 1000]}
          resizeHandles={["se"]}
          handle={
            <div
              className={`absolute w-5 h-5 bottom-0 right-0 bg-no-repeat bg-right-bottom cursor-se-resize z-[15] resize-handle ${
                isEditable ? "" : "hidden"
              }`}
              style={{
                backgroundImage:
                  `url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2IiBoZWlnaHQ9IjYiPjxwYXRoIGQ9Ik02IDZIMFYwaDZ2NnoiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iLjE1Ii8+PC9zdmc+')`,
                padding: "0 3px 3px 0",
                backgroundOrigin: "content-box",
                backgroundSize: "8px",
              }}
              onMouseDown={(e) => {
                // Ensure resize events don't trigger panzoom
                e.stopPropagation();
              }}
            />
          }
        >
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center py-2 px-3 bg-[#3498db] text-white cursor-move box-header">
              <div className="font-medium text-sm">Python Code</div>
              {isEditable && (
                <div className="flex gap-1">
                  {isEditMode && (
                    <button
                      className="bg-transparent border-none text-white cursor-pointer flex items-center justify-center w-6 h-6 rounded hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLinkStart();
                      }}
                      title="Connect to another box"
                    >
                      <Link size={16} />
                    </button>
                  )}
                  <button
                    className="bg-transparent border-none text-white cursor-pointer flex items-center justify-center w-6 h-6 rounded hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExecute();
                    }}
                    title="Run code"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    className="bg-transparent border-none text-white cursor-pointer flex items-center justify-center w-6 h-6 rounded hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    title="Delete box"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <div
              className="flex-1 overflow-hidden"
              onMouseDown={(e) => {
                // Prevent canvas events when interacting with editor
                e.stopPropagation();
              }}
            >
              <Editor
                height={`${height - 80}px`}
                defaultLanguage="python"
                value={content}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  automaticLayout: true,
                  readOnly: !isEditable,
                }}
              />
            </div>
            {results && (
              <div className="border-t border-border overflow-auto max-h-[40%]">
                <Results results={results} />
              </div>
            )}
          </div>
        </ResizableBox>

        {/* Connection points - visible in both edit and link modes */}
        {(isEditMode || isLinkMode) && (
          <>
            {/* Top connection point (inputs) */}
            <div
              className={`absolute w-6 h-6 top-[-12px] left-1/2 -translate-x-1/2 z-[16] flex items-center justify-center transition-all connection-point
                ${
                isLinkMode || isLinkTarget
                  ? "opacity-100"
                  : "opacity-0 hover:opacity-70"
              }
                ${isLinkTarget ? "scale-110" : ""}
              `}
              onClick={handleLinkInteraction}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                // Scale the connection point inversely to maintain size
                transform: `translate(-50%, 0) scale(${1 / scale})`,
              }}
            >
              <div className="w-3 h-3 bg-[#3498db] rounded-full cursor-pointer hover:scale-125 hover:bg-[#2980b9]" />
            </div>

            {/* Bottom connection point (outputs) */}
            <div
              className={`absolute w-6 h-6 bottom-[-12px] left-1/2 -translate-x-1/2 z-[16] flex items-center justify-center transition-all connection-point
                ${
                isLinkMode || isLinkSource
                  ? "opacity-100"
                  : "opacity-0 hover:opacity-70"
              }
                ${isLinkSource ? "scale-110" : ""}
              `}
              onClick={handleLinkInteraction}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                // Scale the connection point inversely to maintain size
                transform: `translate(-50%, 0) scale(${1 / scale})`,
              }}
            >
              <div className="w-3 h-3 bg-[#2ecc71] rounded-full cursor-pointer hover:scale-125 hover:bg-[#27ae60]" />
            </div>
          </>
        )}
      </div>
    </Draggable>
  );
};

export default CodeBox;
