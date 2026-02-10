/**
 * HTTP Transport for MCP CozoDB Server
 *
 * Provides a StreamableHTTP endpoint for browser-based and PWA MCP clients.
 *
 * ## Endpoints
 *
 * | Method | Path      | Purpose                                |
 * | ------ | --------- | -------------------------------------- |
 * | POST   | `/mcp`    | MCP JSON-RPC request                   |
 * | GET    | `/mcp`    | SSE stream for server-initiated events |
 * | DELETE | `/mcp`    | Session cleanup                        |
 * | GET    | `/health` | Liveness probe (returns `{ status }`)  |
 *
 * ## Security Model
 *
 * **This transport has NO authentication.**
 * It relies on network-level controls:
 *
 * - CORS origin restriction (default: `localhost`)
 * - In-memory rate limiter per client IP
 * - Request body size limit
 * - Error message sanitization (no internal details leaked)
 *
 * For production, prefer `stdio` transport or add a reverse proxy
 * with authentication in front of this server.
 *
 * @see SECURITY.md for threat model and recommendations
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface HttpTransportConfig {
  /** TCP port to listen on */
  port: number;
  /** CORS allowed origins — comma-separated list, or `*` for any */
  corsOrigin: string;
  /** Rate limit sliding window in milliseconds (default: 60 000) */
  rateLimitWindowMs?: number;
  /** Maximum requests per window per IP (default: 100) */
  rateLimitMax?: number;
  /** Maximum JSON body size, Express notation (default: `"1mb"`) */
  maxRequestSize?: string;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

/**
 * Simple in-memory per-IP rate limiter.
 *
 * Uses a sliding window: each IP gets `max` requests within `windowMs`.
 * The window resets once `windowMs` has elapsed since the first request.
 *
 * Limitations:
 * - Not shared across processes (single-instance only)
 * - No automatic cleanup of stale entries (acceptable for dev/small-scale)
 * - Trusts `req.ip` / `req.socket.remoteAddress` (can be spoofed without proxy)
 */
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
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }

    record.count++;
    next();
  };
}

// ---------------------------------------------------------------------------
// Error sanitization
// ---------------------------------------------------------------------------

/**
 * Strip internal details from error messages before sending to clients.
 *
 * - CozoDB-internal errors → generic "Database query error"
 * - Other errors → first 200 characters only
 * - Unknown types → "Internal server error"
 */
function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("COZO")) {
      return "Database query error";
    }
    return error.message.slice(0, 200);
  }
  return "Internal server error";
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

/**
 * Start an HTTP server exposing the MCP protocol over StreamableHTTP.
 *
 * The returned `Express` instance is already listening. Use the
 * `/health` endpoint for readiness checks.
 *
 * @param server - Initialized McpServer with tools already registered
 * @param config - Network and security configuration
 * @returns The running Express application
 */
export async function startHttpTransport(
  server: McpServer,
  config: HttpTransportConfig,
): Promise<Express> {
  const app = express();

  const windowMs = config.rateLimitWindowMs ?? 60_000;
  const maxRequests = config.rateLimitMax ?? 100;
  const maxSize = config.maxRequestSize ?? "1mb";

  // --- Middleware ---
  app.use(createRateLimiter(windowMs, maxRequests));

  app.use(
    cors({
      origin:
        config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
      credentials: true,
    }),
  );

  app.use(express.json({ limit: maxSize }));

  // --- Health check ---
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", transport: "http" });
  });

  // --- MCP transport ---
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request error:", error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.get("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP SSE error:", error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP cleanup error:", error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // --- Global error handler ---
  app.use(
    (err: Error, _req: Request, res: Response, _next: NextFunction) => {
      console.error("Unhandled error:", err);
      res.status(500).json({ error: "Internal server error" });
    },
  );

  // --- Connect and start ---
  await server.connect(transport);

  const corsMode =
    config.corsOrigin === "*" ? "⚠ OPEN (any origin)" : config.corsOrigin;

  return new Promise((resolve) => {
    app.listen(config.port, () => {
      console.error(
        [
          `MCP HTTP server listening on http://localhost:${config.port}`,
          `  MCP endpoint: POST/GET/DELETE /mcp`,
          `  Health check: GET /health`,
          `  CORS origins: ${corsMode}`,
          `  Rate limit:   ${maxRequests} req / ${windowMs / 1000}s per IP`,
          `  Body limit:   ${maxSize}`,
          `  Auth:         NONE — see SECURITY.md`,
        ].join("\n"),
      );
      resolve(app);
    });
  });
}
