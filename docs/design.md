# ダイシェア モバイルアプリ 設計書

> バージョン: 1.6.0  
> 作成日: 2026-06-21  
> 対象: MVP リリース

---

## 1. システム概要

### 1.1 目的

台車の個人間レンタルマッチングサービス「ダイシェア」のモバイルアプリ版。
貸主と借主をつなぎ、台車の貸し借りを台車登録・リクエスト・メッセージ・スケジュール管理で一貫してサポートする。

### 1.2 MVPスコープ

| ロール | 機能                           |
| ------ | ------------------------------ |
| 貸主   | レンタルリクエストの承認・拒否 |
| 借主   | レンタルリクエスト送信         |
| 共通   | Google認証、プロフィール編集   |
| 共通   | 台車検索（エリア・駅）         |
| 共通   | メッセージ（チャット）         |
| 共通   | スケジュール確認               |
| 共通   | 通知受信                       |
| 共通   | レビュー・評価                 |

### 1.3 MVPスコープ外（将来対応）

- 見積もり（Quote）機能
- 外部予約管理
- 売上管理・経費帳
- 領収書発行
- 決済（Stripe）
- Apple Sign In

---

## 2. アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                  Mobile App (Expo)                       │
│              React Native + TypeScript                   │
└───────┬──────────────────────────┬───────────────────────┘
        │ REST API (JWT)            │ Realtime / Storage
        ▼                          ▼
┌───────────────────┐      ┌──────────────────────────────┐
│  FastAPI          │      │  Supabase                    │
│  (Python)         │      │                              │
│  ホスティング:Railway│      │  ・PostgreSQL（DB本体）      │
│                   │      │    ↑FastAPIが直接接続         │
│  担当:            │      │  ・Auth（Google OAuth/JWT）  │
│  ビジネスロジック  │      │  ・Realtime（WS・メッセージ） │
│  APIエンドポイント │      │  ・Storage（台車・アバター画像）│
│  JWT検証          │      │                              │
└────────┬──────────┘      └──────────────┬───────────────┘
         │  asyncpg（直接DB接続）           │
         └─────────────────────────────────┘
```

> **補足**:
>
> - FastAPIはSupabaseのPostgreSQLに直接接続してデータを読み書きする（PostgRESTは使わない）
> - Realtime・Storage・AuthはモバイルアプリからSupabase SDKで直接アクセスする
> - FastAPIのホスティングはRailway、DBはSupabase管理のPostgreSQLを使用する

### 2.1 各コンポーネントの役割

| コンポーネント          | 役割                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| **Expo (React Native)** | モバイルUI、画面遷移、状態管理                                   |
| **FastAPI（Railway）**  | ビジネスロジック、APIエンドポイント、JWT検証                     |
| **Supabase Auth**       | Google OAuth認証、JWTトークン発行                                |
| **Supabase PostgreSQL** | データ永続化（FastAPIがasyncpgで直接接続）                       |
| **Supabase Realtime**   | メッセージ・通知のリアルタイム受信（モバイルから直接接続）       |
| **Supabase Storage**    | 台車画像・プロフィール画像の保存（モバイルから直接アップロード） |

### 2.2 認証フロー

```
1. ユーザーがアプリ上で「Googleでログイン」をタップ
2. Supabase Auth SDK が Google OAuth を処理
3. Supabase が JWT（access_token）を発行
4. アプリは以降すべてのAPIリクエストに JWT を付与
5. FastAPI は Supabase の JWT Secret で署名を検証
6. 検証OK → ビジネスロジック処理 → レスポンス返却
```

### 2.3 Realtimeフロー（メッセージ）

```
1. メッセージ送信: モバイル → POST /rental-requests/{id}/messages（FastAPI）
2. FastAPI が messages テーブルに INSERT
3. Supabase Realtime が INSERT を検知し、購読中のクライアントへ配信
4. 相手のモバイルアプリがリアルタイムでメッセージを受信・表示

