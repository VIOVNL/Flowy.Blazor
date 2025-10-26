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

// Flowy Blazor Component - Drag and Drop System

/**
 * Manages drag and drop operations for components and nodes.
 * 
 * This module handles:
 * - Component dragging from toolbox to canvas
 * - Node repositioning within the tree
 * - Drop target validation and highlighting
 * - Visual feedback (ghost elements)
 * 
 * Performance optimizations:
 * - Debounced hover detection (50ms intervals) reduces DOM queries
 * - Global event handlers for mousemove/mouseup prevent listener proliferation
 * - Threshold-based drag initiation (5px) prevents accidental drags
 * 
 * @example
 * const dragDrop = new FlowyDragDrop(canvasId, config, utils, treeConfig);
 * dragDrop.setupComponentDragging(createRoot, addChild, getZoomPan);
 * dragDrop.setupGlobalNodeDragHandlers();
 */
export class FlowyDragDrop {
    /**
     * Creates a new drag and drop manager
     * @param {string} canvasId - The canvas grid element ID
     * @param {Object} config - Configuration object
     * @param {FlowyUtils} utils - Utility functions instance
     * @param {Object} treeConfig - Tree layout configuration
     * @param {FlowyConsole} console - Debug console instance
     * @param {Object} dotNetRef - .NET object reference for callbacks
     */
    constructor(canvasId, config, utils, treeConfig, console, dotNetRef) {
        this.canvasId = canvasId;
        this.config = config;
        this.utils = utils;
        this.TREE_CONFIG = treeConfig;
        this.console = console;
        this.dotNetRef = dotNetRef;
        
        this.draggedComponent = null;
        this.draggedNode = null;
        this.ghostElement = null;
        this.isDragging = false;
        this.isDraggingNode = false;
        this.currentHoveredNode = null;
        
        // Performance constants
        this.HOVER_CHECK_INTERVAL = 50; // ms - limits hover checks to 20fps (prevents excessive DOM queries during drag)
        this.DRAG_START_THRESHOLD = 5; // pixels - prevents accidental drags from clicks, improves UX
        
        // Event listener cleanup
        this.nodeEventCleanupHandlers = new Map();
        this.globalEventCleanupHandlers = [];
    }

    /**
     * Sets up drag and drop for components from the toolbox.
     * 
     * Event flow:
     * 1. mousedown: Captures component, reduces opacity for visual feedback
     * 2. mousemove: Creates ghost element, tracks hover over drop targets
     * 3. mouseup: Attempts drop, creates root if no target, resets state
     * 
     * @param {Function} createRootNodeCallback - Called when dropping on empty canvas
     * @param {Function} addChildToNodeCallback - Called when dropping on existing node
     * @param {Function} getZoomPan - Returns current zoom/pan state for coordinate transforms
     * @example
     * dragDrop.setupComponentDragging(
     *   (component) => this.createRootNode(component),
     *   (parent, component) => this.addChildToNode(parent, component),
     *   () => ({ panX: this.panX, panY: this.panY, zoomLevel: this.zoomLevel })
     * );
     */
    setupComponentDragging(createRootNodeCallback, addChildToNodeCallback, getZoomPan) {
        let lastHoverCheckTime = 0;
        
        document.addEventListener('mousedown', (e) => {
            if (!this.config.enableDragDrop) return; // Check if drag and drop is enabled
            
            const componentItem = e.target.closest('.component-item');
            if (!componentItem) return;
            if (this.isDraggingNode || this.draggedNode) return;
            
            e.preventDefault();
            
            const componentId = componentItem.dataset.componentId;
            const component = this.config.components.find(c => c.componentId === componentId);
            if (!component) return;

            this.console.log('DRAG', `Component mousedown: ${component.name}`, { componentId, bodyHtml: component.bodyHtml });
            this.draggedComponent = { ...component };
            this.draggedComponentElement = componentItem; // Store the actual DOM element
            componentItem.style.opacity = '0.5';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.config.enableDragDrop) return; // Check if drag and drop is enabled
            if (!this.draggedComponent || this.isDraggingNode) return;
            
            if (!this.isDragging && this.draggedComponent) {
                this.isDragging = true;
                this.console.debugDragStart(this.draggedComponent, false);
                this.createGhostElement(this.draggedComponent, e.clientX, e.clientY, this.draggedComponentElement);
            }
            
            if (this.isDragging && this.ghostElement && !this.isDraggingNode) {
                const offsetX = this.ghostOffsetX || 0;
                const offsetY = this.ghostOffsetY || 0;
                this.ghostElement.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;
   
                // Debounce hover detection to improve performance
                const now = Date.now();
                if (now - lastHoverCheckTime >= this.HOVER_CHECK_INTERVAL) {
                    const zoomPan = getZoomPan();
                    const previousHover = this.currentHoveredNode;
                    this.highlightHoveredNode(e.clientX, e.clientY, zoomPan.panX, zoomPan.panY, zoomPan.zoomLevel);
                    // Log only when hover target changes
                    if (this.currentHoveredNode !== previousHover) {
                        this.console.log('DRAG', `Hover target changed`, { 
                            from: previousHover?.name || 'none', 
                            to: this.currentHoveredNode?.name || 'none' 
                        });
                    }
                    lastHoverCheckTime = now;
                }
            }
        });

