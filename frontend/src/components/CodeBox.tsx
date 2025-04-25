import { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import Editor from '@monaco-editor/react';
import Results from './Results';
import { Play, Link, Trash2 } from 'lucide-react';
import 'react-resizable/css/styles.css';

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
  // New linking props
  interactionMode: string;
  isLinkSource: boolean;
  isLinkTarget: boolean;
  onLinkStart: () => void;
  onLinkEnd: () => void;
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
  onLinkEnd
}: CodeBoxProps) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // Determine if in link mode or select mode
  const isLinkMode = interactionMode === 'link';
  const isSelectMode = interactionMode === 'select';
  
  // Whether dragging is allowed (only in select mode and not when resizing)
  const isDraggingEnabled = isSelectMode && !isResizing;
  
  // Whether editing is allowed (in select or link mode)
  const isEditable = isSelectMode || isLinkMode;

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDragStop = (e: any, data: { x: number; y: number }) => {
    setIsDragging(false);
    onMove(data.x, data.y);
  };

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  const handleResizeStop = (e: any, { size }: { size: { width: number; height: number } }) => {
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
      position={{ x, y }}
      onStart={handleDragStart}
      onStop={handleDragStop}
      disabled={!isDraggingEnabled}
    >
      <div
        ref={nodeRef}
        className={`absolute bg-white rounded-md shadow-md z-10 overflow-hidden transition-all 
          ${isDragging ? 'opacity-80 z-20' : ''}
          ${isLinkTarget ? 'ring-2 ring-[#3498db]' : ''}
          ${isLinkSource ? 'ring-2 ring-[#2ecc71]' : ''}
          hover:shadow-lg`}
        style={{ width: `${width}px`, height: `${height}px` }}
        id={id}
      >
        <ResizableBox
          width={width}
          height={height}
          onResizeStart={handleResizeStart}
          onResizeStop={handleResizeStop}
          minConstraints={[200, 100]}
          maxConstraints={[1000, 1000]}
          resizeHandles={['se']}
          handle={
            <div 
              className={`absolute w-5 h-5 bottom-0 right-0 bg-no-repeat bg-right-bottom cursor-se-resize z-[15] ${
                isEditable ? '' : 'hidden'
              }`}
              style={{
                backgroundImage: `url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2IiBoZWlnaHQ9IjYiPjxwYXRoIGQ9Ik02IDZIMFYwaDZ2NnoiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iLjE1Ii8+PC9zdmc+')`,
                padding: '0 3px 3px 0',
                backgroundOrigin: 'content-box',
                backgroundSize: '8px'
              }}
            />
          }
        >
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center py-2 px-3 bg-[#3498db] text-white cursor-move box-header">
              <div className="font-medium text-sm">Python Code</div>
              {isEditable && (
                <div className="flex gap-1">
                  {isSelectMode && (
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
            <div className="flex-1 overflow-hidden">
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
                  readOnly: !isEditable
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
        
        {/* Connection points - visible in both select and link modes */}
        {(isSelectMode || isLinkMode) && (
          <>
            {/* Top connection point (inputs) */}
            <div 
              className={`absolute w-6 h-6 top-[-12px] left-1/2 -translate-x-1/2 z-[16] flex items-center justify-center transition-all
                ${isLinkMode || isLinkTarget ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}
                ${isLinkTarget ? 'scale-110' : ''}
              `}
              onClick={handleLinkInteraction}
            >
              <div className="w-3 h-3 bg-[#3498db] rounded-full cursor-pointer hover:scale-125 hover:bg-[#2980b9]" />
            </div>
            
            {/* Bottom connection point (outputs) */}
            <div 
              className={`absolute w-6 h-6 bottom-[-12px] left-1/2 -translate-x-1/2 z-[16] flex items-center justify-center transition-all
                ${isLinkMode || isLinkSource ? 'opacity-100' : 'opacity-0 group-hover:opacity-70'}
                ${isLinkSource ? 'scale-110' : ''}
              `}
              onClick={handleLinkInteraction}
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