※ モバイルアプリは Supabase JS SDK で messages テーブルを購読する
※ RLS により当事者のみが購読可能
```

---

## 3. 技術スタック

### 3.1 モバイル（フロントエンド）

| 項目                 | 採用技術                                           |
| -------------------- | -------------------------------------------------- |
| フレームワーク       | React Native 0.76 + Expo SDK 56                    |
| 言語                 | TypeScript 5.x                                     |
| 状態管理             | Zustand                                            |
| ナビゲーション       | Expo Router（File-based routing）                  |
| HTTPクライアント     | Axios                                              |
| Realtimeクライアント | Supabase JS SDK（Realtime・Storage・Auth専用）     |
| 認証                 | Supabase Auth（Google OAuth）                      |
| フォーム             | React Hook Form + Zod（予定）                      |
| 日付ピッカー         | @react-native-community/datetimepicker             |
| UIコンポーネント     | React Native 標準コンポーネント（StyleSheet）      |
| 日付操作             | date-fns                                           |
| プッシュ通知         | Expo Notifications                                 |

### 3.2 バックエンド

| 項目             | 採用技術                        |
| ---------------- | ------------------------------- |
| フレームワーク   | FastAPI 0.115.x                 |
| 言語             | Python 3.12                     |
| DBドライバ       | asyncpg（非同期PostgreSQL）     |
| ORM              | SQLAlchemy 2.0（async）         |
| マイグレーション | Alembic                         |
| 認証検証         | python-jose（JWT検証）          |
| バリデーション   | Pydantic v2                     |
| HTTP             | Uvicorn + Gunicorn              |
| テスト           | pytest + pytest-asyncio + httpx |

### 3.3 インフラ・DevOps

| 項目                     | 採用技術                                         |
| ------------------------ | ------------------------------------------------ |
| コンテナ                 | Docker + Docker Compose                          |
| DB                       | Supabase PostgreSQL（managed）                   |
| ストレージ               | Supabase Storage                                 |
| Auth / Realtime          | Supabase                                         |
| バックエンドホスティング | Railway（FastAPIコンテナのみ）                   |
| CI/CD                    | GitHub Actions + EAS（Expo）                     |
| 環境変数管理             | GitHub Secrets（CI） / Railway Variables（本番） |

---

## 4. 環境構成

### 4.1 環境一覧

| 環境           | 用途           | FastAPI                  | Supabase                         |
| -------------- | -------------- | ------------------------ | -------------------------------- |
| **local**      | 開発者ローカル | Docker Compose           | Supabase CLI（`supabase start`） |
| **staging**    | 動作確認・QA   | Railway（dev サービス）  | Supabase staging プロジェクト    |
| **production** | 本番公開       | Railway（prod サービス） | Supabase prod プロジェクト       |

> **ローカル開発のDB接続先について**:
> ローカルではSupabase CLIが立ち上げるPostgreSQL（localhost:54322）に接続する。
> FastAPIコンテナとSupabase CLIは同一マシン上で並走する。

### 4.2 ブランチ戦略

```
main ──────────────────────────── 本番デプロイ（タグリリース）
  │
develop ────────────────────────── stagingへ自動デプロイ
  │
feature/xxx ────────────────────── ローカル開発
```

### 4.3 Docker Compose 構成（ローカル）

```yaml
# docker-compose.yml（概略）
services:
  api:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@host.docker.internal:54322/postgres
      - SUPABASE_JWT_SECRET=...
    volumes:
      - ./backend:/app # ホットリロード


# Supabase はローカルでは supabase CLI で別途起動する
# $ supabase start
#   → API:      http://localhost:54321
#   → DB:       postgresql://localhost:54322
#   → Storage:  http://localhost:54321/storage/v1
```

### 4.4 環境変数

**バックエンド（FastAPI）**

```env
# DB接続（ローカルはSupabase CLI、staging/prodはSupabase managed PostgreSQL）
DATABASE_URL=postgresql+asyncpg://postgres:postgres@host.docker.internal:54322/postgres

# JWT検証（Supabase Project Settings > API > JWT Secret）
SUPABASE_JWT_SECRET=<Supabase JWT Secret>

# Storage署名付きURL生成用（Service Role Key）
SUPABASE_URL=<Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<Service Role Key>

ALLOWED_ORIGINS=http://localhost:8081,https://staging.daishere.app
ENVIRONMENT=local | staging | production
```

**モバイル（Expo）**

```env
# Supabase（Auth・Realtime・Storage に使用）
EXPO_PUBLIC_SUPABASE_URL=<Supabase URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase Anon Key>

# FastAPI（ビジネスロジックAPIに使用）
EXPO_PUBLIC_API_URL=http://localhost:8000 | https://api-staging.daishere.app
```

---

## 5. データベース設計（MVP）

### 5.1 ER図（概略）

```
lines ──── stations ──── carts ──────────── lender(users)
                │
                ├─── rental_requests ──── messages
                │           │
                │      reservations ─── reservation_carts ── carts
                │
                └─── reservations

