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

// Flowy Blazor Component - Core Instance
import { FlowyUtils } from './flowy-utils.js';
import { FlowyZoomPan } from './flowy-zoom-pan.js';
import { FlowyConnections } from './flowy-connections.js';
import { FlowyTreeLayout } from './flowy-tree-layout.js';
import { FlowyDragDrop } from './flowy-drag-drop.js';
import { FlowyConsole } from './flowy-console.js';

/**
 * Core orchestrator class for Flowy canvas instances
 * Manages all modules (zoom/pan, drag/drop, tree layout, connections)
 */
export class FlowyInstance {
    /**
     * Creates a new Flowy canvas instance
     * @param {string} canvasId - The canvas grid element ID
     * @param {Object} config - Configuration object
     * @param {Object} dotNetRef - .NET interop reference for callbacks
     */
    constructor(canvasId, config, dotNetRef) {
        this.canvasId = canvasId;
        this.config = config;
        this.dotNetRef = dotNetRef;
        this.nodes = [];
        this.nodeIdCounter = 1;
        this.rootNode = null;
        this.selectedNode = null;
        this.autoCenter = config.autoCenter === true;
        
        // Performance and timing constants
        this.LAYOUT_RECALC_DELAY = 100; // ms delay for layout recalculation to batch DOM updates
        this.ROOT_NODE_Y_OFFSET = 300; // pixels above center for root node initial position
        
        // Tree configuration
        this.TREE_CONFIG = {
            nodeWidth: 200,
            nodeHeight: 100,
            horizontalSpacing: 80,
            verticalSpacing: 180,
            rootX: 0, // Will be calculated dynamically based on viewport
            rootY: 0  // Will be calculated dynamically based on viewport
        };

        // Initialize modules
        this.console = new FlowyConsole(canvasId, config.debug || false);
        this.utils = new FlowyUtils(config, this.TREE_CONFIG);
        this.zoomPan = new FlowyZoomPan(canvasId, config, this.utils, this.console);
        this.connections = new FlowyConnections(canvasId, config, this.TREE_CONFIG, this.console);
        this.treeLayout = new FlowyTreeLayout(this.TREE_CONFIG, this.console);
        this.dragDrop = new FlowyDragDrop(canvasId, config, this.utils, this.TREE_CONFIG, this.console, dotNetRef);
        
        // Set up zoom change notification callback
        this.zoomPan.setZoomChangedCallback(async (zoomLevel) => {
            await this.notifyZoomChanged(zoomLevel);
        });
        
        // Set up AutoZoom change notification callback
        this.zoomPan.setAutoZoomChangedCallback(async (enabled) => {
            this.config.autoZoom = enabled;
            try {
                await this.dotNetRef.invokeMethodAsync('NotifyAutoZoomChanged', enabled);
            } catch (error) {
                // Silently ignore - component might be disposing
            }
        });
        
        // Set up auto-center check callback
        this.zoomPan.setAutoCenterCallback(() => this.autoCenter);
        
        // Set up center viewport callback
        this.zoomPan.setCenterViewportCallback(() => {
            if (this.autoCenter) {
                this.zoomPan.centerViewport(this.nodes);
            }
        });

        // Set up cross-module dependencies
        this.dragDrop.getAllNodes = () => this.nodes;
        this.dragDrop.getZoomPan = () => ({
            panX: this.zoomPan.panX,
            panY: this.zoomPan.panY,
            zoomLevel: this.zoomPan.zoomLevel
        });

        this.initialize();
    }

    initialize() {
        // Initialize root position based on viewport dimensions
        const viewport = this.utils.getViewport(this.canvasId);
        if (viewport) {
            const viewportDims = this.utils.getViewportDimensions(viewport);
            // Set initial root position to center of viewport
            this.TREE_CONFIG.rootX = viewportDims.width / 2;
            this.TREE_CONFIG.rootY = viewportDims.height / 2;
        }
        
        this.zoomPan.setupZoomAndPan(
            () => this.dragDrop.isDragging,
            () => this.dragDrop.isDraggingNode
        );
        
        if (this.config.enableDragDrop) {
            this.dragDrop.setupComponentDragging(
                (component) => this.createRootNode(component),
                (parent, component) => this.addChildToNode(parent, component),
                () => this.dragDrop.getZoomPan()
            );
            // Setup global drag handlers once (not per node)
            this.dragDrop.setupGlobalNodeDragHandlers();
        }
        
        this.zoomPan.centerViewport(this.nodes);
    }

