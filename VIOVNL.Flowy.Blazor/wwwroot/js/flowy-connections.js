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

// Flowy Blazor Component - Connection Management

/**
 * Manages SVG connections between nodes in the Flowy canvas
 */
export class FlowyConnections {
    /**
     * Creates a new FlowyConnections instance
     * @param {string} canvasId - The ID of the canvas element
     * @param {Object} config - Configuration object
     * @param {Object} treeConfig - Tree layout configuration
     * @param {FlowyConsole} console - Debug console instance
     */
    constructor(canvasId, config, treeConfig, console) {
        this.canvasId = canvasId;
        this.config = config;
        this.TREE_CONFIG = treeConfig;
        this.console = console;
        this.connections = [];
    }

    createConnection(fromNode, toNode) {
        const svg = this.getOrCreateSvg();
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.classList.add('connection-line');
        line.dataset.fromNode = fromNode.id;
        line.dataset.toNode = toNode.id;
        
        this.updateConnectionLine(line, fromNode.element, toNode.element);
        
        svg.appendChild(line);
        this.connections.push({ line, fromNode, toNode });
    }

    getOrCreateSvg() {
        const transformWrapper = document.getElementById(`${this.canvasId}-transform`);
        let svg = transformWrapper.querySelector('.connections-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('connections-svg');
            // SVG fills the transform wrapper which scales with zoom
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.overflow = 'visible';
            transformWrapper.insertBefore(svg, transformWrapper.firstChild);
        }
        return svg;
    }

    updateConnectionLine(line, fromElement, toElement) {
        // Calculate center positions (1px offset corrects for visual alignment with node connectors)
        const fromX = parseFloat(fromElement.style.left) + this.TREE_CONFIG.nodeWidth / 2;
        const fromNodeHeight = fromElement.offsetHeight || this.TREE_CONFIG.nodeHeight;
        const fromY = parseFloat(fromElement.style.top) + fromNodeHeight;
        const toX = parseFloat(toElement.style.left) + this.TREE_CONFIG.nodeWidth / 2;
        const toY = parseFloat(toElement.style.top);
        
        const verticalDistance = toY - fromY;
        const horizontalDistance = Math.abs(toX - fromX);
        
        const curveTension = Math.min(verticalDistance * 0.6, 120);
        const horizontalOffset = Math.min(horizontalDistance * 0.3, 60);
        
        const controlY1 = fromY + curveTension;
        const controlY2 = toY - curveTension;
        
        const controlX1 = fromX + (toX > fromX ? horizontalOffset : -horizontalOffset);
        const controlX2 = toX - (toX > fromX ? horizontalOffset : -horizontalOffset);
        
        const path = `M ${fromX} ${fromY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${toX} ${toY}`;
        
        line.setAttribute('d', path);
        line.setAttribute('stroke', '#667eea');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('stroke-linejoin', 'round');
    }

    updateAllConnections() {
        this.connections.forEach(conn => {
            this.updateConnectionLine(conn.line, conn.fromNode.element, conn.toNode.element);
        });
    }

    removeConnection(toNodeId) {
        this.connections = this.connections.filter(conn => conn.toNode.id !== toNodeId);
        const oldLine = document.querySelector(`.connection-line[data-to-node="${toNodeId}"]`);
        if (oldLine) oldLine.remove();
    }

    clearAll() {
        this.connections = [];
        const transformWrapper = document.getElementById(`${this.canvasId}-transform`);
        if (transformWrapper) {
            transformWrapper.querySelectorAll('.connection-line').forEach(el => el.remove());
            transformWrapper.querySelectorAll('.connections-svg').forEach(el => el.remove());
            transformWrapper.querySelectorAll('.flow-droplet').forEach(el => el.remove());
        }
    }

