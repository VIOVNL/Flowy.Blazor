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
 * For commercial licensing, visit: https://www.viov.nl/flowyblazor/license/
 */

// Flowy Blazor Component - JavaScript Interop Entry Point
import { FlowyInstance } from './flowy-core.js';

/** @type {Map<string, FlowyInstance>} */
const instances = new Map();

/**
 * JavaScript interop API for Blazor component communication
 * All methods are called from C# via JSInterop
 */
export const FlowyInterop = {
    /**
     * Initializes a new Flowy canvas instance
     * @param {string} canvasId - Unique canvas identifier
     * @param {Object} config - Configuration object from C#
     * @param {Object} dotNetRef - .NET object reference for callbacks
     */
    initialize(canvasId, config, dotNetRef) {
        const instance = new FlowyInstance(canvasId, config, dotNetRef);
        instances.set(canvasId, instance);
    },

    reset(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.reset();
    },

    refresh(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.recalculateTreeLayout();
    },

    setDragDropEnabled(canvasId, enabled) {
        const instance = instances.get(canvasId);
        if (instance) instance.setDragDropEnabled(enabled);
    },

    setNodeDraggable(canvasId, nodeId, draggable) {
        const instance = instances.get(canvasId);
        if (instance) instance.setNodeDraggable(nodeId, draggable);
    },

    setNodeCanHaveChildren(canvasId, nodeId, canHaveChildren) {
        const instance = instances.get(canvasId);
        if (instance) instance.setNodeCanHaveChildren(nodeId, canHaveChildren);
    },

    zoomIn(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.zoomIn();
    },

    zoomOut(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.zoomOut();
    },

    zoomReset(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.zoomReset();
    },

    zoomToFit(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.zoomToFit();
    },

    setAutoZoom(canvasId, enabled) {
        const instance = instances.get(canvasId);
        if (instance) instance.setAutoZoom(enabled);
    },

    fitAllNodesInViewport(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.fitAllNodesInViewport();
    },

    setPanningEnabled(canvasId, enabled) {
        const instance = instances.get(canvasId);
        if (instance) instance.setPanningEnabled(enabled);
    },

    setZoomLevel(canvasId, level) {
        const instance = instances.get(canvasId);
        if (instance) instance.setZoomLevel(level);
    },

    setAutoCenter(canvasId, enabled) {
        const instance = instances.get(canvasId);
        if (instance) instance.setAutoCenter(enabled);
    },

    center(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) instance.centerCanvas();
    },

    position(canvasId, x, y) {
        const instance = instances.get(canvasId);
        if (instance) instance.setPosition(x, y);
    },

    focusItem(canvasId, nodeId) {
        const instance = instances.get(canvasId);
        if (instance) return instance.focusItem(nodeId);
        return false;
    },

    setSmooth(canvasId, enabled) {
        const instance = instances.get(canvasId);
        if (instance) instance.setSmooth(enabled);
    },

    /**
     * Animates droplets flowing from one node to another through the tree
     * @param {string} canvasId - Canvas identifier
     * @param {string} startNodeId - GUID of starting node
     * @param {string} endNodeId - GUID of destination node
     * @param {number} duration - Duration in ms for each segment (default: 800)
     * @param {number} dropletCount - Number of droplets (default: 5)
     * @param {number} dropletDelay - Delay between droplets in ms (default: 150)
     * @param {number} dropletDistance - Distance offset (0-1) between droplets along path (default: 0)
     * @param {string} easing - Easing function name (default: 'easeInOut')
     * @returns {Promise<boolean>} True if animation completed, false if no path found
     */
    async flowDroplets(canvasId, startNodeId, endNodeId, duration = 800, dropletCount = 5, dropletDelay = 150, dropletDistance = 0, easing = 'easeInOut') {
        const instance = instances.get(canvasId);
        if (instance) {
            return await instance.flowDroplets(startNodeId, endNodeId, duration, dropletCount, dropletDelay, dropletDistance, easing);
        }
        return false;
    },

    addNode(canvasId, nodeData, skipNotification = false) {
        const instance = instances.get(canvasId);
        if (instance?.console) {
            instance.console.log('INTEROP', 'FlowyInterop.addNode received', { 
                canvasId, 
                skipNotification,
                nodeId: nodeData.id,
                nodeName: nodeData.name,
                parentId: nodeData.parentId
            });
        }
        if (instance) return instance.addNode(nodeData, skipNotification);
        return false;
    },

    removeNode(canvasId, nodeId) {
        const instance = instances.get(canvasId);
        if (instance) return instance.removeNode(nodeId);
        return false;
    },

    exportTreeStructure(canvasId) {
        const instance = instances.get(canvasId);
        if (!instance || !instance.rootNode) return null;

        // Build complete tree structure matching C# FlowyTreeData format
        const buildNodeStructure = (node) => {
            return {
                Id: node.id,
                Name: node.name,
                ComponentId: node.componentId,
                Color: node.color,
                ParentId: node.parent ? node.parent.id : null,
                ChildrenIds: node.children.map(child => child.id),
                IsDraggable: node.isDraggable !== false,
                CanHaveChildren: true
            };
        };

        const nodes = [];
        const traverse = (node) => {
            nodes.push(buildNodeStructure(node));
            node.children.forEach(child => traverse(child));
        };

        traverse(instance.rootNode);

        const treeData = {
            RootNodeId: instance.rootNode.id,
            Nodes: nodes
        };

        return JSON.stringify(treeData);
    },

    dispose(canvasId) {
        const instance = instances.get(canvasId);
        if (instance) {
            instance.dispose();
            instances.delete(canvasId);
        }
    }
};
