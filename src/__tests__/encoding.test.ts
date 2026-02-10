/**
 * Character Encoding Tests - CRITICAL
 * 
 * Tests UTF-8 multibyte character handling across the entire stack:
 * - Node.js → CozoDB FFI boundary
 * - JSON serialization/deserialization
 * - Database storage and retrieval
 * 
 * Focus on:
 * - ASCII (1-byte)
 * - Japanese (3-byte UTF-8)
 * - Emoji (4-byte UTF-8)
 * - Mixed multibyte characters
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { createTestDb, cleanupDb, verifyByteLevelEquality } from './helpers.js';
import {
  ASCII_DATA,
  JAPANESE_DATA,
  EMOJI_DATA,
  MIXED_MULTIBYTE_DATA,
  SPECIAL_CHARS_DATA,
  EDGE_CASE_DATA
} from './fixtures.js';
import {
  createRelation,
  putData,
  executeQuery
} from '../services/cozo-client.js';

describe('Character Encoding - UTF-8 Multibyte Support', () => {
  const db = createTestDb();

  beforeEach(async () => {
    await cleanupDb(db);
  });

  describe('ASCII Characters (1-byte UTF-8)', () => {
    test('round-trip ASCII text', async () => {
      await createRelation(db, 'test', '{id: Int => name: String, age: Int}');
      await putData(db, 'test', ASCII_DATA);

      const result = await executeQuery(db, '?[id, name, age] := *test[id, name, age]');

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0]).toEqual([1, 'Alice', 30]);
      expect(result.rows[1]).toEqual([2, 'Bob Smith', 25]);
    });
  });

  describe('Japanese Characters (3-byte UTF-8)', () => {
    test('hiragana round-trip', async () => {
      await createRelation(db, 'japanese', '{id: Int => text: String, type: String}');
      await putData(db, 'japanese', [JAPANESE_DATA[0]]);

      const result = await executeQuery(db, '?[id, text] := *japanese[id, text, _]');
      const retrieved = String(result.rows[0][1]);

      const verification = verifyByteLevelEquality('こんにちは', retrieved);
      expect(verification.equal).toBe(true);
      expect(verification.originalLength).toBe(5); // 5 characters
      expect(verification.originalBytes).toBe(15); // 15 bytes (5 * 3)
    });

    test('katakana round-trip', async () => {
      await createRelation(db, 'japanese', '{id: Int => text: String, type: String}');
      await putData(db, 'japanese', [JAPANESE_DATA[1]]);

      const result = await executeQuery(db, '?[text] := *japanese[2, text, _]');
      expect(result.rows[0][0]).toBe('カタカナ');
    });

    test('kanji + kana mixed', async () => {
      await createRelation(db, 'japanese', '{id: Int => text: String, type: String}');
      await putData(db, 'japanese', [JAPANESE_DATA[2]]);

      const result = await executeQuery(db, '?[text] := *japanese[3, text, _]');
      const retrieved = String(result.rows[0][0]);

      expect(retrieved).toBe('日本語テスト');
      expect(Buffer.from(retrieved).length).toBeGreaterThan(retrieved.length);
    });

    test('Japanese name (common use case)', async () => {
      await createRelation(db, 'users', '{id: Int => name: String}');
      await putData(db, 'users', [[1, '山田太郎']]);

      const result = await executeQuery(db, '?[name] := *users[1, name]');
      expect(result.rows[0][0]).toBe('山田太郎');
    });

    test('all Japanese test data', async () => {
      await createRelation(db, 'japanese', '{id: Int => text: String, type: String}');
      await putData(db, 'japanese', JAPANESE_DATA);

      const result = await executeQuery(db, '?[id, text] := *japanese[id, text, _]');
      expect(result.rows).toHaveLength(5);

      // Verify each entry
      JAPANESE_DATA.forEach((expected, i) => {
        expect(result.rows[i][1]).toBe(expected[1]);
      });
    });
  });

  describe('Emoji (4-byte UTF-8)', () => {
    test('basic emoji round-trip', async () => {
      await createRelation(db, 'emoji', '{id: Int => emoji: String, desc: String}');
      await putData(db, 'emoji', [EMOJI_DATA[0]]);

      const result = await executeQuery(db, '?[emoji] := *emoji[1, emoji, _]');
      const retrieved = String(result.rows[0][0]);

      const verification = verifyByteLevelEquality('🚀', retrieved);
      expect(verification.equal).toBe(true);
      expect(verification.originalBytes).toBe(4); // 4 bytes for emoji
    });

    test('ZWJ sequence (zero-width joiner)', async () => {
      await createRelation(db, 'emoji', '{id: Int => emoji: String, desc: String}');
      const zwjEmoji = '👨\u200d💻'; // Developer emoji
      await putData(db, 'emoji', [[2, zwjEmoji, 'Developer']]);

      const result = await executeQuery(db, '?[emoji] := *emoji[2, emoji, _]');
      expect(result.rows[0][0]).toBe(zwjEmoji);
    });

    test('regional indicator (flag)', async () => {
      await createRelation(db, 'emoji', '{id: Int => emoji: String, desc: String}');
      await putData(db, 'emoji', [[3, '🇯🇵', 'Japan']]);

      const result = await executeQuery(db, '?[emoji] := *emoji[3, emoji, _]');
      expect(result.rows[0][0]).toBe('🇯🇵');
    });

    test('emoji with skin tone modifier', async () => {
      await createRelation(db, 'emoji', '{id: Int => emoji: String, desc: String}');
      await putData(db, 'emoji', [[4, '👍🏻', 'Thumbs up light']]);

      const result = await executeQuery(db, '?[emoji] := *emoji[4, emoji, _]');
      expect(result.rows[0][0]).toBe('👍🏻');
    });

    test('multiple emoji in sequence', async () => {
      await createRelation(db, 'emoji', '{id: Int => emoji: String, desc: String}');
      await putData(db, 'emoji', [[5, '😀😃😄', 'Happy faces']]);

      const result = await executeQuery(db, '?[emoji] := *emoji[5, emoji, _]');
      expect(result.rows[0][0]).toBe('😀😃😄');
    });
  });

  describe('Mixed Multibyte Characters', () => {
    test('English + Japanese + Emoji', async () => {
      await createRelation(db, 'mixed', '{id: Int => text: String}');
      await putData(db, 'mixed', MIXED_MULTIBYTE_DATA);

      const result = await executeQuery(db, '?[text] := *mixed[1, text]');
      expect(result.rows[0][0]).toBe('Hello 世界 🌏');
    });

    test('café with accents + emoji', async () => {
      await createRelation(db, 'mixed', '{id: Int => text: String}');
      await putData(db, 'mixed', [[2, 'café ☕ コーヒー']]);

      const result = await executeQuery(db, '?[text] := *mixed[2, text]');
      const retrieved = String(result.rows[0][0]);

      expect(retrieved).toBe('café ☕ コーヒー');
      const verification = verifyByteLevelEquality('café ☕ コーヒー', retrieved);
      expect(verification.equal).toBe(true);
    });

    test('multilingual text', async () => {
      await createRelation(db, 'mixed', '{id: Int => text: String}');
      const multilingual = 'Test テスト 🧪 Тест'; // English, Japanese, Emoji, Cyrillic
      await putData(db, 'mixed', [[3, multilingual]]);

      const result = await executeQuery(db, '?[text] := *mixed[3, text]');
      expect(result.rows[0][0]).toBe(multilingual);
    });
  });

  describe('Special Characters', () => {
    test('single quote in data', async () => {
      await createRelation(db, 'special', '{id: Int => text: String, desc: String}');
      await putData(db, 'special', [SPECIAL_CHARS_DATA[0]]);

      const result = await executeQuery(db, '?[text] := *special[1, text, _]');
      expect(result.rows[0][0]).toBe("O'Brien");
    });

    test('double quotes in data', async () => {
      await createRelation(db, 'special', '{id: Int => text: String, desc: String}');
      await putData(db, 'special', [SPECIAL_CHARS_DATA[1]]);

      const result = await executeQuery(db, '?[text] := *special[2, text, _]');
      expect(result.rows[0][0]).toBe('Bob "Bobby" Smith');
    });

    test('backslash in data', async () => {
      await createRelation(db, 'special', '{id: Int => text: String, desc: String}');
      await putData(db, 'special', [SPECIAL_CHARS_DATA[2]]);

      const result = await executeQuery(db, '?[text] := *special[3, text, _]');
      expect(result.rows[0][0]).toBe('C:\\Users\\test');
    });

    test('HTML/XSS attempt', async () => {
      await createRelation(db, 'special', '{id: Int => text: String, desc: String}');
      await putData(db, 'special', [SPECIAL_CHARS_DATA[5]]);

      const result = await executeQuery(db, '?[text] := *special[6, text, _]');
      expect(result.rows[0][0]).toBe('<script>alert(1)</script>');
    });
  });

  describe('Edge Cases', () => {
    test('empty string', async () => {
      await createRelation(db, 'edge', '{id: Int => text: String, desc: String}');
      await putData(db, 'edge', [EDGE_CASE_DATA.empty_string]);

      const result = await executeQuery(db, '?[text] := *edge[1, text, _]');
      expect(result.rows[0][0]).toBe('');
    });

    test('very long string (10,000 chars)', async () => {
      await createRelation(db, 'edge', '{id: Int => text: String, desc: String}');
      await putData(db, 'edge', [EDGE_CASE_DATA.very_long_string]);

      const result = await executeQuery(db, '?[text] := *edge[2, text, _]');
      expect(String(result.rows[0][0]).length).toBe(10000);
    });

    test('RTL text (Arabic)', async () => {
      await createRelation(db, 'edge', '{id: Int => text: String, desc: String}');
      await putData(db, 'edge', [EDGE_CASE_DATA.rtl_text]);

      const result = await executeQuery(db, '?[text] := *edge[5, text, _]');
      expect(result.rows[0][0]).toBe('مرحبا');
    });
  });

  describe('Parameterized Queries with Multibyte Characters', () => {
    test('Japanese text in query params', async () => {
      await createRelation(db, 'users', '{id: Int => name: String}');
      await putData(db, 'users', [[1, '山田太郎'], [2, '鈴木花子']]);

      const result = await executeQuery(
        db,
        '?[id, name] := *users[id, name], name == $target_name',
        { target_name: '山田太郎' }
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0][1]).toBe('山田太郎');
    });

    test('emoji in query params', async () => {
      await createRelation(db, 'messages', '{id: Int => text: String}');
      await putData(db, 'messages', [[1, 'Hello 🌏'], [2, 'Goodbye 👋']]);

      const result = await executeQuery(
        db,
        '?[text] := *messages[_, text], text == $msg',
        { msg: 'Hello 🌏' }
      );

      expect(result.rows[0][0]).toBe('Hello 🌏');
    });
  });
});
