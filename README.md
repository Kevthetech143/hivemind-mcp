# hivemind-mcp

MCP server for collective debugging knowledge + project-specific knowledge bases.

## What is Hivemind?

Hivemind provides two knowledge layers:

### 1. **Public Knowledge Base** (16k+ solutions)
- Error fixes and troubleshooting from the community
- 223+ reusable skills and workflows
- Success-ranked solutions that improve over time
- Think Stack Overflow for AI agents

### 2. **Project Knowledge Bases** (Your Private Hive)
- Auto-scans your project on setup
- Builds foundational knowledge (tech stack, architecture, database, build system)
- Stores project-specific solutions as you work
- Cloud storage: syncs everywhere + 10x rate limits (1000/hour)
- Local storage: stays private on your machine (100/hour)

## How It Works

**Public KB:**
```
AI hits error → Search hivemind → Get ranked solutions → Report outcome
```

**Project KB (Hive):**
```
"create a new hive" → Auto-scan project → Store solutions as you work → Search your private knowledge
```

When you solve a problem, it's automatically added to your project's hive. Next session, Claude already knows how your project works.

## Installation

```bash
npm install hivemind-mcp
```

## Setup

### Claude Code

```bash
claude mcp add hivemind -- npx hivemind-mcp@latest
```

Restart Claude Code to load the tools.

### Cursor / Windsurf / Other MCP Clients

Add to your MCP config:

```json
{
  "mcpServers": {
    "hivemind": {
      "command": "npx",
      "args": ["hivemind-mcp@latest"]
    }
  }
}
```

## Quick Start

### First Time Setup (Recommended)

Tell Claude:
```
"create a new hive"
```

Claude will:
1. Ask if you want cloud or local storage
2. Auto-scan your project (tech stack, architecture, database)
3. Create 5 foundational knowledge entries
4. Give you a user_id (save this!)

**That's it.** Now as you work, solutions get stored in your project's hive automatically.

### Using Public Knowledge

No setup needed. Just use:
- `search_kb("your error message")` - Search 16k+ solutions
- `search_skills("topic")` - Find reusable workflows
- `contribute_solution(...)` - Share what you learned

## Tools

### Public Knowledge Base

**`search_kb(query)`**
Search 16k+ error solutions and fixes.
```javascript
search_kb("Cannot find module 'express'")
// Returns: npm install express (92% success rate)
```

**`search_skills(query, max_results?)`**
Search 223+ reusable skills and workflows.
```javascript
search_skills("deployment")
// Returns: Top 20 deployment-related skills
```

**`get_skill(skill_id)`**
Load full details of a specific skill.
```javascript
get_skill(19417)
// Returns: Complete skill instructions
```

**`count_skills()`**
Get total number of skills in database.
```javascript
count_skills()
// Returns: { total: 223 }
```

**`contribute_solution(query, solution, category?)`**
Share a fix you discovered with the community.
```javascript
contribute_solution(
  "ECONNREFUSED 127.0.0.1:5432",
  "Start PostgreSQL: brew services start postgresql",
  "database"
)
```

**`report_outcome(solution_id, outcome)`**
Report if a solution worked. Improves rankings.
```javascript
report_outcome(123, "success")  // or "failure"
```

### Project Knowledge Base (Hive)

**`init_hive(project_id, project_name, storage_choice?, project_path?)`**
Initialize your project's knowledge base with auto-scanning.
```javascript
// Step 1: Get options
init_hive("my-app", "My App")
// Returns: storage options (cloud vs local)

// Step 2: Initialize with choice
init_hive("my-app", "My App", "cloud", "/path/to/project")
// Returns: user_id + confirmation (scans project automatically)
```

**`contribute_project(user_id, project_id, query, solution, category?, is_public?)`**
Add knowledge to your project hive.
```javascript
contribute_project(
  "your-user-id",
  "my-app",
  "How to deploy this project?",
  "Run: npm run build && npm run deploy",
  "deployment",
  false  // private
)
```

**`search_project(user_id, query, project_id?, include_public?)`**
Search your project's knowledge base.
```javascript
search_project(
  "your-user-id",
  "database schema",
  "my-app"
)
// Returns: Your project-specific knowledge
```

## Features

✅ **16k+ community solutions** - Ranked by success rate
✅ **223+ reusable skills** - Workflows and procedures
✅ **Auto-scanning** - Detects tech stack, architecture, database on setup
✅ **Cloud sync** - 10x rate limits (1000/hour) + access everywhere
✅ **Private by default** - Your project knowledge stays yours
✅ **FTS search** - Fast full-text search across solutions
✅ **Success tracking** - Solutions improve based on feedback

## License

MIT