users ──────┬── carts
            ├── rental_requests（lender / renter）
            ├── reservations（lender / renter）
            ├── notifications
            └── reviews（reviewer / reviewee）
```

### 5.2 テーブル定義

#### lines

| カラム     | 型          | 制約      | 説明   |
| ---------- | ----------- | --------- | ------ |
| id         | UUID        | PK        |        |
| name       | TEXT        | NOT NULL  | 路線名 |
| sort_order | INTEGER     | DEFAULT 0 |        |
| created_at | TIMESTAMPTZ | NOT NULL  |        |

> 駅を削除してもlinesレコードは残るため、路線マスタの整合性が保たれる。

#### stations

| カラム          | 型          | 制約                | 説明           |
| --------------- | ----------- | ------------------- | -------------- |
| id              | UUID        | PK                  |                |
| line_id         | UUID        | FK(lines), NOT NULL | 路線ID         |
| name            | TEXT        | NOT NULL            | 駅名           |
| prefecture_code | TEXT        | NOT NULL            | 都道府県コード |
| municipality    | TEXT        | NOT NULL            | 市区町村       |
| sort_order      | INTEGER     | DEFAULT 0           |                |
| created_at      | TIMESTAMPTZ | NOT NULL            |                |

#### users

| カラム               | 型          | 制約               | 説明                                                 |
| -------------------- | ----------- | ------------------ | ---------------------------------------------------- |
| id                   | UUID        | PK                 | Supabase Auth の `auth.users.id` と同一              |
| name                 | TEXT        | NOT NULL           | ユーザー名                                           |
| email                | TEXT        | UNIQUE, NOT NULL   | メールアドレス                                       |
| google_id            | TEXT        | UNIQUE             | Google OAuth ID                                      |
| bio                  | TEXT        |                    | 自己紹介                                             |
| station_id           | UUID        | FK(stations)       | 活動拠点駅                                           |
| lend_location_detail | TEXT        |                    | 貸出場所の詳細（例：〇〇駅北口のコインパーキング前） |
| user_type            | TEXT        | DEFAULT 'borrower' | 'borrower' / 'lender'                                |
| avatar_url           | TEXT        |                    | プロフィール画像URL                                  |
| push_token           | TEXT        |                    | Expo Push Token                                      |
| created_at           | TIMESTAMPTZ | NOT NULL           |                                                      |
| deleted_at           | TIMESTAMPTZ |                    | 論理削除                                             |

#### carts

| カラム      | 型          | 制約                | 説明                                       |
| ----------- | ----------- | ------------------- | ------------------------------------------ |
| id          | SERIAL      | PK                  |                                            |
| owner_id    | UUID        | FK(users), NOT NULL | 貸主ユーザーID                             |
| title       | VARCHAR(200)| NOT NULL            | 台車タイトル                               |
| description | TEXT        |                     | 説明                                       |
| daily_rate  | NUMERIC(10) | NOT NULL            | 日額（円）                                 |
| quantity    | INTEGER     | DEFAULT 1, NOT NULL | 台数                                       |
| image_urls  | TEXT[]      | DEFAULT '{}'        | 画像URL一覧                                |
| station_id  | INTEGER     | FK(stations)        | 貸出拠点駅                                 |
| status      | cart_status | DEFAULT 'active'    | active / inactive / deleted（論理削除）    |

**ステータス enum:** `active`（公開中）/ `inactive`（非公開）/ `deleted`（論理削除）

#### rental_requests

| カラム     | 型               | 制約                 | 説明                                          |
| ---------- | ---------------- | -------------------- | --------------------------------------------- |
| id         | SERIAL           | PK                   |                                               |
| cart_id    | INTEGER          | FK(carts), NOT NULL  | 対象台車                                      |
| renter_id  | UUID             | FK(users), NOT NULL  | 借主ユーザーID                                |
| quantity   | INTEGER          | DEFAULT 1, NOT NULL  | 希望台数                                      |
| start_date | TIMESTAMPTZ      | NOT NULL             | 貸出開始日時                                  |
| end_date   | TIMESTAMPTZ      | NOT NULL             | 返却日時                                      |
| message    | TEXT             |                      | 借主からのメッセージ                          |
| status     | request_status   | DEFAULT 'pending'    | pending / accepted / rejected / cancelled     |
| created_at | TIMESTAMPTZ      | server default now() |                                               |

**ステータス enum:** `pending`（承認待ち）/ `accepted`（承認済み）/ `rejected`（拒否）/ `cancelled`（キャンセル）

#### messages

| カラム     | 型          | 制約                          | 説明 |
| ---------- | ----------- | ----------------------------- | ---- |
| id         | UUID        | PK                            |      |
| request_id | UUID        | FK(rental_requests), NOT NULL |      |
| sender_id  | UUID        | FK(users), NOT NULL           |      |
| body       | TEXT        | NOT NULL                      |      |
| is_read    | BOOLEAN     | DEFAULT false                 |      |
| is_system  | BOOLEAN     | DEFAULT false                 |      |
| created_at | TIMESTAMPTZ | NOT NULL                      |      |

#### reservations

| カラム              | 型          | 制約                          | 説明                                   |
| ------------------- | ----------- | ----------------------------- | -------------------------------------- |
| id                  | UUID        | PK                            |                                        |
| rental_request_id   | UUID        | FK(rental_requests), NOT NULL |                                        |
| lender_id           | UUID        | FK(users), NOT NULL           |                                        |
| renter_id           | UUID        | FK(users), NOT NULL           |                                        |
| station_id          | UUID        | FK(stations), NOT NULL        |                                        |
| start_at            | TIMESTAMPTZ | NOT NULL                      |                                        |
| end_at              | TIMESTAMPTZ | NOT NULL                      |                                        |
| confirmed_count     | INTEGER     | NOT NULL                      |                                        |
| confirmed_price_jpy | INTEGER     | NOT NULL                      |                                        |
| lend_at             | TIMESTAMPTZ |                               | 実際の貸出日時                         |
| return_at           | TIMESTAMPTZ |                               | 実際の返却日時                         |
| note                | TEXT        |                               |                                        |
| status              | TEXT        | DEFAULT 'RESERVED'            | RESERVED / LENT / RETURNED / CANCELLED |
| cancel_reason       | TEXT        |                               |                                        |
| created_at          | TIMESTAMPTZ | NOT NULL                      |                                        |

#### reservation_carts

| カラム         | 型          | 制約                       | 説明 |
| -------------- | ----------- | -------------------------- | ---- |
| id             | UUID        | PK                         |      |
| reservation_id | UUID        | FK(reservations), NOT NULL |      |
| cart_id        | UUID        | FK(carts), NOT NULL        |      |
| created_at     | TIMESTAMPTZ | NOT NULL                   |      |

**制約:** `(reservation_id, cart_id)` UNIQUE

#### reviews

| カラム         | 型          | 制約                       | 説明                 |
| -------------- | ----------- | -------------------------- | -------------------- |
| id             | UUID        | PK                         |                      |
| reservation_id | UUID        | FK(reservations), NOT NULL |                      |
| reviewer_id    | UUID        | FK(users), NOT NULL        | 評価者               |
| reviewee_id    | UUID        | FK(users), NOT NULL        | 被評価者             |
| rating         | INTEGER     | CHECK(1-3), NOT NULL       | 1:悪い 2:普通 3:良い |
| comment        | TEXT        | DEFAULT ''                 |                      |
| created_at     | TIMESTAMPTZ | NOT NULL                   |                      |
| updated_at     | TIMESTAMPTZ | NOT NULL                   |                      |

**制約:** `(reservation_id, reviewer_id)` UNIQUE（1予約につき1人1回のみ評価可）  
**制限:** 返却済み（RETURNED）の予約に対してのみ作成可。更新・削除不可。

#### notifications

| カラム     | 型          | 制約                | 説明                  |
| ---------- | ----------- | ------------------- | --------------------- |
| id         | UUID        | PK                  |                       |
| user_id    | UUID        | FK(users), NOT NULL |                       |
| type       | TEXT        | NOT NULL            | 下記参照              |
| title      | TEXT        | NOT NULL            |                       |
| body       | TEXT        | NOT NULL            |                       |
| related_id | UUID        |                     | リクエストID / 予約ID |
| is_read    | BOOLEAN     | DEFAULT false       |                       |
| created_at | TIMESTAMPTZ | NOT NULL            |                       |

**通知タイプ:**

```
REQUEST_RECEIVED    貸主：リクエスト受信
REQUEST_ACCEPTED    借主：リクエスト承認
REQUEST_REJECTED    借主：リクエスト拒否
REQUEST_CANCELLED   相手：キャンセル通知
MESSAGE_RECEIVED    メッセージ受信
LEND_STARTED        借主：貸出開始
RETURNED            貸主：返却完了
REVIEW_RECEIVED     相手：レビュー受信
REMINDER_LEND_START 貸主・借主：貸出開始時間リマインド
REMINDER_RETURN     貸主・借主：返却時間リマインド
```

### 5.3 ステータス遷移

```
rental_requests:
  REQUEST ──[承認]──► ACCEPTED ──[予約自動作成]
          ──[拒否]──► REJECTED
          ──[取消]──► CANCELLED

