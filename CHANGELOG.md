# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Additional animation easing functions
- Node search and filter capabilities
- Accessibility improvements (ARIA labels, keyboard navigation)
- Mobile touch gesture enhancements
- Export to image/PDF functionality

## [1.0.0] - 2025-10-26

### Added
- 🎯 Initial release of VIOVNL.Flowy.Blazor
- 🎨 Core `FlowyCanvasEditor` component with drag & drop
- 🔄 Automatic hierarchical tree layout engine
- 🔍 Zoom and pan with momentum physics
- 💧 Droplet flow animations along tree paths
- 📊 Comprehensive event system:
  - `OnNodeDropped` - Node drop events
  - `OnNodeAdded` - Programmatic node addition
  - `OnNodeMoved` - Node rearrangement
  - `OnNodeRemoved` - Node deletion
  - `OnNodeSelected` - Node selection
  - `OnTreeRestructured` - Tree structure changes
  - `OnValidateDropTarget` - Custom drop validation
- ⚙️ Configuration properties:
  - `EnablePanning` - Toggle canvas panning
  - `AutoZoom` - Automatic zoom-to-fit
  - `AutoCenter` - Auto-center on root node
  - `ZoomLevel` - Manual zoom control with two-way binding
  - `Smooth` - Smooth animations with momentum
  - `Debug` - Console logging for development
  - `EnableDragDrop` - Toggle drag & drop functionality
- 🎭 `FlowyComponentsPanel` for drag source UI
- 💾 JSON serialization/deserialization (`ExportJson`, `ImportJson`)
- 🔧 Programmatic API:
  - `AddNodeAsync()` - Add nodes via code
  - `RemoveNodeAsync()` - Remove nodes and descendants
  - `MoveNodeAsync()` - Rearrange tree structure
  - `ResetAsync()` - Clear all nodes
  - `FocusItemAsync()` - Navigate to specific node
  - `SetNodeDraggableAsync()` - Lock/unlock individual nodes
  - `SetNodeCanHaveChildrenAsync()` - Control child acceptance
  - `ZoomInAsync()`, `ZoomOutAsync()`, `ZoomResetAsync()` - Zoom controls
  - `FlowDropletsAsync()` - Trigger droplet animations
- 🎨 Custom node templates via `RenderFragment` (BodyContent)
- 📚 Comprehensive documentation (`Documentation.md`)
- 🔒 Dual licensing model (GPL v3 + Commercial)
- 🚀 GitHub Actions CI/CD workflows
- 🧪 Demo application with interactive examples

### Technical Details
- Built on **.NET 9.0**
- Blazor Server and WebAssembly compatible
- ES6 modular JavaScript architecture
- Fluent Design System styling
- Responsive and mobile-friendly
- High performance with optimized rendering

## Version History Format

### Types of Changes
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security vulnerability fixes

---

**Note**: This project uses dual licensing:
- Open source projects: GPL v3
- Commercial projects: [Commercial License](https://www.viov.nl/)

For installation and usage instructions, see [README.md](README.md)

For detailed API documentation, see [Documentation.md](Documentation.md)
