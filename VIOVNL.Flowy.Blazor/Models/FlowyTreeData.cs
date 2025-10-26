namespace VIOVNL.Flowy.Blazor.Models;

/// <summary>
/// Serializable tree structure for save/load operations
/// </summary>
public class FlowyTreeData
{
    /// <summary>
    /// Version of the data format
    /// </summary>
    public string Version { get; set; } = "1.0";

    /// <summary>
    /// Timestamp when the data was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Root node ID
    /// </summary>
    public Guid? RootNodeId { get; set; }

    /// <summary>
    /// All nodes in the tree
    /// </summary>
    public List<FlowyNode> Nodes { get; set; } = new();

    /// <summary>
    /// Custom metadata
    /// </summary>
    public Dictionary<string, object>? Metadata { get; set; }
}