reservations:
  RESERVED ──[貸出]──► LENT ──[返却]──► RETURNED ──[評価]──► reviews 作成
           ──[取消]──► CANCELLED
```

---

## 6. API設計（FastAPI）

**ベースURL:** `https://api.daishere.app/v1`  
**認証:** `Authorization: Bearer <Supabase JWT>`

> モバイルアプリは Supabase Auth でログイン後に取得した JWT を、
> FastAPI へのすべてのリクエストヘッダーに付与する。
> FastAPI は JWT を検証してユーザーIDを特定する。

### 6.1 エンドポイント一覧

#### Auth / Users

| Method | Path                   | 説明                                                                  |
| ------ | ---------------------- | --------------------------------------------------------------------- |
| POST   | `/auth/sync`           | Supabaseログイン後のユーザー情報同期（usersテーブルへの初回登録含む） |
| GET    | `/users/me`            | 自分のプロフィール取得                                                |
| PUT    | `/users/me`            | プロフィール更新                                                      |
| PUT    | `/users/me/push-token` | Expo Push Token 登録・更新                                            |

#### Stations

| Method | Path                       | 説明                                       |
| ------ | -------------------------- | ------------------------------------------ |
| GET    | `/stations`                | 駅一覧取得（?municipality=xxx でフィルタ） |
| GET    | `/stations/municipalities` | 市区町村一覧取得                           |

