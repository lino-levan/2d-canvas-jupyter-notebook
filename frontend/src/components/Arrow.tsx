import { useRef } from "react";
import Xarrow from "react-xarrows";

interface ArrowProps {
  id: string;
  start: string;
  end: string;
  onDelete?: () => void;
  color?: string;
  dashed?: boolean;
}

const Arrow = ({
  id,
  start,
  end,
  onDelete,
  color = "#3498db",
  dashed = false,
}: ArrowProps) => {
  const arrowRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={arrowRef} className="relative z-[5] group">
      <Xarrow
        start={start}
        end={end}
        color={color}
        path="smooth"
        showHead={true}
        dashness={dashed ? { animation: 1 } : false}
        animateDrawing={0.3}
      />
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer bg-white rounded-full w-6 h-6 flex justify-center items-center text-xs z-10 opacity-0 hover:opacity-100 group-hover:opacity-100 hover:scale-110 transition-all duration-200 shadow-sm border border-gray-200"
          aria-label="Delete connection"
        >
          ❌
        </button>
      )}
    </div>
  );
};

export default Arrow;
