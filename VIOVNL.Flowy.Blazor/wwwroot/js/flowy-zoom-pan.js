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

// Flowy Blazor Component - Zoom and Pan System

/**
 * Manages zoom and pan operations with smooth animations and momentum physics
 */
export class FlowyZoomPan {
    /**
     * Creates a new zoom and pan manager
     * @param {string} canvasId - The canvas grid element ID
     * @param {Object} config - Configuration object
     * @param {FlowyUtils} utils - Utility functions instance
     * @param {FlowyConsole} console - Debug console instance
     */
    constructor(canvasId, config, utils, console) {
        this.canvasId = canvasId;
        this.config = config;
        this.utils = utils;
        this.console = console;
        
        // Zoom and Pan properties
        this.zoomLevel = config.zoomLevel || 1.0;
        this.lastNotifiedZoomLevel = this.zoomLevel; // Track last notified value to prevent spam
        this.minZoom = 0.1;
        this.maxZoom = 3.0;
        this.zoomStep = 0.1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.lastPanX = 0;
        this.lastPanY = 0;
        this.panningEnabled = config.enablePanning !== false;
        
        // Smooth animation properties and constants
        this.smoothEnabled = config.smooth !== false;
        this.isAnimating = false;
        this.animationId = null;
        this.targetPanX = 0;
        this.targetPanY = 0;
        this.targetZoom = 1.0;
        this.panVelocityX = 0;
        this.panVelocityY = 0;
        
        // Animation physics constants (tuned for natural feel)
        this.FRICTION = 0.85; // Momentum decay per frame - 0.85 gives ~3 seconds of momentum from fast swipe
        this.PAN_SNAP_THRESHOLD = 0.5; // Below 0.5px/frame, animation stops (imperceptible movement)
        this.ZOOM_SNAP_THRESHOLD = 0.001; // Below 0.001 zoom delta, animation stops
        this.MAX_VELOCITY = 50; // Caps momentum at 50px/frame = 3000px/sec @ 60fps (prevents runaway scrolling)
        this.MOMENTUM_HISTORY_DURATION = 100; // Sample last 100ms of movement for velocity calculation
        this.ZOOM_NOTIFY_DEBOUNCE = 10; // Batch zoom notifications to C# to reduce interop overhead
        this.AUTO_CENTER_DELAY = 50; // Small delay before centering allows layout to settle
        this.ZOOM_TO_FIT_PADDING = 100; // pixels padding on each side (200px total) when zooming to fit
        
        this.panMoveHistory = [];
        
        // Zoom notification timeout
        this.zoomNotifyTimeout = null;
        
        // Space key state (instance-specific)
        this.spacePressed = false;
        
        // Event listener cleanup
        this.eventCleanupHandlers = [];
    }

