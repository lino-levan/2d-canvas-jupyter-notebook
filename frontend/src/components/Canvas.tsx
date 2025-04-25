import { useRef, useEffect, forwardRef, useState } from 'react';
import CodeBox from './CodeBox';
import Arrow from './Arrow';
import panzoom from 'panzoom';
import { InteractionMode } from './ModeSelector';
import { LinkingManager, LinkingState } from '../utils/LinkingManager';
import { Link2Off } from 'lucide-react';

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  results: any;
}

interface ArrowConnection {
  id: string;
  start: string;
  end: string;
}

interface CanvasProps {
  boxes: Box[];
  arrows: ArrowConnection[];
  interactionMode: InteractionMode;
  onAddBox: (x: number, y: number) => void;
  onUpdateBox: (id: string, updates: any) => void;
  onDeleteBox: (id: string) => void;
  onAddArrow: (start: string, end: string) => void;
  onDeleteArrow: (id: string) => void;
}

const Canvas = forwardRef<HTMLDivElement, CanvasProps>(({
  boxes,
  arrows,
  interactionMode,
  onAddBox,
  onUpdateBox,
  onDeleteBox,
  onAddArrow,
  onDeleteArrow
}, ref) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<any>(null);
  
  // Track the current scale of the canvas
  const [currentScale, setCurrentScale] = useState<number>(1);
  
  // Linking state
  const [linking, setLinking] = useState<LinkingState>({
    isActive: false,
    sourceBoxId: null,
    tempLineCoords: null
  });
  
  // Mouse position for drawing temporary line
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Track link error message
  const [linkError, setLinkError] = useState<string | null>(null);
  
  // Clear error after a timeout
  useEffect(() => {
    if (linkError) {
      const timer = setTimeout(() => setLinkError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [linkError]);

  // Initialize PanZoom and set up scale listener
  useEffect(() => {
    if (canvasRef.current) {
      if (panZoomRef.current) {
        panZoomRef.current.dispose();
      }
      
      panZoomRef.current = panzoom(canvasRef.current, {
        maxZoom: 5,
        minZoom: 0.1,
        zoomSpeed: 0.1,
        bounds: true,
        boundsPadding: 0.1
      });

      // Add event listener for zoom changes
      panZoomRef.current.on('zoom', (e: any) => {
        // Update the current scale state
        const transform = panZoomRef.current.getTransform();
        setCurrentScale(transform.scale);
      });

      // Set initial scale
      const transform = panZoomRef.current.getTransform();
      setCurrentScale(transform.scale);

      // Center the canvas
      const canvas = canvasRef.current;
      const parent = canvas.parentElement;
      if (parent) {
        panZoomRef.current.moveTo(
          parent.clientWidth / 2 - canvas.clientWidth / 2,
          parent.clientHeight / 2 - canvas.clientHeight / 2
        );
      }

      return () => {
        if (panZoomRef.current) {
          panZoomRef.current.dispose();
        }
      };
    }
  }, []);

  // Update panzoom state when interaction mode changes
  useEffect(() => {
    if (panZoomRef.current) {
      if (interactionMode === 'move') {
        panZoomRef.current.resume();
      } else {
        panZoomRef.current.pause();
      }
    }
    
    // Reset linking state when switching out of link mode
    if (interactionMode !== 'link' && linking.isActive) {
      resetLinking();
    }
    
    // When switching to link mode, prepare for linking
    if (interactionMode === 'link' && !linking.isActive) {
      setLinking({
        ...linking,
        isActive: true
      });
    }
  }, [interactionMode]);

  // Add keyboard handlers for linking (Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && linking.isActive) {
        resetLinking();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [linking]);

  // Handle mouse movement for drawing the temporary connection line
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (linking.isActive && linking.sourceBoxId && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const transform = panZoomRef.current.getTransform();
        
        // Apply the inverse of the transform to get the correct canvas coordinates
        const x = (e.clientX - rect.left) / transform.scale;
        const y = (e.clientY - rect.top) / transform.scale;
        
        setMousePosition({ x, y });
        
        // Update the temporary line
        const sourceBox = boxes.find(box => box.id === linking.sourceBoxId);
        if (sourceBox) {
          const startPos = LinkingManager.getBoxOutputPosition(sourceBox);
          
          setLinking({
            ...linking,
            tempLineCoords: {
              start: startPos,
              end: { x, y }
            }
          });
        }
      }
    };
    
    if (linking.isActive && linking.sourceBoxId) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [linking, boxes]);

  const resetLinking = () => {
    setLinking({
      isActive: interactionMode === 'link', // Keep active if still in link mode
      sourceBoxId: null,
      tempLineCoords: null
    });
    setLinkError(null);
  };
  
  // Handle clicks on the canvas background (to cancel linking or create boxes)
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only handle clicks directly on the canvas, not on boxes or other elements
    if (e.target !== canvasRef.current && e.target !== canvasRef.current?.firstChild) {
      return;
    }
    
    // If in linking mode and a source is selected, cancel the current link
    if (linking.isActive && linking.sourceBoxId) {
      resetLinking();
      return;
    }
    
    // If in create mode, add a new box at the click position
    if (interactionMode === 'create' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const transform = panZoomRef.current.getTransform();
      
      // Apply the inverse of the transform to get the correct canvas coordinates
      const x = (e.clientX - rect.left) / transform.scale;
      const y = (e.clientY - rect.top) / transform.scale;
      
      onAddBox(x, y);
    }
  };

  // Start linking from a box
  const handleLinkStart = (boxId: string) => {
    if ((interactionMode === 'link' || interactionMode === 'select')) {
      const sourceBox = boxes.find(box => box.id === boxId);
      if (sourceBox) {
        const startPos = LinkingManager.getBoxOutputPosition(sourceBox);
        
        setLinking({
          isActive: true,
          sourceBoxId: boxId,
          tempLineCoords: {
            start: startPos,
            end: { ...mousePosition }
          }
        });
      }
    }
  };

  // Complete linking to a target box
  const handleLinkEnd = (boxId: string) => {
    if (linking.isActive && linking.sourceBoxId) {
      // Don't allow self-connections
      if (linking.sourceBoxId === boxId) {
        setLinkError("Can't connect a box to itself");
        return;
      }
      
      // Check for duplicate connections
      if (LinkingManager.isDuplicateArrow(linking.sourceBoxId, boxId, arrows)) {
        setLinkError("Connection already exists");
        return;
      }
      
      // Check for circular dependencies
      if (LinkingManager.isCircularDependency(linking.sourceBoxId, boxId, arrows)) {
        setLinkError("Circular dependency detected");
        return;
      }
      
      // Create the connection
      onAddArrow(linking.sourceBoxId, boxId);
      
      // Reset linking state but stay in linking mode if needed
      if (interactionMode === 'link') {
        setLinking({
          isActive: true,
          sourceBoxId: null,
          tempLineCoords: null
        });
      } else {
        resetLinking();
      }
    }
  };

  // Helpers for box updates
  const handleBoxMove = (id: string, x: number, y: number) => {
    onUpdateBox(id, { x, y });
  };

  const handleBoxResize = (id: string, width: number, height: number) => {
    onUpdateBox(id, { width, height });
  };

  // Helper to execute code in a box
  const handleExecuteCode = async (boxId: string) => {
    const box = boxes.find(b => b.id === boxId);
    if (!box) return;
    
    try {
      const { executeCode } = await import('../hooks/useApi');
      // Get ancestors for this box
      const ancestors = LinkingManager.getAncestors(boxId, arrows, boxes);
      const results = await executeCode(boxId, box.content, ancestors);
      onUpdateBox(boxId, { results });
    } catch (err: any) {
      console.error('Execution failed:', err);
      onUpdateBox(boxId, { 
        results: { 
          error: true, 
          output: err.message || 'Execution failed' 
        } 
      });
    }
  };

  // Get cursor style based on the current mode
  const getCursorStyle = () => {
    if (linking.isActive && linking.sourceBoxId) return 'cursor-crosshair';
    
    switch (interactionMode) {
      case 'move': return 'cursor-grab active:cursor-grabbing';
      case 'create': return 'cursor-cell';
      case 'select': return 'cursor-default';
      case 'link': return 'cursor-crosshair';
      default: return '';
    }
  };

  return (
    <div className="flex-1 relative overflow-hidden bg-gray-50">
      {/* Link error message */}
      {linkError && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-100 text-red-800 px-4 py-2 rounded-md shadow-md flex items-center gap-2 max-w-md">
          <Link2Off size={16} />
          <span>{linkError}</span>
        </div>
      )}
      
      {/* Linking mode indicator */}
      {linking.isActive && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center z-50 pointer-events-none">
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-md shadow-md text-sm">
            {linking.sourceBoxId 
              ? "Click on a box's input (top) connection point to complete the link (or anywhere to cancel)" 
              : "Click on a box's output (bottom) connection point to start linking"}
          </div>
        </div>
      )}

      {/* Main canvas */}
      <div 
        className={`w-[5000px] h-[5000px] relative ${getCursorStyle()}`}
        style={{
          backgroundImage: 'linear-gradient(rgba(150, 150, 150, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(150, 150, 150, 0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          transformOrigin: '0 0'
        }}
        ref={canvasRef}
        onClick={handleCanvasClick}
      >
        <div className="absolute w-full h-full" ref={ref}>
          {/* Permanent Arrows */}
          {arrows.map((arrow) => (
            <Arrow
              key={arrow.id}
              id={arrow.id}
              start={arrow.start}
              end={arrow.end}
              onDelete={interactionMode === 'select' ? () => onDeleteArrow(arrow.id) : undefined}
              scale={currentScale}
              boxes={boxes}
            />
          ))}
          
          {/* Temporary Connection Line */}
          {linking.isActive && linking.tempLineCoords && (
            <Arrow
              id="temp-connection"
              start={linking.sourceBoxId!}
              end={`temp-${Date.now()}`}
              color="#3498db"
              dashed={true}
              scale={currentScale}
              boxes={linking.sourceBoxId ? [
                // Find the source box
                ...boxes.filter(box => box.id === linking.sourceBoxId),
                // Create a fake target box at the mouse position
                {
                  id: `temp-${Date.now()}`,
                  x: linking.tempLineCoords.end.x - 1, // -1 for center adjustment
                  y: linking.tempLineCoords.end.y - 1,
                  width: 2,
                  height: 2,
                  content: '',
                  results: null
                }
              ] : []}
            />
          )}

          {/* Code Boxes */}
          {boxes.map((box) => (
            <CodeBox
              key={box.id}
              id={box.id}
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              content={box.content}
              results={box.results}
              onMove={(x, y) => handleBoxMove(box.id, x, y)}
              onResize={(width, height) => handleBoxResize(box.id, width, height)}
              onContentChange={(content) => onUpdateBox(box.id, { content })}
              onDelete={() => onDeleteBox(box.id)}
              onExecute={() => handleExecuteCode(box.id)}
              interactionMode={interactionMode}
              isLinkSource={linking.sourceBoxId === box.id}
              isLinkTarget={linking.isActive && linking.sourceBoxId !== null && linking.sourceBoxId !== box.id}
              onLinkStart={() => handleLinkStart(box.id)}
              onLinkEnd={() => handleLinkEnd(box.id)}
            />
          ))}
          
          {/* Invisible element for temporary arrow target */}
          {linking.isActive && linking.tempLineCoords && (
            <div 
              id={`temp-${Date.now()}`}
              style={{
                position: 'absolute',
                left: linking.tempLineCoords.end.x,
                top: linking.tempLineCoords.end.y,
                width: 1,
                height: 1
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
});

export default Canvas;
