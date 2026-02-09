/**
 * Zod Input Schemas for MCP Tools
 */

import { z } from "zod";

// ====================
// Query Tool
// ====================

export const QueryInputSchema = z.object({
  query: z.string()
    .min(1, "Query cannot be empty")
    .max(10000, "Query too long (max 10000 chars)")
    .describe("Datalog query to execute"),
  params: z.record(z.unknown())
    .optional()
    .default({})
    .describe("Query parameters as key-value pairs"),
  response_format: z.enum(["json", "markdown"])
    .optional()
    .default("json")
    .describe("Output format: 'json' for structured data, 'markdown' for human-readable")
}).strict();

export type QueryInput = z.infer<typeof QueryInputSchema>;

// ====================
// Schema Tools
// ====================

export const ListRelationsInputSchema = z.object({
  response_format: z.enum(["json", "markdown"])
    .optional()
    .default("json")
    .describe("Output format")
}).strict();

export type ListRelationsInput = z.infer<typeof ListRelationsInputSchema>;

export const DescribeRelationInputSchema = z.object({
  relation_name: z.string()
    .min(1, "Relation name required")
    .max(100, "Relation name too long")
    .describe("Name of the relation to describe"),
  response_format: z.enum(["json", "markdown"])
    .optional()
    .default("json")
    .describe("Output format")
}).strict();

export type DescribeRelationInput = z.infer<typeof DescribeRelationInputSchema>;

// ====================
// Mutation Tools
// ====================

export const CreateRelationInputSchema = z.object({
  relation_name: z.string()
    .min(1, "Relation name required")
    .max(100, "Relation name too long")
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Invalid relation name format")
    .describe("Name for the new relation"),
  schema: z.string()
    .min(1, "Schema required")
    .describe("Schema definition, e.g., '{id: Int, name: String => score: Float}'")
}).strict();

export type CreateRelationInput = z.infer<typeof CreateRelationInputSchema>;

export const PutDataInputSchema = z.object({
  relation_name: z.string()
    .min(1, "Relation name required")
    .describe("Target relation name"),
  data: z.array(z.array(z.unknown()))
    .min(1, "Data array cannot be empty")
    .max(1000, "Too many rows (max 1000)")
    .describe("Array of rows to insert/update, e.g., [[1, 'Alice'], [2, 'Bob']]")
}).strict();

export type PutDataInput = z.infer<typeof PutDataInputSchema>;

export const RemoveDataInputSchema = z.object({
  relation_name: z.string()
    .min(1, "Relation name required")
    .describe("Target relation name"),
  keys: z.array(z.array(z.unknown()))
    .min(1, "Keys array cannot be empty")
    .max(1000, "Too many keys (max 1000)")
    .describe("Array of key tuples to remove, e.g., [[1], [2]]")
}).strict();

export type RemoveDataInput = z.infer<typeof RemoveDataInputSchema>;

export const DropRelationInputSchema = z.object({
  relation_name: z.string()
    .min(1, "Relation name required")
    .describe("Name of the relation to drop"),
  confirm: z.literal(true)
    .describe("Must be true to confirm destructive operation")
}).strict();

export type DropRelationInput = z.infer<typeof DropRelationInputSchema>;
