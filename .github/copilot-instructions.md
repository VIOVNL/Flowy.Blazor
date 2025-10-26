# Flowy Blazor Component - AI Agent Instructions

## Project Overview

**Flowy** is a Blazor reusable component library for building interactive hierarchical tree visualizations (e.g., family trees, org charts). It features drag-and-drop, automatic layout, zoom/pan, and real-time visual connections.

- **VIOVNL.Flowy.Blazor**: The component library (NuGet package target, .NET 9.0, Razor SDK)
- **VIOVNL.Flowy.Demo**: Demo web app showcasing the component (Blazor Server, InteractiveServer render mode)

## Architecture & Key Patterns

### C#/Blazor Layer (Server-side)

- **Component**: `FlowyCanvasEditor.razor` - Main Blazor component with 20+ parameters for configuration
- **Service**: `FlowyTreeService.cs` - Tree data management (add/remove/move nodes, validation, serialization)
- **Models**: `FlowyNode`, `FlowyTreeData`, `FlowyComponentItem`, `FlowyEventArgs` classes
- **JS Interop**: `DotNetObjectReference` for bidirectional communication; dynamic ES6 module import in `OnAfterRenderAsync`

**Key Conventions**:
- All async methods end with `Async` suffix (e.g., `AddNodeAsync`, `SetAutoZoomAsync`)
- Parameters use nullable types with defaults (e.g., `bool? EnablePanning = true`)
- Events use `EventCallback<T>` with strongly-typed event args
- Component initialization in `OnAfterRenderAsync(firstRender)` only

### JavaScript Layer (Client-side)

**Modular ES6 Architecture**: Each module is a separate class in `wwwroot/js/`:

- **flowy-interop.js**: Entry point with `FlowyInterop` object, manages instance map
- **flowy-core.js**: `FlowyInstance` - orchestrates all modules, owns node state
- **flowy-zoom-pan.js**: `FlowyZoomPan` - viewport camera, smooth animations, momentum physics
- **flowy-drag-drop.js**: `FlowyDragDrop` - drag/drop logic, drop zones, validation
- **flowy-tree-layout.js**: `FlowyTreeLayout` - hierarchical positioning algorithm
- **flowy-connections.js**: `FlowyConnections` - SVG line rendering between nodes
- **flowy-utils.js**: `FlowyUtils` - shared calculations (bounds, viewport, transforms)

**Critical Patterns**:
- Each module receives dependencies in constructor (config, utils, other modules)
- Cross-module communication via callbacks: `zoomPan.setAutoCenterCallback(() => this.autoCenter)`
- Cleanup required: all modules have `cleanup()` methods to remove event listeners
- Console logging controlled by `config.debug` flag
- Animation system uses `requestAnimationFrame` with velocity/friction physics

### State Management

**C# Side**: `FlowyTreeService` is the source of truth for tree structure. Component parameters are two-way bindable (`@bind-ZoomLevel`).

**JS Side**: `FlowyInstance.nodes` array contains node data. Each node has:
```javascript
{
  id: string (GUID),
  element: HTMLElement,
  name, type, color, icon: string,
  x, y: number (canvas coords),
  parent: node | null,
  children: node[]
}
```

**Synchronization**: After JS operations (drag/drop, move), `notifyNodeDropped` calls back to C# to update `TreeService`.

## Build & Development Workflow

```powershell
# Build entire solution
dotnet build

# Run demo app (launches browser at https://localhost:5001)
dotnet run --project VIOVNL.Flowy.Demo\VIOVNL.Flowy.Demo.csproj

# Pack library for NuGet (output in bin/Release/)
dotnet pack VIOVNL.Flowy.Blazor\VIOVNL.Flowy.Blazor.csproj -c Release
```

**Hot Reload**: Works for C# and Razor files. JS changes require manual browser refresh.

**Debugging**:
- Set `Debug="true"` parameter on `FlowyCanvasEditor` to enable detailed console logging
- Browser DevTools shows timing, positioning, and state changes
- VS Code: F5 launches with debugger attached to .NET process

## Common Modification Scenarios

### Adding a New Component Parameter

1. Add parameter to `FlowyCanvasEditor.razor`:
   ```csharp
   [Parameter]
   public bool MyFeature { get; set; } = false;
   ```
2. Pass to JS in `OnAfterRenderAsync`:
   ```csharp
   var config = new {
       myFeature = MyFeature,
       // ... other config
   };
   ```
