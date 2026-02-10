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
  is_key: boolean;
  index: number;
  type: string;
  has_default: boolean;
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
  // ::columns returns: [column, is_key, index, type, has_default]
  const result = await db.run(`::columns ${relationName}`);
  return result.rows.map((row: unknown[]) => ({
    name: String(row[0]),
    is_key: Boolean(row[1]),
    index: Number(row[2]),
    type: String(row[3]),
    has_default: Boolean(row[4])
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
 * Build CozoDB relation spec clause from schema.
 * Returns column bindings and the { key => value } clause.
 */
async function buildRelationSpec(
  db: CozoDb,
  relationName: string
): Promise<{ allBindings: string; keyBindings: string; clause: string }> {
  const schema = await describeRelation(db, relationName);
  const keys = schema.filter(c => c.is_key).map(c => c.name);
  const values = schema.filter(c => !c.is_key).map(c => c.name);
  const allBindings = [...keys, ...values].join(", ");
  const keyBindings = keys.join(", ");
  const clause = values.length === 0
    ? `{ ${keyBindings} }`
    : `{ ${keyBindings} => ${values.join(", ")} }`;
  return { allBindings, keyBindings, clause };
}

/**
 * Insert or update data using parameterized query.
 * Uses $data parameter to avoid string escaping issues.
 */
export async function putData(
  db: CozoDb,
  relationName: string,
  data: unknown[][]
): Promise<number> {
  if (data.length === 0) {
    return 0;
  }

  const spec = await buildRelationSpec(db, relationName);
  await db.run(
    `?[${spec.allBindings}] <- $data :put ${relationName} ${spec.clause}`,
    { data }
  );
  return data.length;
}

/**
 * Remove data from a relation using parameterized query.
 * Uses $keys parameter to avoid string escaping issues.
 */
export async function removeData(
  db: CozoDb,
  relationName: string,
  keys: unknown[][]
): Promise<number> {
  if (keys.length === 0) {
    return 0;
  }

  const spec = await buildRelationSpec(db, relationName);
  await db.run(
    `?[${spec.keyBindings}] <- $keys :rm ${relationName} { ${spec.keyBindings} }`,
    { keys }
  );
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
