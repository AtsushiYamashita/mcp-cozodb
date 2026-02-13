#!/usr/bin/env node
/**
 * MCP CozoDB Server
 *
 * Model Context Protocol server for CozoDB - a Datalog database with graph query capabilities.
 * This server provides tools for AI agents to interact with CozoDB.
 *
 * Transports:
 * - stdio (default): For Claude Desktop, Gemini CLI
 * - http: For PWA/browser clients via SSE
 *
 * Related Skill: skills-cozodb-connector (for Datalog syntax and patterns)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createCozoClient, closeCozoClient } from "./services/cozo-client.js";
import { registerQueryTool } from "./tools/query.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerMutationTools } from "./tools/mutate.js";
import { startHttpTransport } from "./transports/http.js";

// Configuration from environment
const DB_ENGINE_RAW = process.env.COZO_ENGINE || "mem";
const DB_PATH = process.env.COZO_PATH || "./cozo.db";
const TRANSPORT = process.env.MCP_TRANSPORT || "stdio";
const HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || "3100", 10);
const CORS_ORIGIN = process.env.MCP_CORS_ORIGIN || "localhost";

// Validate configuration
const VALID_ENGINES = ["mem", "sqlite", "rocksdb"] as const;
if (!VALID_ENGINES.includes(DB_ENGINE_RAW as any)) {
  console.error(
    `Invalid COZO_ENGINE: "${DB_ENGINE_RAW}". Must be one of: ${VALID_ENGINES.join(", ")}`,
  );
  process.exit(1);
}
const DB_ENGINE = DB_ENGINE_RAW as "mem" | "sqlite" | "rocksdb";

if (isNaN(HTTP_PORT) || HTTP_PORT < 1 || HTTP_PORT > 65535) {
  console.error(
    `Invalid MCP_HTTP_PORT: "${process.env.MCP_HTTP_PORT}". Must be a number between 1 and 65535.`,
  );
  process.exit(1);
}

// Create MCP server
const server = new McpServer({
  name: "mcp-cozodb",
  version: "1.0.0"
});

// Initialize CozoDB
const db = createCozoClient({
  engine: DB_ENGINE,
  path: DB_PATH
});

// Register all tools
registerQueryTool(server, db);
registerSchemaTools(server, db);
registerMutationTools(server, db);

// Graceful shutdown handler
let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.error(`\n${signal} received, shutting down gracefully...`);
  try {
    await closeCozoClient(db);
    console.error("CozoDB connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Main entry point
async function main(): Promise<void> {
  console.error(`MCP CozoDB Server starting...`);
  console.error(`  Engine: ${DB_ENGINE}`);
  if (DB_ENGINE !== "mem") {
    console.error(`  Path: ${DB_PATH}`);
  }
  console.error(`  Transport: ${TRANSPORT}`);

  if (TRANSPORT === "http") {
    // HTTP/SSE transport for PWA/browser clients
    await startHttpTransport(server, {
      port: HTTP_PORT,
      corsOrigin: CORS_ORIGIN
    });
  } else {
    // stdio transport for Claude Desktop / Gemini CLI
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP CozoDB Server running via stdio");
  }
}

// Run server
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