    /**
     * Animates droplets flowing from startNodeId to endNodeId through the tree structure
     * @param {string} startNodeId - GUID of the starting node
     * @param {string} endNodeId - GUID of the destination node
     * @param {Object} allNodes - Array of all nodes in the tree
     * @param {number} duration - Duration in ms for each segment animation (default: 800)
     * @param {number} dropletCount - Number of droplets to animate (default: 5)
     * @param {number} dropletDelay - Delay in ms between droplet starts (default: 150)
     * @param {number} dropletDistance - Distance offset (0-1) between droplets along path (default: 0, spawns together)
     * @param {string} easing - Easing function name: 'linear', 'easeIn', 'easeOut', 'easeInOut', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad', 'easeInCubic' (default: 'easeInOut')
     */
    async flowDroplets(startNodeId, endNodeId, allNodes, duration = 800, dropletCount = 5, dropletDelay = 150, dropletDistance = 0, easing = 'easeInOut') {
        this.console.log('FLOW', `Starting droplet animation`, { 
            from: startNodeId, 
            to: endNodeId,
            dropletCount,
            duration,
            dropletDelay,
            dropletDistance,
            easing
        });

        // Find the path from start to end
        const path = this.findPath(startNodeId, endNodeId, allNodes);
        
        if (!path || path.length < 2) {
            this.console.log('FLOW', `No valid path found between nodes`, { 
                from: startNodeId, 
                to: endNodeId 
            });
            return false;
        }

        this.console.log('FLOW', `Path found`, { 
            path: path.map(n => n.name),
            segments: path.length - 1
        });

        // Animate multiple droplets with staggered starts
        const animations = [];
        for (let i = 0; i < dropletCount; i++) {
            const delay = i * dropletDelay;
            const distanceOffset = i * dropletDistance;
            animations.push(
                this.animateDropletAlongPath(path, duration, delay, distanceOffset, easing)
            );
        }

        await Promise.all(animations);
        this.console.log('FLOW', `All droplets completed`, { 
            from: startNodeId, 
            to: endNodeId 
        });
        return true;
    }

    /**
     * Finds the shortest path between two nodes in the tree
     * @param {string} startId - Starting node GUID
     * @param {string} endId - Ending node GUID
     * @param {Object} allNodes - Array of all nodes
     * @returns {Array|null} Array of nodes representing the path, or null if no path exists
     */
    findPath(startId, endId, allNodes) {
        const startNode = allNodes.find(n => n.id === startId);
        const endNode = allNodes.find(n => n.id === endId);

        if (!startNode || !endNode) {
            return null;
        }

        // BFS to find shortest path
        const queue = [[startNode]];
        const visited = new Set([startId]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentNode = path[path.length - 1];

            if (currentNode.id === endId) {
                return path;
            }

            // Check children
            if (currentNode.children) {
                for (const child of currentNode.children) {
                    if (!visited.has(child.id)) {
                        visited.add(child.id);
                        queue.push([...path, child]);
                    }
                }
            }

            // Check parent
            if (currentNode.parent && !visited.has(currentNode.parent.id)) {
                visited.add(currentNode.parent.id);
                queue.push([...path, currentNode.parent]);
            }
        }

        return null; // No path found
    }

    /**
     * Animates a single droplet along the path
     * @param {Array} path - Array of nodes representing the path
     * @param {number} duration - Duration for each segment
     * @param {number} initialDelay - Delay before starting this droplet
     * @param {number} distanceOffset - Progress offset (0-1) along the path for this droplet
     * @param {string} easing - Easing function name
     */
    async animateDropletAlongPath(path, duration, initialDelay, distanceOffset = 0, easing = 'easeInOut') {
        // Wait for initial delay
        if (initialDelay > 0) {
            this.console.log('FLOW', `Droplet starting with delay`, { delayMs: initialDelay });
            await new Promise(resolve => setTimeout(resolve, initialDelay));
        }

        const svg = this.getOrCreateSvg();
        
        // Create droplet element
        const droplet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        droplet.classList.add('flow-droplet');
        droplet.setAttribute('r', '6');
        droplet.setAttribute('fill', '#667eea');
        droplet.setAttribute('filter', 'url(#droplet-glow)');
        svg.appendChild(droplet);

        // Create glow filter if it doesn't exist
        this.ensureDropletFilter(svg);

        // Animate through each segment of the path
        for (let i = 0; i < path.length - 1; i++) {
            const fromNode = path[i];
            const toNode = path[i + 1];
            
            // Calculate segment-specific distance offset
            const segmentOffset = (i === 0) ? distanceOffset : 0;
            await this.animateDropletSegment(droplet, fromNode, toNode, duration, segmentOffset, easing);
        }

        // Remove droplet after animation completes
        droplet.remove();
    }

