namespace VIOVNL.Flowy.Blazor.Models;

/// <summary>
/// Event arguments for node operations
/// </summary>
public class FlowyNodeEventArgs : EventArgs
{
    public FlowyNode Node { get; set; } = null!;
    public FlowyNode? OldParent { get; set; }
    public FlowyNode? NewParent { get; set; }
}

/// <summary>
/// Event arguments for node dropped event
/// </summary>
public class FlowyNodeDroppedEventArgs : EventArgs
{
    public FlowyNode Node { get; set; } = null!;
    public FlowyNode? TargetNode { get; set; }
    public DropPosition Position { get; set; }
    public bool IsNewNode { get; set; }
}

/// <summary>
/// Event arguments for node selection
/// </summary>
public class FlowyNodeSelectedEventArgs : EventArgs
{
    public FlowyNode? Node { get; set; }
    public FlowyNode? PreviousNode { get; set; }
}

/// <summary>
/// Event arguments for node removal
/// </summary>
public class FlowyNodeRemovedEventArgs : EventArgs
{
    public Guid NodeId { get; set; }
    public FlowyNode Node { get; set; } = null!;
}

/// <summary>
/// Event arguments for node moved to new parent
/// </summary>
public class FlowyNodeMovedEventArgs : EventArgs
{
    public Guid NodeId { get; set; }
    public Guid? NewParentId { get; set; }
}

/// <summary>
/// Event arguments for tree restructuring operations (promote/demote)
/// </summary>
public class FlowyTreeRestructuredEventArgs : EventArgs
{
    public string OperationType { get; set; } = string.Empty; // "promote" or "demote"
    public Guid AffectedNodeId { get; set; }
}

/// <summary>
/// Event arguments for validation
/// </summary>
public class FlowyValidationEventArgs : EventArgs
{
    public FlowyNode Node { get; set; } = null!;
    public FlowyNode? TargetNode { get; set; }
    public DropPosition Position { get; set; }
    public bool IsValid { get; set; } = true;
    public string? ValidationMessage { get; set; }
}

/// <summary>
/// Drop position relative to target node
/// </summary>
public enum DropPosition
{
    Under,
    Left,
    Right
}
