# MCP CozoDB Server

[CozoDB](https://github.com/cozodb/cozo)のModel Context Protocolサーバー - グラフクエリ機能を持つDatalogデータベース

[English Documentation](README.md)

## 関連Skill

このMCPサーバーは **[CozoDB Connector Skill](../README.md)** と連携して使用します：

- Datalogクエリ構文リファレンス
- CozoDBパターンとベストプラクティス
- エッジケースとトラブルシューティング

## インストール

```bash
cd mcp-cozodb
npm install
npm run build
```

## 設定

### 環境変数

| 変数              | デフォルト  | 説明                                           |
| ----------------- | ----------- | ---------------------------------------------- |
| `COZO_ENGINE`     | `mem`       | ストレージエンジン: `mem`, `sqlite`, `rocksdb` |
| `COZO_PATH`       | `./cozo.db` | データベースパス (`mem`では無視)               |
| `MCP_TRANSPORT`   | `stdio`     | トランスポート: `stdio` or `http`              |
| `MCP_HTTP_PORT`   | `3100`      | HTTPサーバーポート (transport=http時)          |
| `MCP_CORS_ORIGIN` | `*`         | CORS許可オリジン                               |

### トランスポートモード

**stdio (デフォルト)** - Claude Desktop, Gemini CLI向け:

```bash
node dist/index.js
```

**http** - PWA/ブラウザクライアント向け:

```bash
MCP_TRANSPORT=http node dist/index.js
# サーバー: http://localhost:3100/mcp
```

### Claude Desktop設定

`claude_desktop_config.json`に追加:

```json
{
  "mcpServers": {
    "cozodb": {
      "command": "node",
      "args": ["/path/to/mcp-cozodb/dist/index.js"],
      "env": {
        "COZO_ENGINE": "sqlite",
        "COZO_PATH": "/path/to/your/database.db"
      }
    }
  }
}
```

### Gemini CLI設定

MCP設定に追加:

```json
{
  "cozodb": {
    "command": "node",
    "args": ["D:/project/mcp-cozodb/dist/index.js"],
    "env": {
      "COZO_ENGINE": "mem"
    }
  }
}
```

## 利用可能なツール

### 読み取り専用ツール

| ツール                   | 説明                     |
| ------------------------ | ------------------------ |
| `cozo_query`             | Datalogクエリ実行        |
| `cozo_list_relations`    | 全リレーション一覧       |
| `cozo_describe_relation` | リレーションスキーマ取得 |

### 変更ツール

| ツール                 | 説明             | 破壊的  |
| ---------------------- | ---------------- | ------- |
| `cozo_create_relation` | リレーション作成 | いいえ  |
| `cozo_put`             | データ挿入/更新  | いいえ  |
| `cozo_remove`          | データ削除       | ⚠️ はい |
| `cozo_drop_relation`   | リレーション削除 | ⚠️ はい |

## 使用例

### クエリ

```
ツール: cozo_query
入力: {
  "query": "?[x, y] <- [[1, 'hello'], [2, 'world']]"
}
```

### リレーション作成

```
ツール: cozo_create_relation
入力: {
  "relation_name": "users",
  "schema": "{id: Int => name: String, age: Int}"
}
```

### データ挿入

```
ツール: cozo_put
入力: {
  "relation_name": "users",
  "data": [[1, "Alice", 30], [2, "Bob", 25]]
}
```

### リレーションクエリ

```
ツール: cozo_query
入力: {
  "query": "?[name, age] := users[_, name, age], age > 20"
}
```

## 開発

```bash
# ウォッチモード
npm run dev

# ビルド
npm run build

# MCP Inspectorでテスト
npx @modelcontextprotocol/inspector node dist/index.js
```

## ライセンス

MIT
