# Security Guidelines

> [!CAUTION]
> **このサーバーは認証機能を持ちません。** HTTPモードでの公開は、誰でもデータベースへの完全なアクセスを許可することを意味します。

## 🚨 Critical Security Warnings

### 1. No Authentication

**MCPプロトコルは認証を定義していません。** このサーバーには以下の認証機構がありません：

- ユーザー認証
- APIキー検証
- JWT/トークン検証

**リスク**: HTTPモードで起動すると、ネットワークからアクセス可能な全ユーザーがデータベースに無制限アクセス可能。

### 2. Destructive Operations

以下のツールはデータを**永久に削除**します：

- `cozo_remove` - データ行削除
- `cozo_drop_relation` - テーブル全体削除（復元不可）

**リスク**: 悪意のあるユーザーまたは誤操作で全データ消失の可能性。

### 3. CORS Configuration

- **デフォルト**: `localhost`（ローカル開発のみ）
- **変更時のリスク**: `*`（ワイルドカード）設定は、あらゆるWebサイトからアクセス可能

## Threat Scenarios

### Scenario 1: External Data Destruction

```bash
# 外部からHTTPサーバーにアクセス可能な場合
curl -X POST http://your-server:3100/mcp \
  -H "Content-Type: application/json" \
  -d '{"tool": "cozo_drop_relation", "params": {"relation_name": "users"}}'
# → 全ユーザーデータが削除される
```

### Scenario 2: CSRF Attack (CORS Wildcard)

```javascript
// 悪意のあるWebサイトから
fetch("http://localhost:3100/mcp", {
  method: "POST",
  body: JSON.stringify({
    tool: "cozo_query",
    params: { query: "?[*] := sensitive_data[*]" },
  }),
});
// → 機密データが盗まれる
```

## HTTP Transport Security

### Rate Limiting

- **デフォルト**: 100リクエスト/60秒/IP
- **超過時**: HTTP 429 + `retryAfter` ヘッダー

### Request Size Limits

- **デフォルト**: 1MB
- 大量データ挿入には分割が必要

### CORS Configuration

```bash
# ローカル開発（デフォルト）
MCP_CORS_ORIGIN=localhost

# 本番環境（明示的に指定）
MCP_CORS_ORIGIN=https://app.example.com,https://staging.example.com
```

### Error Sanitization

- 内部エラー詳細は隠蔽
- CozoDBエラーは "Database query error" に変換
- エラーメッセージは200文字に制限

## Query Security

### Injection Prevention

CozoDBはDatalogを使用するため、SQLインジェクションは適用されません。
ただし、以下の対策を実施:

1. **パラメータ化クエリ**: `params` オブジェクトを使用
2. **クエリ長制限**: 最大10,000文字
3. **データ行数制限**: 1回の `put` で最大1,000行

## Recommended Configurations

### Development (Safe)

```bash
MCP_TRANSPORT=stdio       # stdioトランスポート（認証不要）
COZO_ENGINE=mem           # インメモリ（データは揮発）
```

### Production (stdio mode)

```bash
MCP_TRANSPORT=stdio       # Claude Desktop/Gemini CLI経由のみ
COZO_ENGINE=sqlite        # 永続ストレージ
COZO_PATH=/secure/path/database.db
```

### HTTP Mode (⚠️ Advanced Users Only)

```bash
# Firewall: ローカルホストのみ許可
# Reverse Proxy: Nginx + TLS + 認証レイヤー
MCP_TRANSPORT=http
MCP_HTTP_PORT=3100
MCP_CORS_ORIGIN=https://trusted-app.com
```

**推奨構成**:

- リバースプロキシ（Nginx/Caddy）
- TLS終端
- Basic認証またはOAuth
- ファイアウォールルール

## Known Limitations

| 項目             | 状態                     |
| ---------------- | ------------------------ |
| 認証             | ❌ 未実装（MCP仕様外）   |
| TLS              | ❌ Express単体では非対応 |
| セッション永続化 | ⚠️ インメモリのみ        |
| 監査ログ         | ❌ 未実装                |

## Security Checklist

- [ ] HTTPモードは内部ネットワークまたはリバースプロキシ経由のみ
- [ ] CORS設定を明示的に指定（`*`を使用しない）
- [ ] データベースパスに適切なファイル権限を設定
- [ ] Rate limitingが有効であることを確認
- [ ] 本番環境ではstdioモードを優先
- [ ] 重要データのバックアップ戦略を確立