    async createRootNode(component, skipNotification = false) {
        if (this.rootNode) return false;
        
        const viewport = document.getElementById(this.canvasId);
        if (!viewport) {
            this.console.log('ERROR', `Canvas viewport not found`, { canvasId: this.canvasId });
            return false;
        }
        
        const transformWrapper = document.getElementById(`${this.canvasId}-transform`);
        if (!transformWrapper) {
            this.console.log('ERROR', `Transform wrapper not found`, { canvasId: this.canvasId });
            return false;
        }
        
        const placeholder = transformWrapper.querySelector('.canvas-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // Calculate root position dynamically based on viewport dimensions
        const viewportDims = this.utils.getViewportDimensions(viewport);
        const centerX = viewportDims.width / 2;
        const centerY = viewportDims.height / 2;
        
        // Position root node: center horizontally, offset vertically to leave room for expansion downward
        const rootX = centerX - this.TREE_CONFIG.nodeWidth / 2;
        const rootY = centerY - this.ROOT_NODE_Y_OFFSET;
        
        // Update tree config root position for layout calculations
        this.TREE_CONFIG.rootX = rootX + this.TREE_CONFIG.nodeWidth / 2;
        this.TREE_CONFIG.rootY = rootY;
        
        const node = this.createNode(component, rootX, rootY, null);
        this.rootNode = node;
        this.nodes.push(node);
        transformWrapper.appendChild(node.element);
        
        // Trigger layout recalculation to apply AutoZoom/AutoCenter
        this.recalculateTreeLayout();
        
        // Notify C# asynchronously - use setTimeout to avoid blocking return
        if (!skipNotification) {
            setTimeout(() => {
                this.notifyNodeDropped(node, null, 'under', true).catch(err => 
                    this.console.log('ERROR', `Error notifying node dropped`, { error: err.message, nodeId: node.id })
                );
            }, 0);
        }
        
        return true;
    }

    /**
     * Sanitize HTML to prevent XSS attacks
     */
    sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Validate and sanitize color value
     */
    sanitizeColor(color) {
        // Only allow valid hex colors
        return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '#667eea';
    }

    createNode(component, x, y, parent) {
        const node = document.createElement('div');
        node.className = 'flow-node';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        const sanitizedColor = this.sanitizeColor(component.color);
        node.style.setProperty('--node-color', sanitizedColor);
        
        // Use provided ID only if it looks like a GUID (contains hyphens), otherwise generate new UUID
        // This ensures component template IDs (like "primary", "success") don't become node IDs
        const nodeId = (component.id && component.id.includes('-')) ? component.id : crypto.randomUUID();
        node.dataset.nodeId = nodeId;
        node.dataset.componentId = component.componentId;
        
        // Sanitize user inputs to prevent XSS (component.bodyHtml is rendered by server)
        const sanitizedName = this.sanitizeHTML(component.name);
        
        node.innerHTML = `
            <div class="node-header" style="background: ${sanitizedColor};">
                <span class="node-title">${sanitizedName}</span>
            </div>
            <div class="node-body">
                <div class="node-body-html">${component.bodyHtml}</div>
            </div>
            ${parent ? '<div class="node-connector node-connector-in"></div>' : ''}
            <div class="node-connector node-connector-out"></div>
            <div class="node-reorder-arrows">
                <button class="arrow-btn arrow-up" title="Promote to parent" data-action="promote">↑</button>
                <button class="arrow-btn arrow-down" title="Demote to child" data-action="demote">↓</button>
            </div>
        `;
        
        const nodeData = {
            id: nodeId,
            element: node,
            name: component.name,
            componentId: component.componentId,
            bodyHtml: component.bodyHtml,
            color: component.color,
            isDraggable: component.isDraggable !== false,
            canHaveChildren: component.canHaveChildren !== false,
            x,
            y,
            parent,
            children: []
        };
        
        // Apply CSS classes based on properties
        if (nodeData.isDraggable === false) {
            node.classList.add('not-draggable');
        }
        if (nodeData.canHaveChildren === false) {
            node.classList.add('no-children');
        }
        
        this.dragDrop.setupNodeDragging(
            node,
            nodeData,
            (draggedNode, newParent) => this.moveNodeToParent(draggedNode, newParent)
        );
        
        // Setup arrow button handlers
        this.setupArrowButtons(node, nodeData);
        
        // Setup node selection click handler
        this.setupNodeClickHandler(node, nodeData);
        
        return nodeData;
    }

    /**
     * Setup promote/demote arrow button handlers
     */
    setupArrowButtons(element, nodeData) {
        const arrowUp = element.querySelector('.arrow-up');
        const arrowDown = element.querySelector('.arrow-down');
        
        if (arrowUp) {
            arrowUp.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.promoteNode(nodeData);
            });
        }
        
