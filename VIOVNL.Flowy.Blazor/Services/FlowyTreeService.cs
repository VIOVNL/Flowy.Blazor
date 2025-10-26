using VIOVNL.Flowy.Blazor.Models;

namespace VIOVNL.Flowy.Blazor.Services;

/// <summary>
/// Service for managing Flowy tree operations (internal - access via FlowyCanvasEditor)
/// </summary>
internal class FlowyTreeService : IDisposable
{
    private readonly List<FlowyNode> _nodes = new();
    private FlowyNode? _rootNode;
    private bool _disposed = false;

    public event EventHandler? TreeChanged;

    /// <summary>
    /// Gets all nodes in the tree
    /// </summary>
    public IReadOnlyList<FlowyNode> Nodes => _nodes.AsReadOnly();

    /// <summary>
    /// Gets the root node
    /// </summary>
    public FlowyNode? RootNode => _rootNode;

    /// <summary>
    /// Adds a new node to the tree
    /// </summary>
    /// <param name="name">Display name (required, non-empty)</param>
    /// <param name="componentId">Component type identifier - references FlowyComponentItem.ComponentId (required, non-empty)</param>
    /// <param name="color">Hex color code (required, format: #RRGGBB)</param>
    /// <param name="parent">Parent node, or null to create root node</param>
    /// <param name="isDraggable">Whether the node can be dragged (default: true)</param>
    /// <param name="canHaveChildren">Whether the node can accept children (default: true)</param>
    /// <returns>The newly created node</returns>
    /// <exception cref="ArgumentException">Thrown when name, componentId, or color is empty</exception>
    /// <remarks>
    /// This method is not thread-safe. If called from multiple threads,
    /// wrap in appropriate synchronization (lock or SemaphoreSlim).
    /// </remarks>
    /// <example>
    /// <code>
    /// var root = treeService.AddNode("John Doe", "Person", "#667eea");
    /// var child = treeService.AddNode("Jane Doe", "Person", "#f093fb", root);
    public FlowyNode AddNode(string name, string componentId, string color, FlowyNode? parent = null, bool isDraggable = true, bool canHaveChildren = true)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Node name cannot be empty", nameof(name));
        if (string.IsNullOrWhiteSpace(componentId))
            throw new ArgumentException("Node componentId cannot be empty", nameof(componentId));
        if (string.IsNullOrWhiteSpace(color))
            throw new ArgumentException("Node color cannot be empty", nameof(color));

        var node = new FlowyNode
        {
            Name = name,
            ComponentId = componentId,
            Color = color,
            ParentId = parent?.Id,
            IsDraggable = isDraggable,
            CanHaveChildren = canHaveChildren
        };

        _nodes.Add(node);

        if (parent != null)
        {
            parent.ChildrenIds.Add(node.Id);
        }
        else if (_rootNode == null)
        {
            _rootNode = node;
        }

