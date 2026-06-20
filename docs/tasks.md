# ダイシェア モバイルアプリ 開発タスク

> 最終更新: 2026-06-20  
> ステータス凡例: `[ ]` 未着手 / `[→]` 進行中 / `[x]` 完了 / `[-]` スキップ

---

## Phase 0 — 環境構築

> 目標: ローカルで FastAPI + Supabase CLI が動き、GitHub Actions が通る状態

### 0-1. リポジトリ・ブランチ設定

- [x] `develop` ブランチ作成
- [x] ブランチ保護ルール設定（main / develop への直接 push 禁止）
- [x] `.gitignore` 整備（Python / Node / Expo / 環境変数）
- [x] `CLAUDE.md` 作成（プロジェクト概要・開発ルール）

### 0-2. バックエンド（FastAPI）初期設定

- [x] `backend/` ディレクトリ作成・構造構築
- [x] `Dockerfile` 作成（Python 3.12-slim ベース）
- [x] `docker-compose.yml` 作成（api サービス）
- [x] `requirements.txt` 作成（FastAPI / uvicorn / sqlalchemy / asyncpg / alembic / python-jose / pydantic 等）
- [x] `app/main.py` 作成（ヘルスチェックエンドポイント含む）
- [x] `app/core/config.py` 作成（環境変数管理）
- [x] `app/core/database.py` 作成（asyncpg 接続）
- [x] `app/core/auth.py` 作成（Supabase JWT 検証ミドルウェア）
- [x] `.env.example` 作成
- [x] `docker compose up` でサーバー起動確認

### 0-3. Supabase ローカル環境

- [x] Supabase CLI インストール（`brew install supabase/tap/supabase`）
- [x] `supabase init`
- [x] `supabase start` で起動確認
- [x] FastAPI コンテナから Supabase CLI の PostgreSQL（port 54322）に接続確認

### 0-4. Supabase クラウドプロジェクト作成

- [x] staging プロジェクト作成（`daishare-staging`）
- [ ] production プロジェクト作成（`daishere-prod`）
- [x] staging の URL / Anon Key / JWT Secret / Service Role Key を取得・保管

### 0-5. モバイル（Expo）初期設定

- [x] `mobile/` ディレクトリ作成
- [x] `npx create-expo-app mobile --template` で Expo Router + TypeScript テンプレート作成
- [x] `@supabase/supabase-js` インストール
- [x] `axios` / `zustand` / `react-hook-form` / `zod` / `date-fns` インストール
- [x] `lib/supabase.ts` 作成（Supabase クライアント初期化）
- [x] `lib/api.ts` 作成（Axios クライアント・JWT 付与インターセプター）
- [x] `.env.local` 作成・`EXPO_PUBLIC_*` 環境変数設定
- [ ] `npx expo start` で起動確認

### 0-6. Railway 設定

- [ ] Railway アカウント作成・プロジェクト作成（`daishere`）
- [ ] staging サービス作成（GitHub 連携 / `develop` ブランチ）
- [ ] production サービス作成（GitHub 連携 / `main` ブランチ）
- [ ] 各サービスに環境変数設定

### 0-7. EAS（Expo Application Services）設定

- [ ] `eas-cli` インストール（`npm install -g eas-cli`）
- [ ] `eas login` / `eas build:configure`
- [ ] `eas.json` 作成（development / staging / production プロファイル）

### 0-8. CI/CD（GitHub Actions）設定

- [x] `.github/workflows/backend-ci.yml` 作成（pytest / ruff / mypy）
- [x] `.github/workflows/backend-deploy.yml` 作成（develop→staging, main→prod Railway デプロイ）
- [x] `.github/workflows/mobile-build.yml` 作成（EAS Build）
- [ ] GitHub Secrets に Railway Token / EAS Token / Supabase キー類を登録
- [ ] PR 作成して CI が通ることを確認

---

## Phase 1 — 認証・ユーザー

> 目標: Google ログイン → ユーザー登録 → プロフィール編集が動く

### 1-1. DBマイグレーション（認証・ユーザー関連）

- [x] Alembic 初期化（`alembic init alembic`）
- [x] `lines` テーブル作成マイグレーション
- [x] `stations` テーブル作成マイグレーション
- [x] `users` テーブル作成マイグレーション
- [x] `alembic upgrade head` でローカル適用確認
- [x] 路線・駅のシードデータ作成・投入

### 1-2. バックエンド（Auth / Users API）

- [x] `POST /auth/sync` — ログイン後のユーザー同期（初回登録含む）
- [x] `GET /users/me` — 自分のプロフィール取得
- [x] `PUT /users/me` — プロフィール更新（名前 / 自己紹介 / 拠点駅 / 貸出場所詳細 / ユーザータイプ）
- [x] `PUT /users/me/push-token` — Expo Push Token 保存
- [x] `GET /stations` — 駅一覧（municipality フィルタ）
- [x] `GET /stations/municipalities` — 市区町村一覧
- [x] `GET /lines` — 路線一覧
- [ ] pytest でユニットテスト作成

