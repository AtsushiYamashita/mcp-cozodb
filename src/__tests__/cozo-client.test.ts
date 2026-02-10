/**
 * CozoDB Client Service Tests
 * Standard happy path and edge case testing
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { createTestDb, cleanupDb } from './helpers.js';
import {
  createRelation,
  putData,
  removeData,
  dropRelation,
  executeQuery,
  listRelations,
  describeRelation,
  CozoError
} from '../services/cozo-client.js';
import {
  LARGE_DATASET,
  SCHEMA_EXAMPLES
} from './fixtures.js';

describe('CozoDB Client Service', () => {
  const db = createTestDb();

  beforeEach(async () => {
    await cleanupDb(db);
  });

  describe('Database Creation', () => {
    test('creates in-memory database', () => {
      expect(db).toBeDefined();
    });
  });

  describe('Relation Management', () => {
    test('creates simple relation', async () => {
      await createRelation(db, 'users', SCHEMA_EXAMPLES.simple);

      const relations = await listRelations(db);
      const userRelation = relations.find(r => r.name === 'users');

      expect(userRelation).toBeDefined();
      expect(userRelation?.name).toBe('users');
    });

    test('creates relation with compound key', async () => {
      await createRelation(db, 'user_items', SCHEMA_EXAMPLES.compound_key);

      const columns = await describeRelation(db, 'user_items');
      expect(columns).toHaveLength(3);

      const keys = columns.filter(c => c.is_key);
      expect(keys).toHaveLength(2);
    });

    test('lists all relations', async () => {
      await createRelation(db, 'users', SCHEMA_EXAMPLES.simple);
      await createRelation(db, 'items', SCHEMA_EXAMPLES.simple);

      const relations = await listRelations(db);
      const names = relations.map(r => r.name);

      expect(names).toContain('users');
      expect(names).toContain('items');
    });

    test('describes relation schema', async () => {
      await createRelation(db, 'users', '{id: Int => name: String, age: Int}');

      const columns = await describeRelation(db, 'users');

      expect(columns).toHaveLength(3);
      // Verify key column
      const idCol = columns.find(c => c.name === 'id');
      expect(idCol).toBeDefined();
      expect(idCol!.is_key).toBe(true);
      // Verify value columns
      const nameCol = columns.find(c => c.name === 'name');
      expect(nameCol).toBeDefined();
      expect(nameCol!.is_key).toBe(false);
    });

    test('drops relation', async () => {
      await createRelation(db, 'temp', SCHEMA_EXAMPLES.simple);
      await dropRelation(db, 'temp');

      const relations = await listRelations(db);
      const tempRelation = relations.find(r => r.name === 'temp');

      expect(tempRelation).toBeUndefined();
    });
  });

  describe('Data Operations', () => {
    beforeEach(async () => {
      await createRelation(db, 'users', '{id: Int => name: String, age: Int}');
    });

    test('inserts single row', async () => {
      const count = await putData(db, 'users', [[1, 'Alice', 30]]);

      expect(count).toBe(1);

      const result = await executeQuery(db, '?[id, name, age] := *users[id, name, age]');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual([1, 'Alice', 30]);
    });

    test('inserts multiple rows', async () => {
      const data = [
        [1, 'Alice', 30],
        [2, 'Bob', 25],
        [3, 'Charlie', 35]
      ];

      const count = await putData(db, 'users', data);
      expect(count).toBe(3);

      const result = await executeQuery(db, '?[id, name] := *users[id, name, _]');
      expect(result.rows).toHaveLength(3);
    });

    test('updates existing row (upsert)', async () => {
      await putData(db, 'users', [[1, 'Alice', 30]]);
      await putData(db, 'users', [[1, 'Alice Updated', 31]]);

      const result = await executeQuery(db, '?[name, age] := *users[1, name, age]');
      expect(result.rows[0]).toEqual(['Alice Updated', 31]);
    });

    test('inserts large dataset (1000 rows)', async () => {
      const count = await putData(db, 'users', LARGE_DATASET);

      expect(count).toBe(1000);

      const result = await executeQuery(db, '?[id] := *users[id, _, _]');
      expect(result.rows).toHaveLength(1000);
    });

    test('removes single row', async () => {
      await putData(db, 'users', [[1, 'Alice', 30], [2, 'Bob', 25]]);

      const count = await removeData(db, 'users', [[1]]);
      expect(count).toBe(1);

      const result = await executeQuery(db, '?[id] := *users[id, _, _]');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0][0]).toBe(2);
    });

    test('removes multiple rows', async () => {
      await putData(db, 'users', [
        [1, 'Alice', 30],
        [2, 'Bob', 25],
        [3, 'Charlie', 35]
      ]);

      await removeData(db, 'users', [[1], [3]]);

      const result = await executeQuery(db, '?[id] := *users[id, _, _]');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0][0]).toBe(2);
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      await createRelation(db, 'users', '{id: Int => name: String, age: Int}');
      await putData(db, 'users', [
        [1, 'Alice', 30],
        [2, 'Bob', 25],
        [3, 'Charlie', 35]
      ]);
    });

    test('executes simple query', async () => {
      const result = await executeQuery(db, '?[id, name] := *users[id, name, _]');

      expect(result.ok).toBe(true);
      expect(result.headers).toEqual(['id', 'name']);
      expect(result.rows).toHaveLength(3);
    });

    test('executes query with filter', async () => {
      const result = await executeQuery(
        db,
        '?[name, age] := *users[_, name, age], age > 28'
      );

      expect(result.rows).toHaveLength(2);
    });

    test('executes parameterized query', async () => {
      const result = await executeQuery(
        db,
        '?[name] := *users[id, name, _], id == $target_id',
        { target_id: 2 }
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0][0]).toBe('Bob');
    });

    test('executes inline data query (no stored relation)', async () => {
      const result = await executeQuery(
        db,
        "?[x, y] <- [[1, 'hello'], [2, 'world']]"
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual([1, 'hello']);
    });
  });

  describe('Error Handling', () => {
    test('throws CozoError for malformed query', async () => {
      await expect(
        executeQuery(db, 'INVALID DATALOG SYNTAX')
      ).rejects.toThrow(CozoError);
    });

    test('throws error for non-existent relation', async () => {
      await expect(
        executeQuery(db, '?[x] := *nonexistent[x]')
      ).rejects.toThrow();
    });

    test('throws error for schema mismatch', async () => {
      await createRelation(db, 'users', '{id: Int => name: String}');

      // Try to insert wrong number of columns
      await expect(
        putData(db, 'users', [[1, 'Alice', 30]]) // 3 columns, but schema expects 2
      ).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('handles empty data array', async () => {
      await createRelation(db, 'users', SCHEMA_EXAMPLES.simple);

      const count = await putData(db, 'users', []);
      expect(count).toBe(0);
    });

    test('handles query returning no results', async () => {
      await createRelation(db, 'users', '{id: Int => name: String}');

      const result = await executeQuery(db, '?[id, name] := *users[id, name]');

      expect(result.ok).toBe(true);
      expect(result.rows).toHaveLength(0);
    });

    test('handles remove of non-existent key', async () => {
      await createRelation(db, 'users', '{id: Int => name: String}');
      await putData(db, 'users', [[1, 'Alice']]);

      // Removing non-existent key should not error
      const count = await removeData(db, 'users', [[999]]);
      expect(count).toBe(1); // CozoDB still reports row count

      const result = await executeQuery(db, '?[id] := *users[id, _]');
      expect(result.rows).toHaveLength(1); // Original data still there
    });
  });
});
