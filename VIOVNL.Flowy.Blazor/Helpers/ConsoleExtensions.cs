using System;

namespace VIOVNL.Flowy.Blazor.Helpers;

/// <summary>
/// Console extensions for prettier debug output
/// </summary>
public static class ConsoleExtensions
{
    /// <summary>
    /// Writes a formatted, colorized debug message to the console
    /// </summary>
    /// <param name="category">Category/component name (e.g., "CanvasEditor", "TreeService")</param>
    /// <param name="method">Method name being called</param>
    /// <param name="message">Optional additional message</param>
    /// <param name="parameters">Optional parameters dictionary</param>
    public static void WriteLinePretty(string category, string method, string? message = null, object? parameters = null)
    {
        var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
        var categoryFormatted = $"[{category}]".PadRight(20);
        var methodFormatted = method.PadRight(30);
        
        // Use colors for prettier output
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.Write("Flowy ");
        
        Console.ForegroundColor = ConsoleColor.DarkGray;
        Console.Write($"{timestamp} ");
        
        Console.ForegroundColor = ConsoleColor.Blue;
        Console.Write(categoryFormatted);
        
        Console.ForegroundColor = ConsoleColor.Green;
        Console.Write(methodFormatted);
        
        if (!string.IsNullOrEmpty(message))
        {
            Console.ForegroundColor = ConsoleColor.White;
            Console.Write(" → ");
            Console.ForegroundColor = ConsoleColor.Gray;
            Console.Write(message);
        }
        
        if (parameters != null)
        {
            var paramsStr = FormatParameters(parameters);
            if (!string.IsNullOrEmpty(paramsStr))
            {
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.Write(" | ");
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.Write(paramsStr);
            }
        }
        
        Console.ResetColor();
        Console.WriteLine();
    }
    
    /// <summary>
    /// Formats parameters object into a readable string
    /// </summary>
    private static string FormatParameters(object parameters)
    {
        if (parameters == null) return string.Empty;
        
        var props = parameters.GetType().GetProperties();
        var parts = new List<string>();
        
        foreach (var prop in props)
        {
            var value = prop.GetValue(parameters);
            var valueStr = value?.ToString() ?? "null";
            
            // Truncate long strings
            if (valueStr.Length > 50)
            {
                valueStr = valueStr.Substring(0, 47) + "...";
            }
            
            parts.Add($"{prop.Name}={valueStr}");
        }
        
        return string.Join(", ", parts);
    }
}
