/**
 * CozoDB Client Service
 *
 * Wraps cozo-node with error handling, type safety,
 * and parameterized query generation.
 */

import { CozoDb } from "cozo-node";
import {
  CozoClientConfig,
  CozoError,
  ColumnInfo,
  QueryResult,
  RelationInfo,
} from "./types.js";

// Re-export types so existing consumers don't break
export {
  CozoClientConfig,
  CozoError,
  ColumnInfo,
  QueryResult,
  RelationInfo,
} from "./types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Query timeout in milliseconds (0 = no timeout) */
export const QUERY_TIMEOUT_MS = parseInt(
  process.env.COZO_QUERY_TIMEOUT || "30000",
  10,
);

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/** Creates a CozoDB client instance. */
export function createCozoClient(
  config: CozoClientConfig = { engine: "mem" },
): CozoDb {
  if (config.engine === "mem") {
    return new CozoDb();
  }
  return new CozoDb(config.engine, config.path ?? "./cozo.db");
}

// ---------------------------------------------------------------------------
// Query execution
// ---------------------------------------------------------------------------

/**
 * Execute a Datalog query with optional parameters.
 *
 * Automatically applies timeout based on COZO_QUERY_TIMEOUT env var.
 * Set to 0 to disable timeout.
 */
export async function executeQuery(
  db: CozoDb,
  query: string,
  params: Record<string, unknown> = {},
): Promise<QueryResult> {
  try {
    let result;

    if (QUERY_TIMEOUT_MS > 0) {
      // Race between query execution and timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Query timeout (${QUERY_TIMEOUT_MS}ms)`)),
          QUERY_TIMEOUT_MS,
        );
      });

      result = await Promise.race([db.run(query, params), timeoutPromise]);
    } else {
      // No timeout
      result = await db.run(query, params);
    }

    return {
      headers: result.headers,
      rows: result.rows,
      ok: true,
    };
  } catch (error) {
    throw new CozoError(
      error instanceof Error ? error.message : String(error),
      "QUERY_ERROR",
    );
  }
}

/**
 * Close the CozoDB client connection gracefully.
 *
 * Should be called during application shutdown to ensure
 * all pending operations complete and resources are released.
 */
export async function closeCozoClient(db: CozoDb): Promise<void> {
  try {
    await db.close();
  } catch (error) {
    // Ignore close errors (already closed, etc.)
    console.error("Error closing CozoDB:", error);
  }
}

// ---------------------------------------------------------------------------
// Schema operations
// ---------------------------------------------------------------------------

/** List all stored relations in the database. */
export async function listRelations(db: CozoDb): Promise<RelationInfo[]> {
  const result = await db.run("::relations");
  return result.rows.map((row: unknown[]) => ({
    name: String(row[0]),
    arity: Number(row[1]),
    access_level: String(row[2]),
  }));
}

/**
 * Describe a relation's schema.
 *
 * Maps the 5-column output of `::columns <relation>`:
 * `[column, is_key, index, type, has_default]`
 */
export async function describeRelation(
  db: CozoDb,
  relationName: string,
): Promise<ColumnInfo[]> {
  const result = await db.run(`::columns ${relationName}`);
  return result.rows.map((row: unknown[]) => ({
    name: String(row[0]),
    is_key: Boolean(row[1]),
    index: Number(row[2]),
    type: String(row[3]),
    has_default: Boolean(row[4]),
  }));
}

/** Create a new stored relation. */
export async function createRelation(
  db: CozoDb,
  relationName: string,
  schema: string,
): Promise<void> {
  await db.run(`:create ${relationName} ${schema}`);
}

/** Drop (permanently delete) a stored relation. */
export async function dropRelation(
  db: CozoDb,
  relationName: string,
): Promise<void> {
  await db.run(`::remove ${relationName}`);
}

// ---------------------------------------------------------------------------
// Data mutation (parameterized queries)
// ---------------------------------------------------------------------------

/** Internal helper: column bindings and `{ key => value }` clause. */
interface RelationSpec {
  allBindings: string;
  keyBindings: string;
  clause: string;
}

const COLUMN_SEPARATOR = ", ";
const KEY_VALUE_SEPARATOR = " => ";

async function buildRelationSpec(
  db: CozoDb,
  relationName: string,
): Promise<RelationSpec> {
  const schema = await describeRelation(db, relationName);
  const keys = schema.filter((c) => c.is_key).map((c) => c.name);
  const values = schema.filter((c) => !c.is_key).map((c) => c.name);

  const allBindings = [...keys, ...values].join(COLUMN_SEPARATOR);
  const keyBindings = keys.join(COLUMN_SEPARATOR);
  const clause =
    values.length === 0
      ? `{ ${keyBindings} }`
      : `{ ${keyBindings}${KEY_VALUE_SEPARATOR}${values.join(COLUMN_SEPARATOR)} }`;

  return { allBindings, keyBindings, clause };
}

/**
 * Insert or update rows (upsert).
 *
 * Uses `$data` parameterized binding to avoid string-escaping issues.
 */
export async function putData(
  db: CozoDb,
  relationName: string,
  data: unknown[][],
): Promise<number> {
  if (data.length === 0) {
    return 0;
  }

  const spec = await buildRelationSpec(db, relationName);
  await db.run(
    `?[${spec.allBindings}] <- $data :put ${relationName} ${spec.clause}`,
    { data },
  );
  return data.length;
}

/**
 * Remove rows by key.
 *
 * Uses `$keys` parameterized binding to avoid string-escaping issues.
 */
export async function removeData(
  db: CozoDb,
  relationName: string,
  keys: unknown[][],
): Promise<number> {
  if (keys.length === 0) {
    return 0;
  }

  const spec = await buildRelationSpec(db, relationName);
  await db.run(
    `?[${spec.keyBindings}] <- $keys :rm ${relationName} { ${spec.keyBindings} }`,
    { keys },
  );
  return keys.length;
}