### 1-3. モバイル（認証・プロフィール画面）

- [x] `/auth/login` 画面 — Google ログインボタン
- [x] Supabase Auth Google OAuth 実装（`@react-native-google-signin/google-signin`）
- [x] ログイン後に `POST /auth/sync` を呼び出してユーザー登録
- [x] 認証状態グローバル管理（Zustand store）
- [x] 未認証時のリダイレクト処理（Expo Router の layout guard）
- [x] `/profile` 画面 — プロフィール表示・編集フォーム
- [ ] プロフィール画像アップロード（Supabase Storage `avatar-images`）
- [x] ユーザータイプ切り替え（借主 / 貸主）
- [ ] 拠点駅選択（路線→駅の2段階選択モーダル）

---

## Phase 2 — 台車・検索・リクエスト

> 目標: 台車を登録して検索でき、リクエストを送受信できる

### 2-1. DBマイグレーション

- [x] `carts` テーブル作成マイグレーション
- [x] `rental_requests` テーブル作成マイグレーション
- [ ] Supabase Storage バケット作成（`cart-images` / `avatar-images`）
- [ ] Storage RLS ポリシー設定

### 2-2. バックエンド（Carts API）

- [x] `GET /carts` — 台車検索（municipality / station_id フィルタ）
- [x] `GET /carts/mine` — 自分の台車一覧
- [x] `GET /carts/{cart_id}` — 台車詳細
- [x] `POST /carts` — 台車登録（貸主のみ）
- [x] `PUT /carts/{cart_id}` — 台車更新
- [x] `DELETE /carts/{cart_id}` — 台車削除（論理削除）
- [ ] pytest でユニットテスト作成

### 2-3. バックエンド（Rental Requests API）

- [x] `GET /rental-requests` — リクエスト一覧
- [x] `GET /rental-requests/{id}` — リクエスト詳細
- [x] `POST /rental-requests` — リクエスト送信（借主のみ）
- [x] `POST /rental-requests/{id}/accept` — 承認 + 予約自動作成
- [x] `POST /rental-requests/{id}/reject` — 拒否
- [x] `POST /rental-requests/{id}/cancel` — キャンセル
- [ ] pytest でユニットテスト作成

### 2-4. モバイル（台車管理画面）

- [x] `/carts` 画面 — 自分の台車一覧（貸主）
- [x] `/carts/new` 画面 — 台車登録フォーム
- [x] `/carts/[id]/edit` 画面 — 台車編集フォーム
- [ ] 台車画像アップロード（Supabase Storage `cart-images`・複数枚）
- [x] 台車削除確認ダイアログ

### 2-5. モバイル（台車検索・リクエスト画面）

- [x] `/search` 画面 — 市区町村・駅で検索、貸主カード一覧表示
- [x] `/search/[lender_id]` 画面 — 貸主詳細・台車一覧
- [x] リクエスト送信モーダル（日時 / 台数 / 希望価格 / メッセージ入力）
- [x] `/requests` 画面 — リクエスト一覧（送信済み・受信済みタブ）

---

## Phase 3 — メッセージ・予約管理

> 目標: チャットで取引が進み、貸出〜返却まで操作できる

### 3-1. DBマイグレーション

- [ ] `messages` テーブル作成マイグレーション
- [ ] `reservations` テーブル作成マイグレーション
- [ ] `reservation_carts` テーブル作成マイグレーション
- [ ] Supabase Realtime — `messages` テーブルの有効化
- [ ] Supabase Realtime — `notifications` テーブルの有効化
- [ ] Supabase RLS — messages（当事者のみ購読可）設定

### 3-2. バックエンド（Messages API）

- [ ] `GET /rental-requests/{id}/messages` — メッセージ一覧
- [ ] `POST /rental-requests/{id}/messages` — メッセージ送信
- [ ] `POST /rental-requests/{id}/messages/read` — 既読更新
- [ ] pytest でユニットテスト作成

### 3-3. バックエンド（Reservations API）

- [ ] `GET /reservations` — 予約一覧
- [ ] `GET /reservations/{id}` — 予約詳細
- [ ] `POST /reservations/{id}/lend` — 貸出開始
- [ ] `POST /reservations/{id}/return` — 返却完了
- [ ] `POST /reservations/{id}/cancel` — キャンセル
- [ ] pytest でユニットテスト作成

### 3-4. モバイル（メッセージ・取引画面）

- [ ] `/requests/[id]` 画面 — チャット UI（Supabase Realtime で即時反映）
- [ ] メッセージ送信フォーム
- [ ] システムメッセージ表示（ステータス変更通知）
- [ ] 承認・拒否ボタン（貸主）
- [ ] キャンセルモーダル（理由入力）
- [ ] 貸出ボタン（貸主 / RESERVED → LENT）
- [ ] 返却ボタン（貸主 / LENT → RETURNED）

