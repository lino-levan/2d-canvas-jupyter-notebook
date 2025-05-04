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
    console.log(sourceId, targetId, arrows);
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
        if (arrow.target === currentId) {
          toVisit.push(arrow.source);
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
