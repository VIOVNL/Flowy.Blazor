# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of VIOVNL.Flowy.Blazor seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do Not

- **Do not** open a public GitHub issue for security vulnerabilities
- **Do not** disclose the vulnerability publicly until we've had a chance to address it

### How to Report

**Please report security vulnerabilities by emailing:** hi@viov.nl

Include the following information in your report:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up

### What to Expect

After you submit a report, we will:

1. **Acknowledge receipt** within 48 hours
2. **Provide an initial assessment** within 5 business days
3. **Keep you informed** of our progress
4. **Notify you** when the vulnerability is fixed
5. **Credit you** in the security advisory (if you wish)

### Our Commitment

- We will respond to your report promptly
- We will work with you to understand and validate the issue
- We will keep you informed of our progress
- We will credit you for the discovery (unless you prefer to remain anonymous)

## Security Update Process

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported versions
4. Release new versions as soon as possible
5. Publish a security advisory on GitHub

## Best Practices for Users

To ensure the security of your application using VIOVNL.Flowy.Blazor:

### Keep Updated

Always use the latest version of the component:

```bash
dotnet add package VIOVNL.Flowy.Blazor
```

### Input Validation

Validate all user input before passing to the component:

```csharp
// Validate node names
if (string.IsNullOrWhiteSpace(nodeName) || nodeName.Length > 100)
{
    // Handle invalid input
}

// Sanitize user-provided HTML content
var sanitizedContent = HtmlSanitizer.Sanitize(userContent);
```

### Authorization

Implement proper authorization for tree operations:

```csharp
private async Task HandleNodeDropped(FlowyNodeDroppedEventArgs args)
{
    // Check user permissions before allowing operation
    if (!await _authService.CanModifyTree(CurrentUser))
    {
        // Reject operation
        return;
    }
    
    // Process the operation
}
```

### Data Validation

Use validation callbacks to enforce business rules:

```csharp
<FlowyCanvasEditor 
    OnValidateDropTarget="ValidateDropTarget"
    ... />

private Task ValidateDropTarget(FlowyValidationEventArgs args)
{
    // Implement your validation logic
    if (args.Node.Type == "restricted" && args.TargetNode?.Type == "public")
    {
        args.IsValid = false;
        args.ValidationMessage = "Restricted nodes cannot be placed under public nodes";
    }
    return Task.CompletedTask;
}
```

### Secure JSON Import

Validate JSON before importing:

```csharp
try
{
    var data = JsonSerializer.Deserialize<FlowyTreeData>(json);
    
    // Validate structure
    if (data == null || data.Nodes.Count > 1000)
    {
        throw new InvalidOperationException("Invalid tree data");
    }
    
    await canvasEditor.ImportJson(json);
}
catch (JsonException ex)
{
    // Handle invalid JSON
}
```

### Content Security Policy (CSP)

Configure CSP headers for your Blazor application to prevent XSS attacks:

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';">
```

## Known Security Considerations

### Client-Side State

The component maintains tree state on the client. Sensitive data should not be stored in the tree structure without additional encryption or server-side validation.

### JavaScript Interop

The component uses JavaScript interop for rendering. Ensure you're using a trusted environment and keep your browser updated.

### RenderFragment Content

If you pass user-generated content via RenderFragment, ensure it's properly sanitized to prevent XSS attacks.

## Security Advisories

Security advisories will be published at:
- GitHub Security Advisories: https://github.com/VIOVNL/Flowy.Blazor/security/advisories
- NuGet package page: https://www.nuget.org/packages/VIOVNL.Flowy.Blazor

## Questions?

If you have questions about this security policy, please email hi@viov.nl
