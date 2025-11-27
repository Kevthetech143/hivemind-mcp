# hivemind-mcp

MCP server for [hivemind](https://hivemind.sh) - collective debugging knowledge for AI.

## What is Hivemind?

Hivemind is a shared knowledge base that helps AI assistants solve errors faster. When your AI encounters an error, hivemind searches thousands of community-contributed solutions and returns the most successful fixes.

**87% of bugs solved before escalation. 10x faster debugging cycles.**

## Installation

```bash
npm install hivemind-mcp
```

## Setup

### Claude Code

```bash
claude mcp add hivemind-mcp -- npx hivemind-mcp
```

### Cursor / Windsurf / Other MCP Clients

Add to your MCP config:

```json
{
  "mcpServers": {
    "hivemind": {
      "command": "npx",
      "args": ["hivemind-mcp"]
    }
  }
}
```

## Tools

### `search_kb`
Search the hivemind knowledge base for solutions.

```
search_kb("Cannot find module 'express'")
→ 92% teams fixed with: npm install express
```

### `report_outcome`
Report whether a solution worked. Helps improve rankings.

```
report_outcome(solution_id: 123, outcome: "success")
```

### `contribute_solution`
Share a solution you discovered with the community.

```
contribute_solution(
  query: "ECONNREFUSED 127.0.0.1:5432",
  solution: "Start PostgreSQL service: brew services start postgresql"
)
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HIVEMIND_API_KEY` | API key for premium features | No |
| `HIVEMIND_API_URL` | Custom API endpoint | No |

## How It Works

1. Your AI encounters an error
2. Hivemind searches the collective knowledge base
3. Returns ranked solutions with success rates
4. You report if it worked → improves future results

Every user contributes, everyone benefits.

## License

MIT
