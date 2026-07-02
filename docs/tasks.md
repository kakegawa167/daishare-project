# ダイシェア モバイルアプリ 開発タスク

> 最終更新: 2026-07-01  
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

- [x] Supabase CLI インストール
- [x] `supabase init`
- [x] `supabase start` で起動確認
- [x] FastAPI コンテナから Supabase CLI の PostgreSQL（port 54322）に接続確認

### 0-4. Supabase クラウドプロジェクト作成

- [x] staging プロジェクト作成（`daishare-staging`）
- [x] production プロジェクト作成（`daishare-production`、Singapore、Supabase Pro）
- [x] staging の URL / Anon Key / JWT Secret / Service Role Key を取得・保管
- [x] production の URL / Anon Key / JWT Secret / Service Role Key を取得・保管
- [x] production DB にマイグレーション適用（Alembic）
- [x] production DB にシードデータ投入（路線・駅）

### 0-5. モバイル（Expo）初期設定

- [x] `mobile/` ディレクトリ作成
- [x] Expo Router + TypeScript テンプレート作成
- [x] `@supabase/supabase-js` / `axios` / `zustand` / `date-fns` インストール
- [x] `lib/supabase.ts` 作成（Supabase クライアント初期化）
- [x] `lib/api.ts` 作成（Axios クライアント・JWT 付与インターセプター）
- [x] `.env.local` 作成・`EXPO_PUBLIC_*` 環境変数設定
- [x] `npx expo start` で起動確認

### 0-6. バックエンドホスティング（Render）

- [x] Render アカウント作成・`daishare-api` サービス作成（Docker / `main` ブランチ / Root: `backend`）
- [x] 環境変数設定（DATABASE_URL / SUPABASE_* / ENVIRONMENT=staging / ALLOWED_ORIGINS）
- [x] デプロイ成功・URL 発行（`https://daishare-api.onrender.com`）
- [x] UptimeRobot でスリープ防止（5分間隔 `/health` 監視）
- [x] モバイルアプリの `EXPO_PUBLIC_API_URL` を Render URL に更新
- [x] Render `daishare-api`（main）の環境変数を production Supabase に更新
- [x] Render `daishare-api-staging`（develop）を Staging 環境に作成・デプロイ
- [x] UptimeRobot に staging 監視追加（`daishare-api-staging.onrender.com/health`）
- [x] `.env.staging` / `.env.production` / `.env.local` 環境ファイル整備
- [ ] production Storage バケット（avatars / cart-images）RLS ポリシー確認
- [x] staging / production API IPv6 問題修正（Supabase pooler URL に変更）

### 0-7. EAS（Expo Application Services）設定

- [ ] `eas-cli` インストール・ログイン
- [ ] `eas build:configure`
- [ ] `eas.json` 作成（development / staging / production プロファイル）

### 0-8. CI/CD（GitHub Actions）設定

- [x] `.github/workflows/backend-ci.yml` 作成（pytest / ruff / mypy）
- [x] `.github/workflows/backend-deploy.yml` 作成（develop → staging / main → production 自動デプロイ。Render Deploy Hook を GitHub Secrets に登録済み）
- [x] `.github/workflows/mobile-build.yml` 作成（EAS 未設定のため無効化・ISS-005 解決後に再有効化）
- [x] gitleaks の CocoaPods 誤検知を除外設定
- [ ] GitHub Secrets に EAS Token / Supabase キー類を登録（EAS Build 設定時）
- [ ] PR 作成して CI が通ることを確認

---

## Phase 1 — 認証・ユーザー

> 目標: Google ログイン → ユーザー登録 → プロフィール編集が動く

### 1-1. DBマイグレーション（認証・ユーザー関連）

- [x] Alembic 初期化
- [x] `lines` テーブル作成マイグレーション
- [x] `stations` テーブル作成マイグレーション
- [x] `users` テーブル作成マイグレーション（display_name / bio / avatar_url / user_type 含む）
- [x] `alembic upgrade head` でローカル適用確認
- [x] 路線・駅のシードデータ作成・投入

