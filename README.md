# MCP CozoDB Server

[CozoDB](https://github.com/cozodb/cozo) (Datalog database) server for Model Context Protocol. Works with **[CozoDB Connector Skill](../README.md)** for syntax reference and best practices.

## Quick Start

```bash
npm install && npm run build
node dist/index.js  # stdio mode (Claude Desktop, Gemini CLI)
```

## Configuration

### Environment Variables

| Variable          | Default     | Description                         |
| ----------------- | ----------- | ----------------------------------- |
| `COZO_ENGINE`     | `mem`       | Storage: `mem`, `sqlite`, `rocksdb` |
| `COZO_PATH`       | `./cozo.db` | Database path (ignored for `mem`)   |
| `MCP_TRANSPORT`   | `stdio`     | Transport: `stdio` or `http`        |
| `MCP_HTTP_PORT`   | `3100`      | HTTP port (when transport=http)     |
| `MCP_CORS_ORIGIN` | `localhost` | CORS origins (comma-separated)      |

### Client Configuration

**Claude Desktop** - Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cozodb": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-cozodb/dist/index.js"],
      "env": { "COZO_ENGINE": "sqlite", "COZO_PATH": "/path/to/db.db" }
    }
  }
}
```

**Gemini CLI** - Add to MCP config:

```json
{
  "cozodb": {
    "command": "node",
    "args": ["D:/project/mcp-cozodb/dist/index.js"],
    "env": { "COZO_ENGINE": "mem" }
  }
}
```

## Available Tools

| Tool                     | Description             | Destructive |
| ------------------------ | ----------------------- | ----------- |
| `cozo_query`             | Execute Datalog queries | No          |
| `cozo_list_relations`    | List relations          | No          |
| `cozo_describe_relation` | Get schema              | No          |
| `cozo_create_relation`   | Create relation         | No          |
| `cozo_put`               | Insert/update data      | No          |
| `cozo_remove`            | Delete rows             | ⚠️ **Yes**  |
| `cozo_drop_relation`     | Drop relation           | ⚠️ **Yes**  |

## Usage Example

```javascript
// 1. Create relation
cozo_create_relation({
  relation_name: "users",
  schema: "{id: Int => name: String}",
});

// 2. Insert data
cozo_put({
  relation_name: "users",
  data: [
    [1, "Alice"],
    [2, "Bob"],
  ],
});

// 3. Query
cozo_query({ query: "?[id, name] := *users[id, name]" });
```

> [!WARNING]
> **HTTP mode exposes the database without authentication.** Use `stdio` for production. See [SECURITY.md](SECURITY.md) for details.

## Development

```bash
npm run dev                                             # Watch mode
npm run test:once                                       # Run tests
npx @modelcontextprotocol/inspector node dist/index.js  # MCP Inspector
```

## License

MIT