#### Carts

| Method | Path               | 説明                                           |
| ------ | ------------------ | ---------------------------------------------- |
| GET    | `/carts`           | 台車検索（?municipality=xxx, ?station_id=xxx） |
| GET    | `/carts/mine`      | 自分の台車一覧                                 |
| GET    | `/carts/{cart_id}` | 台車詳細                                       |
| POST   | `/carts`           | 台車登録（貸主のみ）                           |
| PUT    | `/carts/{cart_id}` | 台車更新（貸主・自分のもののみ）               |
| DELETE | `/carts/{cart_id}` | 台車削除（論理削除）                           |

#### Rental Requests

| Method | Path                           | 説明                             |
| ------ | ------------------------------ | -------------------------------- |
| GET    | `/rental-requests`             | リクエスト一覧（自分関係のもの） |
| GET    | `/rental-requests/{id}`        | リクエスト詳細                   |
| POST   | `/rental-requests`             | リクエスト送信（借主のみ）       |
| POST   | `/rental-requests/{id}/accept` | 承認（貸主のみ）→ 予約自動作成   |
| POST   | `/rental-requests/{id}/reject` | 拒否（貸主のみ）                 |
| POST   | `/rental-requests/{id}/cancel` | キャンセル（当事者）             |

#### Messages

| Method | Path                                  | 説明           |
| ------ | ------------------------------------- | -------------- |
| GET    | `/rental-requests/{id}/messages`      | メッセージ一覧 |
| POST   | `/rental-requests/{id}/messages`      | メッセージ送信 |
| POST   | `/rental-requests/{id}/messages/read` | 既読更新       |

#### Reservations

| Method | Path                        | 説明                 |
| ------ | --------------------------- | -------------------- |
| GET    | `/reservations`             | 予約一覧             |
| GET    | `/reservations/{id}`        | 予約詳細             |
| POST   | `/reservations/{id}/lend`   | 貸出開始（貸主のみ） |
| POST   | `/reservations/{id}/return` | 返却完了（貸主のみ） |
| POST   | `/reservations/{id}/cancel` | キャンセル（当事者） |

#### Reviews

| Method | Path                         | 説明                                  |
| ------ | ---------------------------- | ------------------------------------- |
| POST   | `/reservations/{id}/reviews` | レビュー投稿（返却済みのみ・1回限り） |
| GET    | `/users/{user_id}/reviews`   | ユーザーへのレビュー一覧              |