    /**
     * Animates droplet along a single connection segment
     * @param {SVGElement} droplet - The droplet circle element
     * @param {Object} fromNode - Starting node
     * @param {Object} toNode - Ending node
     * @param {number} duration - Animation duration in ms
     * @param {number} startOffset - Starting progress offset (0-1) for this segment
     * @param {string} easing - Easing function name
     */
    async animateDropletSegment(droplet, fromNode, toNode, duration, startOffset = 0, easing = 'easeInOut') {
        const fromElement = fromNode.element;
        const toElement = toNode.element;

        // Calculate positions
        const fromX = parseFloat(fromElement.style.left) + this.TREE_CONFIG.nodeWidth / 2;
        const fromNodeHeight = fromElement.offsetHeight || this.TREE_CONFIG.nodeHeight;
        const fromY = parseFloat(fromElement.style.top) + fromNodeHeight;
        const toX = parseFloat(toElement.style.left) + this.TREE_CONFIG.nodeWidth / 2;
        const toY = parseFloat(toElement.style.top);

        // Calculate control points for Bézier curve (matching connection lines)
        const verticalDistance = toY - fromY;
        const horizontalDistance = Math.abs(toX - fromX);
        
        const curveTension = Math.min(verticalDistance * 0.6, 120);
        const horizontalOffset = Math.min(horizontalDistance * 0.3, 60);
        
        const controlY1 = fromY + curveTension;
        const controlY2 = toY - curveTension;
        
        const controlX1 = fromX + (toX > fromX ? horizontalOffset : -horizontalOffset);
        const controlX2 = toX - (toX > fromX ? horizontalOffset : -horizontalOffset);

        // Animate along the curve
        const startTime = performance.now();
        
        return new Promise(resolve => {
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                let progress = Math.min(elapsed / duration, 1);
                
                // Apply easing function
                progress = this.applyEasing(progress, easing);
                
                // Apply starting offset (only affects first frame)
                progress = startOffset + (progress * (1 - startOffset));

                // Cubic bezier curve calculation
                const t = progress;
                const invT = 1 - t;
                
                const x = invT * invT * invT * fromX +
                         3 * invT * invT * t * controlX1 +
                         3 * invT * t * t * controlX2 +
                         t * t * t * toX;
                         
                const y = invT * invT * invT * fromY +
                         3 * invT * invT * t * controlY1 +
                         3 * invT * t * t * controlY2 +
                         t * t * t * toY;

                droplet.setAttribute('cx', x);
                droplet.setAttribute('cy', y);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };

            requestAnimationFrame(animate);
        });
    }

    /**
     * Ensures the glow filter for droplets exists in the SVG
     * @param {SVGElement} svg - The SVG container
     */
    ensureDropletFilter(svg) {
        if (!svg.querySelector('#droplet-glow')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <filter id="droplet-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            `;
            svg.insertBefore(defs, svg.firstChild);
        }
    }

    /**
     * Applies easing function to progress value (0-1)
     * @param {number} t - Progress value (0-1)
     * @param {string} easingName - Name of easing function
     * @returns {number} Eased progress value (0-1)
     */
    applyEasing(t, easingName) {
        switch (easingName) {
            case 'linear':
                return t;
            
            case 'easeIn':
                return t * t;
            
            case 'easeOut':
                return t * (2 - t);
            
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            
            case 'easeInQuad':
                return t * t;
            
            case 'easeOutQuad':
                return t * (2 - t);
            
            case 'easeInOutQuad':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            
            case 'easeInCubic':
                return t * t * t;
            
            default:
                // Default to easeInOut
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        }
    }
}
