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
  start: string;
  end: string;
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

    const visited = new Set<string>();
    const toVisit = [targetId];

    while (toVisit.length > 0) {
      const currentId = toVisit.pop()!;

      if (currentId === sourceId) {
        return true; // Found a path back to the source
      }

      if (visited.has(currentId)) {
        continue; // Skip already visited nodes
      }

      visited.add(currentId);

      // Find all boxes that have arrows pointing to the current box
      for (const arrow of arrows) {
        if (arrow.end === currentId) {
          toVisit.push(arrow.start);
        }
      }
    }

    return false; // No circular dependency found
  }

  /**
   * Checks if an arrow already exists between sourceId and targetId
   */
  static isDuplicateArrow(
    sourceId: string,
    targetId: string,
    arrows: Arrow[],
  ): boolean {
    return arrows.some((arrow) =>
      arrow.start === sourceId && arrow.end === targetId
    );
  }

  /**
   * Gets all ancestor boxes for a given box ID based on the arrow connections
   * with added debug logging to help track issues
   */
  static getAncestors(boxId: string, arrows: Arrow[], boxes: Box[]): {
    id: string;
    content: string;
    results: any;
  }[] {
    console.log(arrows, boxes);
    console.log(`Getting ancestors for box ${boxId}`);
    console.log(`Number of arrows: ${arrows.length}`);

    // DEBUG: Print a few arrows to see their structure
    if (arrows.length > 0) {
      console.log("First few arrows:", arrows.slice(0, 3));
    }

    // Make sure we're working with the right data structure
    const normalizedArrows = arrows.map((arrow) => {
      // If it's a ReactFlow edge, convert it to our Arrow type
      if ("source" in arrow) {
        return {
          id: arrow.id,
          start: arrow.source,
          end: arrow.target,
        };
      }
      return arrow;
    });

    // Set to track visited nodes and avoid duplicates
    const visited = new Set<string>();

    // Array to store ancestors in correct topological order
    const orderedAncestors: {
      id: string;
      content: string;
      results: any;
    }[] = [];

    // Helper function for depth-first traversal
    function dfs(currentId: string) {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      // Find all parents (boxes with arrows pointing to this box)
      const parents = normalizedArrows
        .filter((arrow) => arrow.end === currentId)
        .map((arrow) => arrow.start);

      console.log(`Parents of ${currentId}:`, parents);

      // Recursively visit all parents first
      for (const parentId of parents) {
        dfs(parentId);
      }

      // Only add to list if it's not the original box
      if (currentId !== boxId) {
        const box = boxes.find((b) => b.id === currentId);
        if (box) {
          console.log(`Adding ancestor: ${currentId}`);
          orderedAncestors.push({
            id: currentId,
            content: box.content,
            results: box.results,
          });
        } else {
          console.log(`Warning: Box ${currentId} not found in boxes array`);
        }
      }
    }

    // Start DFS from the given box
    dfs(boxId);

    console.log(
      `Final ancestors for ${boxId}:`,
      orderedAncestors.map((a) => a.id),
    );
    return orderedAncestors;
  }

  /**
   * Create a new arrow ID
   */
  static createArrowId(): string {
    return `arrow-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
