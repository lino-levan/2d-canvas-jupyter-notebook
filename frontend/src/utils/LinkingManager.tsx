// TypeScript interfaces for box and arrow
export interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  results: any;
}

export interface Arrow {
  id: string;
  source: string;
  target: string;
}

export class LinkingManager {
  /**
   * Checks if creating an arrow from sourceId to targetId would create a circular dependency
   */
  static isCircularDependency(
    sourceId: string,
    targetId: string,
    arrows: Arrow[],
  ): boolean {
    // Self-connection is circular
    if (sourceId === targetId) return true;

    // Create an adjacency list for faster lookups
    const graph: Record<string, string[]> = {};

    // Initialize graph with empty arrays for all nodes
    for (const arrow of arrows) {
      if (!graph[arrow.source]) graph[arrow.source] = [];
      if (!graph[arrow.target]) graph[arrow.target] = [];
    }

    // Add edges to the graph
    for (const arrow of arrows) {
      graph[arrow.source].push(arrow.target);
    }

    // Add the potential new edge
    if (!graph[sourceId]) graph[sourceId] = [];
    if (!graph[targetId]) graph[targetId] = [];
    graph[sourceId].push(targetId);

    // DFS to detect cycles
    const visited = new Set<string>();
    const recStack = new Set<string>();

    function dfs(nodeId: string): boolean {
      // If node is not visited yet
      if (!visited.has(nodeId)) {
        // Mark node as visited and add to recursion stack
        visited.add(nodeId);
        recStack.add(nodeId);

        // Visit all adjacent nodes
        const neighbors = graph[nodeId] || [];
        for (const neighbor of neighbors) {
          // If neighbor is not visited and has a cycle OR
          // If neighbor is in recursion stack (cycle detected)
          if (
            (!visited.has(neighbor) && dfs(neighbor)) ||
            recStack.has(neighbor)
          ) {
            return true;
          }
        }
      }

      // Remove from recursion stack (backtrack)
      recStack.delete(nodeId);
      return false;
    }

    // Check if any node in the graph has a cycle
    return dfs(sourceId);
  }

  /**
   * Checks if an arrow already exists between sourceId and targetId
   */
  static isDuplicateArrow(
    sourceId: string,
    targetId: string,
    arrows: Arrow[],
  ): boolean {
    return arrows.some(
      (arrow) => arrow.source === sourceId && arrow.target === targetId,
    );
  }

  /**
   * Create a new arrow ID
   */
  static createArrowId(): string {
    return `arrow-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
