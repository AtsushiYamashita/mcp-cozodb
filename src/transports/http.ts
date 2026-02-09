/**
 * HTTP Transport Setup
 * Provides SSE/HTTP endpoint for PWA/browser MCP clients
 * 
 * Security features:
 * - Rate limiting (configurable)
 * - Request size limits
 * - CORS configuration
 * - Error sanitization
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface HttpTransportConfig {
  port: number;
  corsOrigin: string;
  rateLimitWindowMs?: number;  // Rate limit window in ms (default: 60000)
  rateLimitMax?: number;       // Max requests per window (default: 100)
  maxRequestSize?: string;     // Max request body size (default: "1mb")
}

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = rateLimitStore.get(ip);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
      return;
    }

    record.count++;
    next();
  };
}

// Error sanitization - don't leak internal details
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Only return safe error messages
    if (error.message.includes("COZO")) {
      return "Database query error";
    }
    return error.message.slice(0, 200); // Limit length
  }
  return "Internal server error";
}

/**
 * Start HTTP server with MCP endpoint
 */
export async function startHttpTransport(
  server: McpServer,
  config: HttpTransportConfig
): Promise<Express> {
  const app = express();

  const windowMs = config.rateLimitWindowMs ?? 60000;
  const maxRequests = config.rateLimitMax ?? 100;
  const maxSize = config.maxRequestSize ?? "1mb";

  // Rate limiting
  app.use(createRateLimiter(windowMs, maxRequests));

  // CORS configuration
  app.use(cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept"],
    credentials: true
  }));

  // Request size limit
  app.use(express.json({ limit: maxSize }));

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
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // SSE endpoint for server-initiated messages
  app.get("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP SSE error:", error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // DELETE endpoint for session cleanup
  app.delete("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP cleanup error:", error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  // Connect MCP server to transport
  await server.connect(transport);

  // Start HTTP server
  return new Promise((resolve) => {
    app.listen(config.port, () => {
      console.error(`MCP HTTP server listening on http://localhost:${config.port}`);
      console.error(`  MCP endpoint: http://localhost:${config.port}/mcp`);
      console.error(`  Health check: http://localhost:${config.port}/health`);
      console.error(`  Rate limit: ${maxRequests} requests per ${windowMs / 1000}s`);
      resolve(app);
    });
  });
}