        document.addEventListener('mouseup', async (e) => {
            if (this.isDraggingNode) return;
            
            if (!this.isDragging) {
                this.resetDragState();
                return;
            }
            
            this.console.log('DRAG', `Component drop attempt`, { 
                component: this.draggedComponent.name,
                target: this.currentHoveredNode?.name || 'canvas root',
                position: { x: e.clientX, y: e.clientY }
            });
            
            const hasRoot = await createRootNodeCallback(this.draggedComponent);
            if (!hasRoot) {
                await this.handleDrop(e.clientX, e.clientY, addChildToNodeCallback);
            }
            
            // Drop is successful if: created root OR dropped on existing node
            const dropSuccess = hasRoot || this.currentHoveredNode !== null;
            this.console.debugDragEnd(this.currentHoveredNode || 'root', dropSuccess);
            this.resetDragState();
        });
    }

    /**
     * Attaches drag handlers to a single node element.
     * 
     * Note: Only adds mousedown listener here. mousemove/mouseup handlers are global
     * (see setupGlobalNodeDragHandlers) to improve performance and prevent listener bloat.
     * 
     * @param {HTMLElement} element - The node DOM element
     * @param {Object} nodeData - Node data with id, name, parent, children
     * @param {Function} moveNodeToParentCallback - Called to execute the move operation
     */
    setupNodeDragging(element, nodeData, moveNodeToParentCallback) {
        const mousedownHandler = (e) => {
            // Check if drag and drop is globally enabled
            if (!this.config.enableDragDrop) {
                this.console.log('DRAG', `Drag & Drop is disabled globally`, { nodeId: nodeData.id });
                return;
            }
            
            // Prevent dragging from arrow buttons
            if (e.target.closest('.arrow-btn')) return;
            
            // Check if node is draggable
            if (nodeData.isDraggable === false) {
                this.console.log('DRAG', `Node is not draggable`, { 
                    nodeId: nodeData.id, 
                    name: nodeData.name 
                });
                return;
            }
            
            e.stopPropagation();
            e.preventDefault();
            
            this.console.log('DRAG', `Node mousedown: ${nodeData.name}`, { 
                nodeId: nodeData.id, 
                currentParent: nodeData.parent?.name || 'root' 
            });
            
            this.draggedNode = nodeData;
            this.dragStartPos = { x: e.clientX, y: e.clientY };
            this.isDraggingNode = false;
            this.moveNodeCallback = moveNodeToParentCallback;
        };
        
        element.addEventListener('mousedown', mousedownHandler);
        
        // Store only element cleanup handler
        this.nodeEventCleanupHandlers.set(nodeData.id, [
            () => element.removeEventListener('mousedown', mousedownHandler)
        ]);
    }
    
    setupGlobalNodeDragHandlers() {
        // Single global mousemove handler for all nodes
        let lastNodeHoverCheckTime = 0;
        
        const globalMousemoveHandler = (e) => {
            if (!this.config.enableDragDrop) return; // Check if drag and drop is enabled
            if (!this.draggedNode) return;
            
            if (!this.isDraggingNode && this.dragStartPos) {
                const dx = e.clientX - this.dragStartPos.x;
                const dy = e.clientY - this.dragStartPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > this.DRAG_START_THRESHOLD) {
                    this.isDraggingNode = true;
                    this.console.debugDragStart(this.draggedNode, true);
                    this.console.log('DRAG', `Drag threshold exceeded`, { distance: distance.toFixed(2), threshold: this.DRAG_START_THRESHOLD });
                    const nodeElement = document.querySelector(`[data-node-id="${this.draggedNode.id}"]`);
                    if (nodeElement) nodeElement.classList.add('dragging');
                    this.createNodeGhost(this.draggedNode, e.clientX, e.clientY);
                }
            }
            
            if (this.isDraggingNode && this.ghostElement) {
                const offsetX = this.ghostOffsetX || 0;
                const offsetY = this.ghostOffsetY || 0;
                this.ghostElement.style.transform = `translate(${e.clientX - offsetX}px, ${e.clientY - offsetY}px)`;
                
                // Debounce hover detection
                const now = Date.now();
                if (now - lastNodeHoverCheckTime >= this.HOVER_CHECK_INTERVAL) {
                    const previousHover = this.currentHoveredNode;
                    // Use synchronous version during drag (validation only happens on drop)
                    this.highlightHoveredNodeForDragSync(e.clientX, e.clientY, this.draggedNode);
                    // Log only when hover target changes
                    if (this.currentHoveredNode !== previousHover) {
                        this.console.log('DRAG', `Node hover target changed`, { 
                            from: previousHover?.name || 'none', 
                            to: this.currentHoveredNode?.name || 'none',
                            draggedNode: this.draggedNode.name
                        });
                    }
                    lastNodeHoverCheckTime = now;
                }
            }
        };
        
        // Single global mouseup handler for all nodes
        const globalMouseupHandler = async (e) => {
            if (!this.isDraggingNode || !this.draggedNode) {
                if (this.draggedNode) {
                    this.console.log('DRAG', `Node drag cancelled (no movement or insufficient distance)`);
                    this.draggedNode = null;
                    this.dragStartPos = null;
                    this.moveNodeCallback = null;
                }
                return;
            }
            
            this.console.log('DRAG', `Node drop attempt`, { 
                node: this.draggedNode.name,
                target: this.currentHoveredNode?.name || 'none',
                oldParent: this.draggedNode.parent?.name || 'root',
                position: { x: e.clientX, y: e.clientY }
            });
            
            if (this.moveNodeCallback) {
                await this.handleNodeDrop(e.clientX, e.clientY, this.draggedNode, this.moveNodeCallback);
            }
            
            this.console.debugDragEnd(this.currentHoveredNode, this.currentHoveredNode !== null);
            this.resetNodeDragState();
        };
        
        document.addEventListener('mousemove', globalMousemoveHandler);
        document.addEventListener('mouseup', globalMouseupHandler);
        
        this.globalEventCleanupHandlers.push(
            () => document.removeEventListener('mousemove', globalMousemoveHandler),
            () => document.removeEventListener('mouseup', globalMouseupHandler)
        );
    }

    cleanupNodeListeners(nodeId) {
        const handlers = this.nodeEventCleanupHandlers.get(nodeId);
        if (handlers) {
            this.console.log('CLEANUP', `Removing event listeners for node`, { nodeId });
            handlers.forEach(cleanup => cleanup());
            this.nodeEventCleanupHandlers.delete(nodeId);
        }
    }

    /**
     * Removes all event listeners to prevent memory leaks.
     * 
     * Critical for component disposal - must be called when canvas is destroyed.
     * Cleans up both per-node listeners and global document listeners.
     */
    cleanup() {
        this.console.log('CLEANUP', `Cleaning up drag-drop module`, { 
            nodeListeners: this.nodeEventCleanupHandlers.size,
            globalListeners: this.globalEventCleanupHandlers.length
        });
        
        // Clean up all node event listeners
        this.nodeEventCleanupHandlers.forEach((handlers) => {
            handlers.forEach(cleanup => cleanup());
        });
        this.nodeEventCleanupHandlers.clear();
        
        // Clean up global event listeners
        this.globalEventCleanupHandlers.forEach(cleanup => cleanup());
        this.globalEventCleanupHandlers = [];
        
        this.console.log('CLEANUP', `Drag-drop cleanup complete`);
    }

    createGhostElement(component, x, y, sourceElement = null) {
        this.ghostElement = document.createElement('div');
        this.ghostElement.className = 'drag-ghost';
        
        // Disable animation to prevent position jump
        this.ghostElement.style.animation = 'none';
        
        // Clone the actual component item if available for 1:1 visual copy
        if (sourceElement) {
            const clone = sourceElement.cloneNode(true);
            // Remove any IDs to avoid duplicates
            clone.removeAttribute('id');
            clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
            this.ghostElement.appendChild(clone);
            
            // Get dimensions from source element for centering
            const rect = sourceElement.getBoundingClientRect();
            this.ghostOffsetX = rect.width / 2;
            this.ghostOffsetY = rect.height / 2;
        } else {
            // Fallback to simple name display
            this.ghostElement.innerHTML = `
                <div class="ghost-name">${component.name}</div>
            `;
            this.ghostElement.style.setProperty('--ghost-color', component.color);
            // Default offset for simple ghost
            this.ghostOffsetX = 50;
            this.ghostOffsetY = 20;
        }
        
        this.ghostElement.style.transform = `translate(${x - this.ghostOffsetX}px, ${y - this.ghostOffsetY}px)`;
        document.body.style.cursor = 'grabbing';
        document.body.appendChild(this.ghostElement);
    }

    createNodeGhost(nodeData, x, y) {
        this.ghostElement = document.createElement('div');
        this.ghostElement.className = 'drag-ghost drag-ghost-node';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'ghost-node-header';
        const title = document.createElement('span');
        title.className = 'ghost-node-title';
        title.textContent = nodeData.name;
        header.appendChild(title);
        
        // Create body
        const body = document.createElement('div');
        body.className = 'ghost-node-body';
        
        if (nodeData.bodyHtml) {
            body.innerHTML = nodeData.bodyHtml;
        }
        
        // Append both to ghost
        this.ghostElement.appendChild(header);
        this.ghostElement.appendChild(body);
        
        this.ghostElement.style.setProperty('--ghost-node-color', nodeData.color);
        
        // Disable animation to prevent position jump
        this.ghostElement.style.animation = 'none';
        
        // Append to body first to get dimensions
        document.body.appendChild(this.ghostElement);
        const rect = this.ghostElement.getBoundingClientRect();
        this.ghostOffsetX = rect.width / 2;
        this.ghostOffsetY = rect.height / 2;
        
        this.ghostElement.style.transform = `translate(${x - this.ghostOffsetX}px, ${y - this.ghostOffsetY}px)`;
        document.body.style.cursor = 'grabbing';
    }

    highlightHoveredNode(mouseX, mouseY, panX, panY, zoomLevel) {
        const hoveredNode = this.utils.getNodeAtPosition(mouseX, mouseY, this.canvasId, this.getAllNodes(), panX, panY, zoomLevel);
        
        this.clearAllHighlights();
        
        // Only highlight if the node can have children
        if (hoveredNode && hoveredNode.canHaveChildren !== false) {
            this.highlightNodeConnector(hoveredNode);
        }
        
        // Only set as valid drop target if it can have children
        this.currentHoveredNode = (hoveredNode && hoveredNode.canHaveChildren !== false) ? hoveredNode : null;
    }

    /**
     * Synchronous highlight for mousemove - no C# validation
     */
    highlightHoveredNodeForDragSync(mouseX, mouseY, draggedNodeData) {
        const hoveredNode = this.getValidDropTargetNodeSync(mouseX, mouseY, draggedNodeData);
        
        this.clearAllHighlights();
        
        if (hoveredNode) {
            this.highlightNodeConnector(hoveredNode);
        }
        
        this.currentHoveredNode = hoveredNode;
    }

    /**
     * Async highlight with validation for final drop
     */
    async highlightHoveredNodeForDrag(mouseX, mouseY, draggedNodeData) {
        const hoveredNode = await this.getValidDropTargetNode(mouseX, mouseY, draggedNodeData);
        
        this.clearAllHighlights();
        
        if (hoveredNode) {
            this.highlightNodeConnector(hoveredNode);
        }
        
        this.currentHoveredNode = hoveredNode;
    }

    /**
     * Synchronous validation for mousemove - no C# callback
     */
    getValidDropTargetNodeSync(mouseX, mouseY, draggedNodeData) {
        const nodeAtPosition = this.utils.getNodeAtPosition(mouseX, mouseY, this.canvasId, this.getAllNodes(), 
            this.getZoomPan().panX, this.getZoomPan().panY, this.getZoomPan().zoomLevel);
        if (!nodeAtPosition) return null;
        
        // Basic client-side validation
        if (nodeAtPosition.id === draggedNodeData.id) return null;
        if (this.isDescendant(draggedNodeData, nodeAtPosition)) return null;
        if (draggedNodeData.parent && draggedNodeData.parent.id === nodeAtPosition.id) return null;
        if (nodeAtPosition.canHaveChildren === false) return null;
        
        return nodeAtPosition;
    }

    /**
     * Async validation with C# callback for final drop
     * 
     * Validation rules:
     * 1. Cannot drop onto self
     * 2. Cannot drop onto own descendant (would create cycle)
     * 3. Cannot drop onto current parent (no-op)
     * 4. Cannot drop onto node that cannot have children (canHaveChildren=false)
     * 5. Custom C# validation via ValidateDropTarget callback
     * 
     * @param {number} mouseX - Mouse X coordinate in viewport
     * @param {number} mouseY - Mouse Y coordinate in viewport
     * @param {Object} draggedNodeData - The node being dragged
     * @returns {Object|null} Valid drop target node or null
     */
    async getValidDropTargetNode(mouseX, mouseY, draggedNodeData) {
        const nodeAtPosition = this.utils.getNodeAtPosition(mouseX, mouseY, this.canvasId, this.getAllNodes(), 
            this.getZoomPan().panX, this.getZoomPan().panY, this.getZoomPan().zoomLevel);
        if (!nodeAtPosition) {
            this.console.log('DRAG', `No node at position`, { x: mouseX, y: mouseY });
            return null;
        }
        
        if (nodeAtPosition.id === draggedNodeData.id) {
            this.console.log('DRAG', `Drop validation failed: cannot drop onto self`, { node: draggedNodeData.name });
            return null;
        }
        if (this.isDescendant(draggedNodeData, nodeAtPosition)) {
            this.console.log('DRAG', `Drop validation failed: cannot drop onto descendant`, { 
                dragged: draggedNodeData.name, 
                target: nodeAtPosition.name 
            });
            return null;
        }
        if (draggedNodeData.parent && draggedNodeData.parent.id === nodeAtPosition.id) {
            this.console.log('DRAG', `Drop validation failed: already child of target`, { 
                node: draggedNodeData.name, 
                parent: nodeAtPosition.name 
            });
            return null;
        }
        if (nodeAtPosition.canHaveChildren === false) {
            this.console.log('DRAG', `Drop validation failed: target cannot have children`, { 
                target: nodeAtPosition.name 
            });
            return null;
        }
        
        // Call custom validation callback if available
        if (this.dotNetRef) {
            try {
                const isValid = await this.dotNetRef.invokeMethodAsync(
                    'ValidateDropTarget',
                    draggedNodeData.id,
                    nodeAtPosition.id,
                    'under' // Position is always 'under' for drop target validation
                );
                
                if (!isValid) {
                    this.console.log('DRAG', `Drop validation failed: custom validation rejected`, { 
                        dragged: draggedNodeData.name, 
                        target: nodeAtPosition.name 
                    });
                    return null;
                }
            } catch (error) {
                this.console.log('ERROR', `Drop validation callback failed`, { error: error.message });
                // Continue with drop if validation callback fails
            }
        }
        
        this.console.log('DRAG', `Valid drop target found`, { 
            dragged: draggedNodeData.name, 
            target: nodeAtPosition.name 
        });
        return nodeAtPosition;
    }

    /**
     * Check if a node is a descendant of another node (prevents circular references).
     * 
     * Walks up the parent chain from 'node' checking if 'ancestor' is encountered.
     * This prevents invalid drops that would create cycles in the tree.
     * 
     * @param {Object} ancestor - Potential ancestor node
     * @param {Object} node - Node to check
     * @returns {boolean} True if node is a descendant of ancestor
     */
    isDescendant(ancestor, node) {
        let current = node.parent;
        while (current) {
            if (current.id === ancestor.id) return true;
            current = current.parent;
        }
        return false;
    }

    clearAllHighlights() {
        document.querySelectorAll('.node-connector-out').forEach(connector => {
            connector.classList.remove('drop-target-active');
        });
    }

    highlightNodeConnector(node) {
        const connector = node.element.querySelector('.node-connector-out');
        if (connector) {
            connector.classList.add('drop-target-active');
        }
    }

    async handleDrop(mouseX, mouseY, addChildToNodeCallback) {
        if (this.currentHoveredNode) {
            this.console.log('DRAG', `Executing component drop`, { 
                component: this.draggedComponent.name,
                parent: this.currentHoveredNode.name 
            });
            await addChildToNodeCallback(this.currentHoveredNode, this.draggedComponent);
        } else {
            this.console.log('DRAG', `Component drop skipped: no valid target`);
        }
    }

    async handleNodeDrop(mouseX, mouseY, draggedNodeData, moveNodeToParentCallback) {
        // Re-validate with C# callback before final drop
        const validTarget = await this.getValidDropTargetNode(mouseX, mouseY, draggedNodeData);
        
        if (validTarget) {
            this.console.log('DRAG', `Executing node drop`, { 
                node: draggedNodeData.name,
                newParent: validTarget.name,
                oldParent: draggedNodeData.parent?.name || 'root'
            });
            await moveNodeToParentCallback(draggedNodeData, validTarget);
        } else {
            this.console.log('DRAG', `Node drop rejected: validation failed`);
        }
    }

    resetDragState() {
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
        
        this.ghostOffsetX = 0;
        this.ghostOffsetY = 0;
        this.clearAllHighlights();
        
        document.body.style.cursor = '';
        
        // Restore opacity only for the specific dragged element
        if (this.draggedComponentElement) {
            this.draggedComponentElement.style.opacity = '1';
            this.draggedComponentElement = null;
        } else {
            // Fallback: restore all component items
            document.querySelectorAll('.component-item').forEach(item => {
                item.style.opacity = '1';
            });
        }
        
        this.draggedComponent = null;
        this.isDragging = false;
        this.currentHoveredNode = null;
    }

    resetNodeDragState() {
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
        
        this.ghostOffsetX = 0;
        this.ghostOffsetY = 0;
        
        if (this.draggedNode) {
            const nodeElement = document.querySelector(`[data-node-id="${this.draggedNode.id}"]`);
            if (nodeElement) nodeElement.classList.remove('dragging');
        }
        
        this.clearAllHighlights();
        
        document.body.style.cursor = '';
        
        this.draggedNode = null;
        this.isDraggingNode = false;
        this.currentHoveredNode = null;
        this.dragStartPos = null;
        this.moveNodeCallback = null;
    }

    // These need to be set from the main instance
    getAllNodes = null;
    getZoomPan = null;
}
