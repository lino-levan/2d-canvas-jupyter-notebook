import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, NodeToolbar, Position } from "@xyflow/react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Play } from "lucide-react";
import Results, { type ResultsType } from "./Results";

// Define the props type for the CodeBox node
interface CodeBoxNodeProps {
  id: string;
  data: {
    width: number;
    height: number;
    content: string;
    results: ResultsType;
    onExecute: (id: string, content: string) => Promise<void>;
    onContentChange: (content: string) => void;
    onResize: (width: number, height: number) => void;
    onEditorFocus?: (isFocused: boolean) => void;
  };
  selected: boolean;
}

// Create a memoized component for better performance
const CodeBoxNode = memo(({ id, data, selected }: CodeBoxNodeProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState(
    data.content || '# New Python Code\nprint("Hello, World!")',
  );

  // Update local content when props change
  useEffect(() => {
    setContent(data.content || '# New Python Code\nprint("Hello, World!")');
  }, [data.content]);

  // Handle editor content changes
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setContent(value);
        // Update the parent component's state
        data.onContentChange(value);
      }
    },
    [data],
  );

  // Execute the code
  const executeCode = useCallback(() => {
    data.onExecute(id, content).then(() => {
      if (!data.results) {
        editorRef.current?.layout({ width: 0, height: 0 });
      }
    });
  }, [id, content, data]);

  return (
    <div className="relative" ref={nodeRef}>
      {/* Node Toolbar that appears when selected */}
      <NodeToolbar isVisible={selected} position={Position.Top}>
        <div className="flex bg-white border border-gray-200 rounded shadow-sm">
          <button
            className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-gray-100"
            onClick={executeCode}
          >
            <Play size={16} />
            <span>Run Code</span>
          </button>
        </div>
      </NodeToolbar>

      {/* Make the node resizable with onResize callback */}
      <NodeResizer
        minWidth={300}
        minHeight={200}
        isVisible={selected}
        lineClassName="border-blue-500"
        handleClassName="h-3 w-3 bg-white border-2 border-blue-500 rounded"
        onResize={(_, params) => {
          data.onResize(params.width, params.height);
          editorRef.current?.layout({ width: 0, height: 0 });
        }}
      />

      {/* The main node container */}
      <div
        className="bg-white rounded-md shadow-md overflow-hidden border border-gray-200 flex flex-col"
        style={{ width: data.width, height: data.height }}
      >
        {/* Node header - this is draggable */}
        <div
          className="node-drag-handle flex justify-between items-center py-2 px-3 bg-[#3498db] text-white"
          style={{ cursor: "move" }}
        >
          <div className="font-medium text-sm">Python Code</div>
          <div className="flex gap-1">
            <button
              className="bg-transparent border-none text-white cursor-pointer flex items-center justify-center w-6 h-6 rounded hover:bg-white/20"
              onClick={executeCode}
              title="Run code"
            >
              <Play size={16} />
            </button>
          </div>
        </div>

        {/* Main content area with Monaco editor */}
        <div className="flex-grow">
          <Editor
            height="100%"
            defaultLanguage="python"
            value={content}
            onChange={handleEditorChange}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              automaticLayout: true,
              lineNumbers: "on",
              wordWrap: "on",
              tabSize: 4,
              insertSpaces: true,
            }}
            theme="vs-dark"
            onMount={(editor) => {
              editorRef.current = editor;
            }}
          />
        </div>

        {/* Results area */}
        {data.results && (
          <div className="border-t border-gray-200 overflow-auto flex-shrink-0">
            <Results
              results={data.results}
              onExpand={() => {
                editorRef.current?.layout({ width: 0, height: 0 });
              }}
            />
          </div>
        )}
      </div>

      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        style={{ background: "#3498db", width: "10px", height: "10px" }}
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{ background: "#2ecc71", width: "10px", height: "10px" }}
        isConnectable={true}
      />
    </div>
  );
});

export default CodeBoxNode;
