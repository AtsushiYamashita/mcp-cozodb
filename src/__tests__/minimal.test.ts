/**
 * Minimal progression test - VERIFIED syntax
 */

import { describe, test, expect } from 'vitest';
import { CozoDb } from 'cozo-node';

describe('Minimal CozoDB Test - Verified', () => {
  test('Step 1: Create + inline query (no stored relation)', async () => {
    const db = new CozoDb();
    const result = await db.run("?[x, y] <- [[1, 'hello'], [2, 'world']]");
    expect(result.rows).toHaveLength(2);
  });

  test('Step 2: Create relation + :put + query', async () => {
    const db = new CozoDb();
    await db.run(':create test {id: Int => name: String}');
    await db.run('?[id, name] <- [[1, "Alice"]] :put test {id => name}');
    
    // IMPORTANT: *test (with asterisk) for stored relations
    const result = await db.run('?[id, name] := *test[id, name]');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual([1, 'Alice']);
  });

  test('Step 3: Multi-row :put', async () => {
    const db = new CozoDb();
    await db.run(':create test {id: Int => name: String, age: Int}');
    await db.run('?[id, name, age] <- [[1, "Alice", 30], [2, "Bob", 25]] :put test {id => name, age}');
    
    const result = await db.run('?[id, name, age] := *test[id, name, age]');
    expect(result.rows).toHaveLength(2);
  });

  test('Step 4: :rm removes data', async () => {
    const db = new CozoDb();
    await db.run(':create test {id: Int => name: String}');
    await db.run('?[id, name] <- [[1, "Alice"], [2, "Bob"]] :put test {id => name}');
    await db.run('?[id] <- [[1]] :rm test {id}');
    
    const result = await db.run('?[id, name] := *test[id, name]');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe(2);
  });

  test('Step 5: Japanese text round-trip', async () => {
    const db = new CozoDb();
    await db.run(':create test {id: Int => name: String}');
    await db.run('?[id, name] <- [[1, "山田太郎"]] :put test {id => name}');
    
    const result = await db.run('?[name] := *test[1, name]');
    expect(result.rows[0][0]).toBe('山田太郎');
  });

  test('Step 6: Emoji round-trip', async () => {
    const db = new CozoDb();
    await db.run(':create test {id: Int => text: String}');
    await db.run('?[id, text] <- [[1, "🚀🇯🇵"]] :put test {id => text}');
    
    const result = await db.run('?[text] := *test[1, text]');
    expect(result.rows[0][0]).toBe('🚀🇯🇵');
  });
});
