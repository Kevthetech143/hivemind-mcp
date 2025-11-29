#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { searchKnowledgeBase, reportOutcome, contributeSolution, searchSkills, getSkill, countSkills, initProjectKB, contributeProject, searchProject, initHive } from "./api.js";

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
        name: "search_skills",
        description:
          "Search for skills by topic/keyword. Returns lightweight summaries - use get_skill() for full details.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Topic or keyword to search for (e.g., 'deployment', 'testing', 'CI/CD')",
            },
          },
          required: ["query"],
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
      {
        name: "count_skills",
        description:
          "Get total count of skills in the database.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "init_project_kb",
        description:
          "Initialize a project-specific knowledge base with cloud storage. Returns user_id to store for future contributions. Cloud storage users get 10x rate limits (1000/hour vs 100/hour).",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Unique project identifier (e.g., 'hivemind-mcp', 'my-app')",
            },
            project_name: {
              type: "string",
              description: "Human-readable project name",
            },
            storage_type: {
              type: "string",
              enum: ["cloud", "local"],
              description: "Storage type: 'cloud' (10x limits) or 'local' (default limits)",
            },
          },
          required: ["project_id", "project_name"],
        },
      },
      {
        name: "contribute_project",
        description:
          "Store project-specific knowledge (errors, solutions, patterns). Private by default, optionally public.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID from init_project_kb",
            },
            project_id: {
              type: "string",
              description: "Project identifier",
            },
            query: {
              type: "string",
              description: "Error message or problem description",
            },
            solution: {
              type: "string",
              description: "What fixed it",
            },
            category: {
              type: "string",
              description: "Optional category (auto-detected if not provided)",
            },
            is_public: {
              type: "boolean",
              description: "Make this entry public (default: false/private)",
            },
          },
          required: ["user_id", "project_id", "query", "solution"],
        },
      },
      {
        name: "search_project",
        description:
          "Search project-specific knowledge base. Searches your private entries + optionally public entries.",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID from init_project_kb",
            },
            query: {
              type: "string",
              description: "Search query",
            },
            project_id: {
              type: "string",
              description: "Optional: limit to specific project",
            },
            include_public: {
              type: "boolean",
              description: "Include public entries in results (default: true)",
            },
          },
          required: ["user_id", "query"],
        },
      },
      {
        name: "init_hive",
        description:
          "Guided setup for project knowledge base (hive). Call without storage_choice first to get options, then call again with user's choice. Auto-scans project and contributes foundational knowledge (tech stack, architecture, database, build system).",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Project identifier (e.g., from package.json name or directory)",
            },
            project_name: {
              type: "string",
              description: "Human-readable project name",
            },
            storage_choice: {
              type: "string",
              enum: ["cloud", "local"],
              description: "User's storage choice (omit on first call to get options)",
            },
            project_path: {
              type: "string",
              description: "Absolute path to project directory (for scanning). Defaults to current working directory if not provided.",
            },
          },
          required: ["project_id", "project_name"],
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
      const result = await contributeSolution(
        args?.query as string,
        args?.solution as string,
        args?.category as string | undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "search_skills": {
      const result = await searchSkills(args?.query as string);
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

    case "count_skills": {
      const result = await countSkills();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "init_project_kb": {
      const result = await initProjectKB(
        args?.project_id as string,
        args?.project_name as string,
        args?.storage_type as 'cloud' | 'local' | undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "contribute_project": {
      const result = await contributeProject(
        args?.user_id as string,
        args?.project_id as string,
        args?.query as string,
        args?.solution as string,
        args?.category as string | undefined,
        args?.is_public as boolean | undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "search_project": {
      const result = await searchProject(
        args?.user_id as string,
        args?.query as string,
        args?.project_id as string | undefined,
        args?.include_public as boolean | undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "init_hive": {
      const result = await initHive(
        args?.project_id as string,
        args?.project_name as string,
        args?.storage_choice as 'cloud' | 'local' | undefined,
        args?.project_path as string | undefined
      );
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
