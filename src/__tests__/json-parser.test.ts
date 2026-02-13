/**
 * Tests for JSON/JSONC/JSONL parser utility
 */

import { describe, test, expect } from "vitest";
import {
  parseJsonc,
  parseJsonl,
  parseFlexibleJson,
  detectJsonFormat,
} from "../utils/json-parser.js";

// ---------------------------------------------------------------------------
// JSONC
// ---------------------------------------------------------------------------

describe("parseJsonc", () => {
  test("parses standard JSON (no comments)", () => {
    expect(parseJsonc('{"a": 1}')).toEqual({ a: 1 });
  });

  test("strips line comments", () => {
    const input = `{
      // This is a comment
      "name": "Alice"
    }`;
    expect(parseJsonc(input)).toEqual({ name: "Alice" });
  });

  test("strips block comments", () => {
    const input = `{
      /* block
         comment */
      "value": 42
    }`;
    expect(parseJsonc(input)).toEqual({ value: 42 });
  });

  test("preserves // inside string literals", () => {
    const input = '{"url": "https://example.com"}';
    expect(parseJsonc(input)).toEqual({ url: "https://example.com" });
  });

  test("preserves /* inside string literals", () => {
    const input = '{"pattern": "/* not a comment */"}';
    expect(parseJsonc(input)).toEqual({ pattern: "/* not a comment */" });
  });

  test("handles escaped quotes in strings", () => {
    const input = '{"text": "say \\"hello\\""}';
    expect(parseJsonc(input)).toEqual({ text: 'say "hello"' });
  });

  test("handles trailing comma style (via comment after last value)", () => {
    const input = `{
      "a": 1, // first
      "b": 2  // second
    }`;
    expect(parseJsonc(input)).toEqual({ a: 1, b: 2 });
  });

  test("handles complex nested JSONC", () => {
    const input = `{
      // Database config
      "engine": "sqlite",
      /* Storage path
         for persistent data */
      "path": "./data.db",
      "options": {
        // Enable WAL mode
        "wal": true
      }
    }`;
    const result = parseJsonc(input) as Record<string, unknown>;
    expect(result.engine).toBe("sqlite");
    expect(result.path).toBe("./data.db");
    expect((result.options as Record<string, unknown>).wal).toBe(true);
  });

  test("handles empty input after stripping comments", () => {
    expect(() => parseJsonc("// just a comment")).toThrow(SyntaxError);
  });
});

// ---------------------------------------------------------------------------
// JSONL
// ---------------------------------------------------------------------------

describe("parseJsonl", () => {
  test("parses single line", () => {
    expect(parseJsonl('{"id": 1}')).toEqual([{ id: 1 }]);
  });

  test("parses multiple lines", () => {
    const input = `{"id": 1, "name": "Alice"}
{"id": 2, "name": "Bob"}
{"id": 3, "name": "Charlie"}`;
    expect(parseJsonl(input)).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ]);
  });

  test("skips empty lines", () => {
    const input = `{"a": 1}

{"b": 2}

`;
    expect(parseJsonl(input)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("handles array values per line", () => {
    const input = `[1, "Alice", 30]
[2, "Bob", 25]`;
    expect(parseJsonl(input)).toEqual([
      [1, "Alice", 30],
      [2, "Bob", 25],
    ]);
  });

  test("handles scalar values per line", () => {
    const input = `42
"hello"
true
null`;
    expect(parseJsonl(input)).toEqual([42, "hello", true, null]);
  });

  test("reports line number on error", () => {
    const input = `{"valid": true}
{invalid json}`;
    expect(() => parseJsonl(input)).toThrow(/line 2/);
  });

  test("handles Japanese text", () => {
    const input = `{"name": "田中太郎"}
{"name": "山田花子"}`;
    expect(parseJsonl(input)).toEqual([
      { name: "田中太郎" },
      { name: "山田花子" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

describe("detectJsonFormat", () => {
  test("detects standard JSON (object)", () => {
    expect(detectJsonFormat('{"a": 1}')).toBe("json");
  });

  test("detects standard JSON (array)", () => {
    expect(detectJsonFormat("[[1,2],[3,4]]")).toBe("json");
  });

  test("detects JSONC (line comment at top)", () => {
    expect(detectJsonFormat('// comment\n{"a": 1}')).toBe("jsonc");
  });

  test("detects JSONC (block comment at top)", () => {
    expect(detectJsonFormat('/* comment */\n{"a": 1}')).toBe("jsonc");
  });

  test("detects JSONC (inline comment)", () => {
    expect(detectJsonFormat('{\n  "a": 1 // comment\n}')).toBe("jsonc");
  });

  test("detects JSONL (multiple JSON objects)", () => {
    expect(detectJsonFormat('{"a":1}\n{"b":2}')).toBe("jsonl");
  });

  test("detects JSONL (multiple arrays)", () => {
    expect(detectJsonFormat("[1,2]\n[3,4]")).toBe("jsonl");
  });

  test("does not mistake multi-line JSON for JSONL", () => {
    // Multi-line JSON object — first line '{' isn't valid standalone JSON
    expect(detectJsonFormat('{\n  "a": 1\n}')).toBe("json");
  });

  test("does not mistake URL in string for JSONC", () => {
    expect(detectJsonFormat('{"url": "https://x.com"}')).toBe("json");
  });
});

// ---------------------------------------------------------------------------
// Flexible parser (auto-detect)
// ---------------------------------------------------------------------------

describe("parseFlexibleJson", () => {
  test("auto-parses standard JSON", () => {
    expect(parseFlexibleJson('{"x": 1}')).toEqual({ x: 1 });
  });

  test("auto-parses JSONC", () => {
    expect(parseFlexibleJson('// config\n{"x": 1}')).toEqual({ x: 1 });
  });

  test("auto-parses JSONL", () => {
    expect(parseFlexibleJson('{"a":1}\n{"b":2}')).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
  });

  test("round-trips CozoDB row data (JSONL arrays)", () => {
    const input = `[1, "Alice", 30]
[2, "Bob", 25]
[3, "Charlie", 35]`;
    const result = parseFlexibleJson(input) as unknown[][];
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual([1, "Alice", 30]);
    expect(result[2]).toEqual([3, "Charlie", 35]);
  });
});