#### Notifications

| Method | Path                       | 説明     |
| ------ | -------------------------- | -------- |
| GET    | `/notifications`           | 通知一覧 |
| POST   | `/notifications/{id}/read` | 既読     |
| POST   | `/notifications/read-all`  | 全件既読 |
| DELETE | `/notifications/{id}`      | 通知削除 |

### 6.2 共通レスポンス形式

```json
// 成功
{
  "data": { ... },
  "message": "success"
}

// エラー
{
  "detail": "エラーメッセージ",
  "code": "ERROR_CODE"
}
```

### 6.3 主要APIの詳細

#### POST `/rental-requests/{id}/accept`

リクエスト承認と同時に予約を自動作成する。

```
処理フロー:
1. rental_requests.status を ACCEPTED に更新
2. reservations を作成（start_at / end_at / confirmed_price_jpy をリクエストから引き継ぎ）
3. システムメッセージを messages に作成
4. 借主への通知（REQUEST_ACCEPTED）を notifications に作成
5. Expo Push Notification を送信
```

#### POST `/reservations/{id}/lend`

```
処理フロー:
1. reservations.status を LENT に更新
2. reservations.lend_at = now()
3. システムメッセージ作成
4. 借主への通知（LEND_STARTED）作成・送信
```

#### POST `/reservations/{id}/return`

```
処理フロー:
1. reservations.status を RETURNED に更新
2. reservations.return_at = now()
3. システムメッセージ作成
4. 貸主への通知（RETURNED）作成・送信
```

#### POST `/reservations/{id}/reviews`

```
処理フロー:
1. reservations.status が RETURNED であることを確認
2. すでにレビュー済みでないことを確認（(reservation_id, reviewer_id) の重複チェック）
3. reviews を作成（reviewee_id は相手ユーザー）
4. 相手への通知（REVIEW_RECEIVED）作成・送信
```

---

## 7. 画面設計

### 7.1 ナビゲーション構造

```
(未認証)
  └── /auth/login          Google ログイン画面

(認証済み・Bottom Tab 5タブ)
  ├── / (index)            ホーム（メルカリ風 台車グリッド一覧 + 検索バー）
  ├── /reservations        予約一覧（受信/送信タブ、リクエスト承認・拒否）
  ├── /messages            メッセージ（進行中スレッド一覧）
  ├── /schedule            スケジュール（今後/過去の予約一覧）
  └── /carts               台車管理（自分の台車一覧・登録FAB）

  ヘッダー右アイコン（全タブ共通）
  ├── 🔔 通知アイコン（未読バッジ付き） → /notifications
  └── 👤 プロフィールアイコン          → /profile（モーダル）

(スタック画面)
  ├── /search/[lender_id]  貸主詳細・台車一覧・リクエスト送信
  ├── /carts/new           台車登録フォーム
  ├── /carts/[id]/edit     台車編集フォーム
  ├── /requests/[id]       チャット・取引詳細（承認/拒否/貸出/返却/レビューボタン）
  ├── /notifications       通知一覧・既読管理
  └── /profile             プロフィール編集（モーダル）
```

### 7.2 画面一覧

| 画面           | ロール | 主な機能                                         |
| -------------- | ------ | ------------------------------------------------ |
| ログイン       | 全員   | Googleでログイン                                 |
| 台車検索       | 借主   | 市区町村・駅で検索、貸主カード表示               |
| 貸主詳細       | 借主   | 貸主プロフィール・台車一覧・リクエスト送信       |
| 台車管理       | 貸主   | 自分の台車一覧                                   |
| 台車登録・編集 | 貸主   | 台車情報・画像の入力                             |
| リクエスト一覧 | 両方   | 送受信リクエスト一覧、ステータス別表示           |
| メッセージ     | 両方   | チャット、承認/拒否/取消、貸出/返却ボタン        |
| スケジュール   | 両方   | 今後7日間 + 一覧で予定確認                       |
| 通知一覧       | 両方   | 通知一覧・既読管理                               |
| プロフィール   | 両方   | 名前・自己紹介・拠点駅・貸出場所詳細・タイプ変更 |
| レビュー投稿   | 両方   | 返却後に相手を評価（モーダル）                   |

---

## 8. ディレクトリ構造

