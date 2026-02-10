/**
 * Reproduce exact conditions of failing tests
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { createTestDb, cleanupDb } from './helpers.js';
import { createRelation, putData, executeQuery, describeRelation } from '../services/cozo-client.js';
import { JAPANESE_DATA } from './fixtures.js';
import { writeFileSync } from 'fs';

describe('Reproduce Failures', () => {
  const db = createTestDb();

  beforeEach(async () => {
    await cleanupDb(db);
  });

  test('reproduce: parameterized query', async () => {
    await createRelation(db, 'users', '{id: Int => name: String, age: Int}');
    await putData(db, 'users', [
      [1, 'Alice', 30],
      [2, 'Bob', 25],
      [3, 'Charlie', 35]
    ]);

    // Verify data is there
    const allResult = await executeQuery(db, '?[id, name] := *users[id, name, _]');
    
    // Try the parameterized query
    const paramResult = await executeQuery(
      db,
      '?[name] := *users[id, name, _], id == $target_id',
      { target_id: 2 }
    );
    
    writeFileSync('d:/project/mcp-cozodb/tmp/debug-reproduce.json', JSON.stringify({
      allRows: allResult.rows,
      paramRows: paramResult.rows,
      paramHeaders: paramResult.headers
    }, null, 2));
    
    expect(paramResult.rows).toHaveLength(1);
  });

  test('reproduce: katakana round-trip', async () => {
    await createRelation(db, 'japanese', '{id: Int => text: String, type: String}');
    
    // Verify the schema
    const schema = await describeRelation(db, 'japanese');
    
    // Insert JAPANESE_DATA[1] = [2, 'カタカナ', 'Katakana']
    await putData(db, 'japanese', [JAPANESE_DATA[1]]);
    
    // Query back
    const allResult = await executeQuery(db, '?[id, text, type] := *japanese[id, text, type]');
    const specificResult = await executeQuery(db, '?[text] := *japanese[2, text, _]');
    
    writeFileSync('d:/project/mcp-cozodb/tmp/debug-katakana.json', JSON.stringify({
      fixtureData: JAPANESE_DATA[1],
      schema: schema,
      allRows: allResult.rows,
      specificRows: specificResult.rows
    }, null, 2));
    
    expect(specificResult.rows).toHaveLength(1);
  });
});
