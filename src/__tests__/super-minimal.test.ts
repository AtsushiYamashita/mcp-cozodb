/**
 * Even simpler test - one assertion at a time
 */

import { describe, test, expect } from 'vitest';
import { CozoDb } from 'cozo-node';

describe('Super Minimal - Step by Step', () => {
  test('ONLY create and put', async () => {
    const db = new CozoDb();
    
    console.log('\n=== Step 1: Create relation ===');
    const createResult = await db.run(':create test {id: Int => name: String}');
    console.log('Create OK:', createResult.ok);
    
    console.log('\n=== Step 2: Build :put query ===');
    const query = '?[id, name] <- [[1, "Alice"]] :put test {id => name}';
    console.log('Query:', query);
    
    console.log('\n=== Step 3: Execute :put ===');
    try {
      const putResult = await db.run(query);
      console.log('Put OK:', putResult.ok);
      console.log('Put result:', JSON.stringify(putResult, null, 2));
      
      console.log('\n=== Step 4: Verify data ===');
      const queryResult = await db.run('?[id, name] := *test[id, name]');
      console.log('Query result:', JSON.stringify(queryResult, null, 2));
      
      expect(queryResult.rows).toHaveLength(1);
      expect(queryResult.rows[0]).toEqual([1, 'Alice']);
    } catch (error: any) {
      console.error('\n!!! ERROR !!!');
      console.error('Message:', error.message);
      console.error('Full error:', JSON.stringify(error, null, 2));
      throw error;
    }
  });
});