```
cart-rental-ios/
├── docs/
│   └── design.md               # 本ドキュメント
│
├── mobile/                     # Expo アプリ
│   ├── app/                    # Expo Router（画面）
│   │   ├── (auth)/
│   │   │   └── login.tsx
│   │   ├── (tabs)/
│   │   │   ├── index.tsx          # ホーム（メルカリ風グリッド）
│   │   │   ├── reservations.tsx   # 予約一覧（リクエスト受信/送信）
│   │   │   ├── messages.tsx       # メッセージスレッド一覧
│   │   │   ├── schedule.tsx       # スケジュール（確定予約）
│   │   │   ├── carts.tsx          # 台車管理
│   │   │   ├── profile.tsx        # プロフィール（非表示・/profileへ移動）
│   │   │   └── _layout.tsx
│   │   ├── carts/
│   │   │   ├── index.tsx       # 自分の台車一覧
│   │   │   ├── new.tsx         # 台車登録
│   │   │   └── [id]/edit.tsx   # 台車編集
│   │   ├── search/
│   │   │   ├── index.tsx       # 台車検索
│   │   │   └── [lender_id].tsx # 貸主詳細・リクエスト送信
│   │   ├── requests/
│   │   │   └── index.tsx       # リクエスト一覧（送信/受信タブ）
│   │   └── _layout.tsx
│   ├── components/             # 共通コンポーネント
│   │   ├── CartForm.tsx        # 台車登録・編集フォーム（インラインバリデーション）
│   │   └── ScreenState.tsx     # LoadingScreen / ErrorScreen / EmptyScreen
│   ├── hooks/
│   │   └── usePushNotifications.ts  # 権限リクエスト・プッシュトークン登録・タップ遷移
│   ├── store/                  # Zustand ストア
│   │   └── authStore.ts
│   ├── lib/
│   │   ├── api.ts              # Axios クライアント（FastAPI用）
│   │   ├── supabase.ts         # Supabase クライアント（Auth・Realtime・Storage用）
│   │   └── types.ts            # 共通型定義（Cart / RentalRequest等）
│   ├── .env.local
│   ├── .env.staging
│   ├── eas.json
│   └── package.json
│
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py       # 環境変数
│   │   │   ├── database.py     # DB接続
│   │   │   └── auth.py         # JWT検証ミドルウェア
│   │   ├── models/             # SQLAlchemy モデル
│   │   ├── schemas/            # Pydantic スキーマ
│   │   ├── routers/            # APIルーター
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── carts.py
│   │   │   ├── rental_requests.py
│   │   │   ├── messages.py
│   │   │   ├── reservations.py
│   │   │   ├── reviews.py
│   │   │   └── notifications.py
│   │   └── services/           # ビジネスロジック
│   │       ├── notification_service.py  # 全イベント通知 + Expo Push
│   │       └── reminder_service.py      # APScheduler: 貸出・返却60分前リマインド
│   ├── alembic/                # DBマイグレーション
│   ├── tests/                  # pytest (PostgreSQL test_daishare スキーマ)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── docker-compose.yml          # ローカル開発用
├── docker-compose.prod.yml     # 本番参照用
└── .github/
    └── workflows/
        ├── backend-ci.yml      # テスト・Lint
        ├── backend-deploy.yml  # Railway デプロイ
        └── mobile-build.yml    # EAS ビルド
```

---

## 9. CI/CDパイプライン

### 9.1 バックエンド

```
Pull Request → GitHub Actions
  ├── pytest（ユニット・統合テスト）
  ├── ruff（Lintチェック）
  └── mypy（型チェック）

develop マージ → Railway staging へ自動デプロイ
main マージ（タグ付き）→ Railway production へ自動デプロイ
```

### 9.2 モバイル

```
Pull Request → GitHub Actions
  ├── TypeScript チェック
  └── ESLint

develop マージ → EAS Build（Preview）
  └── TestFlight (iOS) / Internal Testing (Android) 配布

main タグ → EAS Build（Production）
  └── App Store / Play Store 申請
```

### 9.3 DBマイグレーション

```
backend/alembic/ でマイグレーションファイルを管理
デプロイ時に自動実行:
  alembic upgrade head
```

---

## 10. セキュリティ設計

### 10.1 認証・認可

- すべてのAPIリクエストで Supabase JWT を検証
- JWTの `sub`（= user_id）でリクエストユーザーを特定
- リソースのオーナーチェックはAPI層で実施（SQLクエリの WHERE 句で制御）

### 10.2 データアクセス制御ポリシー