### 1-2. バックエンド（Auth / Users API）

- [x] `POST /auth/sync` — ログイン後のユーザー同期
- [x] `GET /users/me` — 自分のプロフィール取得
- [x] `PUT /users/me` — プロフィール更新（display_name / bio / user_type / avatar_url）
- [x] `PUT /users/me/push-token` — Expo Push Token 保存
- [x] `GET /stations` — 駅一覧（municipality フィルタ）
- [x] `GET /stations/municipalities` — 市区町村一覧
- [ ] pytest でユニットテスト作成

### 1-3. モバイル（認証・プロフィール画面）

- [x] `/auth/login` 画面 — Google ログインボタン
- [x] 開発用メール/パスワードログインボタン（`__DEV__` 時のみ表示）
- [x] Supabase Auth Google OAuth 実装
- [x] ログイン後に `POST /auth/sync` を呼び出してユーザー登録
- [x] 認証状態グローバル管理（Zustand authStore）
- [x] 未認証時のリダイレクト処理（Expo Router layout guard）
- [x] `/profile` 画面 — プロフィール表示（名前・自己紹介・タイプ・通知設定）
- [x] `/profile-edit` 画面 — プロフィール編集（名前・自己紹介・タイプ・アバター）
- [x] プロフィールアイコン画像アップロード（Supabase Storage `avatars`）
- [x] アバターアップロードは `expo-image-picker` を動的インポート（Expo Go 対応）
- [x] アバターアップロードを base64 方式に修正（`blob.arrayBuffer()` は React Native 未サポート。ERR-017）
- [x] 通知設定（AsyncStorage に保存・即時反映・`useFocusEffect` で再読込）

---

## Phase 2 — 台車・検索・リクエスト

> 目標: 台車を登録して検索でき、リクエストを送受信できる

### 2-1. DBマイグレーション

- [x] `carts` テーブル作成マイグレーション（category / weight / max_load / foldable / daily_rate / weekly_rate / per_rental_rate / status 含む）
- [x] `rental_requests` テーブル作成マイグレーション
- [x] Supabase Storage バケット作成（`cart-images` / `avatars`）
- [x] Storage RLS ポリシー設定（SELECT: 全員 / INSERT: authenticated）

### 2-2. バックエンド（Carts API）

- [x] `GET /carts` — 台車検索（municipality / station_id フィルタ、active のみ）
- [x] `GET /carts/mine` — 自分の台車一覧（active/inactive 両方・id ASC 順）
- [x] `GET /carts/{cart_id}` — 台車詳細（station_name / municipality 含む）
- [x] `POST /carts` — 台車登録
- [x] `PUT /carts/{cart_id}` — 台車更新
- [x] `DELETE /carts/{cart_id}` — 台車削除（論理削除・status = deleted）
- [x] `PATCH /carts/{cart_id}/status` — 公開/非公開トグル（active ↔ inactive）
- [ ] pytest でユニットテスト作成

### 2-3. バックエンド（Rental Requests API）

- [x] `GET /rental-requests` — リクエスト一覧
- [x] `GET /rental-requests/{id}` — リクエスト詳細
- [x] `POST /rental-requests` — リクエスト送信
- [x] `POST /rental-requests/{id}/accept` — 承認 + 予約自動作成
- [x] `POST /rental-requests/{id}/reject` — 拒否
- [x] `POST /rental-requests/{id}/cancel` — キャンセル（貸主のみ）
- [x] `PATCH /rental-requests/{id}` — 貸主によるリクエスト内容編集（日時・台数）
- [x] `RentalRequestResponse` に `station_name` / `municipality` / `lending_address` / `lender_name` を追加
- [ ] pytest でユニットテスト作成

### 2-4. モバイル（台車管理画面）

