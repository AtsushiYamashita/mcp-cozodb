# Deployment Guide

This document provides comprehensive deployment guidance for production environments.

## Pre-Deployment Checklist

### Security

- [ ] Review [SECURITY.md](SECURITY.md) threat scenarios
- [ ] Set `COZO_ENGINE` to `sqlite` or `rocksdb` (not `mem`)
- [ ] Set restrictive file permissions on `COZO_PATH`
- [ ] For HTTP mode: Use reverse proxy with authentication (see below)
- [ ] For HTTP mode: Set explicit `MCP_CORS_ORIGIN` (never `*`)
- [ ] Verify no hardcoded secrets in environment variables

### Reliability

- [ ] Test graceful shutdown: `Ctrl+C` → verify "CozoDB connection closed"
- [ ] Configure query timeout: `COZO_QUERY_TIMEOUT=30000` (30s default)
- [ ] Verify rate limiting is enabled (`http.ts` default: 100 req/60s)
- [ ] Establish backup schedule (see Backup & Recovery section)

### Resource Limits

- [ ] Memory: Allocate ≥200MB for SQLite, ≥500MB for RocksDB
- [ ] Disk: Allocate 2-10× expected database size for RocksDB
- [ ] File descriptors: Set `ulimit -n 4096` or higher

---

## Deployment Modes

### stdio Mode (Recommended)

**Use for**: Claude Desktop, Gemini CLI, personal workflows

**Advantages**:

- No network exposure
- Authentication handled by AI client
- Auto-managed lifecycle

**Configuration**:

```json
{
  "mcpServers": {
    "cozodb": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-cozodb/dist/index.js"],
      "env": {
        "COZO_ENGINE": "sqlite",
        "COZO_PATH": "/secure/path/database.db",
        "COZO_QUERY_TIMEOUT": "30000"
      }
    }
  }
}
```

**Deployment Steps**:

1. Build: `npm run build`
2. Add to AI client config
3. Restart AI client
4. Test with: `cozo_list_relations`

---

### HTTP Mode (Advanced)

**Use for**: Internal tools, browser-based UIs, team access

> [!CAUTION]
> **HTTP mode has NO built-in authentication.** You MUST add a reverse proxy layer.

#### Option 1: Nginx Reverse Proxy (Recommended)

```nginx
# /etc/nginx/sites-available/mcp-cozodb
server {
    listen 443 ssl http2;
    server_name mcp.example.com;

    ssl_certificate /etc/letsencrypt/live/mcp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.example.com/privkey.pem;

    # Basic Auth
    auth_basic "MCP Server";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location /mcp {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;

        # SSE support
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
        proxy_buffering off;
        proxy_cache off;
    }

    location /health {
        proxy_pass http://127.0.0.1:3100;
        auth_basic off;  # Allow unauthenticated health checks
    }
}
```

**Setup**:

```bash
# Create password file
sudo htpasswd -c /etc/nginx/.htpasswd mcp-user

# Test configuration
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

#### Option 2: Caddy Reverse Proxy (Simpler)

```
mcp.example.com {
    basicauth {
        mcp-user $2a$14$... # Generated with: caddy hash-password
    }

    reverse_proxy localhost:3100
}
```

**Configuration**:

```bash
MCP_TRANSPORT=http
MCP_HTTP_PORT=3100
MCP_CORS_ORIGIN=https://mcp.example.com
COZO_ENGINE=sqlite
COZO_PATH=/var/lib/mcp-cozodb/cozo.db
```

---

## Backup & Recovery

### SQLite

**Manual Backup**:

```bash
# Stop server first (graceful shutdown)
cp /path/to/cozo.db /backups/cozo-$(date +%Y%m%d-%H%M%S).db
```

**Automated Backup** (cron):

```bash
# /etc/cron.daily/mcp-cozodb-backup
#!/bin/bash
BACKUP_DIR="/var/backups/mcp-cozodb"
DB_PATH="/var/lib/mcp-cozodb/cozo.db"

mkdir -p "$BACKUP_DIR"
cp "$DB_PATH" "$BACKUP_DIR/cozo-$(date +%Y%m%d).db"

# Keep only last 7 days
find "$BACKUP_DIR" -name "cozo-*.db" -mtime +7 -delete
```

**Restore**:

```bash
# Stop server
pkill -SIGTERM -f mcp-cozodb

# Restore
cp /backups/cozo-20260211.db /var/lib/mcp-cozodb/cozo.db

