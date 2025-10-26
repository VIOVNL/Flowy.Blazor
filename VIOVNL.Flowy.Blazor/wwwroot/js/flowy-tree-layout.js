/**
 * VIOVNL.Flowy.Blazor - Interactive Hierarchical Tree Builder
 * Copyright (C) 2025 VIOVNL
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 * 
 * For commercial licensing, visit: https://viov.nl
 */

// Flowy Blazor Component - Tree Layout Management

/**
 * Manages hierarchical tree layout calculations and positioning
 */
export class FlowyTreeLayout {
    /**
     * Creates a new tree layout manager
     * @param {Object} treeConfig - Tree configuration with spacing and dimensions
     * @param {FlowyConsole} console - Debug console instance
     */
    constructor(treeConfig, console) {
        this.TREE_CONFIG = treeConfig;
        this.console = console;
        this.widthCache = new Map();
    }

    /**
     * Clear the width calculation cache.
     * Call before recalculating layout when node structure has changed.
     */
    clearCache() {
        this.widthCache.clear();
    }

    /**
     * Get actual node height from DOM element
     */
    getNodeHeight(nodeElement) {
        if (!nodeElement) return this.TREE_CONFIG.nodeHeight;
        return nodeElement.offsetHeight || this.TREE_CONFIG.nodeHeight;
    }

    /**
     * Calculate vertical spacing based on parent node height
     * Uses a minimum base spacing plus the parent's actual height
     */
    calculateVerticalSpacing(parentNode) {
        const baseSpacing = 80; // Minimum gap between nodes
        const parentHeight = this.getNodeHeight(parentNode?.element);
        return parentHeight + baseSpacing;
    }

    /**
     * Calculate position for a new child node relative to its parent
     * @param {Object} parentNode - The parent node object
     * @param {number} childIndex - Index of the child in parent's children array
     * @returns {{x: number, y: number}} Position coordinates
     */
    calculateChildPosition(parentNode, childIndex) {
        if (!parentNode || !parentNode.children) {
            this.console.log('ERROR', `Invalid parent node in calculateChildPosition`, { 
                hasParent: !!parentNode,
                hasChildren: parentNode?.children !== undefined
            });
            return { x: 0, y: 0 };
        }
        
        const totalChildren = parentNode.children.length + 1;
        const totalWidth = (totalChildren - 1) * (this.TREE_CONFIG.nodeWidth + this.TREE_CONFIG.horizontalSpacing);
        const startX = parentNode.x - totalWidth / 2;
        const x = startX + childIndex * (this.TREE_CONFIG.nodeWidth + this.TREE_CONFIG.horizontalSpacing);
        const verticalSpacing = this.calculateVerticalSpacing(parentNode);
        const y = parentNode.y + verticalSpacing;
        
        return { x, y };
    }

    /**
     * Recursively calculate positions for entire subtree using two-pass algorithm.
     * 
     * Algorithm (based on Reingold-Tilford tree drawing):
     * Pass 1: Calculate subtree widths bottom-up (post-order traversal)
     *   - Leaf nodes: width = nodeWidth
     *   - Parent nodes: width = sum(child widths) + spacing
     * Pass 2: Position nodes top-down (pre-order traversal)
     *   - Calculate total width needed for children
     *   - Distribute children left-to-right centered under parent
     *   - Recursively position each child's subtree
     * 
     * This ensures:
     * - Sibling nodes don't overlap
     * - Children are centered under parent
     * - Tree is balanced and aesthetically pleasing
     * 
     * @param {Object} node - Root node of subtree
     * @param {number} centerX - Horizontal center position for this node
     * @param {number} y - Vertical position for this node
     * @returns {Object} Object with width property (total subtree width)
     */
    calculateSubtreePositions(node, centerX, y) {
        node.x = centerX;
        node.y = y;
        
        if (node.children.length === 0) {
            return { width: this.TREE_CONFIG.nodeWidth };
        }
        
        // First pass: calculate widths only (no positioning yet)
        const childWidths = node.children.map(child => 
            this.calculateSubtreeWidth(child)
        );
        
        const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) + 
                          (node.children.length - 1) * this.TREE_CONFIG.horizontalSpacing;
        
        // Second pass: position children based on calculated widths and dynamic vertical spacing
        const verticalSpacing = this.calculateVerticalSpacing(node);
        let currentX = centerX - totalWidth / 2;
        node.children.forEach((child, index) => {
            const childCenterX = currentX + childWidths[index] / 2;
            this.positionSubtree(child, childCenterX, y + verticalSpacing);
            currentX += childWidths[index] + this.TREE_CONFIG.horizontalSpacing;
        });
        
        return { width: Math.max(totalWidth, this.TREE_CONFIG.nodeWidth) };
    }

    /**
     * Calculate total width needed for a subtree (memoized for performance).
     * 
     * Uses cache to avoid recalculating widths for same nodes during layout.
     * Cache is cleared before each layout recalculation to ensure fresh values.
     * 
     * @param {Object} node - Node to calculate width for
     * @returns {number} Width in pixels required for this node's subtree
     */
    calculateSubtreeWidth(node) {
        // Check cache first to avoid redundant calculations
        if (this.widthCache.has(node.id)) {
            return this.widthCache.get(node.id);
        }
        
        let width;
        if (node.children.length === 0) {
            width = this.TREE_CONFIG.nodeWidth;
        } else {
            const childWidths = node.children.map(child => this.calculateSubtreeWidth(child));
            const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) + 
                              (node.children.length - 1) * this.TREE_CONFIG.horizontalSpacing;
            width = Math.max(totalWidth, this.TREE_CONFIG.nodeWidth);
        }
        
        // Cache the result
        this.widthCache.set(node.id, width);
        return width;
    }

    positionSubtree(node, centerX, y) {
        node.x = centerX;
        node.y = y;
        
        if (node.children.length === 0) return;
        
        const childWidths = node.children.map(child => this.calculateSubtreeWidth(child));
        const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) + 
                          (node.children.length - 1) * this.TREE_CONFIG.horizontalSpacing;
        
        const verticalSpacing = this.calculateVerticalSpacing(node);
        let currentX = centerX - totalWidth / 2;
        node.children.forEach((child, index) => {
            const childCenterX = currentX + childWidths[index] / 2;
            this.positionSubtree(child, childCenterX, y + verticalSpacing);
            currentX += childWidths[index] + this.TREE_CONFIG.horizontalSpacing;
        });
    }

    updateNodePositions(node) {
        node.element.style.left = `${node.x}px`;
        node.element.style.top = `${node.y}px`;
        node.children.forEach(child => this.updateNodePositions(child));
    }
}