- [x] `/carts` 画面 — 自分の台車一覧
- [x] `useFocusEffect` による登録・編集後の自動再取得
- [x] 公開/非公開トグル（Switch → `PATCH /carts/{id}/status`）
- [x] 並び替えドロップダウン（登録順↑↓ / 価格安い順 / 高い順）
- [x] カードタップで編集画面へ遷移（編集ボタン廃止）
- [x] 🗑 削除ボタン（stopPropagation 付き）+ 確認ダイアログ
- [x] FAB「台車を登録」ボタン（画面下部全幅）
- [x] 台車画像アップロード（Supabase Storage `cart-images`・複数枚）

### 2-5. モバイル（台車フォーム）

- [x] `CartForm` コンポーネント（新規・編集共用）
- [x] カード別セクション（基本情報 / スペック / 価格 / 貸出場所 / 備考）
- [x] カテゴリチップ選択（必須）
- [x] 価格フィールド（日額 / 週額 / 1回あたり・いずれか1つ必須）
- [x] 駅選択モーダル（市区町村→駅の2段階選択）
- [x] 編集時に選択済み駅を事前表示（`initialStation` props）
- [x] インラインバリデーション（タイトル / カテゴリ / 駅 / 価格）

### 2-6. モバイル（台車検索・リクエスト画面）

- [x] ホーム `/` 画面 — 台車グリッド（`useFocusEffect` で再取得）
- [x] エリア選択モーダル（市区町村を 東京23区 / 東京市部 / 神奈川県 / その他 にグルーピング）
- [x] 絞り込みモーダル（台車タイプ・折りたたみ可否でフィルタ）
- [x] アクティブフィルタをチップで表示・個別クリアボタン
- [x] `GET /carts` に category / foldable クエリパラメータ追加（バックエンド）
- [x] `/search/[lender_id]` 画面 — 貸主詳細・台車一覧（ナビヘッダー非表示・カスタム戻るボタン・仕切り線付き）
- [x] `/search/[lender_id]` — 台車カードを2カラムグリッドに変更（CARD_WIDTH = (screenWidth - 48) / 2・正方形サムネイル）
- [x] `/search/[lender_id]` — 最終ログイン時刻を相対時間（X分前/X時間前/X日前）で表示（access-time アイコン）
- [x] `/search/[lender_id]` — ヘッダー上の重複タイトル・重複戻るボタン除去（ERR-019）
- [x] `/search/[lender_id]` — レビューなし時も「0件（まだレビューがありません）」と表示
- [x] `/request-new` 画面 — 日時選択（日付・時刻別ボタン）/ 台車カード選択（+/- カウンター）/ メッセージ入力
- [x] `/request-new` — カレンダー UX 改善（inline + ja-JP・タップ即表示・Modal 確定ボタン・同日タップで閉じる）（ERR-021）
- [x] `/request-new` — 時刻ピッカーに確定ボタン追加（即時クローズ防止）（ERR-022）
- [x] `/request-new` — 日付ラベルに西暦を追加（year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'）
- [x] `/reservations` 画面 — ユーザータイプ別3タブ表示（リクエスト / 予約中 / 履歴）
- [x] 予約一覧カードに全情報表示（日時・場所・住所・備考）
- [x] 予約カードタップでチャット画面に遷移（「チャット・詳細を開く」ボタン廃止）
- [x] プロフィール編集のユーザータイプ選択を「借りる / 貸す」2択カードに変更（both 廃止）
- [x] 借主キャンセルボタン廃止（メッセージで貸主にキャンセル依頼する仕様）

---

## Phase 3 — メッセージ・予約管理

> 目標: チャットで取引が進み、貸出〜返却まで操作できる

### 3-1. DBマイグレーション

- [x] `messages` テーブル作成マイグレーション
- [x] `reservations` テーブル作成マイグレーション
- [x] `reservation_carts` テーブル作成マイグレーション
- [x] Supabase Realtime — `messages` テーブルの有効化
- [ ] Supabase Realtime — `notifications` テーブルの有効化
- [ ] Supabase RLS — messages（当事者のみ購読可）設定

### 3-2. バックエンド（Messages API）

