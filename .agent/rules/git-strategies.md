---
trigger: always_on
---

# Rules

## Abstract

- **Rules**: プロンプトレベルで永続的かつ再利用可能なコンテキストを提供します。
- **Workflows**: 軌跡レベルで構造化された一連のステップ（プロンプト）を提供します。

---

## Core Policy: 計画的コミット

作業セットが終了するごとに、以下の指針に基づき**計画的コミット**を実行してください。

- **小規模分割**: 人間の認知限界を意識し、一度に理解可能な最小限の意味単位で分割する。
- **戦略的実行**: 動作確認が取れた段階で即座にコミットし、作業の履歴を保護する。

---

## Context Management (@mention)

ルールファイル内では `@filename` を使用して他のファイルを参照可能です。

- **相対パス**: ルールファイルの場所を基準に解決。
- **絶対パス**: 真の絶対パスとして解決。
- **その他**: リポジトリのルートを基準に解決。

---

## Feature: Workflow

エージェントが繰り返し実行するタスク（デプロイ、PR返信など）をステップとして定義できます。

### How to Make

1. 右サイドバーの「...」ドロップダウンから「Workflow」ペインへ移動。
2. Global または Workspace を選択して作成。

### How to Use

- `/workflow-name` 形式のスラッシュコマンドで呼び出し可能。
- ワークフロー内から別の `/workflow-2` を呼び出す指示も可能。
- 各ワークフローは最大12,000文字のマークダウンファイルとして保存されます。

---

## References

- **Google Antigravity Documentation**
  - [https://antigravity.google/docs/rules-workflows](https://antigravity.google/docs/rules-workflows)
