/**
 * Flexible JSON parser supporting JSON, JSONC, and JSONL formats.
 *
 * - **JSON**  : Standard JSON.parse
 * - **JSONC** : JSON with line and block comments stripped before parsing
 * - **JSONL** : One JSON value per line, parsed into an array
 *
 * @module
 */

// ---------------------------------------------------------------------------
// JSONC (JSON with Comments)
// ---------------------------------------------------------------------------

// Strip line comments (//) and block comments from a JSON string,
// preserving content inside string literals.
function stripJsonComments(input: string): string {
  let result = "";
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // --- JSON string literal: copy verbatim until closing quote ---
    if (ch === '"') {
      result += '"';
      i++;
      while (i < len) {
        const sc = input[i];
        result += sc;
        if (sc === "\\") {
          // Escaped character — copy next char too
          i++;
          if (i < len) {
            result += input[i];
          }
        } else if (sc === '"') {
          break;
        }
        i++;
      }
      i++;
      continue;
    }

    // --- Line comment: // ---
    if (ch === "/" && i + 1 < len && input[i + 1] === "/") {
      // Skip until end of line
      i += 2;
      while (i < len && input[i] !== "\n") {
        i++;
      }
      continue;
    }

    // --- Block comment: /* */ ---
    if (ch === "/" && i + 1 < len && input[i + 1] === "*") {
      i += 2;
      while (i + 1 < len && !(input[i] === "*" && input[i + 1] === "/")) {
        i++;
      }
      i += 2; // skip */
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/** Parse a JSONC string (JSON with line and block comments). */
export function parseJsonc(input: string): unknown {
  return JSON.parse(stripJsonComments(input));
}

// ---------------------------------------------------------------------------
// JSONL (JSON Lines)
// ---------------------------------------------------------------------------

/**
 * Parse a JSONL string (one JSON value per line).
 * Empty lines are skipped. Each non-empty line is parsed independently.
 */
export function parseJsonl(input: string): unknown[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new SyntaxError(
          `JSONL parse error on line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
}

// ---------------------------------------------------------------------------
// Auto-detect
// ---------------------------------------------------------------------------

/** Supported input format identifiers. */
export type JsonFormat = "json" | "jsonc" | "jsonl";

/** Detect the format of a JSON-like string via heuristics. */
export function detectJsonFormat(input: string): JsonFormat {
  const trimmed = input.trimStart();

  // Obvious comment at the top → JSONC
  if (trimmed.startsWith("//") || trimmed.startsWith("/*")) {
    return "jsonc";
  }

  // Check for inline comments (// or /* outside strings)
  if (hasComments(trimmed)) {
    return "jsonc";
  }

  // Multiple non-empty lines where first line parses independently → JSONL
  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length > 1) {
    try {
      JSON.parse(lines[0]);
      // First line is valid JSON on its own — likely JSONL
      return "jsonl";
    } catch {
      // First line isn't standalone JSON — standard multi-line JSON
    }
  }

  return "json";
}

// Quick check for comment markers outside of JSON string literals.
function hasComments(input: string): boolean {
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (ch === "\\") {
        i++; // skip escaped char
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === "/" && i + 1 < input.length) {
        if (input[i + 1] === "/" || input[i + 1] === "*") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Parse a string as JSON, JSONC, or JSONL (auto-detected).
 *
 * @returns Parsed value (array for JSONL, any type for JSON/JSONC)
 * @throws {SyntaxError} on parse failure
 */
export function parseFlexibleJson(input: string): unknown {
  const format = detectJsonFormat(input);
  switch (format) {
    case "jsonc":
      return parseJsonc(input);
    case "jsonl":
      return parseJsonl(input);
    case "json":
      return JSON.parse(input);
  }
}
