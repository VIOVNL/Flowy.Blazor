using Microsoft.AspNetCore.Components;

namespace VIOVNL.Flowy.Blazor.Models;

/// <summary>
/// Represents a component that can be dragged from the toolbox to create nodes.
/// </summary>
/// <remarks>
/// BodyContent is rendered to HTML on the server and sent to JavaScript.
/// This allows rich Blazor components to be used as node content.
/// </remarks>
/// <example>
/// <code>
/// new FlowyComponentItem
/// {
///     ComponentId = "person",
///     Name = "Person",
///     BodyContent = @&lt;text&gt;👤 Family Member&lt;/text&gt;,
///     Color = "#667eea"
/// }
/// </code>
/// </example>
public class FlowyComponentItem
{
    /// <summary>
    /// Unique identifier for the component type (template identifier, not instance GUID)
    /// </summary>
    public string ComponentId { get; set; } = string.Empty;

    /// <summary>
    /// Display name of the component
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Custom body content to display in the component
    /// </summary>
    public RenderFragment? BodyContent { get; set; }

    /// <summary>
    /// Color for the component (hex format)
    /// </summary>
    public string Color { get; set; } = "#667eea";

    /// <summary>
    /// Whether nodes created from this component can be dragged
    /// </summary>
    public bool IsDraggable { get; set; } = true;

    /// <summary>
    /// Whether nodes created from this component can accept children
    /// </summary>
    public bool CanHaveChildren { get; set; } = true;

    /// <summary>
    /// Whether this component is enabled in the toolbox
    /// </summary>
    public bool IsEnabled { get; set; } = true;
}
