/**
 * Test Fixtures for MCP CozoDB Server
 * 
 * Character encoding test data with special focus on:
 * - ASCII (1-byte)
 * - Japanese (3-byte UTF-8)
 * - Emoji (4-byte UTF-8)
 * - Mixed multibyte
 */

export const ASCII_DATA = [
  [1, 'Alice', 30],
  [2, 'Bob Smith', 25],
  [3, 'Charlie-Jones', 35]
];

export const JAPANESE_DATA = [
  [1, 'こんにちは', 'Hiragana'],         // Hiragana
  [2, 'カタカナ', 'Katakana'],           // Katakana
  [3, '日本語テスト', 'Kanji+Kana'],     // Mixed
  [4, '山田太郎', 'Name'],               // Common name
  [5, '東京都渋谷区', 'Address']         // Address
];

export const EMOJI_DATA = [
  [1, '🚀', 'Rocket'],
  [2, '👨\u200d💻', 'Developer (ZWJ)'],   // Zero-width joiner
  [3, '🇯🇵', 'Japan Flag'],              // Regional indicator
  [4, '👍🏻', 'Thumbs up + skin tone'],   // Emoji modifier
  [5, '😀😃😄', 'Multiple emoji']
];

export const MIXED_MULTIBYTE_DATA = [
  [1, 'Hello 世界 🌏'],
  [2, 'café ☕ コーヒー'],
  [3, 'Test テスト 🧪 Тест'],
  [4, '日本🇯🇵Japan'],
  [5, 'Zürich 🇨🇭 チューリッヒ']
];

export const SPECIAL_CHARS_DATA = [
  [1, "O'Brien", 'Single quote'],
  [2, 'Bob "Bobby" Smith', 'Double quotes'],
  [3, 'C:\\Users\\test', 'Backslash'],
  [4, 'Line 1\nLine 2', 'Newline'],
  [5, 'Tab\there', 'Tab character'],
  [6, '<script>alert(1)</script>', 'HTML/XSS'],
  [7, '; DROP TABLE users--', 'SQL injection attempt'],
  [8, '../../etc/passwd', 'Path traversal']
];

export const EDGE_CASE_DATA = {
  empty_string: [1, '', 'Empty'],
  very_long_string: [2, 'a'.repeat(10000), 'Long'],
  unicode_zero: [3, '\u0000', 'Null char'],
  bom: [4, '\uFEFF', 'BOM'],
  rtl_text: [5, 'مرحبا', 'Arabic RTL'],
  emoji_variation: [6, '️✊🏿', 'Emoji variation selector']
};

export const LARGE_DATASET = Array.from({ length: 1000 }, (_, i) => [
  i,
  `User ${i}`,
  20 + (i % 50)
]);

export const OVER_LIMIT_DATASET = Array.from({ length: 1001 }, (_, i) => [
  i,
  `User ${i}`,
  20
]);

export const MALFORMED_DATA = {
  null_value: [[1, null, 'null']],
  undefined_value: [[2, undefined, 'undefined']],
  mixed_types: [[3, 123, true, null]],
  nested_array: [[4, [1, 2, 3], 'nested']],
  object: [[5, { name: 'test' }, 'object']]
};

export const DATALOG_INJECTION_QUERIES = [
  '?[x] := users[x, _, _]; ::remove users',
  '?[x] := users[x, _, _] ::relations',
  "?[x] := users[x, _, _]\\n::remove sensitive_data",
  '?[*] := users[*]; ?[*] := secrets[*]'
];

export const SCHEMA_EXAMPLES = {
  simple: '{id: Int => name: String}',
  compound_key: '{user_id: Int, item_id: Int => quantity: Int}',
  graph_edge: '{from: Int, to: Int => weight: Float}',
  complex: '{id: Int => name: String, age: Int, active: Bool, metadata: Json}'
};