        if (arrowDown) {
            arrowDown.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.demoteNode(nodeData);
            });
        }
        
        // Update arrow visibility based on node position
        this.updateArrowVisibility(element, nodeData);
    }

    /**
     * Update arrow button visibility based on node position in tree
     */
    updateArrowVisibility(element, nodeData) {
        const arrowUp = element.querySelector('.arrow-up');
        const arrowDown = element.querySelector('.arrow-down');
        
        if (arrowUp) {
            // Hide up arrow if:
            // - Node is root OR parent is root (can't replace root)
            // - Node is not draggable (locked)
            // - Parent is not draggable (locked) - can't demote locked parent
            // - Node can't have children (would need to accept demoted parent as child)
            const canPromote = nodeData.parent && 
                              nodeData.parent.parent && 
                              nodeData.isDraggable !== false &&
                              nodeData.parent.isDraggable !== false &&
                              nodeData.canHaveChildren !== false;
            arrowUp.style.display = canPromote ? 'flex' : 'none';
        }
        
        if (arrowDown) {
            // Hide down arrow if:
            // - Node is root OR has no children
            // - Node is not draggable (locked)
            // - First child is not draggable (locked) - can't promote locked child
            // - First child can't have children (would need to accept parent as child)
            const firstChild = nodeData.children.length > 0 ? nodeData.children[0] : null;
            const canDemote = nodeData.parent && 
                             nodeData.children.length > 0 && 
                             nodeData.isDraggable !== false &&
                             firstChild?.isDraggable !== false &&
                             firstChild?.canHaveChildren !== false;
            arrowDown.style.display = canDemote ? 'flex' : 'none';
        }
    }

    /**
     * Setup node click handler for selection
     */
    setupNodeClickHandler(element, nodeData) {
        element.addEventListener('click', (e) => {
            // Don't select if clicking on buttons or during drag
            if (e.target.closest('button') || this.dragDrop.isDragging || this.dragDrop.isDraggingNode) {
                return;
            }
            this.selectNode(nodeData);
        });
    }

    /**
     * Select a node (visual highlight + notify C#)
     */
    async selectNode(nodeData) {
        const previousNode = this.selectedNode;
        
        // Deselect previous node if different
        if (previousNode && previousNode !== nodeData) {
            previousNode.element.classList.remove('flowy-node--selected');
        }
        
        // Select new node
        this.selectedNode = nodeData;
        nodeData.element.classList.add('flowy-node--selected');
        
        // Notify C# (with previous node info)
        try {
            await this.dotNetRef.invokeMethodAsync('NotifyNodeSelected', 
                nodeData.id, 
                previousNode ? previousNode.id : null
            );
        } catch (error) {
            this.console.log('ERROR', 'Failed to notify node selected', { error: error.message });
        }
    }

    /**
     * Deselect the currently selected node
     */
    deselectNode() {
        if (this.selectedNode) {
            const previousNode = this.selectedNode;
            this.selectedNode.element.classList.remove('flowy-node--selected');
            this.selectedNode = null;
            
            // Notify C# (null node, with previous node info)
            try {
                this.dotNetRef.invokeMethodAsync('NotifyNodeSelected', null, previousNode.id);
            } catch (error) {
                this.console.log('ERROR', 'Failed to notify node deselected', { error: error.message });
            }
        }
    }

    async addChildToNode(parentNode, component, skipNotification = false) {
        // Validate drop target before adding
        if (this.dotNetRef && !skipNotification) {
            try {
                const isValid = await this.dotNetRef.invokeMethodAsync(
                    'ValidateDropTarget',
                    component.componentId, // Pass componentId instead of node ID
                    parentNode.id,
                    'under'
                );
                
                if (!isValid) {
                    this.console.log('DRAG', `Drop rejected by validation`, { 
                        component: component.name, 
                        target: parentNode.name 
                    });
                    return; // Abort the drop
                }
            } catch (error) {
                this.console.log('ERROR', `Validation callback failed`, { error: error.message });
                // Continue with drop if validation fails
            }
        }
        
        const transformWrapper = document.getElementById(`${this.canvasId}-transform`);
        if (!transformWrapper) {
            const error = `Transform wrapper not found: ${this.canvasId}`;
            this.console.log('ERROR', error, { canvasId: this.canvasId });
            throw new Error(error);
        }
        
        const childIndex = parentNode.children.length;
        const position = this.treeLayout.calculateChildPosition(parentNode, childIndex);
        
        const childNode = this.createNode(component, position.x, position.y, parentNode);
        this.nodes.push(childNode);
        parentNode.children.push(childNode);
        transformWrapper.appendChild(childNode.element);
        
        this.connections.createConnection(parentNode, childNode);
        this.recalculateTreeLayout();

        if (!skipNotification) {
            await this.notifyNodeDropped(childNode, parentNode, 'under', true);
        }
    }

    removeNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return false;

        // Collect all descendants (including the node itself)
        const nodesToRemove = [node];
        const collectDescendants = (n) => {
            n.children.forEach(child => {
                nodesToRemove.push(child);
                collectDescendants(child);
            });
        };
        collectDescendants(node);

        // Remove all nodes (descendants first, then parent)
        nodesToRemove.forEach(n => {
            // Clean up event listeners
            this.dragDrop.cleanupNodeListeners(n.id);
            
            // Remove from DOM
            n.element.remove();
            
            // Remove connections
            this.connections.removeConnection(n.id);
            
            // Remove from nodes array
            this.nodes = this.nodes.filter(existing => existing.id !== n.id);
        });

        // Update tree structure
        if (node.parent) {
            node.parent.children = node.parent.children.filter(c => c.id !== nodeId);
        } else if (this.rootNode?.id === nodeId) {
            this.rootNode = null;
        }

        this.recalculateTreeLayout();

        // Notify C# to sync TreeService
        if (this.dotNetRef) {
            this.dotNetRef.invokeMethodAsync('NotifyNodeRemoved', nodeId).catch(error => {
                this.console.log('ERROR', `Error notifying node removed`, { 
                    error: error.message, 
                    nodeId
                });
            });
        }

        return true;
    }

    async moveNodeToParent(nodeToMove, newParent) {
        if (nodeToMove.parent) {
            const index = nodeToMove.parent.children.indexOf(nodeToMove);
            if (index > -1) {
                nodeToMove.parent.children.splice(index, 1);
            }
            this.connections.removeConnection(nodeToMove.id);
        }
        
        nodeToMove.parent = newParent;
        newParent.children.push(nodeToMove);
        this.connections.createConnection(newParent, nodeToMove);
        
        this.updateChildConnections(nodeToMove);
        this.recalculateTreeLayout();

        // Notify C# to sync TreeService
        try {
            await this.dotNetRef.invokeMethodAsync(
                'NotifyNodeMoved',
                nodeToMove.id,
                newParent.id
            );
        } catch (error) {
            this.console.log('ERROR', `Error notifying node moved`, { 
                error: error.message, 
                nodeId: nodeToMove.id,
                newParentId: newParent.id
            });
        }
    }

    /**
     * Promote a node to become parent of its current parent
     * Child becomes Parent, Parent becomes Child
     */
    async promoteNode(node) {
        if (!node.parent) {
            this.console.log('TREE', `Cannot promote root node`, { nodeId: node.id, nodeName: node.name });
            return false;
        }

        const oldParent = node.parent;
        
        // Prevent changing the root node position
        if (!oldParent.parent) {
            this.console.log('TREE', `Cannot promote node - would replace the root node`, { 
                nodeId: node.id, 
                nodeName: node.name,
                parentName: oldParent.name 
            });
            return false;
        }
        
        const grandParent = oldParent.parent;
        
        // Store the promoted node's existing children - they will become children of the demoted parent
        const promotedNodeChildren = [...node.children];
        
        // Store the promoted node's siblings (other children of oldParent) - they become siblings of demoted parent
        const promotedNodeSiblings = oldParent.children.filter(child => child.id !== node.id);
        
        // Clear old parent's children array
        oldParent.children = [];
        
        // Replace old parent with promoted node in grandparent's children
        const parentIndex = grandParent.children.indexOf(oldParent);
        if (parentIndex > -1) {
            grandParent.children[parentIndex] = node;
        }
        node.parent = grandParent;
        
        // Clear promoted node's children
        node.children = [];
        
        // Old parent becomes child of promoted node
        oldParent.parent = node;
        node.children.push(oldParent);
        
        // Promoted node's siblings become siblings of the demoted parent (under promoted node)
        promotedNodeSiblings.forEach(sibling => {
            sibling.parent = node;
            node.children.push(sibling);
        });
        
        // Transfer promoted node's original children to the demoted parent
        promotedNodeChildren.forEach(child => {
            child.parent = oldParent;
            oldParent.children.push(child);
        });
        
        // Rebuild all connections: clear old ones, recreate from tree structure, then update positions
        this.connections.clearAll();
        this.rebuildAllConnections(this.rootNode);
        this.recalculateTreeLayout(true); // Skip zoom/pan - user is just restructuring

        // Sync TreeService with the promotion
        try {
            await this.dotNetRef.invokeMethodAsync('NotifyNodePromoted', node.id);
        } catch (error) {
            this.console.log('ERROR', `Error notifying node promoted`, { 
                error: error.message, 
                nodeId: node.id
            });
        }

        this.console.log('TREE', `Node promoted successfully`, { 
            nodeId: node.id,
            nodeName: node.name,
            newParentName: node.parent.name
        });

        return true;
    }

    /**
     * Demote a node to become child of its first child
     * Parent becomes Child, Child becomes Parent
     * First child's children move down to become demoted node's children
     */
    async demoteNode(node) {
        // Prevent demoting the root node
        if (!node.parent) {
            this.console.log('TREE', `Cannot demote the root node`, { nodeId: node.id, nodeName: node.name });
            return false;
        }
        
        if (node.children.length === 0) {
            this.console.log('TREE', `Cannot demote node without children`, { nodeId: node.id, nodeName: node.name });
            return false;
        }

        const firstChild = node.children[0];
        const parent = node.parent;
        
        // Store the first child's existing children (grandchildren) - they will move to demoted node
        const grandChildren = [...firstChild.children];
        
        // Store node's OTHER children (excluding firstChild) - they become siblings of promoted child
        const demotedNodeSiblings = node.children.slice(1);
        
        // Clear both nodes' children arrays
        node.children = [];
        firstChild.children = [];
        
        // Update parent relationships
        if (parent) {
            const nodeIndex = parent.children.indexOf(node);
            if (nodeIndex > -1) {
                parent.children[nodeIndex] = firstChild;
            }
            firstChild.parent = parent;
        } else {
            // Node was root, first child becomes new root
            firstChild.parent = null;
            this.rootNode = firstChild;
        }
        
        // Node becomes child of its former first child
        node.parent = firstChild;
        firstChild.children.push(node);
        
        // Demoted node's other children become siblings of promoted child (under promoted child)
        demotedNodeSiblings.forEach(sibling => {
            sibling.parent = firstChild;
            firstChild.children.push(sibling);
        });
        
        // Transfer first child's children (grandchildren) to demoted node
        grandChildren.forEach(child => {
            child.parent = node;
            node.children.push(child);
        });
        
        // Rebuild all connections: clear old ones, recreate from tree structure, then update positions
        this.connections.clearAll();
        this.rebuildAllConnections(this.rootNode);
        this.recalculateTreeLayout(true); // Skip zoom/pan - user is just restructuring

        // Sync TreeService with the demotion
        try {
            await this.dotNetRef.invokeMethodAsync('NotifyNodeDemoted', node.id);
        } catch (error) {
            this.console.log('ERROR', `Error notifying node demoted`, { 
                error: error.message, 
                nodeId: node.id
            });
        }

        this.console.log('TREE', `Node demoted successfully`, { 
            nodeId: node.id,
            nodeName: node.name,
            newParentName: node.parent.name
        });

        return true;
    }

    /**
     * Rebuild all connections recursively from a root node
     */
    rebuildAllConnections(node) {
        if (!node) return;
        
        node.children.forEach(child => {
            this.connections.createConnection(node, child);
            this.rebuildAllConnections(child);
        });
    }

    updateChildConnections(node) {
        node.children.forEach(child => {
            this.connections.removeConnection(child.id);
            this.connections.createConnection(node, child);
            this.updateChildConnections(child);
        });
    }

    recalculateTreeLayout(skipZoomPan = false) {
        if (!this.rootNode) return;
        
        // Clear layout cache before recalculation to ensure fresh calculations
        this.treeLayout.clearCache();
        
        this.treeLayout.calculateSubtreePositions(this.rootNode, this.TREE_CONFIG.rootX, this.TREE_CONFIG.rootY);
        this.treeLayout.updateNodePositions(this.rootNode);
        this.connections.updateAllConnections();
        
        // Update arrow visibility for all nodes
        this.nodes.forEach(node => {
            this.updateArrowVisibility(node.element, node);
        });
        
        // Skip zoom/pan adjustments if requested (e.g., during promote/demote)
        if (skipZoomPan) {
            this.console.log('LAYOUT', `Layout recalculated without zoom/pan changes`, { 
                nodeCount: this.nodes.length
            });
            return;
        }
        
        // Auto Zoom takes priority over Auto Center (zoom includes centering)
        if (this.config.autoZoom) {
            // Delay allows DOM to settle before calculating bounds
            setTimeout(() => this.zoomPan.zoomToFit(this.nodes, this.TREE_CONFIG), this.LAYOUT_RECALC_DELAY);
        } else if (this.autoCenter) {
            this.zoomPan.centerViewport(this.nodes);
        } else {
            this.console.log('LAYOUT', `Manual pan mode active - no auto-center/zoom`, { 
                nodeCount: this.nodes.length,
                autoZoom: this.config.autoZoom,
                autoCenter: this.autoCenter
            });
        }
    }

    async notifyNodeDropped(node, targetNode, position, isNewNode) {
        const nodeData = {
            id: node.id,
            name: node.name,
            componentId: node.componentId,
            color: node.color,
            isDraggable: node.isDraggable !== false,
            canHaveChildren: node.canHaveChildren !== false
        };

        try {
            await this.dotNetRef.invokeMethodAsync(
                'NotifyNodeDropped',
                JSON.stringify(nodeData),
                targetNode?.id || '',
                position,
                isNewNode
            );
        } catch (error) {
            this.console.log('ERROR', `Error notifying node dropped`, { 
                error: error.message, 
                nodeId: node.id,
                targetNodeId: targetNode?.id 
            });
        }
    }

    reset() {
        this.nodes = [];
        this.rootNode = null;
        
        const transformWrapper = document.getElementById(`${this.canvasId}-transform`);
        if (transformWrapper) {
            transformWrapper.querySelectorAll('.flow-node').forEach(el => el.remove());
            
            const placeholder = transformWrapper.querySelector('.canvas-placeholder');
            if (placeholder) placeholder.style.display = '';
        }
        
        this.connections.clearAll();
        
        // Reset zoom and pan to defaults
        if (this.zoomPan) {
            this.zoomPan.reset();
        }
    }

    dispose() {
        // Clean up event listeners and resources
        this.zoomPan.cleanup();
        this.dragDrop.cleanup();
        this.reset();
    }

    addNode(nodeData, skipNotification = false) {
        // Public method for programmatic node addition
        this.console.log('ACTION', 'Adding node programmatically', { 
            nodeId: nodeData.id,
            nodeName: nodeData.name,
            parentId: nodeData.parentId,
            skipNotification,
            currentNodesCount: this.nodes.length
        });
        
        const parent = nodeData.parentId ? this.nodes.find(n => n.id === nodeData.parentId) : null;
        if (nodeData.parentId && !parent) {
            this.console.log('ERROR', 'Parent node not found in addNode', { 
                parentId: nodeData.parentId,
                nodeData: nodeData.name,
                availableNodeIds: this.nodes.map(n => n.id)
            });
            return false;
        }

        const component = {
            id: nodeData.id,
            name: nodeData.name,
            componentId: nodeData.componentId,
            bodyHtml: nodeData.bodyHtml,
            color: nodeData.color
        };

        if (parent) {
            this.console.log('ACTION', 'Adding as child to parent', { parentName: parent.name });
            this.addChildToNode(parent, component, skipNotification);
        } else {
            this.console.log('ACTION', 'Creating root node', { nodeName: component.name });
            this.createRootNode(component, skipNotification);
        }
        this.console.log('ACTION', 'Node addition complete', { totalNodes: this.nodes.length });
        return true;
    }

    // Delegated methods to modules
    zoomIn() { this.zoomPan.zoomIn(this.rootNode); }
    zoomOut() { this.zoomPan.zoomOut(this.rootNode); }
    zoomReset() { this.zoomPan.zoomReset(this.nodes); }
    zoomToFit() { this.zoomPan.zoomToFit(this.nodes, this.TREE_CONFIG); }
    centerCanvas() { this.zoomPan.centerViewport(this.nodes); }
    focusItem(nodeId) { return this.zoomPan.focusItem(nodeId, this.nodes); }
    
    setAutoZoom(enabled) {
        const oldValue = this.config.autoZoom;
        this.config.autoZoom = enabled;
        this.console.log('CONFIG', `Auto-Zoom ${enabled ? 'ENABLED' : 'DISABLED'}`, { 
            oldValue, 
            newValue: enabled,
            nodeCount: this.nodes.length 
        });
        
        // Notify C# of the change
        if (this.zoomPan.onAutoZoomChangedCallback) {
            this.zoomPan.onAutoZoomChangedCallback(enabled);
        }
        
        if (enabled && this.nodes.length > 0) {
            this.zoomToFit();
        }
    }
    
    fitAllNodesInViewport() {
        this.console.log('ACTION', `Fit all nodes in viewport (one-time)`);
        if (this.nodes.length > 0) {
            this.zoomPan.zoomToFit(this.nodes, this.TREE_CONFIG);
        }
    }
    
    setPanningEnabled(enabled) {
        const oldValue = this.zoomPan.panningEnabled;
        this.zoomPan.panningEnabled = enabled;
        this.console.log('CONFIG', `Panning ${enabled ? 'ENABLED' : 'DISABLED'}`, { 
            oldValue, 
            newValue: enabled,
            wasPanning: this.zoomPan.isPanning 
        });
        if (!enabled && this.zoomPan.isPanning) {
            this.zoomPan.isPanning = false;
            const viewport = this.utils.getViewport(this.canvasId);
            if (viewport) viewport.style.cursor = '';
        }
    }
    
    setZoomLevel(level, userInitiated = false) {
        const oldLevel = this.zoomPan.zoomLevel;
        const newLevel = Math.max(this.zoomPan.minZoom, Math.min(this.zoomPan.maxZoom, level));
        this.console.log('CONFIG', `Zoom Level set`, { 
            oldValue: oldLevel.toFixed(2), 
            newValue: newLevel.toFixed(2),
            requested: level.toFixed(2),
            min: this.zoomPan.minZoom,
            max: this.zoomPan.maxZoom,
            userInitiated
        });
        if (this.rootNode) {
            const viewport = this.utils.getViewport(this.canvasId);
            if (viewport) {
                const { width, height } = this.utils.getViewportDimensions(viewport);
                const rootCenter = this.utils.calculateNodeCenter(this.rootNode);
                const target = this.utils.calculateTargetPanForCenter(rootCenter.x, rootCenter.y, width, height, newLevel);
                this.zoomPan.smoothZoomTo(newLevel);
                this.zoomPan.smoothPanTo(target.x, target.y);
                
                // Notify C# with userInitiated flag
                this.notifyZoomChanged(newLevel, userInitiated);
            }
        } else {
            this.zoomPan.smoothZoomTo(newLevel);
            this.notifyZoomChanged(newLevel, userInitiated);
        }
    }
    
    setAutoCenter(enabled) {
        const oldValue = this.autoCenter;
        this.autoCenter = enabled;
        this.console.log('CONFIG', `Auto-Center ${enabled ? 'ENABLED' : 'DISABLED'}`, { 
            oldValue, 
            newValue: enabled,
            willCenter: enabled && this.nodes.length > 0
        });
        if (enabled) this.centerCanvas();
    }
    
    setSmooth(enabled) {
        const oldValue = this.zoomPan.smoothEnabled;
        this.zoomPan.smoothEnabled = enabled;
        this.console.log('CONFIG', `Smooth Animations ${enabled ? 'ENABLED' : 'DISABLED'}`, { 
            oldValue, 
            newValue: enabled,
            wasAnimating: this.zoomPan.isAnimating
        });
        if (!enabled && this.zoomPan.isAnimating) {
            this.zoomPan.stopSmoothAnimation();
        }
    }
    
    setPosition(x, y) {
        this.console.log('CONFIG', `Position set`, { 
            oldPosition: { x: this.zoomPan.panX.toFixed(2), y: this.zoomPan.panY.toFixed(2) },
            newPosition: { x: x.toFixed(2), y: y.toFixed(2) }
        });
        this.zoomPan.smoothPanTo(x, y);
    }
    
    setDragDropEnabled(enabled) {
        const oldValue = this.config.enableDragDrop;
        this.config.enableDragDrop = enabled;
        this.console.log('CONFIG', `Drag & Drop ${enabled ? 'ENABLED' : 'DISABLED'}`, { 
            oldValue, 
            newValue: enabled
        });
        
        // Toggle CSS classes to show/hide grab cursor
        const viewport = document.getElementById(this.canvasId);
        if (viewport) {
            if (enabled) {
                viewport.classList.remove('drag-disabled');
            } else {
                viewport.classList.add('drag-disabled');
            }
        }
        
        // Toggle drag-disabled class on all component panels
        document.querySelectorAll('.components-panel').forEach(panel => {
            if (enabled) {
                panel.classList.remove('drag-disabled');
            } else {
                panel.classList.add('drag-disabled');
            }
        });
    }
    
    setNodeDraggable(nodeId, draggable) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            const oldValue = node.isDraggable;
            node.isDraggable = draggable;
            this.console.log('CONFIG', `Node draggable state changed`, { 
                nodeId,
                nodeName: node.name,
                oldValue, 
                newValue: draggable
            });
            if (draggable) {
                node.element.classList.remove('not-draggable');
            } else {
                node.element.classList.add('not-draggable');
            }
        } else {
            this.console.log('CONFIG', `Failed to set node draggable: node not found`, { nodeId });
        }
    }
    
    setNodeCanHaveChildren(nodeId, canHaveChildren) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            const oldValue = node.canHaveChildren;
            node.canHaveChildren = canHaveChildren;
            this.console.log('CONFIG', `Node canHaveChildren state changed`, { 
                nodeId,
                nodeName: node.name,
                oldValue, 
                newValue: canHaveChildren
            });
            if (canHaveChildren) {
                node.element.classList.remove('no-children');
            } else {
                node.element.classList.add('no-children');
            }
        } else {
            this.console.log('CONFIG', `Failed to set node canHaveChildren: node not found`, { nodeId });
        }
    }

    /**
     * Animates droplets flowing from one node to another through the tree
     * @param {string} startNodeId - GUID of starting node
     * @param {string} endNodeId - GUID of destination node
     * @param {number} duration - Duration in ms for each segment
     * @param {number} dropletCount - Number of droplets to animate
     * @param {number} dropletDelay - Delay between droplet starts in ms
     * @param {number} dropletDistance - Distance offset (0-1) between droplets along path
     * @param {string} easing - Easing function name
     * @returns {Promise<boolean>} True if successful, false if no path found
     */
    async flowDroplets(startNodeId, endNodeId, duration = 800, dropletCount = 5, dropletDelay = 150, dropletDistance = 0, easing = 'easeInOut') {
        return await this.connections.flowDroplets(
            startNodeId, 
            endNodeId, 
            this.nodes, 
            duration, 
            dropletCount, 
            dropletDelay,
            dropletDistance,
            easing
        );
    }
    
    async notifyZoomChanged(zoomLevel) {
        try {
            await this.dotNetRef.invokeMethodAsync('NotifyZoomChanged', zoomLevel);
        } catch (error) {
            // Silently ignore - component might be disposing
        }
    }
}
