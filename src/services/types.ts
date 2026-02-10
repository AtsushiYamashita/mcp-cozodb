/**
 * CozoDB type definitions and error classes.
 *
 * Single source of truth for all CozoDB data shapes
 * used across services, tools, and tests.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CozoClientConfig {
  engine: "mem" | "sqlite" | "rocksdb";
  path?: string;
}

// ---------------------------------------------------------------------------
// Query results
// ---------------------------------------------------------------------------

export interface QueryResult {
  headers: string[];
  rows: unknown[][];
  ok: boolean;
}

// ---------------------------------------------------------------------------
// Schema metadata
// ---------------------------------------------------------------------------

export interface RelationInfo {
  name: string;
  arity: number;
  access_level: string;
}

/** Mirrors the 5-column output of CozoDB's `::columns` command. */
export interface ColumnInfo {
  name: string;
  is_key: boolean;
  index: number;
  type: string;
  has_default: boolean;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Typed error for CozoDB operations, carrying a machine-readable code. */
export class CozoError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "CozoError";
    this.code = code;
  }
}
