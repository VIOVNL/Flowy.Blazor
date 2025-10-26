using System.Text.Json.Serialization;

namespace VIOVNL.Flowy.Blazor.Models;

/// <summary>
/// Represents a node in the Flowy tree structure.
/// 
/// Nodes maintain parent-child relationships via ParentId and ChildrenIds.
/// The tree structure is acyclic - circular references are prevented by validation.
/// </summary>
/// <remarks>
/// Serialization notes:
/// - ParentId is omitted from JSON when null
/// - Data dictionary is omitted when null
/// - Order property is computed at runtime (not serialized)
/// </remarks>
public class FlowyNode
{
    /// <summary>
    /// Unique identifier for the node
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Display name of the node
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Component type identifier - references FlowyComponentItem.ComponentId that was used to create this node
    /// </summary>
    public string ComponentId { get; set; } = string.Empty;

    /// <summary>
    /// Color for the node header (hex format: #RRGGBB)
    /// </summary>
    /// <example>#667eea, #f093fb, #ff6b6b</example>
    public string Color { get; set; } = "#667eea";

    /// <summary>
    /// Parent node ID (null for root)
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Guid? ParentId { get; set; }

    /// <summary>
    /// List of child node IDs (ordered left-to-right in tree layout)
    /// </summary>
    /// <remarks>
    /// Must maintain consistency with child nodes' ParentId properties.
    /// Order in this list determines visual left-to-right positioning.
    /// </remarks>
    public List<Guid> ChildrenIds { get; set; } = new();

    /// <summary>
    /// Custom data associated with the node
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Dictionary<string, object>? Data { get; set; }

    /// <summary>
    /// Whether this node can be dragged
    /// </summary>
    public bool IsDraggable { get; set; } = true;

    /// <summary>
    /// Whether this node can accept children
    /// </summary>
    public bool CanHaveChildren { get; set; } = true;

    /// <summary>
    /// Position in parent's children list
    /// </summary>
    [JsonIgnore]
    public int Order { get; set; }
}
