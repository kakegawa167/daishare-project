# ダイシェア モバイルアプリ — Claude Code 作業ルール

## プロジェクト概要

台車の個人間レンタルマッチングサービス「ダイシェア」のモバイルアプリ。
詳細は `docs/design.md` を参照。

## 必須ルール

### タスク管理（docs/tasks.md）

- タスクに着手したら `[ ]` → `[→]` に変更する
- タスクが完了したら `[→]` → `[x]` に変更する
- **タスクの完了・着手のたびに必ず `docs/tasks.md` を更新すること（指示がなくても自動で行う）**
- 複数タスクをまとめて完了した場合も、すべて反映してから次に進む
- ページ末尾の「進捗サマリー」テーブルも合わせて更新する

### 設計書管理（docs/design.md）

- アーキテクチャ・DB・API・画面構成などの設計を変更した場合は、**必ず `docs/design.md` を更新すること（指示がなくても自動で行う）**
- バージョン番号（`> バージョン: X.X.X`）をインクリメントする
- 設計変更の内容は変更箇所のみ更新し、無関係な箇所は触らない

### Git

- タスク完了・設計更新のたびにコミットする
- コミットメッセージは英語で簡潔に記述する

## 技術スタック

- **モバイル**: React Native + Expo (TypeScript)
- **バックエンド**: FastAPI (Python 3.12) — Railway にホスティング
- **DB**: Supabase PostgreSQL（FastAPI が asyncpg で直接接続）
- **Auth / Realtime / Storage**: Supabase
- **コンテナ**: Docker + Docker Compose（ローカル開発）
- **マイグレーション**: Alembic

## ディレクトリ構成

```
cart-rental-ios/
├── CLAUDE.md          # このファイル
├── docs/
│   ├── design.md      # システム設計書
│   └── tasks.md       # 開発タスク・進捗管理
├── mobile/            # Expo アプリ
├── backend/           # FastAPI
└── docker-compose.yml
```
