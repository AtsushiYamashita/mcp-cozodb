/**
 * Schema Tools Implementation
 * - cozo_list_relations
 * - cozo_describe_relation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CozoDb } from "cozo-node";
import {
  ListRelationsInputSchema,
  DescribeRelationInputSchema,
  type ListRelationsInput,
  type DescribeRelationInput
} from "../schemas/input.js";
import { listRelations, describeRelation, CozoError } from "../services/cozo-client.js";

export function registerSchemaTools(server: McpServer, db: CozoDb): void {
  // List all relations
  server.registerTool(
    "cozo_list_relations",
    {
      title: "List CozoDB Relations",
      description: `List all relations (tables) in the CozoDB database.

Returns a list of relation names with their arity (column count) and access level.

Args:
  - response_format ('json' | 'markdown'): Output format (default: 'json')

Returns:
  JSON: [{ name: string, arity: number, access_level: string }, ...]
  Markdown: Table listing all relations

Use this tool first to discover what data is available before querying.`,
      inputSchema: ListRelationsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: ListRelationsInput) => {
      try {
        const relations = await listRelations(db);

        if (relations.length === 0) {
          return {
            content: [{ type: "text", text: "No relations found. Use cozo_create_relation to create one." }]
          };
        }

        let textContent: string;
        if (params.response_format === "markdown") {
          const lines = [
            "# Relations",
            "",
            "| Name | Arity | Access |",
            "| --- | --- | --- |"
          ];
          for (const rel of relations) {
            lines.push(`| ${rel.name} | ${rel.arity} | ${rel.access_level} |`);
          }
          textContent = lines.join("\n");
        } else {
          textContent = JSON.stringify(relations, null, 2);
        }

        return {
          content: [{ type: "text", text: textContent }],
          structuredContent: { relations }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Describe a relation
  server.registerTool(
    "cozo_describe_relation",
    {
      title: "Describe CozoDB Relation",
      description: `Get the schema (columns) of a specific relation.

Returns column names, types, and whether each column is part of the key.

Args:
  - relation_name (string): Name of the relation to describe
  - response_format ('json' | 'markdown'): Output format (default: 'json')

Returns:
  JSON: [{ name: string, type: string, is_key: boolean }, ...]
  Markdown: Table showing column definitions

Use after cozo_list_relations to understand a specific table's structure.`,
      inputSchema: DescribeRelationInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: DescribeRelationInput) => {
      try {
        const columns = await describeRelation(db, params.relation_name);

        if (columns.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Relation '${params.relation_name}' not found. Use cozo_list_relations to see available relations.`
            }]
          };
        }

        let textContent: string;
        if (params.response_format === "markdown") {
          const lines = [
            `# Relation: ${params.relation_name}`,
            "",
            "| Column | Type | Key |",
            "| --- | --- | --- |"
          ];
          for (const col of columns) {
            lines.push(`| ${col.name} | ${col.type} | ${col.is_key ? "✓" : ""} |`);
          }
          textContent = lines.join("\n");
        } else {
          textContent = JSON.stringify({ relation: params.relation_name, columns }, null, 2);
        }

        return {
          content: [{ type: "text", text: textContent }],
          structuredContent: { relation: params.relation_name, columns }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );
}