- [x] `GET /rental-requests/{id}/messages` — メッセージ一覧
- [x] `POST /rental-requests/{id}/messages` — メッセージ送信
- [x] `POST /rental-requests/{id}/messages/read` — 既読更新
- [x] pytest でユニットテスト作成

### 3-3. バックエンド（Reservations API）

- [x] `GET /reservations` — 予約一覧
- [x] `GET /reservations/{id}` — 予約詳細
- [x] `POST /reservations/{id}/lend` — 貸出開始
- [x] `POST /reservations/{id}/return` — 返却完了
- [x] `POST /reservations/{id}/cancel` — キャンセル
- [x] pytest でユニットテスト作成

### 3-4. モバイル（メッセージ・取引画面）

- [x] `/requests/[id]` 画面 — LINE風チャット UI（自分: 右青バブル / 相手: 左白バブル）
- [x] Supabase Realtime でメッセージをリアルタイム受信（INSERT + UPDATE 購読）
- [x] 5秒ポーリングフォールバック（Realtime 未到達時の補完）
- [x] Pull-to-refresh（下スワイプでリロード）
- [x] システムメッセージ表示（ステータス変更・リクエスト編集内容の差分表示）
- [x] リクエスト条件を常時展開表示（台車名・日時・場所・台数・備考）
- [x] ヘッダータイトルに相手ユーザー名を表示
- [x] 既読表示（相手が読んだ最後のメッセージに「既読」を表示）
- [x] 貸主アクション: 承認 / 編集 / 拒否 の3ボタン（pending 時）
- [x] 貸主リクエスト編集モーダル（日時・台車カード選択）
- [x] 貸出ボタン（RESERVED → LENT）
- [x] 返却ボタン（LENT → RETURNED）
- [x] キーボードで入力欄が隠れない（`automaticallyAdjustKeyboardInsets` + KAV）
- [x] 借主キャンセルボタン廃止

---

## Phase 4 — レビュー・スケジュール・通知

### 4-1. DBマイグレーション

- [x] `reviews` テーブル作成マイグレーション
- [x] `notifications` テーブル作成マイグレーション

### 4-2. バックエンド（Reviews API）

- [x] `POST /reservations/{id}/reviews` — レビュー投稿
- [x] `GET /users/{user_id}/reviews` — レビュー一覧
- [x] pytest でユニットテスト作成

### 4-3. バックエンド（Notifications API）

- [x] `GET /notifications` / `POST /read` / `POST /read-all` / `DELETE /{id}`
- [x] `notification_service.py` — 各イベント時の通知作成・プッシュ送信
- [x] リマインドバッチ（APScheduler で貸出60分前・返却60分前）
- [x] pytest でユニットテスト作成

### 4-4. モバイル（スケジュール画面）

- [x] `/schedule` 画面 — 予約一覧（今後・過去に分類）
- [x] 予定タップで `/requests/[id]` へ遷移

### 4-5. モバイル（通知画面・バッジ）

- [x] `/notifications` 画面 — 通知一覧・既読管理
- [x] 未読バッジ（Zustand badgeStore・ヘッダー通知アイコン）
- [x] Supabase Realtime で未読バッジをリアルタイム更新
- [ ] Supabase Realtime — `notifications` テーブルの購読実装

### 4-6. モバイル（プッシュ通知）

- [x] `expo-notifications` 導入・権限リクエスト
- [x] Push Token 取得 → `PUT /users/me/push-token`
- [x] フォアグラウンド通知ハンドラー
- [x] バックグラウンド通知タップ時の画面遷移
- [x] キルド状態からの通知タップ対応（`getLastNotificationResponseAsync`）
- [x] 通知タイプ別遷移: `request_received` → 予約一覧 / その他 → チャット画面

### 4-7. モバイル（レビュー）

