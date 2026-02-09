/**
 * CozoDB Client Service
 * Wraps cozo-node with error handling and type safety
 */

import { CozoDb } from "cozo-node";

export interface QueryResult {
  headers: string[];
  rows: unknown[][];
  ok: boolean;
}

export interface RelationInfo {
  name: string;
  arity: number;
  access_level: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  is_key: boolean;
}

export interface CozoClientConfig {
  engine: "mem" | "sqlite" | "rocksdb";
  path?: string;
}

/**
 * Creates a CozoDB client instance
 */
export function createCozoClient(config: CozoClientConfig = { engine: "mem" }): CozoDb {
  if (config.engine === "mem") {
    return new CozoDb();
  }
  return new CozoDb(config.engine, config.path ?? "./cozo.db");
}

/**
 * Execute a Datalog query
 */
export async function executeQuery(
  db: CozoDb,
  query: string,
  params: Record<string, unknown> = {}
): Promise<QueryResult> {
  try {
    const result = await db.run(query, params);
    return {
      headers: result.headers,
      rows: result.rows,
      ok: true
    };
  } catch (error) {
    throw new CozoError(
      error instanceof Error ? error.message : String(error),
      "QUERY_ERROR"
    );
  }
}

/**
 * List all relations in the database
 */
export async function listRelations(db: CozoDb): Promise<RelationInfo[]> {
  const result = await db.run("::relations");
  return result.rows.map((row: unknown[]) => ({
    name: String(row[0]),
    arity: Number(row[1]),
    access_level: String(row[2])
  }));
}

/**
 * Describe a relation's schema
 */
export async function describeRelation(
  db: CozoDb,
  relationName: string
): Promise<ColumnInfo[]> {
  const result = await db.run(`::columns ${relationName}`);
  return result.rows.map((row: unknown[]) => ({
    name: String(row[0]),
    type: String(row[1]),
    is_key: Boolean(row[2])
  }));
}

/**
 * Create a new relation
 */
export async function createRelation(
  db: CozoDb,
  relationName: string,
  schema: string
): Promise<void> {
  await db.run(`:create ${relationName} ${schema}`);
}

/**
 * Insert or update data
 */
export async function putData(
  db: CozoDb,
  relationName: string,
  data: unknown[][]
): Promise<number> {
  const placeholders = data.map((_, i) => 
    `row${i}` 
  );
  
  const params: Record<string, unknown> = {};
  data.forEach((row, i) => {
    params[`row${i}`] = row;
  });

  // Build the query dynamically
  const dataLiteral = data.map(row => 
    `[${row.map(v => JSON.stringify(v)).join(", ")}]`
  ).join(", ");
  
  await db.run(`?[..row] <- [${dataLiteral}] :put ${relationName} { ..row }`);
  return data.length;
}

/**
 * Remove data from a relation
 */
export async function removeData(
  db: CozoDb,
  relationName: string,
  keys: unknown[][]
): Promise<number> {
  const dataLiteral = keys.map(row => 
    `[${row.map(v => JSON.stringify(v)).join(", ")}]`
  ).join(", ");
  
  await db.run(`?[..key] <- [${dataLiteral}] :rm ${relationName} { ..key }`);
  return keys.length;
}

/**
 * Drop a relation
 */
export async function dropRelation(
  db: CozoDb,
  relationName: string
): Promise<void> {
  await db.run(`::remove ${relationName}`);
}

/**
 * Custom error class for CozoDB operations
 */
export class CozoError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CozoError";
    this.code = code;
  }
}