3. Add setter method in component:
   ```csharp
   public async Task SetMyFeatureAsync(bool enabled)
   {
       MyFeature = enabled;
       if (_jsModule != null)
           await _jsModule.InvokeVoidAsync("FlowyInterop.setMyFeature", CanvasId, enabled);
   }
   ```
4. Add method to `flowy-interop.js` and `flowy-core.js`

### Adding a New JavaScript Module

1. Create `flowy-newmodule.js` with `export class FlowyNewModule`
2. Import in `flowy-core.js`: `import { FlowyNewModule } from './flowy-newmodule.js';`
3. Instantiate in `FlowyInstance` constructor: `this.newModule = new FlowyNewModule(...)`
4. Add cleanup: `this.newModule.cleanup()` in `dispose()`

### Modifying Tree Layout Algorithm

- Edit `FlowyTreeLayout.calculateSubtreePositions()` in `flowy-tree-layout.js`
- Adjust `TREE_CONFIG` constants (nodeWidth, horizontalSpacing, etc.) in `flowy-core.js`
- Test with multi-level trees (3+ generations with varying child counts)

### Fixing Zoom/Pan Issues

- Check `FlowyZoomPan` state: `panX`, `panY`, `zoomLevel`, `targetPanX/Y`, `panVelocityX/Y`
- Verify `constrainPan()` is called after position changes
- Ensure `updateTransform()` applies CSS transform to `#canvasId-transform`
- For snap-back issues: verify `targetPanX/Y` matches current `panX/Y` after manual pan

## Critical Implementation Details

### Canvas Transform Chain
```
.canvas-viewport (overflow: hidden, position: relative, background grid pattern)
  → .canvas-transform-wrapper (transform: translate() scale(), transform-origin: 0 0)
    → Node elements (positioned absolutely within transform wrapper)
```

**Never** apply zoom to individual nodes - always transform the wrapper. Node positions are in canvas coordinates (absolute px).

### Auto-Center vs Auto-Zoom vs Manual Pan

- **Auto-Zoom**: Recalculates zoom on layout change to fit all nodes, includes centering
- **Auto-Center**: Centers on root node after layout change, keeps current zoom
- **Manual Pan**: User control; momentum applies on mouse-up unless Auto-Center is enabled
- **Priority**: Auto-Zoom > Auto-Center > Manual Pan

Logic in `recalculateTreeLayout()` (flowy-core.js) and `mouseup` handler (flowy-zoom-pan.js).

### Event Listener Management

All DOM event listeners MUST be tracked for cleanup. Pattern:
```javascript
const handler = (e) => { /* ... */ };
document.addEventListener('keydown', handler);
this.eventCleanupHandlers.push(() => document.removeEventListener('keydown', handler));
```

Call in `cleanup()` method to prevent memory leaks during component disposal.

### Animation Timing

- Layout recalculation uses `setTimeout(..., 100)` to batch DOM updates
- Zoom notifications debounced 100ms to avoid flooding C# callbacks
- Momentum physics runs at 60fps via `requestAnimationFrame`

## Testing & Validation

- **Manual Testing**: Use Flowy.Demo with Debug=true, check browser console for errors
- **Test Multi-Child Layouts**: Add 3+ nodes at same level, verify spacing and connections
- **Test Zoom/Pan Interactions**: Try combinations of Auto-Zoom, Auto-Center, manual pan
- **Memory Leaks**: Check DevTools Memory profiler - dispose component, force GC, verify cleanup

## Package Publishing

Before publishing to NuGet:
1. Update version in `VIOVNL.Flowy.Blazor.csproj`
2. Ensure README.md exists (referenced in csproj)
3. Verify static web assets are included via `<Content Update="wwwroot\**\*">`
4. Test in consuming project: `dotnet add package VIOVNL.Flowy.Blazor`
5. Add `_content/VIOVNL.Flowy.Blazor/` CSS/JS references in consuming app

## Known Quirks

- **Console.log lines**: Some debug logging (e.g., line 204 in flowy-zoom-pan.js) may be incomplete - use `console.log('message', data)` format
- **GUID Format**: JavaScript uses `crypto.randomUUID()`, C# uses `Guid.NewGuid()` - both compatible
- **Circular References**: `IsDescendant()` check prevents moving nodes into their own subtrees
- **Placeholder Hiding**: `.canvas-placeholder` must be manually hidden on first node creation