---

## Phase 4 — レビュー・スケジュール・通知

> 目標: 評価・スケジュール確認・プッシュ通知が動く

### 4-1. DBマイグレーション

- [ ] `reviews` テーブル作成マイグレーション
- [ ] `notifications` テーブル作成マイグレーション

### 4-2. バックエンド（Reviews API）

- [ ] `POST /reservations/{id}/reviews` — レビュー投稿
- [ ] `GET /users/{user_id}/reviews` — ユーザーへのレビュー一覧
- [ ] pytest でユニットテスト作成

### 4-3. バックエンド（Notifications API）

- [ ] `GET /notifications` — 通知一覧
- [ ] `POST /notifications/{id}/read` — 既読
- [ ] `POST /notifications/read-all` — 全件既読
- [ ] `DELETE /notifications/{id}` — 通知削除
- [ ] `notification_service.py` — 各イベント時の通知作成・プッシュ送信ロジック
- [ ] リマインドバッチ実装（APScheduler で貸出60分前・返却60分前）
- [ ] pytest でユニットテスト作成

### 4-4. モバイル（スケジュール画面）

- [ ] `/schedule` 画面 — 今後7日間の予定（日次ビュー）
- [ ] 7日以降の予定一覧表示
- [ ] 予定タップで該当メッセージ画面へ遷移

### 4-5. モバイル（通知画面）

- [ ] `/notifications` 画面 — 通知一覧・既読管理
- [ ] Supabase Realtime で通知をリアルタイム受信
- [ ] 未読バッジ表示（タブアイコンに件数表示）

### 4-6. モバイル（プッシュ通知）

- [ ] `expo-notifications` 導入・権限リクエスト実装
- [ ] アプリ起動時に Push Token 取得 → `PUT /users/me/push-token`
- [ ] フォアグラウンド通知ハンドラー設定
- [ ] バックグラウンド通知タップ時の画面遷移設定

### 4-7. モバイル（レビュー）

- [ ] 返却完了後にレビューモーダルを表示
- [ ] 評価（1〜3）+ コメント入力
- [ ] 貸主詳細画面にレビュー一覧・平均評価を表示

---

## Phase 5 — 仕上げ・リリース準備

> 目標: App Store / Play Store 申請できる品質にする

### 5-1. UI/UX 調整

- [ ] ローディング・エラー状態の UI 整備
- [ ] 空状態（データなし）の UI 整備
- [ ] フォームバリデーションエラーメッセージ整備
- [ ] アクセシビリティ対応（フォントサイズ・コントラスト）

### 5-2. テスト

- [ ] バックエンド統合テスト（主要フロー）
- [ ] モバイル E2E テスト（主要フロー手動確認）
- [ ] TestFlight / Internal Testing 配布・動作確認

### 5-3. セキュリティ確認

- [ ] JWT 検証の網羅確認
- [ ] オーナーチェック漏れがないか確認
- [ ] Supabase RLS ポリシーの動作確認
- [ ] 環境変数の本番設定確認（シークレットが .env に残っていないか）

### 5-4. App Store / Play Store 申請準備

- [ ] アプリアイコン・スプラッシュ画像作成
- [ ] App Store Connect 登録・メタデータ入力
- [ ] Google Play Console 登録・メタデータ入力
- [ ] プライバシーポリシー URL 用意
- [ ] EAS Build（Production）実行
- [ ] App Store 審査申請
- [ ] Google Play 審査申請

---

## バックログ（MVP後対応）

- [ ] 見積もり（Quote）機能
- [ ] 外部予約管理
- [ ] 売上管理・経費帳
- [ ] 領収書発行
- [ ] 決済（Stripe）
- [ ] Apple Sign In
- [ ] チャット画像送信
- [ ] メッセージ既読表示
- [ ] ユーザーお気に入り機能
- [ ] カレンダー表示での空き状況確認
- [ ] リマインド送信タイミングのユーザー設定
- [ ] 管理者ダッシュボード

---

## 進捗サマリー

| Phase                                  | タスク数 | 完了   | 進行中 | 未着手  |
| -------------------------------------- | -------- | ------ | ------ | ------- |
| Phase 0 — 環境構築                     | 29       | 29     | 0      | 0       |
| Phase 1 — 認証・ユーザー               | 22       | 20     | 0      | 2       |
| Phase 2 — 台車・検索・リクエスト       | 24       | 0      | 0      | 24      |
| Phase 3 — メッセージ・予約管理         | 18       | 0      | 0      | 18      |
| Phase 4 — レビュー・スケジュール・通知 | 22       | 0      | 0      | 22      |
| Phase 5 — 仕上げ・リリース準備         | 14       | 0      | 0      | 14      |
| **合計**                               | **129**  | **49** | **0**  | **80**  |
