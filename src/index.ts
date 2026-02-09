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

import { createCozoClient } from "./services/cozo-client.js";
import { registerQueryTool } from "./tools/query.js";
import { registerSchemaTools } from "./tools/schema.js";
import { registerMutationTools } from "./tools/mutate.js";
import { startHttpTransport } from "./transports/http.js";

// Configuration from environment
const DB_ENGINE = (process.env.COZO_ENGINE || "mem") as "mem" | "sqlite" | "rocksdb";
const DB_PATH = process.env.COZO_PATH || "./cozo.db";
const TRANSPORT = process.env.MCP_TRANSPORT || "stdio";
const HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || "3100", 10);
const CORS_ORIGIN = process.env.MCP_CORS_ORIGIN || "*";

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
