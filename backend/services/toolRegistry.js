/**
 * Agentic AI Brain - Tool Registry
 * 
 * Manages all available tools and their execution.
 * Tools are the actions the agent can take.
 */

const fs = require('fs');
const path = require('path');

class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a tool
   */
  registerTool(tool) {
    if (!tool.name || !tool.execute) {
      throw new Error('Tool must have a name and execute function');
    }

    this.tools.set(tool.name, {
      name: tool.name,
      description: tool.description || 'No description provided',
      parameters: tool.parameters || {},
      execute: tool.execute,
      category: tool.category || 'general',
      requiresApproval: tool.requiresApproval || false,
    });

    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * Get a tool by name
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * List all tools
   */
  listTools() {
    return Array.from(this.tools.values());
  }

  /**
   * List tools by category
   */
  listToolsByCategory(category) {
    return Array.from(this.tools.values()).filter(t => t.category === category);
  }

  /**
   * Get tool descriptions for Claude
   */
  getToolDescriptions() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      category: tool.category,
    }));
  }

  /**
   * Auto-load all tools from the tools directory
   */
  loadToolsFromDirectory(toolsDir) {
    try {
      console.log(`[ToolRegistry] Loading tools from: ${toolsDir}`);
      const files = fs.readdirSync(toolsDir);
      console.log(`[ToolRegistry] Found ${files.length} files in tools directory`);
      
      let loadedCount = 0;
      let failedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.js') && file !== 'index.js') {
          const toolPath = path.join(toolsDir, file);
          
          try {
            console.log(`[ToolRegistry] Loading tool from: ${file}`);
            const tool = require(toolPath);
            
            if (tool && tool.name) {
              this.registerTool(tool);
              loadedCount++;
              console.log(`[ToolRegistry] ✅ Loaded: ${tool.name} from ${file}`);
            } else {
              console.warn(`[ToolRegistry] ⚠️  Skipped ${file} - no name or invalid export`);
            }
          } catch (error) {
            failedCount++;
            console.error(`[ToolRegistry] ❌ Failed to load ${file}:`, error.message);
            console.error(`[ToolRegistry]    Stack:`, error.stack);
          }
        }
      }

      console.log(`[ToolRegistry] ===== TOOL LOADING SUMMARY =====`);
      console.log(`[ToolRegistry] Total tools loaded: ${this.tools.size}`);
      console.log(`[ToolRegistry] Successfully loaded: ${loadedCount}`);
      console.log(`[ToolRegistry] Failed to load: ${failedCount}`);
      console.log(`[ToolRegistry] Tool names: ${Array.from(this.tools.keys()).join(', ')}`);
      console.log(`[ToolRegistry] ===============================`);
      
    } catch (error) {
      console.error('[ToolRegistry] CRITICAL ERROR loading tools directory:', error);
      console.error('[ToolRegistry] Directory:', toolsDir);
      console.error('[ToolRegistry] Stack:', error.stack);
    }
  }

  /**
   * Validate tool parameters before execution
   */
  validateParameters(toolName, params) {
    const tool = this.getTool(toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Basic validation - could be expanded
    const toolParams = tool.parameters;
    
    for (const [paramName, paramConfig] of Object.entries(toolParams)) {
      if (paramConfig.required && !(paramName in params)) {
        throw new Error(`Missing required parameter: ${paramName} for tool ${toolName}`);
      }
    }

    return true;
  }
}

module.exports = ToolRegistry;

