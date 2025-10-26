# Flowy.Blazor Documentation

Complete guide for using VIOVNL.Flowy.Blazor - an interactive hierarchical tree visualization component for Blazor applications.

## 🚀 Quick Start

### 1. Add Using Statements

In your `_Imports.razor`:

```razor
@using VIOVNL.Flowy.Blazor.Components
@using VIOVNL.Flowy.Blazor.Models
```

### 2. Include CSS

In your `App.razor` or layout file (`<head>` section):

```html
<link href="_content/VIOVNL.Flowy.Blazor/css/flowy.css" rel="stylesheet" />
```

> **Note:** JavaScript is loaded automatically via ES6 modules.

### 3. Basic Usage

```razor
@page "/tree"
@rendermode InteractiveServer

<div style="display: flex; height: 600px; gap: 16px;">
    <FlowyComponentsPanel Components="@components" 
                        Title="Components"
                        Style="width: 220px;" />
    
    <FlowyCanvasEditor Components="@components"
                     Style="flex: 1;" />
</div>

@code {
    private List<FlowyComponentItem> components = new()
    {
        new FlowyComponentItem 
        { 
            ComponentId = "person",
            Name = "Person",
            Color = "#667eea"
        },
        new FlowyComponentItem 
        { 
            ComponentId = "spouse",
            Name = "Spouse",
            Color = "#f093fb"
        }
    };
}
```

## 🎨 Custom Node Templates

Use Blazor `RenderFragment` for rich, customizable node content:

```razor
@code {
    private List<FlowyComponentItem> components = new()
    {
        new FlowyComponentItem 
        { 
            ComponentId = "executive",
            Name = "Executive",
            Color = "#667eea",
            BodyContent = @<div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 20px;">👔</span>
                <div>
                    <div style="font-weight: 700;">Executive</div>
                    <div style="font-size: 11px; opacity: 0.8;">Leadership</div>
                </div>
            </div>
        }
    };
}
```

## 🔧 Programmatic Control

Access component methods via `@ref`:

```razor
<FlowyCanvasEditor @ref="canvasEditor" Components="@components" />

@code {
    private FlowyCanvasEditor? canvasEditor;

    // Add node programmatically
    private async Task AddNode()
    {
        var node = await canvasEditor!.AddNodeAsync(
            "New Node", 
            "person", 
            "#667eea", 
            parentId: null
        );
    }

    // Zoom controls
    private async Task ZoomIn() => await canvasEditor!.ZoomInAsync();
    private async Task FitScreen() => await canvasEditor!.FitAllNodesInViewportAsync();
    
    // Navigation
    private async Task FocusNode(Guid nodeId) 
        => await canvasEditor!.FocusItemAsync(nodeId);
}
```

## 📊 Event Handling

Comprehensive event system for tracking user interactions:

```razor
<FlowyCanvasEditor 
    Components="@components"
    OnNodeDropped="HandleNodeDropped"
    OnNodeMoved="HandleNodeMoved"
    OnNodeRemoved="HandleNodeRemoved"
    OnNodeSelected="HandleNodeSelected"
    OnValidateDropTarget="HandleValidation" />

@code {
    private Task HandleNodeDropped(FlowyNodeDroppedEventArgs args)
    {
        Console.WriteLine($"Node '{args.Node.Name}' dropped on {args.TargetNode?.Name ?? "canvas"}");
        return Task.CompletedTask;
    }

    private Task HandleValidation(FlowyValidationEventArgs args)
    {
        // Custom validation logic
        if (args.TargetNode?.ComponentId == "restricted" && args.Node.ComponentId == "forbidden")
        {
            args.IsValid = false;
            args.ValidationMessage = "This combination is not allowed!";
        }
        return Task.CompletedTask;
    }
}
```

## 💾 Import/Export

Save and restore tree structures:

```razor
@code {
    private async Task ExportTree()
    {
        var json = canvasEditor!.ExportJson();
        await File.WriteAllTextAsync("tree.json", json);
    }

    private async Task ImportTree()
    {
        var json = await File.ReadAllTextAsync("tree.json");
        await canvasEditor!.ImportJson(json);
    }
}
```

## ⚙️ Configuration

### Component Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `Components` | `List<FlowyComponentItem>` | `[]` | Available draggable components |
| `EnablePanning` | `bool` | `true` | Allow canvas panning |
| `AutoZoom` | `bool` | `false` | Auto-fit all nodes (two-way bindable) |
| `AutoCenter` | `bool` | `false` | Auto-center on root node |
| `ZoomLevel` | `double` | `1.0` | Manual zoom (0.1-3.0, two-way bindable) |
| `Smooth` | `bool` | `true` | Enable smooth animations with momentum |
| `EnableDragDrop` | `bool` | `true` | Enable drag & drop functionality |
| `Debug` | `bool` | `false` | Enable console logging |

### Two-Way Binding

```razor
<FlowyCanvasEditor 
    @bind-ZoomLevel="zoomLevel"
    @bind-AutoZoom="autoZoom" />

@code {
    private double zoomLevel = 1.0;
    private bool autoZoom = true;
}
```

## 🎯 Key Methods

### Tree Manipulation
- `AddNodeAsync(name, componentId, color, parentId, isDraggable, canHaveChildren)` - Add node
- `RemoveNodeAsync(nodeId)` - Remove node and descendants
- `MoveNodeAsync(nodeId, newParentId, position)` - Move node
- `ResetAsync()` - Clear all nodes

### Data Access
- `GetNodeById(nodeId)` - Get specific node
- `GetChildren(parentNode)` - Get child nodes
- `GetRootNode()` - Get root node
- `Nodes` - Read-only collection of all nodes

### Viewport Control
- `ZoomInAsync()`, `ZoomOutAsync()`, `ZoomResetAsync()`
- `SetZoomLevelAsync(level)` - Set specific zoom
- `FitAllNodesInViewportAsync()` - Fit all nodes
- `CenterAsync()` - Center on root
- `FocusItemAsync(nodeId)` - Focus specific node

### Advanced
- `FlowDropletsAsync(startNodeId, endNodeId, duration, count, delay, distance, easing)` - Animate droplets
- `SetNodeDraggableAsync(nodeId, draggable)` - Lock/unlock node
- `SetNodeCanHaveChildrenAsync(nodeId, canHave)` - Control child acceptance
- `ExportJson()`, `ImportJson(json)` - Serialization