- [x] 返却完了後にレビューモーダル表示
- [x] 評価（1〜3）+ コメント入力
- [x] 貸主詳細画面にレビュー一覧表示（バイナリ評価：thumb-up/thumb-down アイコン）
- [x] レビューをバイナリ方式に変更（良かった=3 / 悪かった=1 の2択。評価2は廃止）
- [x] レビューボタンを絵文字から Material Icons（thumb_up / thumb_down）に変更
- [x] プロフィールの評価表示を5つ星表示に変更（良いレビュー割合から算出: ratio × 5 stars、メルカリ方式）
- [x] `users` テーブルに `last_seen_at` カラム追加（Alembic マイグレーション）
- [x] `POST /auth/sync` で `last_seen_at` を現在時刻（UTC）に更新
- [x] `GET /users/{user_id}/profile` のレスポンスに `last_seen_at` を追加（`PublicUserResponse`）

---

## Phase 5 — 仕上げ・リリース準備

### 5-1. UI/UX 調整

- [x] ローディング・エラー状態の UI 整備（LoadingScreen / ErrorScreen / EmptyScreen）
- [x] 空状態の UI 整備
- [x] フォームバリデーションエラーメッセージ整備
- [x] アクセシビリティ対応（フォントサイズ・コントラスト）
- [x] プロフィール画面のモダンデザイン刷新
- [x] 台車フォームのカード分割レイアウト
- [x] 通知設定ドラムロールピッカー（iOSタイマー風）
- [x] ヘッダー右のアイコン（通知ベル・プロフィール）サイズを 24px → 28px に拡大
- [x] ログアウト後のローディングスピナー無限ループ修正（ERR-020）
- [x] `gitleaks.toml` に `.env.staging` / `.env.production` の allowlist 追加（ERR-026）
- [x] iPhone Dev Build を `xcodebuild` + `xcrun devicectl` で実機インストール（ERR-024）
- [x] 貸主詳細画面: プロフィール名と区切り線の余白調整（paddingTop 追加）
- [x] リクエスト送信画面: メッセージ入力時にキーボードで隠れない対応（KeyboardAvoidingView + onFocus 自動スクロール）
- [x] ログアウト後スピナー無限ループの残存修正（profile 系画面で `!session` 時は即 return）
- [x] 予約一覧カードのモダン刷新（ステータス左ボーダー・頭文字アバター・ユーザー名を主見出し／台車名を副見出しに変更）
- [x] メッセージ（チャット）画面のヘッダーに "requests" グループ名が出る二重ヘッダーを解消。ルート `_layout.tsx` で `requests` / `notifications` グループを `headerShown: false` に（ヘッダーは相手ユーザー名を表示・LINE風）（ERR-019 更新）
- [x] チャット画面ヘッダーに LINE 風の戻るボタンを追加（`headerLeft` で `router.back()`・`headerBackVisible: false`）。横スワイプで戻るジェスチャーは従来どおり有効
- [x] チャット戻るボタンのアイコンを `chevron-left` にし 36×36 の中央寄せボックスで整列（`arrow-back-ios` のグリフ右寄りズレを解消）
- [x] チャット入力欄がキーボードに隠れる問題を修正（コンテンツ全体を KAV で包み `keyboardVerticalOffset = insets.top + 44`。内側 KAV・FlatList の二重補正を削除）（ERR-027 更新）
- [x] メッセージ一覧カードを LINE 風に情報階層を再設計（①名前 ②予約識別=台車×台数 ③最終メッセージを主役に大きく濃く ④日程・場所は11px1行に集約）。最終メッセージの可読性を改善
- [x] 日付表示を `fmtDateSmart`（`lib/format.ts`）に集約し、今年と異なる年のみ年を付与。メッセージ一覧の最終メッセージ日付・予約日程の年跨ぎ曖昧さを解消
- [x] ログアウト後にプロフィールモーダルの空背景が残る問題を修正。`handleLogout` で `await signOut()` 後に `router.replace('/(tabs)')` でホームへ遷移（ERR-028 更新）
- [x] 承認/拒否/通知時の一瞬エラーを修正。`_send_expo_push` の HTTP 呼び出しを try/except で握りつぶし、Expo Push 失敗が主処理（承認等）を巻き込まないよう修正（ERR-029・要バックエンド再デプロイ）
- [x] 通知画面を `(tabs)` 内の隠しタブ（`href: null`）に移設し、ボトムタブバーを表示。戻り導線が分かりにくい問題を解消（`app/notifications/` グループ → `app/(tabs)/notifications.tsx`）
- [x] 予約アクションの確認ダイアログ文言を自然化（貸出開始→「貸出を開始しますか？」、返却→「返却を完了しますか？」、キャンセル→「予約をキャンセルしますか？」）
- [x] チャットの送信ボタンを「送信」テキストから紙飛行機アイコン（`send`）に変更（40×40円形・`accessibilityLabel="送信"`）
- [x] 日時ピッカーを共通コンポーネント `components/DateTimeField.tsx` に抽出（request-new から移動）。返却日変更モーダルもこれに統一し、リクエスト送信と同じ日付/時刻 UI に
- [x] チャットでメッセージが重複表示される問題を修正。Realtime INSERT で自分の送信をスキップ＋POST置換を重複防止型に（ERR-030）

