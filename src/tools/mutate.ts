/**
 * Mutation Tools Implementation
 * - cozo_create_relation
 * - cozo_put
 * - cozo_remove
 * - cozo_drop_relation
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CozoDb } from "cozo-node";
import {
  CreateRelationInputSchema,
  PutDataInputSchema,
  RemoveDataInputSchema,
  DropRelationInputSchema,
  type CreateRelationInput,
  type PutDataInput,
  type RemoveDataInput,
  type DropRelationInput
} from "../schemas/input.js";
import {
  createRelation,
  putData,
  removeData,
  dropRelation
} from "../services/cozo-client.js";

export function registerMutationTools(server: McpServer, db: CozoDb): void {
  // Create relation
  server.registerTool(
    "cozo_create_relation",
    {
      title: "Create CozoDB Relation",
      description: `Create a new relation (table) in CozoDB.

Args:
  - relation_name (string): Name for the new relation
  - schema (string): Schema definition in CozoDB format

Schema Format:
  {key_col1: Type, key_col2: Type => value_col1: Type, value_col2: Type}
  
  - Columns before '=>' are keys (required, unique together)
  - Columns after '=>' are values (optional, can be updated)
  - Types: Int, Float, String, Bool, Bytes, Uuid, Validity, List, Json

Examples:
  - Simple: schema="{id: Int => name: String, age: Int}"
  - Compound key: schema="{user_id: Int, item_id: Int => quantity: Int}"
  - Graph edge: schema="{from: Int, to: Int => weight: Float}"

Returns: Success message or error`,
      inputSchema: CreateRelationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    async (params: CreateRelationInput) => {
      try {
        await createRelation(db, params.relation_name, params.schema);
        return {
          content: [{
            type: "text",
            text: `✓ Relation '${params.relation_name}' created successfully.`
          }],
          structuredContent: { success: true, relation: params.relation_name }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error creating relation: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Put (insert/update) data
  server.registerTool(
    "cozo_put",
    {
      title: "Put Data into CozoDB",
      description: `Insert or update rows in a CozoDB relation.

If a row with the same key exists, it will be updated. Otherwise, a new row is inserted.

Args:
  - relation_name (string): Target relation name
  - data (array): Array of rows, each row is an array of values

Examples:
  - Single row: data=[[1, "Alice", 30]]
  - Multiple rows: data=[[1, "Alice", 30], [2, "Bob", 25]]

The order of values must match the relation's column order (keys first, then values).
Use cozo_describe_relation to check the column order.

Returns: Number of rows affected`,
      inputSchema: PutDataInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: PutDataInput) => {
      try {
        const count = await putData(db, params.relation_name, params.data);
        return {
          content: [{
            type: "text",
            text: `✓ ${count} row(s) inserted/updated in '${params.relation_name}'.`
          }],
          structuredContent: { success: true, rows_affected: count }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error inserting data: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Remove data
  server.registerTool(
    "cozo_remove",
    {
      title: "Remove Data from CozoDB",
      description: `Delete rows from a CozoDB relation by key.

⚠️ DESTRUCTIVE: This permanently removes data.

Args:
  - relation_name (string): Target relation name
  - keys (array): Array of key tuples to delete

Examples:
  - Single key: keys=[[1]]
  - Multiple keys: keys=[[1], [2], [3]]
  - Compound key: keys=[[1, 100], [1, 101]]

Only provide the key columns, not the value columns.
Use cozo_describe_relation to check which columns are keys.

Returns: Number of rows removed`,
      inputSchema: RemoveDataInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: RemoveDataInput) => {
      try {
        const count = await removeData(db, params.relation_name, params.keys);
        return {
          content: [{
            type: "text",
            text: `✓ ${count} row(s) removed from '${params.relation_name}'.`
          }],
          structuredContent: { success: true, rows_removed: count }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error removing data: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );

  // Drop relation
  server.registerTool(
    "cozo_drop_relation",
    {
      title: "Drop CozoDB Relation",
      description: `Delete an entire relation (table) and all its data.

⚠️ DESTRUCTIVE: This permanently deletes the relation and ALL its data.
This action cannot be undone.

Args:
  - relation_name (string): Name of the relation to drop
  - confirm (boolean): Must be true to confirm deletion

Returns: Success message or error`,
      inputSchema: DropRelationInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (params: DropRelationInput) => {
      try {
        await dropRelation(db, params.relation_name);
        return {
          content: [{
            type: "text",
            text: `✓ Relation '${params.relation_name}' dropped successfully.`
          }],
          structuredContent: { success: true, dropped: params.relation_name }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error dropping relation: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );
}
