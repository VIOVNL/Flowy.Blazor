# Contributing to VIOVNL.Flowy.Blazor

First off, thank you for considering contributing to VIOVNL.Flowy.Blazor! It's people like you that make this project such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, screenshots)
- **Describe the behavior you observed** and what you expected
- **Include your environment details** (.NET version, browser, OS)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **Provide examples** of how it would be used

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code, add tests if applicable
3. Ensure your code follows the coding standards
4. Update documentation as needed
5. Write a clear commit message

## Development Setup

### Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) or [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- A code editor (Visual Studio 2022, VS Code, or Rider recommended)
- Git

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/VIOVNL/Flowy.Blazor.git
   cd Flowy.Blazor
   ```

2. **Restore dependencies**
   ```bash
   dotnet restore
   ```

3. **Build the solution**
   ```bash
   dotnet build
   ```

4. **Run the demo application**
   ```bash
   cd VIOVNL.Flowy.Demo
   dotnet run
   ```
   Open your browser to `https://localhost:5001`

## Project Structure

```
Flowy.Blazor/
├── VIOVNL.Flowy.Blazor/          # Component library
│   ├── Components/               # Blazor components
│   ├── Models/                   # Data models
│   ├── Services/                 # Tree management services
│   ├── Helpers/                  # Helper classes
│   └── wwwroot/                  # Static assets (JS, CSS)
│       ├── js/                   # ES6 JavaScript modules
│       └── css/                  # Component stylesheets
├── VIOVNL.Flowy.Demo/           # Demo application
└── Documentation.md              # Comprehensive docs
```

## Coding Standards

### C# / Blazor

- Follow [Microsoft's C# Coding Conventions](https://docs.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- Use **PascalCase** for public members
- Use **camelCase** for private fields (prefix with `_`)
- Add XML documentation comments for public APIs
- Keep methods focused and small
- Use async/await for I/O operations
- Suffix async methods with `Async`

**Example:**
```csharp
/// <summary>
/// Adds a new node to the tree programmatically.
/// </summary>
/// <param name="name">Display name for the node</param>
/// <param name="componentId">Component type identifier</param>
/// <returns>The created node, or null if operation failed</returns>
public async Task<FlowyNode?> AddNodeAsync(string name, string componentId)
{
    // Implementation
}
```

### JavaScript

- Use **ES6 modules** (import/export)
- Use **camelCase** for variables and functions
- Use **PascalCase** for class names
- Add JSDoc comments for public methods
- Always use `const` or `let` (never `var`)
- Clean up event listeners in `cleanup()` methods

**Example:**
```javascript
/**
 * Animates droplets flowing between nodes
 * @param {string} startNodeId - Starting node GUID
 * @param {string} endNodeId - Destination node GUID
 * @param {number} duration - Animation duration in milliseconds
 * @returns {boolean} True if animation started successfully
 */
async flowDroplets(startNodeId, endNodeId, duration = 800) {
    // Implementation
}
```

### CSS

- Use **kebab-case** for class names
- Follow BEM methodology where appropriate
- Use CSS variables for theming
- Keep specificity low
- Group related properties

## Branch Naming Convention

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions/changes

**Examples:**
- `feature/add-node-icons`
- `fix/zoom-reset-bug`
- `docs/update-installation-guide`

## Commit Messages

Use clear and meaningful commit messages:

- `feat: add droplet animation easing options`
- `fix: resolve zoom level binding issue`
- `docs: update API reference for events`
- `refactor: simplify tree layout algorithm`
- `test: add unit tests for FlowyTreeService`
- `chore: update dependencies`

## Testing

- Test your changes in the demo application
- Verify all existing features still work
- Test in multiple browsers (Chrome, Firefox, Edge)
- Test different screen sizes
- Ensure no console errors

## Documentation

- Update `Documentation.md` for new features or API changes
- Add XML comments to new public methods
- Update README.md if adding major features
- Include code examples in documentation

## License

By contributing to VIOVNL.Flowy.Blazor, you agree that your contributions will be licensed under:
- **GPL v3** for open source use
- Available under **Commercial License** for commercial use

See [LICENSE](LICENSE) for details.

## Questions?

Feel free to open an issue with the "question" label or contact us at [https://www.viov.nl/](https://www.viov.nl/)

## Recognition

Contributors will be acknowledged in the project and release notes. Thank you for making this project better! 🎉
