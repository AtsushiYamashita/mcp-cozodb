/**
 * Query Tool Implementation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CozoDb } from "cozo-node";
import { QueryInputSchema, type QueryInput } from "../schemas/input.js";
import { executeQuery, CozoError } from "../services/cozo-client.js";

export function registerQueryTool(server: McpServer, db: CozoDb): void {
  server.registerTool(
    "cozo_query",
    {
      title: "Execute CozoDB Query",
      description: `Execute a Datalog query on CozoDB.

This tool runs Datalog queries and returns results. CozoDB uses Datalog syntax, NOT SQL.

Args:
  - query (string): Datalog query to execute
  - params (object): Optional query parameters
  - response_format ('json' | 'markdown'): Output format (default: 'json')

Query Syntax Examples:
  - Inline data: ?[x, y] <- [[1, 'hello'], [2, 'world']]
  - From relation: ?[name, age] := users[id, name, age], age > 18
  - With params: ?[name] := users[$id, name, _]

Returns:
  JSON format: { headers: string[], rows: any[][], count: number }
  Markdown format: Table with headers and rows

Examples:
  - "List all users": query="?[id, name] := users[id, name, _]"
  - "Find by ID": query="?[name] := users[$id, name, _]", params={id: 1}

Error Handling:
  - Syntax errors return detailed parsing error messages
  - Relation not found returns suggestion to use cozo_list_relations`,
      inputSchema: QueryInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: QueryInput) => {
      try {
        const result = await executeQuery(db, params.query, params.params);
        
        const output = {
          headers: result.headers,
          rows: result.rows,
          count: result.rows.length
        };

        let textContent: string;
        if (params.response_format === "markdown") {
          const lines: string[] = [];
          lines.push(`| ${result.headers.join(" | ")} |`);
          lines.push(`| ${result.headers.map(() => "---").join(" | ")} |`);
          for (const row of result.rows) {
            lines.push(`| ${row.map(v => String(v)).join(" | ")} |`);
          }
          lines.push("");
          lines.push(`*${result.rows.length} rows returned*`);
          textContent = lines.join("\n");
        } else {
          textContent = JSON.stringify(output, null, 2);
        }

        return {
          content: [{ type: "text", text: textContent }],
          structuredContent: output
        };
      } catch (error) {
        const message = error instanceof CozoError
          ? `Query Error (${error.code}): ${error.message}`
          : `Error: ${error instanceof Error ? error.message : String(error)}`;
        
        return {
          content: [{ type: "text", text: message }]
        };
      }
    }
  );
}
