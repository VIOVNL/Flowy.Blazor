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

// Flowy Blazor Component - Utility Functions

/**
 * Utility functions for viewport, coordinate transformations, and helpers
 */
export class FlowyUtils {
    /**
     * Creates a new utility functions instance
     * @param {Object} config - Configuration object
     * @param {Object} treeConfig - Tree layout configuration
     */
    constructor(config, treeConfig) {
        this.config = config;
        this.TREE_CONFIG = treeConfig;
    }

    // Get viewport element
    getViewport(canvasId) {
        return document.getElementById(canvasId);
    }

    // Get viewport dimensions
    getViewportDimensions(viewport) {
        if (!viewport) return { width: 0, height: 0 };
        return {
            width: viewport.clientWidth,
            height: viewport.clientHeight
        };
    }

    // Get actual node height from DOM
    getNodeHeight(nodeElement) {
        if (!nodeElement) return this.TREE_CONFIG.nodeHeight;
        return nodeElement.offsetHeight || this.TREE_CONFIG.nodeHeight;
    }

    // Calculate bounds of all nodes
    calculateNodesBounds(nodes) {
        if (!nodes || nodes.length === 0) {
            return {
                minX: this.TREE_CONFIG.rootX,
                minY: this.TREE_CONFIG.rootY,
                maxX: this.TREE_CONFIG.rootX,
                maxY: this.TREE_CONFIG.rootY,
                centerX: this.TREE_CONFIG.rootX,
                centerY: this.TREE_CONFIG.rootY,
                width: 0,
                height: 0
            };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            const nodeHeight = this.getNodeHeight(node.element);
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + this.TREE_CONFIG.nodeWidth);
            maxY = Math.max(maxY, node.y + nodeHeight);
        });

        return {
            minX,
            minY,
            maxX,
            maxY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    // Calculate node center position
    calculateNodeCenter(node) {
        const nodeHeight = this.getNodeHeight(node.element);
        return {
            x: node.x + this.TREE_CONFIG.nodeWidth / 2,
            y: node.y + nodeHeight / 2
        };
    }

    // Calculate target pan to center a point
    calculateTargetPanForCenter(targetCenterX, targetCenterY, viewportWidth, viewportHeight, zoomLevel) {
        return {
            x: viewportWidth / 2 - targetCenterX * zoomLevel,
            y: viewportHeight / 2 - targetCenterY * zoomLevel
        };
    }

    // Convert viewport coordinates to canvas coordinates
    viewportToCanvas(viewportX, viewportY, panX, panY, zoomLevel) {
        return {
            x: (viewportX - panX) / zoomLevel,
            y: (viewportY - panY) / zoomLevel
        };
    }

    // Convert canvas coordinates to viewport coordinates
    canvasToViewport(canvasX, canvasY, panX, panY, zoomLevel) {
        return {
            x: canvasX * zoomLevel + panX,
            y: canvasY * zoomLevel + panY
        };
    }

    // Check if a point is within a rectangle
    pointInRect(pointX, pointY, rectX, rectY, rectWidth, rectHeight) {
        return pointX >= rectX && pointX <= rectX + rectWidth &&
               pointY >= rectY && pointY <= rectY + rectHeight;
    }

    // Find node at a specific position
    getNodeAtPosition(mouseX, mouseY, canvasId, nodes, panX, panY, zoomLevel) {
        const viewport = this.getViewport(canvasId);
        if (!viewport) return null;
        
        const rect = viewport.getBoundingClientRect();
        const viewportX = mouseX - rect.left;
        const viewportY = mouseY - rect.top;
        
        const canvas = this.viewportToCanvas(viewportX, viewportY, panX, panY, zoomLevel);
        
        return nodes.find(node => {
            const nodeHeight = this.getNodeHeight(node.element);
            return this.pointInRect(canvas.x, canvas.y, node.x, node.y, 
                this.TREE_CONFIG.nodeWidth, nodeHeight);
        }) || null;
    }

    // Build relationship JSON structure
    buildRelationshipJSON(rootNode, totalNodes) {
        const nodeToJSON = (node) => ({
            id: node.id,
            name: node.name,
            componentId: node.componentId,
            children: node.children.map(child => nodeToJSON(child))
        });
        
        if (!rootNode) {
            return { tree: null, totalNodes: 0 };
        }
        
        return {
            tree: nodeToJSON(rootNode),
            totalNodes: totalNodes
        };
    }

  
}
