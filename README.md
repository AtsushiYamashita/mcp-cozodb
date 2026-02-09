# MCP CozoDB Server

Model Context Protocol server for [CozoDB](https://github.com/cozodb/cozo) - a Datalog database with graph query capabilities.

## Related Skill

This MCP server works best with the **[CozoDB Connector Skill](../README.md)** which provides:

- Datalog query syntax reference
- CozoDB patterns and best practices
- Edge cases and troubleshooting

## Installation

```bash
cd mcp-cozodb
npm install
npm run build
```

## Configuration

### Environment Variables

| Variable      | Default     | Description                                |
| ------------- | ----------- | ------------------------------------------ |
| `COZO_ENGINE` | `mem`       | Storage engine: `mem`, `sqlite`, `rocksdb` |
| `COZO_PATH`   | `./cozo.db` | Database path (ignored for `mem`)          |

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cozodb": {
      "command": "node",
      "args": ["/path/to/mcp-cozodb/dist/index.js"],
      "env": {
        "COZO_ENGINE": "sqlite",
        "COZO_PATH": "/path/to/your/database.db"
      }
    }
  }
}
```

### Gemini CLI Configuration

Add to MCP config:

```json
{
  "cozodb": {
    "command": "node",
    "args": ["D:/project/mcp-cozodb/dist/index.js"],
    "env": {
      "COZO_ENGINE": "mem"
    }
  }
}
```

## Available Tools

### Read-Only Tools

| Tool                     | Description                 |
| ------------------------ | --------------------------- |
| `cozo_query`             | Execute Datalog queries     |
| `cozo_list_relations`    | List all relations (tables) |
| `cozo_describe_relation` | Get relation schema         |

### Mutation Tools

| Tool                   | Description         | Destructive |
| ---------------------- | ------------------- | ----------- |
| `cozo_create_relation` | Create new relation | No          |
| `cozo_put`             | Insert/update rows  | No          |
| `cozo_remove`          | Delete rows         | ⚠️ Yes      |
| `cozo_drop_relation`   | Delete relation     | ⚠️ Yes      |

## Usage Examples

### Query

```
Tool: cozo_query
Input: {
  "query": "?[x, y] <- [[1, 'hello'], [2, 'world']]"
}
```

### Create Relation

```
Tool: cozo_create_relation
Input: {
  "relation_name": "users",
  "schema": "{id: Int => name: String, age: Int}"
}
```

### Insert Data

```
Tool: cozo_put
Input: {
  "relation_name": "users",
  "data": [[1, "Alice", 30], [2, "Bob", 25]]
}
```

### Query Relation

```
Tool: cozo_query
Input: {
  "query": "?[name, age] := users[_, name, age], age > 20"
}
```

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## License

MIT