### 5-6. リファクタリング・コード整理

- [x] 死んだ重複ルートを削除（`app/requests/index.tsx` / `app/schedule/` ＝どこからも遷移されない孤立画面。実体は `(tabs)` 側）
- [x] 共通フォーマッタを `lib/format.ts` に集約（`fmtDateTime` / `formatRate`）— 6ファイルの重複定義を解消
- [x] 未使用インポート・未使用ローカル関数（`RequestStatus` / `fmt`）を除去
- [x] `design.md` に「2. 設計方針・原則（Design Principles）」を新設。実装指針を明文化（既存セクションは 3〜15 に繰り上げ）
- [x] `CLAUDE.md` に「実装方針（無駄を作らない）」を追記（design.md §2 参照・事前チェック・YAGNI）
- [ ] Expo テンプレート残骸の掃除（`(tabs)/two.tsx` / `modal.tsx` / `EditScreenInfo` / `ExternalLink` — TSエラー1件の発生源）

### 5-2. テスト

- [x] バックエンド統合テスト（主要フロー）
- [ ] モバイル E2E テスト（主要フロー手動確認）
- [ ] TestFlight / Internal Testing 配布・動作確認

### 5-3. セキュリティ確認

- [x] JWT 検証の網羅確認
- [x] オーナーチェック漏れがないか確認
- [x] 環境変数の本番設定確認（`.env` が git 管理外であること）
- [x] gitleaks によるシークレットスキャン運用確立
- [ ] Supabase RLS ポリシーの動作確認（本番プロジェクト作成後）

### 5-4. App Store / Play Store 申請準備

- [ ] アプリアイコン・スプラッシュ画像作成
- [ ] App Store Connect 登録・メタデータ入力
- [ ] Google Play Console 登録・メタデータ入力
- [ ] プライバシーポリシー URL 用意
- [ ] EAS Build（Production）実行
- [ ] App Store 審査申請
- [ ] Google Play 審査申請

### 5-5. 課金・プランシステム（RevenueCat）

- [x] DB: `users` テーブルに `plan` / `plan_expires_at` カラム追加（Alembic）
- [x] バックエンド: `plan_service.py`（`get_effective_plan` / `check_cart_limit` / `check_location_limit` / `is_over_limit`）
- [x] バックエンド: 台車登録・地点登録の制限チェック（carts router）
- [x] バックエンド: メッセージ送信ブロック（messages router）
- [x] バックエンド: `GET /users/me` に `plan` / `plan_expires_at` / `is_over_limit` 追加
- [x] バックエンド: RevenueCat Webhook エンドポイント（`POST /webhooks/revenuecat`）
- [x] フロントエンド: `UserPlan` 型 / `User` インターフェース更新
- [x] フロントエンド: `authStore` の `AppUser` に plan フィールド追加
- [x] フロントエンド: 台車管理画面 — プラン超過警告バナー
- [x] フロントエンド: チャット画面 — 超過中の貸主メッセージ送信ブロック
- [x] フロントエンド: `lib/purchases.ts`（RevenueCat SDK ラッパー）
- [x] フロントエンド: `_layout.tsx` — RevenueCat 初期化
- [x] フロントエンド: `authStore` — ログイン/ログアウト時の RevenueCat セッション紐付け
- [x] フロントエンド: プロフィール画面 — プランカード・アップグレードボタン・購入復元
- [ ] 手動作業: App Store Connect でサブスクリプション商品登録（ISS-009）
- [ ] 手動作業: RevenueCat プロジェクト設定・Webhook 設定（ISS-010）
- [ ] 手動作業: `REVENUECAT_WEBHOOK_SECRET` を Render 環境変数に追加
- [ ] 手動作業: `EXPO_PUBLIC_REVENUECAT_API_KEY` を `.env` に追加
- [ ] EAS Dev Build で実機購入フローのテスト（ISS-011）

