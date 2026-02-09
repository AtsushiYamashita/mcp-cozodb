/**
 * HTTP Transport Setup
 * Provides SSE/HTTP endpoint for PWA/browser MCP clients
 */

import express, { Express, Request, Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface HttpTransportConfig {
  port: number;
  corsOrigin: string;
}

/**
 * Start HTTP server with MCP endpoint
 */
export async function startHttpTransport(
  server: McpServer,
  config: HttpTransportConfig
): Promise<Express> {
  const app = express();

  // CORS configuration
  app.use(cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    credentials: true
  }));

  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", transport: "http" });
  });

  // MCP endpoint using StreamableHTTPServerTransport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  // Handle MCP requests
  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // SSE endpoint for server-initiated messages
  app.get("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP SSE error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE endpoint for session cleanup
  app.delete("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP cleanup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Connect MCP server to transport
  await server.connect(transport);

  // Start HTTP server
  return new Promise((resolve) => {
    app.listen(config.port, () => {
      console.error(`MCP HTTP server listening on http://localhost:${config.port}`);
      console.error(`  MCP endpoint: http://localhost:${config.port}/mcp`);
      console.error(`  Health check: http://localhost:${config.port}/health`);
      resolve(app);
    });
  });
}
