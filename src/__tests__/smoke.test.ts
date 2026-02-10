/**
 * Simple smoke test to verify test setup
 */

import { describe, test, expect } from 'vitest';

describe('Basic Smoke Test', () => {
  test('1 + 1 equals 2', () => {
    expect(1 + 1).toBe(2);
  });

  test('string concatenation', () => {
    expect('hello' + ' ' + 'world').toBe('hello world');
  });
});