        TreeChanged?.Invoke(this, EventArgs.Empty);
        return node;
    }

    /// <summary>
    /// Adds an existing node to the tree (used during drag/drop or import)
    /// </summary>
    /// <param name="node">The node to add</param>
    /// <param name="parent">Parent node, or null to create root node</param>
    public void AddExistingNode(FlowyNode node, FlowyNode? parent = null)
    {
        node.ParentId = parent?.Id;
        _nodes.Add(node);

        if (parent != null)
        {
            parent.ChildrenIds.Add(node.Id);
        }
        else if (_rootNode == null)
        {
            _rootNode = node;
        }

        TreeChanged?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Removes a node and all its descendants (cascading delete)
    /// </summary>
    /// <param name="nodeId">GUID of the node to remove</param>
    /// <returns>True if node was found and removed, false otherwise</returns>
    /// <remarks>
    /// Time complexity: O(n) where n is total descendants.
    /// This is a cascading operation - all child nodes are recursively removed.
    /// TreeChanged event fires once after all deletions complete.
    /// </remarks>
    public bool RemoveNode(Guid nodeId)
    {
        var node = GetNodeById(nodeId);
        if (node == null) return false;

        // Remove all descendants first
        var descendants = GetDescendants(node);
        foreach (var descendant in descendants)
        {
            _nodes.Remove(descendant);
        }

        // Remove from parent's children
        if (node.ParentId.HasValue)
        {
            var parent = GetNodeById(node.ParentId.Value);
            parent?.ChildrenIds.Remove(nodeId);
        }
        else if (_rootNode?.Id == nodeId)
        {
            _rootNode = null;
        }

        _nodes.Remove(node);
        TreeChanged?.Invoke(this, EventArgs.Empty);
        return true;
    }

    /// <summary>
    /// Moves a node to a new parent
    /// </summary>
    /// <param name="nodeId">GUID of node to move</param>
    /// <param name="newParentId">GUID of new parent, or null to make root</param>
    /// <param name="position">Insert position in parent's children list (-1 = append, 0+ = insert at index)</param>
    /// <returns>True if move succeeded, false if validation failed</returns>
    /// <remarks>
    /// Validation checks:
    /// - Cannot move node to itself
    /// - Cannot create circular references (moving ancestor into descendant)
    /// - Invalid positions are coerced to append (-1)
    /// 
    /// This operation maintains tree integrity and fires TreeChanged event.
    /// </remarks>
    public bool MoveNode(Guid nodeId, Guid? newParentId, int position = -1)
    {
        var node = GetNodeById(nodeId);
        if (node == null) return false;

        // Prevent moving node to itself
        if (newParentId.HasValue && nodeId == newParentId.Value) return false;

        // Validate we're not creating a circular reference
        if (newParentId.HasValue)
        {
            var newParent = GetNodeById(newParentId.Value);
            if (newParent == null || IsDescendant(node, newParent)) return false;
        }

        // Remove from old parent
        if (node.ParentId.HasValue)
        {
            var oldParent = GetNodeById(node.ParentId.Value);
            oldParent?.ChildrenIds.Remove(nodeId);
        }

        // Add to new parent
        node.ParentId = newParentId;
        if (newParentId.HasValue)
        {
            var newParent = GetNodeById(newParentId.Value);
            if (newParent != null)
            {
                // Validate position - only accept -1 (append) or valid index
                if (position >= 0 && position < newParent.ChildrenIds.Count)
                {
                    newParent.ChildrenIds.Insert(position, nodeId);
                }
                else
                {
                    // Append to end for invalid positions
                    newParent.ChildrenIds.Add(nodeId);
                }
            }
        }

        TreeChanged?.Invoke(this, EventArgs.Empty);
        return true;
    }

    /// <summary>
    /// Reorders a node within its parent's children
    /// </summary>
    public bool ReorderNode(Guid nodeId, int newPosition)
    {
        var node = GetNodeById(nodeId);
        if (node == null || !node.ParentId.HasValue) return false;

        var parent = GetNodeById(node.ParentId.Value);
        if (parent == null) return false;

        parent.ChildrenIds.Remove(nodeId);
        if (newPosition >= parent.ChildrenIds.Count)
        {
            parent.ChildrenIds.Add(nodeId);
        }
        else
        {
            parent.ChildrenIds.Insert(Math.Max(0, newPosition), nodeId);
        }

        TreeChanged?.Invoke(this, EventArgs.Empty);
        return true;
    }

    /// <summary>
    /// Gets a node by its ID
    /// </summary>
    public FlowyNode? GetNodeById(Guid id) => _nodes.FirstOrDefault(n => n.Id == id);

    /// <summary>
    /// Gets all children of a node
    /// </summary>
    public List<FlowyNode> GetChildren(FlowyNode node)
    {
        return node.ChildrenIds
            .Select(GetNodeById)
            .Where(n => n != null)
            .Cast<FlowyNode>()
            .ToList();
    }

    /// <summary>
    /// Gets all descendants of a node
    /// </summary>
    public List<FlowyNode> GetDescendants(FlowyNode node)
    {
        var descendants = new List<FlowyNode>();
        var children = GetChildren(node);
        
        foreach (var child in children)
        {
            descendants.Add(child);
            descendants.AddRange(GetDescendants(child));
        }

        return descendants;
    }

    /// <summary>
    /// Checks if a node is a descendant of another node
    /// </summary>
    /// <param name="ancestor">Potential ancestor node</param>
    /// <param name="node">Node to check</param>
    /// <returns>True if node is a descendant of ancestor</returns>
    /// <remarks>
    /// Algorithm: Walks up parent chain from 'node' checking for 'ancestor'.
    /// 
    /// Time complexity: O(h) where h is tree height (depth of node).
    /// 
    /// Includes circular reference detection - if corrupted data causes a cycle,
    /// returns false and logs error to prevent infinite loop.
    /// </remarks>
    public bool IsDescendant(FlowyNode ancestor, FlowyNode node)
    {
        var current = node;
        // Track visited nodes to detect cycles (should never happen in valid data)
        var visited = new HashSet<Guid> { ancestor.Id };
        
        // Walk up the parent chain from node toward root
        while (current.ParentId.HasValue)
        {
            // Found ancestor in the parent chain
            if (current.ParentId == ancestor.Id) return true;
            
            // Protection against circular references in corrupted data
            // If we've already visited this parent, there's a cycle
            if (visited.Contains(current.ParentId.Value))
            {
                Console.Error.WriteLine($"[Flowy] Circular reference detected in tree at node {current.Id}");
                return false;
            }
            
            visited.Add(current.ParentId.Value);
            current = GetNodeById(current.ParentId.Value);
            if (current == null) break; // Parent not found (orphaned node)
        }
        
        // Reached root without finding ancestor
        return false;
    }

    /// <summary>
    /// Promotes a node to become parent of its current parent
    /// Child becomes Parent, Parent becomes Child
    /// </summary>
    /// <param name="nodeId">GUID of node to promote</param>
    /// <returns>True if promotion succeeded, false if validation failed</returns>
    public bool PromoteNode(Guid nodeId)
    {
        var node = GetNodeById(nodeId);
        if (node == null || !node.ParentId.HasValue) return false;
        
        var oldParent = GetNodeById(node.ParentId.Value);
        if (oldParent == null || !oldParent.ParentId.HasValue) return false; // Can't replace root
        
        var grandParent = GetNodeById(oldParent.ParentId.Value);
        if (grandParent == null) return false;
        
        // Store collections before modifications
        var promotedNodeChildren = new List<Guid>(node.ChildrenIds);
        var promotedNodeSiblings = oldParent.ChildrenIds.Where(id => id != nodeId).ToList();
        
        // Replace old parent with promoted node in grandparent's children
        var parentIndex = grandParent.ChildrenIds.IndexOf(oldParent.Id);
        if (parentIndex >= 0)
        {
            grandParent.ChildrenIds[parentIndex] = nodeId;
        }
        node.ParentId = grandParent.Id;
        
        // Clear children arrays
        node.ChildrenIds.Clear();
        oldParent.ChildrenIds.Clear();
        
        // Old parent becomes child of promoted node
        oldParent.ParentId = nodeId;
        node.ChildrenIds.Add(oldParent.Id);
        
        // Promoted node's siblings become siblings of the demoted parent
        foreach (var siblingId in promotedNodeSiblings)
        {
            var sibling = GetNodeById(siblingId);
            if (sibling != null)
            {
                sibling.ParentId = nodeId;
                node.ChildrenIds.Add(siblingId);
            }
        }
        
        // Transfer promoted node's original children to the demoted parent
        foreach (var childId in promotedNodeChildren)
        {
            var child = GetNodeById(childId);
            if (child != null)
            {
                child.ParentId = oldParent.Id;
                oldParent.ChildrenIds.Add(childId);
            }
        }
        
        TreeChanged?.Invoke(this, EventArgs.Empty);
        return true;
    }
    
    /// <summary>
    /// Demotes a node to become child of its first child
    /// Parent becomes Child, Child becomes Parent
    /// </summary>
    /// <param name="nodeId">GUID of node to demote</param>
    /// <returns>True if demotion succeeded, false if validation failed</returns>
    public bool DemoteNode(Guid nodeId)
    {
        var node = GetNodeById(nodeId);
        if (node == null || !node.ParentId.HasValue) return false; // Can't demote root
        
        if (node.ChildrenIds.Count == 0) return false; // Must have children
        
        var firstChildId = node.ChildrenIds[0];
        var firstChild = GetNodeById(firstChildId);
        if (firstChild == null) return false;
        
        var parent = GetNodeById(node.ParentId.Value);
        if (parent == null) return false;
        
        // Store collections before modifications
        var grandChildren = new List<Guid>(firstChild.ChildrenIds);
        var demotedNodeSiblings = node.ChildrenIds.Skip(1).ToList();
        
        // Replace node with first child in parent's children
        var nodeIndex = parent.ChildrenIds.IndexOf(nodeId);
        if (nodeIndex >= 0)
        {
            parent.ChildrenIds[nodeIndex] = firstChildId;
        }
        firstChild.ParentId = parent.Id;
        
        // Clear children arrays
        node.ChildrenIds.Clear();
        firstChild.ChildrenIds.Clear();
        
        // Node becomes child of its former first child
        node.ParentId = firstChildId;
        firstChild.ChildrenIds.Add(nodeId);
        
        // Demoted node's other children become siblings of promoted child
        foreach (var siblingId in demotedNodeSiblings)
        {
            var sibling = GetNodeById(siblingId);
            if (sibling != null)
            {
                sibling.ParentId = firstChildId;
                firstChild.ChildrenIds.Add(siblingId);
            }
        }
        
        // Transfer first child's children to demoted node
        foreach (var childId in grandChildren)
        {
            var child = GetNodeById(childId);
            if (child != null)
            {
                child.ParentId = nodeId;
                node.ChildrenIds.Add(childId);
            }
        }
        
        TreeChanged?.Invoke(this, EventArgs.Empty);
        return true;
    }

    /// <summary>
    /// Clears the entire tree
    /// </summary>
    public void Clear()
    {
        _nodes.Clear();
        _rootNode = null;
        TreeChanged?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Loads tree from data
    /// </summary>
    public void LoadFromData(FlowyTreeData data)
    {
        Clear();
        _nodes.AddRange(data.Nodes);
        if (data.RootNodeId.HasValue)
        {
            _rootNode = GetNodeById(data.RootNodeId.Value);
        }
        TreeChanged?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Exports tree to data format
    /// </summary>
    public FlowyTreeData ExportToData()
    {
        return new FlowyTreeData
        {
            RootNodeId = _rootNode?.Id,
            Nodes = new List<FlowyNode>(_nodes),
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Disposes the service and cleans up event handlers
    /// </summary>
    public void Dispose()
    {
        if (_disposed) return;
        
        // Clear all event handlers to prevent memory leaks
        if (TreeChanged != null)
        {
            foreach (var handler in TreeChanged.GetInvocationList())
            {
                TreeChanged -= (EventHandler)handler;
            }
        }
        
        _disposed = true;
    }
}
