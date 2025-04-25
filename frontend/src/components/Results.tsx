import { useState } from "react";

export type ResultsType = {
  error: boolean;
  output: string | {
    text_output: string;
    data: Record<string, string>;
  };
};

interface ResultsProps {
  results: ResultsType;
}

const Results = ({ results }: ResultsProps) => {
  const [expanded, setExpanded] = useState(true);

  if (!results) return null;

  // Handle error display
  if (results.error) {
    return (
      <div className="p-2 bg-red-50 text-sm">
        <div className="flex justify-between items-center mb-1">
          <span className="font-medium">Error</span>
          <button
            className="bg-transparent border-none cursor-pointer text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
        {expanded && (
          <pre className="font-mono whitespace-pre-wrap text-xs m-0 p-1 bg-red-50/80 rounded text-[#e74c3c]">
            {typeof results.output === 'string' ? results.output : JSON.stringify(results.output)}
          </pre>
        )}
      </div>
    );
  }

  // Handle different output types (text, image, html, etc.)
  const renderOutput = () => {
    if (!expanded) return null;

    const output = results.output;

    // If output is just a string
    if (typeof output === "string") {
      return (
        <pre className="font-mono whitespace-pre-wrap text-xs m-0 p-2 bg-gray-50 rounded">
          {output}
        </pre>
      );
    }

    // New format with both text output and rich data
    const elements = [];

    // Add text output if present
    if (output.text_output) {
      elements.push(
        <pre
          key="text"
          className="font-mono whitespace-pre-wrap text-xs m-0 p-2 bg-gray-50 rounded mb-2"
        >
          {output.text_output}
        </pre>,
      );
    }

    // Add rich output if present
    if (output.data) {
      const data = output.data;

      // Handle image/png output
      if (data["image/png"]) {
        elements.push(
          <img
            key="img"
            src={`data:image/png;base64,${data["image/png"]}`}
            alt="Execution result"
            className="max-w-full my-2"
          />,
        );
      } // Handle text/html output
      else if (data["text/html"]) {
        elements.push(
          <div
            key="html"
            className="p-2 bg-white rounded"
            dangerouslySetInnerHTML={{ __html: data["text/html"] }}
          />,
        );
      } // Handle application/json output
      else if (data["application/json"]) {
        elements.push(
          <pre
            key="json"
            className="font-mono whitespace-pre-wrap text-xs m-0 p-2 bg-gray-50 rounded"
          >
            {JSON.stringify(data['application/json'], null, 2)}
          </pre>,
        );
      } // Handle text/plain output (only if no text_output)
      else if (data["text/plain"] && !output.text_output) {
        elements.push(
          <pre
            key="plain"
            className="font-mono whitespace-pre-wrap text-xs m-0 p-2 bg-gray-50 rounded"
          >
            {data['text/plain']}
          </pre>,
        );
      }
    }

    return elements.length > 0
      ? elements
      : <div className="p-2 text-sm text-gray-500">No output</div>;
  };

  return (
    <div className="p-2 text-sm bg-gray-50">
      <div className="flex justify-between items-center mb-1">
        <span className="font-medium">Output</span>
        <button
          className="bg-transparent border-none cursor-pointer text-xs text-gray-500 hover:text-gray-700"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {renderOutput()}
    </div>
  );
};

export default Results;