| リソース         | 閲覧               | 作成                   | 更新       | 削除     |
| ---------------- | ------------------ | ---------------------- | ---------- | -------- |
| users            | 全員（削除済除く） | 自動（Auth連携）       | 本人のみ   | 不可     |
| stations / lines | 全員               | 管理者のみ             | 管理者のみ | 不可     |
| carts            | 公開中は全員       | 貸主のみ               | 本人のみ   | 本人のみ |
| rental_requests  | 当事者のみ         | 借主のみ               | 当事者のみ | 不可     |
| messages         | 当事者のみ         | 当事者のみ             | 不可       | 不可     |
| reservations     | 当事者のみ         | システム（承認時）     | 貸主のみ   | 不可     |
| reviews          | 関係者のみ         | 当事者（返却済みのみ） | 不可       | 不可     |
| notifications    | 本人のみ           | システムのみ           | 本人のみ   | 本人のみ |

### 10.3 RLS（Row Level Security）設計

**FastAPI経由のアクセス（REST API）**

- FastAPIはSupabaseに **Service Role Key** で接続するためRLSをバイパスする
- **アクセス制御はFastAPI層で完全に実施する**（WHEREクエリ・オーナーチェック）

**モバイルアプリからの直接アクセス（Realtime・Storage）**

- モバイルは **Anon Key** で接続するためRLSが適用される
- Realtimeのメッセージ購読・Storage画像アクセスにRLSポリシーを設定する

| テーブル/バケット        | RLS設定対象        | ポリシー概要                           |
| ------------------------ | ------------------ | -------------------------------------- |
| messages                 | Realtime購読       | request_idの当事者のみ購読可           |
| notifications            | Realtime購読       | user_idが本人のみ購読可                |
| cart-images（Storage）   | 閲覧・アップロード | 閲覧は全員、アップロードは貸主本人のみ |
| avatar-images（Storage） | 閲覧・アップロード | 閲覧は全員、アップロードは本人のみ     |

---

## 11. プッシュ通知設計

### 11.1 フロー

```
1. ユーザーがアプリ起動時に通知権限を取得
2. Expo Push Token を取得し、PUT /users/me/push-token で保存
3. サーバー側イベント発生時（承認・メッセージ等）
4. FastAPI の notification_service が Expo Push API を呼び出す
5. デバイスに通知が届く
```

### 11.2 通知トリガー一覧

| イベント                    | 送信先     | 通知タイプ          |
| --------------------------- | ---------- | ------------------- |
| リクエスト受信              | 貸主       | REQUEST_RECEIVED    |
| リクエスト承認              | 借主       | REQUEST_ACCEPTED    |
| リクエスト拒否              | 借主       | REQUEST_REJECTED    |
| キャンセル                  | 相手方     | REQUEST_CANCELLED   |
| メッセージ受信              | 相手方     | MESSAGE_RECEIVED    |
| 貸出開始                    | 借主       | LEND_STARTED        |
| 返却完了                    | 貸主       | RETURNED            |
| レビュー投稿                | 相手方     | REVIEW_RECEIVED     |
| 貸出開始N分前（定期バッチ） | 貸主・借主 | REMINDER_LEND_START |
| 返却時刻N分前（定期バッチ） | 貸主・借主 | REMINDER_RETURN     |

> **リマインドの実装方針**: FastAPI側でAPScheduler（または Railway Cron）を使い、
> 定期的に `reservations` を検索して対象者にプッシュ通知を送信する。
> リマインドの送信タイミングは将来的にユーザー設定で変更できるよう `users` テーブルに
> カラム追加（MVP後対応）。現時点は固定値（貸出60分前・返却60分前）。

---

## 12. 開発フェーズ計画

| Phase       | 期間   | 内容                                                            |
| ----------- | ------ | --------------------------------------------------------------- |
| **Phase 0** | 1〜2日 | 環境構築（Docker, Supabase CLI, Expo, GitHub Actions, Railway） |
| **Phase 1** | 1週間  | 認証・ユーザー登録・プロフィール                                |
| **Phase 2** | 2週間  | 台車CRUD・検索・リクエスト送受信                                |
| **Phase 3** | 2週間  | メッセージ・承認フロー・予約管理                                |
| **Phase 4** | 1週間  | スケジュール・通知・プッシュ通知                                |
| **Phase 5** | 1週間  | テスト・UI調整・App Store申請準備                               |
