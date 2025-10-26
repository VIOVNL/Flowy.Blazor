# Copilot Instructions for Flowy.Blazor

## Project Snapshot
- `VIOVNL.Flowy.Blazor` is the reusable component library; `VIOVNL.Flowy.Demo` is the showcase app that references it directly (no solution file).
- Support both `net8.0` and `net9.0`; prefer multi-target-friendly changes in the library and keep demo on `net9.0`.
- Build/pack with `dotnet build VIOVNL.Flowy.Blazor/VIOVNL.Flowy.Blazor.csproj -c Release` and `dotnet pack ... -c Release /p:IncludeSymbols=true`; run the sample via `dotnet run --project VIOVNL.Flowy.Demo/VIOVNL.Flowy.Demo.csproj`.
- Static assets ship through the library’s `_content` pipeline; always update files under `VIOVNL.Flowy.Blazor/wwwroot` and let the SDK handle publishing.
- No automated test suite yet—manual verification flows through the demo; mention any new test gaps explicitly.

## Component Anatomy
- `Components/FlowyCanvasEditor.razor` is the main Blazor surface: it instantiates `FlowyTreeService`, renders toolbox items, and bridges to JavaScript via `IJSRuntime`.
- Node metadata lives in `Models/FlowyNode.cs`; toolbox templates come from `FlowyComponentItem` with optional `RenderFragment` body content.
- `FlowyTreeService` holds authoritative server-side tree state, raises `TreeChanged`, and is not thread-safe—wrap multi-threaded access in locks if needed.
- Public API is exposed through component parameters, `EventCallback` hooks (`OnNodeDropped`, `OnValidateDropTarget`, etc.), and instance methods accessed with `@ref`.
- `RenderFragmentWrapper.razor` plus `HtmlRenderer` pre-render templates to HTML strings; keep this flow intact when introducing new content paths.

## JS Interop & Assets
- `wwwroot/js/flowy-interop.js` is the only JS entry point consumed from C#; new JS surface areas must be exported there and mirrored with C# wrapper methods.
- Core behavior lives in `flowy-core.js`, which composes modules (`flowy-zoom-pan.js`, `flowy-drag-drop.js`, `flowy-connections.js`, `flowy-tree-layout.js`, `flowy-utils.js`, `flowy-console.js`).
- `FlowyCanvasEditor` uses `DotNetObjectReference` callbacks like `NotifyNodeDropped` and `ValidateDropTarget`; keep signatures stable or version the JS module accordingly.
- CSS is modular: `flowy.css` imports per-feature styles (`flowy-variables.css`, `flowy-layout.css`, etc.); extend styling by adding new partials and updating the import list.
- The components panel relies on `data-component-id` attributes in `FlowyComponentsPanel.razor`; JS drag logic reads those values—preserve them when restyling.

## Coding Patterns
- Nodes use GUIDs; when injecting custom IDs from JS ensure they pass `Guid.TryParse` or provide deterministic conversion in `FlowyTreeService`.
- Keep two-way bindings (`@bind-ZoomLevel`, `@bind-AutoZoom`) in sync with JS by toggling `_updatingFromJS` flags; mimic this approach for any new bindable parameter.
- Long-running JS operations (e.g., droplet animation) should call back into C# sparingly; reuse existing `FlowDropletsAsync` plumbing rather than inventing new loops.
- For imports/exports, use `FlowyTreeData` to stay compatible with existing JSON schema; update both C# serializer and JS `exportTreeStructure` if the shape changes.
- Console diagnostics funnel through `Helpers/ConsoleExtensions.WriteLinePretty`; prefer it for verbose logging when `Debug` is enabled.

## Working Tips
- When adding interop, update `FlowyCanvasEditor.DisposeAsync` to clean up subscriptions and invoke the matching `FlowyInterop.dispose` logic.
- Demo adjustments should stay in `VIOVNL.Flowy.Demo/Components/Pages/FeaturesExample.razor`; keep library examples minimal and production-safe.
- Static asset tweaks require rebuilding the project once so `_content/VIOVNL.Flowy.Blazor/...` outputs refresh before manual testing.
- Keep documentation aligned—`Documentation.md` mirrors most public API, so revise it alongside signature changes.
- Mention multi-target impacts and manual test steps in PR descriptions to offset the absence of automated checks.
