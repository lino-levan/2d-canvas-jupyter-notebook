import { useRef, useEffect, useState } from 'react';
import Xarrow from 'react-xarrows';
import { LinkingManager } from '../utils/LinkingManager';

interface ArrowProps {
  id: string;
  start: string;
  end: string;
  onDelete?: () => void;
  color?: string;
  dashed?: boolean;
  scale?: number;
  boxes?: any[]; // Array of boxes for advanced anchor calculation
}

const Arrow = ({ 
  id, 
  start, 
  end, 
  onDelete, 
  color = "#3498db", 
  dashed = false,
  scale = 1,
  boxes = []
}: ArrowProps) => {
  const arrowRef = useRef<HTMLDivElement>(null);
  const [anchors, setAnchors] = useState({ startAnchor: "bottom", endAnchor: "top" });

  // Dynamically calculate anchors based on box positions when available
  useEffect(() => {
    if (boxes.length > 0) {
      const startBox = boxes.find(box => box.id === start);
      const endBox = boxes.find(box => box.id === end);
      
      if (startBox && endBox) {
        const customAnchors = LinkingManager.getCustomAnchors(startBox, endBox, scale);
        setAnchors(customAnchors);
      }
    }
  }, [start, end, boxes, scale]);

  // Calculate arrow properties adjusted for scale
  const strokeWidth = 2 / scale; // Adjust line thickness 
  const headSize = 6 / scale; // Adjust arrowhead size
  
  // Adjust curveness based on scale - more curve at higher zooms
  const scaledCurveness = 0.3 / Math.sqrt(scale);

  return (
    <div ref={arrowRef} className="relative z-[5] group">
      <Xarrow
        start={start}
        end={end}
        color={color}
        strokeWidth={strokeWidth}
        curveness={scaledCurveness}
        headSize={headSize}
        path="smooth"
        startAnchor={anchors.startAnchor}
        endAnchor={anchors.endAnchor}
        showHead={true}
        dashness={dashed ? { animation: 1 } : false}
        // Additional props for better scaling behavior
        zIndex={10}
        animateDrawing={0.3}
      />
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer bg-white rounded-full w-6 h-6 flex justify-center items-center text-xs z-10 opacity-0 hover:opacity-100 group-hover:opacity-100 hover:scale-110 transition-all duration-200 shadow-sm border border-gray-200"
          style={{
            transform: `translate(-50%, -50%) scale(${1 / scale})` // Scale the delete button inversely
          }}
          aria-label="Delete connection"
        >
          ❌
        </button>
      )}
    </div>
  );
};

export default Arrow;
