/**
 * Test Helpers for MCP CozoDB Server
 */

import { CozoDb } from 'cozo-node';
import { createCozoClient } from '../services/cozo-client.js';

/**
 * Create a fresh in-memory CozoDB instance for testing
 */
export function createTestDb(): CozoDb {
  return createCozoClient({ engine: 'mem' });
}

/**
 * Clean up all relations in a database
 */
export async function cleanupDb(db: CozoDb): Promise<void> {
  const relations = await db.run('::relations');
  for (const row of relations.rows) {
    const relationName = String(row[0]);
    // Skip system relations
    if (!relationName.startsWith('_')) {
      await db.run(`::remove ${relationName}`);
    }
  }
}

/**
 * Verify byte-level equality for character encoding tests
 */
export function verifyByteLevelEquality(original: string, retrieved: string): {
  equal: boolean;
  originalLength: number;
  retrievedLength: number;
  originalBytes: number;
  retrievedBytes: number;
} {
  const originalBuffer = Buffer.from(original, 'utf8');
  const retrievedBuffer = Buffer.from(retrieved, 'utf8');

  return {
    equal: original === retrieved && originalBuffer.equals(retrievedBuffer),
    originalLength: original.length,
    retrievedLength: retrieved.length,
    originalBytes: originalBuffer.length,
    retrievedBytes: retrievedBuffer.length
  };
}

/**
 * Assert that a query result matches expected data
 */
export function assertQueryResult(
  result: { headers: string[]; rows: unknown[][] },
  expectedRows: unknown[][]
): void {
  if (result.rows.length !== expectedRows.length) {
    throw new Error(
      `Row count mismatch: expected ${expectedRows.length}, got ${result.rows.length}`
    );
  }

  for (let i = 0; i < expectedRows.length; i++) {
    const expected = expectedRows[i];
    const actual = result.rows[i];

    if (actual.length !== expected.length) {
      throw new Error(
        `Row ${i} column count mismatch: expected ${expected.length}, got ${actual.length}`
      );
    }

    for (let j = 0; j < expected.length; j++) {
      if (actual[j] !== expected[j]) {
        throw new Error(
          `Row ${i}, column ${j} mismatch: expected ${JSON.stringify(expected[j])}, got ${JSON.stringify(actual[j])}`
        );
      }
    }
  }
}
