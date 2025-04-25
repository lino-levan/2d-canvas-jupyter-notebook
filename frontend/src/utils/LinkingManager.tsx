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

// State of the linking process
export interface LinkingState {
  isActive: boolean;        // Whether linking mode is active
  sourceBoxId: string | null; // ID of the source box (if selected)
  tempLineCoords: {         // Coordinates for the temporary line
    start: { x: number, y: number };
    end: { x: number, y: number };
  } | null;
}

export class LinkingManager {
  /**
   * Checks if creating an arrow from sourceId to targetId would create a circular dependency
   */
  static isCircularDependency(sourceId: string, targetId: string, arrows: Arrow[]): boolean {
    // Creating an arrow from sourceId -> targetId
    // Check if there already exists a path from targetId -> sourceId

    if (sourceId === targetId) return true; // Self-connection is circular

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
      // (i.e., where current box is the 'end')
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
  static isDuplicateArrow(sourceId: string, targetId: string, arrows: Arrow[]): boolean {
    return arrows.some(arrow => arrow.start === sourceId && arrow.end === targetId);
  }

  /**
   * Gets all ancestor boxes for a given box ID based on the arrow connections
   */
  static getAncestors(boxId: string, arrows: Arrow[], boxes: Box[]): {
    id: string;
    content: string;
    results: any;
  }[] {
    // Find direct parents (boxes that have arrows pointing to this box)
    const parents = arrows
      .filter(arrow => arrow.end === boxId)
      .map(arrow => arrow.start);
    
    if (parents.length === 0) return [];
    
    // Get parent boxes with their content and results
    const parentBoxes = parents.map(parentId => {
      const box = boxes.find(b => b.id === parentId);
      return {
        id: parentId,
        content: box ? box.content : '',
        results: box ? box.results : null
      };
    });
    
    // Get ancestors recursively (parents' parents, etc.)
    const ancestors = parents.flatMap(parentId => 
      this.getAncestors(parentId, arrows, boxes)
    );
    
    return [...ancestors, ...parentBoxes];
  }

  /**
   * Create a new arrow ID
   */
  static createArrowId(): string {
    return `arrow-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  /**
    * Calculate center bottom position of a box (for output connection),
    * with optional scale adjustment
    */
  static getBoxOutputPosition(box: Box, scale: number = 1): { x: number, y: number } {
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height
    };
  }

  /**
    * Calculate center top position of a box (for input connection),
    * with optional scale adjustment
    */
  static getBoxInputPosition(box: Box, scale: number = 1): { x: number, y: number } {
    return {
      x: box.x + box.width / 2,
      y: box.y
    };
  }

  /**
    * Get custom anchors for arrow connections based on box positions and scaling
    */
  static getCustomAnchors(startBox: Box, endBox: Box, scale: number = 1) {
    // Calculate the position of the boxes to determine the best anchors
    const startCenter = {
      x: startBox.x + startBox.width / 2,
      y: startBox.y + startBox.height / 2
    };
    
    const endCenter = {
      x: endBox.x + endBox.width / 2,
      y: endBox.y + endBox.height / 2
    };
    
    // Default anchors for common case (start box above end box)
    let startAnchor = "bottom";
    let endAnchor = "top";
    
    // If end box is significantly to the left of start box
    if (endCenter.x < startCenter.x - startBox.width / 2) {
      startAnchor = "left";
      endAnchor = "right";
    } 
    // If end box is significantly to the right of start box
    else if (endCenter.x > startCenter.x + startBox.width / 2) {
      startAnchor = "right";
      endAnchor = "left";
    }
    // If end box is above start box
    else if (endCenter.y < startCenter.y) {
      startAnchor = "top";
      endAnchor = "bottom";
    }
    
    return {
      startAnchor,
      endAnchor
    };
  }
}
