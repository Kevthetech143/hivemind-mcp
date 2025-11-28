#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { searchKnowledgeBase, reportOutcome, contributeSOlution, listSkills, getSkill } from "./api.js";

const server = new Server(
  {
    name: "hivemind-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_kb",
        description:
          "Search the hivemind knowledge base for troubleshooting solutions, error fixes, and best practices. Returns ranked solutions with success rates.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Error message, problem description, or technology to search for.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "report_outcome",
        description:
          "Report whether a solution worked or not. Helps improve solution rankings.",
        inputSchema: {
          type: "object",
          properties: {
            solution_id: {
              type: "number",
              description: "The ID of the solution from search results.",
            },
            outcome: {
              type: "string",
              enum: ["success", "failure"],
              description: "Did the solution work?",
            },
          },
          required: ["outcome"],
        },
      },
      {
        name: "contribute_solution",
        description:
          "Submit a new solution to the hivemind knowledge base.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The error message or problem this solution solves.",
            },
            solution: {
              type: "string",
              description: "The solution that worked.",
            },
            category: {
              type: "string",
              description: "Category: mcp-troubleshooting, web-automation, security, etc.",
            },
          },
          required: ["query", "solution"],
        },
      },
      {
        name: "list_skills",
        description:
          "List all available skills in the knowledge base, optionally filtered by category. Skills are executable step-by-step guides.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional: Filter skills by category (e.g., 'claude-code', 'python', 'docker')",
            },
          },
        },
      },
      {
        name: "get_skill",
        description:
          "Get detailed information about a specific skill including full instructions and executable steps.",
        inputSchema: {
          type: "object",
          properties: {
            skill_id: {
              type: "number",
              description: "The ID of the skill to retrieve",
            },
          },
          required: ["skill_id"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_kb": {
      const result = await searchKnowledgeBase(args?.query as string);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "report_outcome": {
      const result = await reportOutcome(
        args?.solution_id as number | undefined,
        args?.outcome as "success" | "failure"
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "contribute_solution": {
      const result = await contributeSOlution(
        args?.query as string,
        args?.solution as string,
        args?.category as string | undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "list_skills": {
      const result = await listSkills(args?.category as string | undefined);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "get_skill": {
      const result = await getSkill(args?.skill_id as number);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Hivemind MCP server running");
}

main().catch(console.error);
