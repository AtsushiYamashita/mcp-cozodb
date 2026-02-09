# Security Guidelines

本ドキュメントはMCP CozoDBサーバーのセキュリティ対策を説明します。

## HTTP Transport セキュリティ

### Rate Limiting

デフォルト設定:

- **100リクエスト/60秒/IP**
- 超過時: HTTP 429 + `retryAfter` ヘッダー

カスタマイズ (環境変数なし、コード変更が必要):

```typescript
startHttpTransport(server, {
  rateLimitWindowMs: 60000, // 60秒
  rateLimitMax: 100, // 最大リクエスト数
});
```

### Request Size Limits

- デフォルト: **1MB**
- 大量データ挿入には分割が必要

### CORS

- デフォルト: `*` (全オリジン許可)
- 本番環境では明示的に設定:
  ```bash
  MCP_CORS_ORIGIN=https://your-app.com,https://staging.your-app.com
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
2. **クエリ長制限**: 最大10,000文字 (Zodスキーマで検証)
3. **データ行数制限**: 1回の `put` で最大1,000行

### Prototype Pollution Prevention

`cozo-wrapper.js` は `Object.freeze` を使用してオブジェクトを不変化。

## 推奨設定

### 本番環境

```bash
# 明示的なCORS
MCP_CORS_ORIGIN=https://your-app.com

# 永続ストレージ
COZO_ENGINE=sqlite
COZO_PATH=/secure/path/database.db
```

### ファイアウォール

HTTPモードを使用する場合、ポート3100へのアクセスを制限:

- ローカルホストのみ許可
- または、リバースプロキシ経由でアクセス

## 既知の制限

| 項目             | 状態                                         |
| ---------------- | -------------------------------------------- |
| 認証             | 未実装 (MCP仕様に含まれない)                 |
| TLS              | Express単体では非対応 (リバースプロキシ推奨) |
| セッション永続化 | インメモリのみ                               |
