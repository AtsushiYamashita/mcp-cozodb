# MCP CozoDB Server

[CozoDB](https://github.com/cozodb/cozo)（Datalogデータベース）のModel Context Protocolサーバー。**[CozoDB Connector Skill](../README.md)** と連携して構文リファレンスとベストプラクティスを提供。

[English Documentation](README.md)

## クイックスタート

```bash
npm install && npm run build
node dist/index.js  # stdioモード（Claude Desktop、Gemini CLI）
```

## 設定

### 環境変数

| 変数              | デフォルト  | 説明                                   |
| ----------------- | ----------- | -------------------------------------- |
| `COZO_ENGINE`     | `mem`       | ストレージ: `mem`, `sqlite`, `rocksdb` |
| `COZO_PATH`       | `./cozo.db` | データベースパス（`mem`では無視）      |
| `MCP_TRANSPORT`   | `stdio`     | トランスポート: `stdio` or `http`      |
| `MCP_HTTP_PORT`   | `3100`      | HTTPポート（transport=http時）         |
| `MCP_CORS_ORIGIN` | `localhost` | CORS許可オリジン（カンマ区切り）       |

### クライアント設定

**Claude Desktop** - `claude_desktop_config.json`に追加:

```json
{
  "mcpServers": {
    "cozodb": {
      "command": "node",
      "args": ["/絶対パス/to/mcp-cozodb/dist/index.js"],
      "env": { "COZO_ENGINE": "sqlite", "COZO_PATH": "/path/to/db.db" }
    }
  }
}
```

**Gemini CLI** - MCP設定に追加:

```json
{
  "cozodb": {
    "command": "node",
    "args": ["D:/project/mcp-cozodb/dist/index.js"],
    "env": { "COZO_ENGINE": "mem" }
  }
}
```

## 利用可能なツール

| ツール                   | 説明              | 破壊的      |
| ------------------------ | ----------------- | ----------- |
| `cozo_query`             | Datalogクエリ実行 | いいえ      |
| `cozo_list_relations`    | リレーション一覧  | いいえ      |
| `cozo_describe_relation` | スキーマ取得      | いいえ      |
| `cozo_create_relation`   | リレーション作成  | いいえ      |
| `cozo_put`               | データ挿入/更新   | いいえ      |
| `cozo_remove`            | データ削除        | ⚠️ **はい** |
| `cozo_drop_relation`     | リレーション削除  | ⚠️ **はい** |

## 使用例

```javascript
// 1. リレーション作成
cozo_create_relation({
  relation_name: "users",
  schema: "{id: Int => name: String}",
});

// 2. データ挿入
cozo_put({
  relation_name: "users",
  data: [
    [1, "Alice"],
    [2, "Bob"],
  ],
});

// 3. クエリ
cozo_query({ query: "?[id, name] := users[id, name]" });
```

> [!WARNING]
> **HTTPモードは認証なしでデータベースを公開します。**本番環境では`stdio`を使用してください。詳細は[SECURITY.md](SECURITY.md)を参照。

## 開発

```bash
npm run dev                                          # ウォッチモード
npx @modelcontextprotocol/inspector node dist/index.js  # MCP Inspectorでテスト
```

## ライセンス

MIT
