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

// Flowy Blazor Component - Debug Console
export class FlowyConsole {
    constructor(canvasId, enabled = false) {
        this.canvasId = canvasId;
        this.enabled = enabled;
        this.timers = new Map();
        this.counters = new Map();
    }

    log(category, message, data = null) {
        if (!this.enabled) return;
        
        const timestamp = new Date().toISOString().split('T')[1];
        const prefix = `[${timestamp}] [${this.canvasId}] [${category}]`;
        
        if (data) {
            console.log(`${prefix} ${message}`, data);
        } else {
            console.log(`${prefix} ${message}`);
        }
    }

    startTimer(label) {
        if (!this.enabled) return;
        this.timers.set(label, performance.now());
    }

    endTimer(label, message = null) {
        if (!this.enabled) return;
        
        const startTime = this.timers.get(label);
        if (startTime === undefined) {
            this.log('TIMER', `⚠️ Timer "${label}" was never started`);
            return;
        }
        
        const elapsed = performance.now() - startTime;
        this.timers.delete(label);
        
        const msg = message || `Timer "${label}" completed`;
        this.log('TIMER', `⏱️ ${msg}: ${elapsed.toFixed(2)}ms`);
        return elapsed;
    }

    count(label) {
        if (!this.enabled) return;
        
        const current = this.counters.get(label) || 0;
        const newCount = current + 1;
        this.counters.set(label, newCount);
        this.log('COUNTER', `🔢 ${label}: ${newCount}`);
        return newCount;
    }

    group(label) {
        if (!this.enabled) return;
        console.group(`[${this.canvasId}] ${label}`);
    }

    groupEnd() {
        if (!this.enabled) return;
        console.groupEnd();
    }

    trace(message) {
        if (!this.enabled) return;
        this.log('TRACE', message);
        console.trace();
    }

    // Specific debug methods for common operations
    debugNodeCreation(node, component, x, y, parent) {
        if (!this.enabled) return;
        
        this.group(`🎨 Creating Node: ${component.name}`);
        this.log('NODE', 'Component data:', {
            name: component.name,
            type: component.type,
            color: component.color
        });
        this.log('NODE', 'Position:', { x, y });
        this.log('NODE', 'Parent:', parent ? parent.name : 'ROOT');
        this.log('NODE', 'Generated ID:', node.id);
        this.groupEnd();
    }

    debugNodeAppend(node, timing = null) {
        if (!this.enabled) return;
        
        this.log('DOM', `📍 Appending node "${node.name}" to canvas`);
        if (timing) {
            this.log('DOM', `⏱️ Time since creation: ${timing.toFixed(2)}ms`);
        }
    }

    debugLayoutCalculation(nodeCount, rootPosition) {
        if (!this.enabled) return;
        
        this.log('LAYOUT', `📐 Recalculating tree layout (${nodeCount} nodes)`, {
            rootX: rootPosition?.x,
            rootY: rootPosition?.y
        });
    }

    debugConnection(parentNode, childNode) {
        if (!this.enabled) return;
        
        this.log('CONNECTION', `🔗 Creating connection: ${parentNode.name} → ${childNode.name}`, {
            parentPos: { x: parentNode.x, y: parentNode.y },
            childPos: { x: childNode.x, y: childNode.y }
        });
    }

    debugDragStart(component, isNode = false) {
        if (!this.enabled) return;
        
        this.log('DRAG', `🖱️ Drag started: ${isNode ? 'Node' : 'Component'} "${component.name}"`);
    }

    debugDragEnd(dropTarget, success) {
        if (!this.enabled) return;
        
        if (success) {
            this.log('DRAG', `✅ Drop successful on target:`, dropTarget);
        } else {
            this.log('DRAG', `❌ Drop failed or cancelled`);
        }
    }

    debugZoomPan(action, data) {
        if (!this.enabled) return;
        
        this.log('ZOOM/PAN', `🔍 ${action}`, data);
    }

    debugAnimation(type, from, to) {
        if (!this.enabled) return;
        
        this.log('ANIMATION', `✨ ${type} animation`, { from, to });
    }

    debugEventCall(eventName, args) {
        if (!this.enabled) return;
        
        this.log('EVENT', `📢 Firing event: ${eventName}`, args);
    }

    debugPerformance(operation, duration, details = null) {
        if (!this.enabled) return;
        
        const emoji = duration < 16 ? '⚡' : duration < 50 ? '✅' : duration < 100 ? '⚠️' : '🐌';
        this.log('PERF', `${emoji} ${operation}: ${duration.toFixed(2)}ms`, details);
    }

    enable() {
        this.enabled = true;
        this.log('DEBUG', '🟢 Debug console ENABLED');
    }

    disable() {
        this.log('DEBUG', '🔴 Debug console DISABLED');
        this.enabled = false;
    }

    clear() {
        this.timers.clear();
        this.counters.clear();
        if (this.enabled) {
            console.clear();
            this.log('DEBUG', '🧹 Console cleared');
        }
    }
}
