import { useEffect, useRef, useState } from "react";
import Canvas from "./components/Canvas";
import ModeSelector, { InteractionMode } from "./components/ModeSelector";
import { fetchWorkspace, saveWorkspace } from "./hooks/useApi";
import { LinkingManager } from "./utils/LinkingManager";
import { Info, Link, MousePointer } from "lucide-react";
import "./styles.css";

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  results: any;
}

interface Arrow {
  id: string;
  start: string;
  end: string;
}

function App() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(
    "edit",
  );
  const [saving, setSaving] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        setLoading(true);
        const { boxes, arrows } = await fetchWorkspace();
        setBoxes(boxes || []);
        setArrows(arrows || []);
      } catch (err) {
        console.error("Failed to load workspace:", err);
        setError("Failed to load workspace. Starting with empty canvas.");
        // Initialize with an empty box if no workspace exists
        setBoxes([createNewBox()]);
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, []);

  // Save workspace whenever boxes or arrows change (with debounce)
  useEffect(() => {
    if (!loading && boxes.length > 0) {
      // Clear any existing timeout
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      // Set a new timeout for saving
      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          setSaving(true);
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
  }, [boxes, arrows, loading]);

  const createNewBox = (x: number = 50, y: number = 50) => {
    const id = `box-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
      id,
      x,
      y,
      width: 500,
      height: 400,
      content: '# New Python Code\nprint("Hello, World!")',
      results: null,
    };
  };

  const handleAddBox = (x?: number, y?: number) => {
    setBoxes([...boxes, createNewBox(x, y)]);
  };

  const handleUpdateBox = (id: string, updates: Partial<Box>) => {
    setBoxes(boxes.map((box) => box.id === id ? { ...box, ...updates } : box));
  };

  const handleDeleteBox = (id: string) => {
    setBoxes(boxes.filter((box) => box.id !== id));
    // Also delete any arrows connected to this box
    setArrows(arrows.filter((arrow) => arrow.start !== id && arrow.end !== id));
  };

  const handleAddArrow = (start: string, end: string) => {
    // Create a new arrow with a unique ID
    const newArrow = {
      id: LinkingManager.createArrowId(),
      start,
      end,
    };

    setArrows([...arrows, newArrow]);
  };

  const handleDeleteArrow = (id: string) => {
    setArrows(arrows.filter((arrow) => arrow.id !== id));
  };

  const handleModeChange = (mode: InteractionMode) => {
    setInteractionMode(mode);
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

  const getModeInfoMessage = () => {
    switch (interactionMode) {
      case "create":
        return (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50/50 px-3 py-1.5 rounded">
            <Info size={16} />
            <span>Click anywhere on canvas to create a new box</span>
          </div>
        );
      case "link":
        return (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50/50 px-3 py-1.5 rounded">
            <Link size={16} />
            <span>
              Click on connection points to create links between boxes
            </span>
          </div>
        );
      case "edit":
        return (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50/50 px-3 py-1.5 rounded">
            <MousePointer size={16} />
            <span>Drag background to pan, interact with boxes to edit</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex justify-between items-center p-2.5 bg-white border-b border-gray-200 shadow-sm z-10">
        <ModeSelector
          activeMode={interactionMode}
          onModeChange={handleModeChange}
        />

        <div className="flex items-center gap-4">
          {getModeInfoMessage()}

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

      <Canvas
        boxes={boxes}
        arrows={arrows}
        interactionMode={interactionMode}
        onAddBox={handleAddBox}
        onUpdateBox={handleUpdateBox}
        onDeleteBox={handleDeleteBox}
        onAddArrow={handleAddArrow}
        onDeleteArrow={handleDeleteArrow}
        ref={workspaceRef}
      />
    </div>
  );
}

export default App;