---

## Phase 6 — 品質向上・追加機能（MVP後）

> MVP 後に対応する機能・改善タスク

### 6-1. 台車画像

- [x] Supabase Storage `cart-images` バケット作成・RLS 設定
- [x] 台車フォームへの複数枚画像アップロード追加（最大5枚・サムネイル表示・削除対応）
- [x] ホーム画面・貸主詳細画面への画像表示（`image_urls[0]` 表示済み）

### 6-2. ユーザー体験向上

- [ ] プロフィール画面から他ユーザーのプロフィールを閲覧できるようにする
- [ ] 台車検索のフリーワード検索対応
- [ ] お気に入り台車（ブックマーク）機能
- [ ] メッセージ画面内での画像送受信
- [x] メッセージ既読表示（最後の既読メッセージに「既読」表示 / Realtime UPDATE 対応）

### 6-3. スケジュール・カレンダー

- [ ] カレンダービューでの空き状況確認
- [ ] 複数予約の重複チェック（同一台車の二重予約防止）

### 6-4. 通知強化

- [ ] リマインド送信タイミングをサーバー側にも反映（現在はクライアントのみ）
- [ ] Supabase Realtime — `notifications` テーブルの購読実装
- [ ] 通知既読をサーバーリアルタイムで反映

### 6-5. 管理・収益

- [ ] 見積もり（Quote）機能
- [ ] 売上管理・経費帳
- [ ] 領収書発行
- [ ] 決済（Stripe）連携
- [ ] 管理者ダッシュボード

### 6-6. 認証拡張

- [ ] Apple Sign In 対応
- [ ] 電話番号認証対応

### 6-7. インフラ

- [x] Render `daishare-api`（main）= production 環境構築（`https://daishare-api.onrender.com`）
- [x] Render `daishare-api-staging`（develop）= staging 環境構築（`https://daishare-api-staging.onrender.com`）
- [x] Supabase production プロジェクト作成（`daishare-production`、Pro）
- [x] Supabase production DB マイグレーション・シードデータ投入
- [ ] Supabase production Storage バケット・RLS 設定完了確認
- [ ] Supabase production Google OAuth リダイレクト URL 登録
- [ ] 本番 RLS ポリシー全設定
- [ ] APM・ログ監視設定（Sentry など）

---

## 進捗サマリー

| Phase                                  | タスク数 | 完了    | 未着手  |
| -------------------------------------- | -------- | ------- | ------- |
| Phase 0 — 環境構築                     | 51       | 45      | 6       |
| Phase 1 — 認証・ユーザー               | 25       | 24      | 1       |
| Phase 2 — 台車・検索・リクエスト       | 55       | 53      | 2       |
| Phase 3 — メッセージ・予約管理         | 30       | 28      | 2       |
| Phase 4 — レビュー・スケジュール・通知 | 30       | 29      | 1       |
| Phase 5 — 仕上げ・リリース準備         | 68       | 52      | 16      |
| Phase 6 — 品質向上・追加機能（MVP後）  | 28       | 8       | 20      |
| **合計**                               | **287**  | **239** | **48**  |