    setupZoomAndPan(isDragging, isDraggingNode) {
        const viewport = this.utils.getViewport(this.canvasId);
        if (!viewport) return;

        // Keyboard zoom controls
        const keydownZoomHandler = (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault();
                    this.zoomIn();
                } else if (e.key === '-' || e.key === '_') {
                    e.preventDefault();
                    this.zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    this.zoomReset();
                }
            }
        };
        document.addEventListener('keydown', keydownZoomHandler);
        this.eventCleanupHandlers.push(() => document.removeEventListener('keydown', keydownZoomHandler));

        // Mouse wheel zoom
        const wheelZoomHandler = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                
                // Disable AutoZoom on manual zoom
                if (this.config.autoZoom) {
                    this.config.autoZoom = false;
                    if (this.onAutoZoomChangedCallback) {
                        this.onAutoZoomChangedCallback(false);
                    }
                }
                
                const rect = viewport.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const delta = e.deltaY > 0 ? -this.zoomStep : this.zoomStep;
                this.zoomAtPoint(mouseX, mouseY, delta);
            }
        };
        viewport.addEventListener('wheel', wheelZoomHandler, { passive: false });
        this.eventCleanupHandlers.push(() => viewport.removeEventListener('wheel', wheelZoomHandler));

        // Pan with space + drag or canvas drag
        const keydownSpaceHandler = (e) => {
            if (e.code === 'Space' && !isDragging() && !isDraggingNode()) {
                e.preventDefault();
                this.spacePressed = true;
                viewport.style.cursor = 'grab';
            }
        };
        
        const keyupSpaceHandler = (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                if (!this.isPanning) {
                    viewport.style.cursor = '';
                }
            }
        };
        document.addEventListener('keydown', keydownSpaceHandler);
        document.addEventListener('keyup', keyupSpaceHandler);
        this.eventCleanupHandlers.push(() => document.removeEventListener('keydown', keydownSpaceHandler));
        this.eventCleanupHandlers.push(() => document.removeEventListener('keyup', keyupSpaceHandler));

        viewport.addEventListener('mousedown', (e) => {
            if (!this.panningEnabled) {
                this.console.log('ZOOM/PAN', `Panning disabled - ignoring mousedown`);
                return;
            }
            
            const clickedOnNode = e.target.closest('.flow-node');
            const clickedOnComponent = e.target.closest('.component-item');
            
            if (e.button === 1 || 
                (e.button === 0 && this.spacePressed) || 
                (e.button === 0 && !clickedOnNode && !clickedOnComponent && !isDragging() && !isDraggingNode())) {
                this.console.log('ZOOM/PAN', `Pan started`, { button: e.button, spacePressed: this.spacePressed });
                e.preventDefault();
                e.stopPropagation();
                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.lastPanX = this.panX;
                this.lastPanY = this.panY;
                
                this.panMoveHistory = [];
                this.stopSmoothAnimation();
                
                viewport.style.cursor = 'grabbing';
            }
        });

        viewport.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                e.preventDefault();
                const dx = e.clientX - this.panStartX;
                const dy = e.clientY - this.panStartY;
                
                const newPanX = this.lastPanX + dx;
                const newPanY = this.lastPanY + dy;
                
                const now = Date.now();
                this.panMoveHistory.push({ x: newPanX, y: newPanY, time: now });
                this.panMoveHistory = this.panMoveHistory.filter(h => now - h.time < this.MOMENTUM_HISTORY_DURATION);
                
                this.panX = newPanX;
                this.panY = newPanY;
                this.constrainPan();
                this.updateTransform();
            }
        });

        viewport.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                viewport.style.cursor = this.spacePressed ? 'grab' : '';
                
                const autoCenterEnabled = this.isAutoCenterEnabled ? this.isAutoCenterEnabled() : false;
                this.console.log('ZOOM/PAN', `Pan released - Auto-Center check`, { autoCenterEnabled });
                
                if (autoCenterEnabled) {
                    // Auto Center mode: trigger re-centering after pan
                    this.console.log('ZOOM/PAN', `Triggering auto-center after pan release`);
                    if (this.triggerCenterViewport) {
                        setTimeout(() => this.triggerCenterViewport(), this.AUTO_CENTER_DELAY);
                    }
                } else {
                    // Manual pan mode: prepare for momentum calculation
                    this.targetPanX = this.panX;
                    this.targetPanY = this.panY;
                    
                    if (this.smoothEnabled && this.panMoveHistory && this.panMoveHistory.length >= 2) {
                        const recent = this.panMoveHistory.slice(-3);
                        if (recent.length >= 2) {
                            const first = recent[0];
                            const last = recent[recent.length - 1];
                            const timeDiff = last.time - first.time;
                            
                            if (timeDiff > 0) {
                                const velocityX = (last.x - first.x) / timeDiff * 16;
                                const velocityY = (last.y - first.y) / timeDiff * 16;
                                
                                if (Math.abs(velocityX) > 0.5 || Math.abs(velocityY) > 0.5) {
                                    this.console.log('ZOOM/PAN', `Applying momentum`, { 
                                        velocityX: velocityX.toFixed(2), 
                                        velocityY: velocityY.toFixed(2) 
                                    });
                                    this.addPanMomentum(velocityX, velocityY);
                                }
                            }
                        }
                    }
                }
                
                this.panMoveHistory = [];
                
                setTimeout(() => {
                    this.console.log('ZOOM/PAN', `Position tracking (1s after pan)`, { 
                        panX: this.panX.toFixed(2), 
                        panY: this.panY.toFixed(2) 
                    });
                }, 1000);
            }
        });

        viewport.addEventListener('mouseleave', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                viewport.style.cursor = this.spacePressed ? 'grab' : '';
            }
        });
    }

    cleanup() {
        // Clean up all event listeners
        this.eventCleanupHandlers.forEach(cleanup => cleanup());
        this.eventCleanupHandlers = [];
        
        // Clear animation frame
        this.stopSmoothAnimation();
        
        // Clear timeout
        if (this.zoomNotifyTimeout) {
            clearTimeout(this.zoomNotifyTimeout);
            this.zoomNotifyTimeout = null;
        }
    }

    /**
     * Constrains pan position to keep canvas visible within viewport bounds.
     * 
     * Algorithm:
     * 1. Calculate scaled canvas dimensions (canvas size × zoom level)
     * 2. Determine max pan (allows centering when canvas < viewport)
     * 3. Determine min pan (prevents canvas from scrolling out of view)
     * 4. Clamp current pan within [min, max] range
     * 
     * Constrains pan position to prevent excessive panning beyond reasonable bounds.
     * With autoscaling canvas, we allow more freedom but prevent extreme panning.
     */
    constrainPan() {
        const viewport = this.utils.getViewport(this.canvasId);
        if (!viewport) return;
        
        const { width: viewportWidth, height: viewportHeight } = this.utils.getViewportDimensions(viewport);
        
        // Allow panning within reasonable bounds relative to viewport size
        // This provides freedom to explore while preventing getting completely lost
        const maxPanRange = Math.max(viewportWidth, viewportHeight) * 2;
        
        this.panX = Math.max(-maxPanRange, Math.min(maxPanRange, this.panX));
        this.panY = Math.max(-maxPanRange, Math.min(maxPanRange, this.panY));
    }

    updateTransform() {
        const transformWrapper = document.getElementById(`${this.canvasId}-transform`);
        if (transformWrapper) {
            // Apply scale first, then translate - this way pan values are in viewport pixels
            transformWrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
            // Set transform-origin to top-left so scaling happens from that point
            transformWrapper.style.transformOrigin = '0 0';
        }
        
        // Always notify zoom changes immediately for instant two-way binding
        this.notifyZoomChanged();
    }

    notifyZoomChanged() {
        if (!this.onZoomChangedCallback) return;
        
        // Only notify if zoom level actually changed (avoid interop spam)
        if (Math.abs(this.zoomLevel - this.lastNotifiedZoomLevel) < 0.001) return;
        
        if (this.zoomNotifyTimeout) {
            clearTimeout(this.zoomNotifyTimeout);
        }
        
        this.zoomNotifyTimeout = setTimeout(async () => {
            try {
                if (this.onZoomChangedCallback && Math.abs(this.zoomLevel - this.lastNotifiedZoomLevel) >= 0.001) {
                    this.lastNotifiedZoomLevel = this.zoomLevel;
                    await this.onZoomChangedCallback(this.zoomLevel);
                }
            } catch (error) {
                // Silently ignore - component might be disposing
            }
        }, this.ZOOM_NOTIFY_DEBOUNCE);
    }

    setZoomChangedCallback(callback) {
        this.onZoomChangedCallback = callback;
    }
    
    setAutoZoomChangedCallback(callback) {
        this.onAutoZoomChangedCallback = callback;
    }
    
    setAutoCenterCallback(callback) {
        this.isAutoCenterEnabled = callback;
    }
    
    setCenterViewportCallback(callback) {
        this.triggerCenterViewport = callback;
    }

    // Smooth animation system
    startSmoothAnimation() {
        if (!this.smoothEnabled || this.isAnimating) return;
        this.isAnimating = true;
        this.animateSmooth();
    }

    stopSmoothAnimation() {
        // Set flag FIRST to prevent new animation frames from being requested
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animateSmooth() {
        if (!this.isAnimating) return;

        let needsUpdate = false;
        
        // Apply momentum (decelerating pan velocity)
        if (Math.abs(this.panVelocityX) > this.PAN_SNAP_THRESHOLD) {
            this.panX += this.panVelocityX;
            this.panVelocityX *= this.FRICTION;
            // Keep target synced with momentum to prevent snap-back to old position
            this.targetPanX = this.panX;
            needsUpdate = true;
        } else if (this.panVelocityX !== 0) {
            // Stop animation when velocity is negligible
            this.panVelocityX = 0;
        }
        
        if (Math.abs(this.panVelocityY) > this.PAN_SNAP_THRESHOLD) {
            this.panY += this.panVelocityY;
            this.panVelocityY *= this.FRICTION;
            // Keep target synced with momentum to prevent snap-back to old position
            this.targetPanY = this.panY;
            needsUpdate = true;
        } else if (this.panVelocityY !== 0) {
            // Stop animation when velocity is negligible
            this.panVelocityY = 0;
        }

        // Only snap to target if there's no momentum
        if (this.panVelocityX === 0 && this.panVelocityY === 0) {
            const panDiffX = this.targetPanX - this.panX;
            const panDiffY = this.targetPanY - this.panY;

            if (Math.abs(panDiffX) > this.PAN_SNAP_THRESHOLD) {
                this.panX += panDiffX * 0.1;
                needsUpdate = true;
            } else if (Math.abs(panDiffX) > 0.1) {
                this.panX = this.targetPanX;
                needsUpdate = true;
            }

            if (Math.abs(panDiffY) > this.PAN_SNAP_THRESHOLD) {
                this.panY += panDiffY * 0.1;
                needsUpdate = true;
            } else if (Math.abs(panDiffY) > 0.1) {
                this.panY = this.targetPanY;
                needsUpdate = true;
            }
        }

        // Handle zoom animations
        const zoomDiff = this.targetZoom - this.zoomLevel;
        if (Math.abs(zoomDiff) > this.ZOOM_SNAP_THRESHOLD) {
            this.zoomLevel += zoomDiff * 0.1;
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel));
            needsUpdate = true;
        } else if (Math.abs(zoomDiff) > 0.0001) {
            this.zoomLevel = this.targetZoom;
            needsUpdate = true;
        }

        if (needsUpdate) {
            this.constrainPan();
            this.updateTransform();
            this.animationId = requestAnimationFrame(() => this.animateSmooth());
        } else {
            this.stopSmoothAnimation();
        }
    }

    addPanMomentum(velocityX, velocityY) {
        if (!this.smoothEnabled) return;
        
        this.panVelocityX = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, velocityX));
        this.panVelocityY = Math.max(-this.MAX_VELOCITY, Math.min(this.MAX_VELOCITY, velocityY));
        this.startSmoothAnimation();
    }

    smoothPanTo(targetX, targetY, immediate = false) {
        this.targetPanX = targetX;
        this.targetPanY = targetY;
        
        if (!this.smoothEnabled || immediate) {
            this.panX = targetX;
            this.panY = targetY;
            this.constrainPan();
            this.updateTransform();
        } else {
            this.startSmoothAnimation();
        }
    }

    smoothZoomTo(targetZoom, immediate = false) {
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
        
        if (!this.smoothEnabled || immediate) {
            this.zoomLevel = this.targetZoom;
            this.updateTransform();
        } else {
            this.startSmoothAnimation();
        }
    }

    zoomIn() {
        // Disable AutoZoom on manual zoom
        if (this.config.autoZoom) {
            this.config.autoZoom = false;
            if (this.onAutoZoomChangedCallback) {
                this.onAutoZoomChangedCallback(false);
            }
        }
        this.performZoomStep(this.zoomStep, null);
    }

    zoomOut() {
        // Disable AutoZoom on manual zoom
        if (this.config.autoZoom) {
            this.config.autoZoom = false;
            if (this.onAutoZoomChangedCallback) {
                this.onAutoZoomChangedCallback(false);
            }
        }
        this.performZoomStep(-this.zoomStep, null);
    }

    performZoomStep(delta, rootNode) {
        const viewport = this.utils.getViewport(this.canvasId);
        if (!viewport) return;
        
        if (rootNode) {
            const rect = viewport.getBoundingClientRect();
            const viewportCenterX = rect.width / 2;
            const viewportCenterY = rect.height / 2;
            
            const rootCenter = this.utils.calculateNodeCenter(rootNode);
            const currentRootViewportX = rootCenter.x * this.zoomLevel + this.panX;
            const currentRootViewportY = rootCenter.y * this.zoomLevel + this.panY;
            
            const zoomPointX = (currentRootViewportX >= 0 && currentRootViewportX <= rect.width) ? currentRootViewportX : viewportCenterX;
            const zoomPointY = (currentRootViewportY >= 0 && currentRootViewportY <= rect.height) ? currentRootViewportY : viewportCenterY;
            
            this.zoomAtPoint(zoomPointX, zoomPointY, delta);
        } else {
            const rect = viewport.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            this.zoomAtPoint(centerX, centerY, delta);
        }
    }

    zoomReset(nodes) {
        this.smoothZoomTo(1.0, false);
        if (nodes) {
            setTimeout(() => this.centerViewport(nodes), this.AUTO_CENTER_DELAY);
        }
    }

    zoomAtPoint(viewportX, viewportY, delta) {
        const oldZoom = this.zoomLevel;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom + delta));
        
        if (newZoom === oldZoom) return;
        
        const canvasX = (viewportX - this.panX) / oldZoom;
        const canvasY = (viewportY - this.panY) / oldZoom;
        
        const newPanX = viewportX - canvasX * newZoom;
        const newPanY = viewportY - canvasY * newZoom;
        
        this.smoothZoomTo(newZoom, false);
        this.smoothPanTo(newPanX, newPanY);
    }

    /**
     * Zooms and pans to fit all nodes within viewport.
     * 
     * Calculation steps:
     * 1. Calculate bounding box of all nodes
     * 2. Add padding to content dimensions
     * 3. Calculate scale to fit: min(viewportWidth/contentWidth, viewportHeight/contentHeight)
     * 4. Calculate pan to center the content
     * 5. Atomically update all targets before starting animation
     * 
     * @param {Array} nodes - Array of node objects with x, y, element properties
     * @param {Object} treeConfig - Tree configuration with nodeWidth
     */
    zoomToFit(nodes, treeConfig) {
        if (nodes.length === 0) {
            this.zoomReset(nodes);
            setTimeout(() => this.centerViewport(nodes), this.AUTO_CENTER_DELAY);
            return;
        }

        const viewport = this.utils.getViewport(this.canvasId);
        if (!viewport) return;
        
        const bounds = this.utils.calculateNodesBounds(nodes);
        const { width: viewportWidth, height: viewportHeight } = this.utils.getViewportDimensions(viewport);

        const contentWidth = bounds.width + this.ZOOM_TO_FIT_PADDING * 2;
        const contentHeight = bounds.height + this.ZOOM_TO_FIT_PADDING * 2;

        const scaleX = viewportWidth / contentWidth;
        const scaleY = viewportHeight / contentHeight;
        const scale = Math.min(Math.max(Math.min(scaleX, scaleY), this.minZoom), this.maxZoom);

        // Calculate target pan position
        const target = this.utils.calculateTargetPanForCenter(bounds.centerX, bounds.centerY, viewportWidth, viewportHeight, scale);
        
        // Stop any running animation before updating targets to minimize conflicts
        const newTargets = {
            zoom: scale,
            panX: target.x,
            panY: target.y
        };
        
        // Stop any ongoing animation
        this.stopSmoothAnimation();
        
        // Apply all targets atomically
        this.targetZoom = newTargets.zoom;
        this.targetPanX = newTargets.panX;
        this.targetPanY = newTargets.panY;
        
        if (!this.smoothEnabled) {
            // Immediate mode: update all at once atomically
            this.zoomLevel = newTargets.zoom;
            this.panX = newTargets.panX;
            this.panY = newTargets.panY;
            this.constrainPan();
            this.updateTransform();
        } else {
            // Animated mode: start animation with all targets already set
            this.startSmoothAnimation();
        }
    }

    centerViewport(nodes) {
        if (!nodes) return;
        const viewport = this.utils.getViewport(this.canvasId);
        if (!viewport) return;
        
        const bounds = this.utils.calculateNodesBounds(nodes);
        const { width, height } = this.utils.getViewportDimensions(viewport);
        const target = this.utils.calculateTargetPanForCenter(bounds.centerX, bounds.centerY, width, height, this.zoomLevel);
        
        this.smoothPanTo(target.x, target.y);
    }



    focusItem(nodeId, nodes) {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return false;
        
        const viewport = this.utils.getViewport(this.canvasId);
        if (!viewport) return false;
        
        const nodeCenter = this.utils.calculateNodeCenter(node);
        const { width, height } = this.utils.getViewportDimensions(viewport);
        const target = this.utils.calculateTargetPanForCenter(nodeCenter.x, nodeCenter.y, width, height, this.zoomLevel);
        
        this.smoothPanTo(target.x, target.y);
        return true;
    }

    /**
     * Resets zoom and pan to default values
     */
    reset() {
        this.stopSmoothAnimation();
        this.zoomLevel = this.config.zoomLevel || 1.0;
        this.targetZoom = this.zoomLevel;
        this.panX = 0;
        this.panY = 0;
        this.targetPanX = 0;
        this.targetPanY = 0;
        this.panVelocityX = 0;
        this.panVelocityY = 0;
        this.updateTransform();
    }
}