# Start server
npm start
```

### RocksDB

**Export to JSON**:

```bash
# Via MCP tool
cozo_query({
  query: "::export /backups/export-$(date +%Y%m%d).json"
})
```

**Import from JSON**:

```bash
cozo_query({
  query: "::import /backups/export-20260211.json"
})
```

---

## Monitoring & Observability

### Health Checks

**HTTP Mode**:

```bash
curl http://localhost:3100/health
# Expected: {"status":"ok","transport":"http"}
```

**stdio Mode**:

```bash
# Check if process is running
pgrep -f "mcp-cozodb"
```

### Logging

**Default**: All logs go to `stderr`

**Capture logs**:

```bash
# Redirect to file
node dist/index.js 2>&1 | tee -a /var/log/mcp-cozodb.log

# Or use systemd journal (if running as service)
journalctl -u mcp-cozodb -f
```

**Important Log Messages**:

- `MCP CozoDB Server starting...` → Server started
- `SIGTERM received, shutting down gracefully...` → Shutdown initiated
- `CozoDB connection closed` → Shutdown complete
- `Query timeout` → Query exceeded `COZO_QUERY_TIMEOUT`
- `Too many requests` → Rate limit triggered

---

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` (Ctrl+C) gracefully:

1. **Signal received** → Log message
2. **Close CozoDB connection** → Flush pending writes
3. **Exit cleanly** → Code 0

**Test**:

```bash
# Start server
npm start

# In another terminal
pkill -SIGTERM -f mcp-cozodb

# Verify logs show:
# "SIGTERM received, shutting down gracefully..."
# "CozoDB connection closed"
```

**Timeout**: If shutdown hangs, force kill after 30s:

```bash
timeout 30 pkill -SIGTERM -f mcp-cozodb || pkill -SIGKILL -f mcp-cozodb
```

---

## Environment Variables Reference

| Variable             | Default     | Description                                    |
| -------------------- | ----------- | ---------------------------------------------- |
| `COZO_ENGINE`        | `mem`       | Storage engine: `mem`, `sqlite`, `rocksdb`     |
| `COZO_PATH`          | `./cozo.db` | Database file path (ignored for `mem`)         |
| `COZO_QUERY_TIMEOUT` | `30000`     | Query timeout in milliseconds (0 = no timeout) |
| `MCP_TRANSPORT`      | `stdio`     | Transport mode: `stdio` or `http`              |
| `MCP_HTTP_PORT`      | `3100`      | HTTP server port (1-65535)                     |
| `MCP_CORS_ORIGIN`    | `localhost` | CORS allowed origins (comma-separated)         |

**Validation**: Invalid values cause immediate exit with error message.

---

## Troubleshooting

### "Invalid COZO_ENGINE" on startup

**Symptom**:

```
Invalid COZO_ENGINE: "sqlite3". Must be one of: mem, sqlite, rocksdb
```

**Solution**: Use exact names: `mem`, `sqlite`, or `rocksdb`

---

### "Query timeout (30000ms)"

**Symptom**: Long-running queries fail

**Solution**:

```bash
# Option 1: Increase timeout
export COZO_QUERY_TIMEOUT=60000  # 60 seconds

# Option 2: Disable timeout
export COZO_QUERY_TIMEOUT=0
```

---

### "Too many requests" (HTTP 429)

**Symptom**: Clients receive rate limit errors

**Solution**:

- **If legitimate traffic**: Increase limits in code (edit `http.ts`)
- **If attack**: Keep limits, investigate IP source

---

### Database file locked (SQLite)

**Symptom**: `database is locked` error

**Cause**: Another process has the file open

**Solution**:

```bash
# Find process holding lock
lsof /path/to/cozo.db

# Kill it gracefully
pkill -SIGTERM -f mcp-cozodb
```

---

## Known Limitations

| Item                         | Status                                                          | Mitigation                                                           |
| ---------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| **npm audit**                | ⚠️ 2 high vulnerabilities in `tar` (transitive via `cozo-node`) | Accept risk; vulnerability requires malicious tarball during install |
| **Authentication**           | ❌ Not implemented (MCP spec limitation)                        | Use stdio mode OR reverse proxy with auth                            |
| **TLS**                      | ❌ Express-only HTTP                                            | Use reverse proxy (Nginx/Caddy)                                      |
| **Multi-process clustering** | ❌ Rate limiter is in-memory                                    | Use single instance or external rate limiter (Redis)                 |
| **Audit logging**            | ❌ Not implemented                                              | Monitor stderr logs for destructive operations                       |

---

## Production-Ready Checklist

- [ ] Tests passing: `npm run test:once`
- [ ] Build successful: `npm run build`
- [ ] Graceful shutdown tested
- [ ] Backup strategy established
- [ ] Monitoring / alerting configured
- [ ] Environment variables validated
- [ ] (HTTP mode only) Reverse proxy with auth deployed
- [ ] SECURITY.md reviewed and understood
