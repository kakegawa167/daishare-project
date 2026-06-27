# ダイシェア モバイルアプリ 設計書

> バージョン: 2.7.0  
> 作成日: 2026-06-23  
> 最終更新: 2026-06-28  
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
│  ホスティング:Render │      │  ・PostgreSQL（DB本体）      │
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
> - FastAPIのホスティングはRender（無料プラン）、DBはSupabase管理のPostgreSQLを使用する

### 2.1 各コンポーネントの役割

| コンポーネント          | 役割                                                             |
| ----------------------- | ---------------------------------------------------------------- |
| **Expo (React Native)** | モバイルUI、画面遷移、状態管理                                   |
| **FastAPI（Render）**   | ビジネスロジック、APIエンドポイント、JWT検証                     |
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
5. 相手がチャットを開くと POST /messages/read で is_read=true に更新
6. Supabase Realtime が UPDATE を検知し、送信者に既読を通知
7. 送信者の画面で最後の既読メッセージに「既読」を表示

※ messages テーブル: REPLICA IDENTITY FULL + supabase_realtime publication 設定済み
※ Realtime 未達時のフォールバック: 5秒ポーリングで補完
※ モバイルアプリは INSERT と UPDATE の両方を同一チャンネルで購読する
```

### 2.4 プッシュ通知フロー

```
1. FastAPI がイベント発生時に notification_service を呼び出す
2. notification_service が Expo Push API へ送信（ExponentPushToken）
3. Expo が APNs / FCM 経由でデバイスへ配信
4. 通知データに type フィールドを含める:
   - request_received → 予約一覧（リクエスト受信タブ）へ遷移
   - message_received / request_accepted / その他 → チャット画面へ遷移
5. アプリがキルド状態の場合は getLastNotificationResponseAsync で初回起動時に処理
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
| ローカル永続化       | AsyncStorage（通知設定など）                       |
| UIコンポーネント     | React Native 標準コンポーネント（StyleSheet）      |
| 日付操作             | date-fns                                           |
| プッシュ通知         | Expo Notifications                                 |
| 画像選択             | expo-image-picker（Dev Build必須・動的import）     |

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
| コンテナ                 | Docker + Docker Compose                                                     |
| DB                       | Supabase PostgreSQL（managed、Pro プラン）                                   |
| ストレージ               | Supabase Storage（avatars / cart-images バケット）                           |
| Auth / Realtime          | Supabase                                                                     |
| バックエンドホスティング | Render（無料プラン）                                                          |
| スリープ防止             | UptimeRobot（5分間隔 `/health` 監視、staging / production 両方）             |
| CI/CD                    | GitHub Actions + EAS（Expo）                                                 |
| 環境変数管理             | GitHub Secrets（CI） / Render Environment Variables（staging / production）  |
| DB 接続（Render）        | Supabase IPv4 接続プーラー（`aws-1-ap-southeast-1.pooler.supabase.com:5432`）|

---

## 4. 環境構成

### 4.1 環境一覧

| 環境           | 用途           | FastAPI                                          | Supabase                                        | モバイル env ファイル |
| -------------- | -------------- | ------------------------------------------------ | ----------------------------------------------- | --------------------- |
| **local**      | 開発者ローカル | Docker Compose（`http://192.168.X.X:8000`）      | `daishare-staging`（Supabase CLI または直接接続）| `.env.local`          |
| **staging**    | 動作確認・QA   | Render `daishare-api-staging`（develop ブランチ）| `daishare-staging`                              | `.env.staging`        |
| **production** | 本番公開       | Render `daishare-api`（main ブランチ）           | `daishare-production`（Pro）                    | `.env.production`     |

### 4.2 ブランチ戦略

```
feature/xxx ──→ develop ──→ main
               (staging)   (production)

- feature/xxx: ローカル開発
- develop: daishare-api-staging へ自動デプロイ
- main: daishare-api（production）へ自動デプロイ
```

### 4.3 Docker Compose 構成（ローカル）

```yaml
services:
  api:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@host.docker.internal:54322/postgres
      - SUPABASE_JWT_SECRET=...
    volumes:
      - ./backend:/app

# Supabase はローカルでは supabase CLI で別途起動
# $ supabase start
```

### 4.4 環境変数

**バックエンド（FastAPI）**

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@host.docker.internal:54322/postgres
SUPABASE_JWT_SECRET=<Supabase JWT Secret>
SUPABASE_URL=<Supabase Project URL>
SUPABASE_SERVICE_ROLE_KEY=<Service Role Key>
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006,exp://localhost:8081
ENVIRONMENT=local | staging | production
```

**モバイル（Expo）— `.env.local` / `.env.staging` / `.env.production`**

```env
EXPO_PUBLIC_SUPABASE_URL=<Supabase Project URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase Anon Key>
EXPO_PUBLIC_API_URL=<FastAPI URL>
# local:      http://192.168.X.X:8000
# staging:    https://daishare-api-staging.onrender.com
# production: https://daishare-api.onrender.com
```

> **注意**: `.env.staging` / `.env.production` は `.gitignore` で除外済み（シークレットを含むため）

---

## 5. データベース設計（MVP）

### 5.1 ER図（概略）

```
lines ──── stations ──── carts ──── cart_locations ──── stations
                │           │
                │     (owner: users)
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

#### stations

| カラム          | 型          | 制約                | 説明           |
| --------------- | ----------- | ------------------- | -------------- |
| id              | INTEGER     | PK（SERIAL）        |                |
| line_id         | UUID        | FK(lines), NOT NULL | 路線ID         |
| name            | TEXT        | NOT NULL            | 駅名           |
| prefecture_code | TEXT        | NOT NULL            | 都道府県コード |
| municipality    | TEXT        | NOT NULL            | 市区町村       |
| sort_order      | INTEGER     | DEFAULT 0           |                |
| created_at      | TIMESTAMPTZ | NOT NULL            |                |

#### users

| カラム          | 型          | 制約             | 説明                                        |
| --------------- | ----------- | ---------------- | ------------------------------------------- |
| id              | UUID        | PK               | Supabase Auth の `auth.users.id` と同一     |
| display_name    | VARCHAR(100)| NOT NULL         | 表示名（アプリ上では「名前」と表示）        |
| email           | VARCHAR(255)| UNIQUE, NOT NULL | メールアドレス                              |
| bio             | TEXT        |                  | 自己紹介                                    |
| avatar_url      | TEXT        |                  | プロフィール画像URL（Supabase Storage）     |
| user_type       | user_type   | DEFAULT 'renter' | 'renter'（借主）/ 'lender'（貸主）/ 'both'  |
| expo_push_token | VARCHAR(255)|                  | Expo Push Token                             |
| base_station_id | INTEGER     | FK(stations)     | 拠点駅（将来の拡張用）                      |
| lending_address | TEXT        |                  | 貸出場所詳細（将来の拡張用）                |
| is_active       | BOOLEAN     | DEFAULT true     | アカウント有効フラグ                        |

#### carts

| カラム          | 型           | 制約                | 説明                                          |
| --------------- | ------------ | ------------------- | --------------------------------------------- |
| id              | SERIAL       | PK                  |                                               |
| owner_id        | UUID         | FK(users), NOT NULL | 貸主ユーザーID                                |
| title           | VARCHAR(200) | NOT NULL            | 台車タイトル                                  |
| category        | cart_category|                     | カテゴリ（任意）                              |
| description     | TEXT         |                     | 説明（備考）                                  |
| weight_kg       | NUMERIC      |                     | 重量(kg)                                      |
| max_load_kg     | NUMERIC      |                     | 最大積載量(kg)                                |
| width_cm        | NUMERIC      |                     | 横幅(cm)                                      |
| length_cm       | NUMERIC      |                     | 奥行(cm)                                      |
| foldable        | BOOLEAN      | DEFAULT false        | 折りたたみ可能か                              |
| daily_rate      | NUMERIC      |                     | 日額（円）                                    |
| weekly_rate     | NUMERIC      |                     | 週額（円）                                    |
| per_rental_rate | NUMERIC      |                     | 1回あたり（円）                               |
| quantity        | INTEGER      | DEFAULT 1, NOT NULL | 台数                                          |
| station_id      | INTEGER      | FK(stations)        | 貸出拠点駅（必須）                            |
| lending_address | TEXT         |                     | 貸出場所の詳細                                |
| image_urls      | TEXT[]       | DEFAULT '{}'        | 画像URL一覧                                   |
| status          | cart_status  | DEFAULT 'active'    | active / inactive / deleted（論理削除）       |
| created_at      | TIMESTAMPTZ  | NOT NULL            |                                               |

**ステータス enum:**
- `active`（公開中）: 検索結果に表示される
- `inactive`（非公開）: 自分の管理画面にのみ表示
- `deleted`（論理削除）: 表示されない

**価格バリデーション:** `daily_rate` / `weekly_rate` / `per_rental_rate` のうち少なくとも1つは必須。

#### cart_locations

> 台車の貸出拠点を複数登録するためのテーブル。1台車 → N拠点。

| カラム          | 型          | 制約                | 説明                               |
| --------------- | ----------- | ------------------- | ---------------------------------- |
| id              | SERIAL      | PK                  |                                    |
| cart_id         | INTEGER     | FK(carts), NOT NULL | 対象台車                           |
| station_id      | INTEGER     | FK(stations)        | 貸出拠点駅                         |
| lending_address | TEXT        |                     | 貸出場所の詳細住所                 |
| sort_order      | INTEGER     | DEFAULT 0           | 表示順                             |
| created_at      | TIMESTAMPTZ | server default now()|                                    |

> `carts.station_id` / `carts.lending_address` は後方互換のため残存。`cart_locations` が登録されている場合はそちらが優先される。

#### rental_requests

| カラム     | 型             | 制約                 | 説明                                                      |
| ---------- | -------------- | -------------------- | --------------------------------------------------------- |
| id         | SERIAL         | PK                   |                                                           |
| cart_id    | INTEGER        | FK(carts), NOT NULL  | 対象台車                                                  |
| renter_id  | UUID           | FK(users), NOT NULL  | 借主ユーザーID                                            |
| quantity   | INTEGER        | DEFAULT 1, NOT NULL  | 希望台数                                                  |
| start_date | TIMESTAMPTZ    | NULL許可             | 貸出開始日時（inquiry 時は NULL）                         |
| end_date   | TIMESTAMPTZ    | NULL許可             | 返却日時（inquiry 時は NULL）                             |
| message    | TEXT           |                      | 借主からのメッセージ                                      |
| status     | request_status | DEFAULT 'pending'    | inquiry / pending / accepted / rejected / cancelled       |
| created_at | TIMESTAMPTZ    | server default now() |                                                           |

**request_status enum:**
- `inquiry`: 日程未定の問い合わせ（メッセージスレッドのみ作成）
- `pending`: 日程確定済みリクエスト・承認待ち
- `accepted`: 承認済み（reservationが存在する）
- `rejected`: 拒否
- `cancelled`: キャンセル

#### messages

| カラム             | 型          | 制約                          | 説明                             |
| ------------------ | ----------- | ----------------------------- | -------------------------------- |
| id                 | SERIAL      | PK                            |                                  |
| rental_request_id  | INTEGER     | FK(rental_requests), NOT NULL |                                  |
| sender_id          | UUID        | FK(users), NOT NULL           |                                  |
| body               | TEXT        | NOT NULL                      |                                  |
| is_read            | BOOLEAN     | DEFAULT false                 |                                  |
| is_system          | BOOLEAN     | DEFAULT false                 | システム通知メッセージか         |
| created_at         | TIMESTAMPTZ | NOT NULL                      |                                  |

> **Realtime設定**: `REPLICA IDENTITY FULL` + `supabase_realtime` publication 登録済み（UPDATE イベントも配信可能）

#### reservations

| カラム            | 型                  | 制約                                | 説明                                     |
| ----------------- | ------------------- | ----------------------------------- | ---------------------------------------- |
| id                | SERIAL              | PK                                  |                                          |
| rental_request_id | INTEGER             | FK(rental_requests), NOT NULL, UNIQUE | 1リクエスト→1予約（1:1）               |
| lender_id         | UUID                | FK(users), NOT NULL                 |                                          |
| renter_id         | UUID                | FK(users), NOT NULL                 |                                          |
| start_date        | TIMESTAMPTZ         | NOT NULL                            | 貸出開始日時                             |
| end_date          | TIMESTAMPTZ         | NOT NULL                            | 返却予定日時                             |
| quantity          | INTEGER             | NOT NULL                            | 確定台数                                 |
| daily_rate        | NUMERIC(10,0)       | NOT NULL                            | 確定日額（円）                           |
| lent_at           | TIMESTAMPTZ         |                                     | 実際の貸出日時                           |
| returned_at       | TIMESTAMPTZ         |                                     | 実際の返却日時                           |
| note              | TEXT                |                                     | 備考                                     |
| status            | reservation_status  | DEFAULT 'reserved'                  | reserved / lent / returned / cancelled   |
| created_at        | TIMESTAMPTZ         | server default now()                |                                          |

#### reservation_carts

| カラム         | 型          | 制約                       | 説明 |
| -------------- | ----------- | -------------------------- | ---- |
| id             | SERIAL      | PK                         |      |
| reservation_id | INTEGER     | FK(reservations), NOT NULL |      |
| cart_id        | INTEGER     | FK(carts), NOT NULL        |      |
| created_at     | TIMESTAMPTZ | server default now()       |      |

**制約:** `(reservation_id, cart_id)` UNIQUE

#### reviews

| カラム         | 型          | 制約                       | 説明                 |
| -------------- | ----------- | -------------------------- | -------------------- |
| id             | SERIAL      | PK                         |                      |
| reservation_id | INTEGER     | FK(reservations), NOT NULL |                      |
| reviewer_id    | UUID        | FK(users), NOT NULL        | 評価者               |
| reviewee_id    | UUID        | FK(users), NOT NULL        | 被評価者             |
| rating         | INTEGER     | CHECK(1-3), NOT NULL       | 1:悪い 2:普通 3:良い |
| comment        | TEXT        | DEFAULT ''                 |                      |
| created_at     | TIMESTAMPTZ | server default now()       |                      |

**制約:** `(reservation_id, reviewer_id)` UNIQUE（1予約につき1人1回のみ評価可）  
**制限:** 返却済み（returned）の予約に対してのみ作成可。更新・削除不可。

#### notifications

| カラム     | 型               | 制約                | 説明                    |
| ---------- | ---------------- | ------------------- | ----------------------- |
| id         | SERIAL           | PK                  |                         |
| user_id    | UUID             | FK(users), NOT NULL |                         |
| type       | notification_type| NOT NULL            | 下記参照                |
| title      | TEXT             | NOT NULL            |                         |
| body       | TEXT             | NOT NULL            |                         |
| related_id | INTEGER          |                     | リクエストID / 予約ID   |
| is_read    | BOOLEAN          | DEFAULT false       |                         |
| created_at | TIMESTAMPTZ      | server default now()|                         |

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
rental_requests（問い合わせ起点フロー）:
  ─── 問い合わせ（inquiry）起点 ─────────────────────────────────
  [借主が質問] → inquiry
    inquiry ──[借主が日程を決めて予約リクエスト送信]──► pending
                POST /rental-requests/{id}/formalize
    inquiry ──[貸主が直接予約を確定]──────────────────► accepted（+ reservation reserved）
                POST /rental-requests/{id}/direct-reserve

  ─── 通常リクエスト起点 ───────────────────────────────────────
  [借主がリクエスト送信（日程あり）] → pending
    pending ──[承認]──► accepted ──[予約自動作成（reserved）]
            ──[拒否]──► rejected
            ──[取消]──► cancelled（貸主のみ）→ 借主に通知
  ※ 借主はキャンセル不可。チャットで貸主に依頼する仕様

reservations:
  reserved ──[貸出]──► lent ──[返却]──► returned ──[評価]──► reviews 作成
           ──[取消]──► cancelled（reserved / lent どちらからでも可・当事者どちらでも可）

carts:
  active ⇄ inactive  （貸主がトグルで随時切替）
  active / inactive ──[削除]──► deleted（論理削除・復元不可）
```

---

## 6. API設計（FastAPI）

**ベースURL:** `https://daishare-api.onrender.com`  
**認証:** `Authorization: Bearer <Supabase JWT>`

### 6.1 エンドポイント一覧

#### Auth / Users

| Method | Path                        | 説明                                                                        |
| ------ | --------------------------- | --------------------------------------------------------------------------- |
| POST   | `/auth/sync`                | Supabaseログイン後のユーザー情報同期（usersテーブルへの初回登録含む）       |
| GET    | `/users/me`                 | 自分のプロフィール取得                                                      |
| PUT    | `/users/me`                 | プロフィール更新（display_name / bio / user_type / avatar_url）             |
| PUT    | `/users/me/push-token`      | Expo Push Token 登録・更新                                                  |
| GET    | `/users/{user_id}/profile`  | 他ユーザーのパブリックプロフィール取得（認証不要）                          |

#### Stations

| Method | Path                       | 説明                                       |
| ------ | -------------------------- | ------------------------------------------ |
| GET    | `/stations`                | 駅一覧取得（?municipality=xxx でフィルタ） |
| GET    | `/stations/municipalities` | 市区町村一覧取得                           |

#### Carts

| Method | Path                      | 説明                                                         |
| ------ | ------------------------- | ------------------------------------------------------------ |
| GET    | `/carts`                  | 台車検索（?municipality, ?station_id, ?owner_id, ?category, ?foldable）active のみ |
| GET    | `/carts/mine`             | 自分の台車一覧（active/inactive 両方・id ASC順）             |
| GET    | `/carts/{cart_id}`        | 台車詳細（station_name, municipality を含む）                |
| POST   | `/carts`                  | 台車登録（認証ユーザー）                                     |
| PUT    | `/carts/{cart_id}`        | 台車更新（本人のみ）                                         |
| DELETE | `/carts/{cart_id}`        | 台車削除（論理削除・status = deleted）                       |
| PATCH  | `/carts/{cart_id}/status` | 公開/非公開トグル（active ↔ inactive）                       |

#### Rental Requests

| Method | Path                                  | 説明                                                                                             |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GET    | `/rental-requests`                    | リクエスト一覧（自分関係のもの）                                                                 |
| GET    | `/rental-requests/{id}`               | リクエスト詳細（`cart_title`, `renter_name`, `lender_name`, `station_name`, `municipality`, `lending_address` 含む） |
| POST   | `/rental-requests`                    | リクエスト送信（借主のみ）。`start_date`/`end_date` 省略時は `inquiry` ステータスで作成          |
| PATCH  | `/rental-requests/{id}`               | リクエスト内容編集（貸主のみ・pending 時のみ・日時/台数変更）                                   |
| POST   | `/rental-requests/{id}/accept`        | 承認（貸主のみ）→ 予約自動作成                                                                   |
| POST   | `/rental-requests/{id}/reject`        | 拒否（貸主のみ）                                                                                 |
| POST   | `/rental-requests/{id}/cancel`        | キャンセル（貸主のみ）→ 借主に通知                                                               |
| POST   | `/rental-requests/{id}/formalize`     | 借主が inquiry → pending に昇格（日程・台数を確定）                                              |
| POST   | `/rental-requests/{id}/direct-reserve`| 貸主が直接予約確定（inquiry/pending → accepted + reservation reserved 作成）                     |

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

### 6.2 主要APIの詳細

#### POST `/rental-requests`（問い合わせモード）

```
リクエストボディの start_date / end_date が省略された場合:
1. rental_requests.status = 'inquiry' で作成
2. messages にシステムメッセージを追加（「問い合わせが届きました」）
3. 貸主へ通知（REQUEST_RECEIVED: "問い合わせが届きました"）
4. 作成したリクエストIDを返す → モバイルはそのままチャット画面へ遷移
```

#### POST `/rental-requests/{id}/accept`

```
1. rental_requests.status を accepted に更新
2. reservations を作成
3. システムメッセージを messages に作成
4. 借主への通知（REQUEST_ACCEPTED）を作成・送信
```

#### POST `/rental-requests/{id}/formalize`

```
ボディ: { start_date, end_date, quantity }
1. 本人（renter）かつ status = 'inquiry' であることを確認
2. rental_requests.start_date / end_date / quantity を更新
3. status を 'pending' に更新
4. システムメッセージを messages に追加
5. 貸主への通知（REQUEST_RECEIVED）を送信
```

#### POST `/rental-requests/{id}/direct-reserve`

```
ボディ: { start_date, end_date, quantity }
1. 台車オーナー（lender）かつ status が 'inquiry' または 'pending' であることを確認
2. rental_requests を accepted に更新
3. reservations を status = 'reserved' で作成
4. システムメッセージを messages に追加
5. 借主への通知（REQUEST_ACCEPTED）を送信
```

#### PATCH `/carts/{id}/status`

```
active → inactive / inactive → active をトグル
自分の台車のみ変更可能
```

---

## 7. 画面設計

### 7.1 ナビゲーション構造

```
(未認証)
  └── /(auth)/login            Google ログイン画面

(認証済み・Bottom Tab 5タブ)
  ├── / (index)                ホーム（台車グリッド一覧 + 検索バー）
  │                              ※ useFocusEffect で再取得
  ├── /reservations            予約一覧（リクエスト / 予約中 / 履歴 の3コンテンツタブ）
  ├── /messages                メッセージ（スレッド一覧）
  ├── /schedule                スケジュール（今日 / 明日以降 / 履歴 セクション）
  │                              ※ useFocusEffect で再取得
  └── /carts                   台車管理（自分の台車一覧・登録FAB）
                                 ※ useFocusEffect で再取得

  ヘッダー右アイコン（全タブ共通）
  ├── 🔔 通知アイコン（未読数バッジ・9+表示・30秒ポーリング） → /notifications
  └── 👤 プロフィールアイコン → /profile（モーダル）

(スタック画面 / モーダル)
  ├── /profile                 プロフィール表示（presentation: modal）
  ├── /profile-edit            プロフィール編集（スタック）
  ├── /carts/new               台車登録フォーム
  ├── /carts/[id]/edit         台車編集フォーム
  ├── /search/[lender_id]      貸主詳細・台車一覧
  ├── /request-new             リクエスト送信（presentation: modal）
  ├── /requests/[id]           チャット・取引詳細
  └── /notifications           通知一覧・既読管理
```

### 7.2 画面遷移図

```
[未認証]
  ↓ アプリ起動
/(auth)/login
  ↓ Googleログイン成功
  ├─ is_new=true → /profile-edit（プロフィール設定を促す）
  └─ 通常 → /(tabs)/index（ホーム）

[ホーム: /(tabs)/index]
  → 台車カードタップ → /search/[lender_id]?cart_id=N
                          ↓ 借りたいボタン → /request-new?lender_id=X&cart_id=N
                                               ↓ 送信成功 → /(tabs)/reservations
                          ↓ 質問するボタン（InquiryModal） → /requests/[id]

[予約一覧: /(tabs)/reservations]
  → カードタップ → /requests/[id]（チャット・取引）

[メッセージ: /(tabs)/messages]
  → カードタップ → /requests/[id]（チャット・取引）

[スケジュール: /(tabs)/schedule]
  → EventCardタップ → /requests/[id]（チャット・取引）

[台車管理: /(tabs)/carts]
  → カードタップ → /carts/[id]/edit
  → 登録FAB → /carts/new

[チャット・取引: /requests/[id]]
  ← 戻るボタン → 前の画面（reservations / messages / schedule）
  → 予約確定後 → 同画面でステータス更新

[通知: /notifications]
  → 通知タップ → /requests/[id]（チャット系）
               → /(tabs)/reservations（リクエスト系）
               → /search/[自分のID]（レビュー受信）

[ヘッダー共通]
  🔔 → /notifications
  👤 → /profile（モーダル）
         → /profile-edit（プロフィール編集スタック）
```

### 7.3 画面詳細

---

#### `/(auth)/login` ログイン画面

| 項目     | 内容                                   |
| -------- | -------------------------------------- |
| 表示条件 | 未認証時のみ（セッションなし）         |
| レイアウト | 中央揃え縦並び（flex: 1, justifyContent: center） |
| 表示内容 | アプリロゴ / アプリ名「ダイシェア」 / キャッチコピー |
|          | 「Googleでログイン」ボタン（白地・Googleロゴ・テキスト） |
| 動作     | ボタンタップ → `supabase.auth.signInWithOAuth({ provider: 'google' })` |
| 遷移先   | ログイン成功 → `is_new=true` なら `/profile-edit`、それ以外は `/(tabs)/` |

---

#### `/ (index)` ホーム（台車検索）

| 項目       | 内容                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| 表示条件   | 認証済み                                                                                  |
| APIコール  | `GET /carts`（`?municipality=` / `?station_id=` / `?category=` / `?foldable=` で絞込）  |
| 再取得     | `useFocusEffect`（タブフォーカス時に自動再取得）＋ Pull-to-refresh                       |
| カード展開 | `buildCartItems` で `cart_locations` 分のカードを flatMap 展開                           |
| 並び順     | 新しい順 / 価格安い順 / 価格高い順（ドロップダウン）。デフォルト: 新しい順（id DESC）    |
| 空状態     | 🔍「台車が見つかりませんでした」＋「条件を変えてみてください」                           |

**レイアウト（上から順）:**

```
┌─────────────────────────────────────────┐
│  ┌────────────────────────────────────┐ │ ← 検索バー（bg white, hairline下線）
│  │ 🔍 エリアで検索 ▾  [絞り込み(N)] │ │
│  └────────────────────────────────────┘ │
│  N件   [新しい順 ▾]  [≡ 絞り込み(N)] │ ← ツールバー（ListHeaderComponent）
├─────────────────────────┬───────────────┤
│  ┌─────────────────────┐│┌────────────┐│ ← 2カラムグリッド
│  │   [台車画像]        │││  [画像]    ││
│  │  タイトル           │││ タイトル   ││
│  │  📍 市区町村 駅名   │││ 📍 場所    ││
│  │  ¥1,000/日          │││ ¥2,000/日  ││
│  └─────────────────────┘│└────────────┘│
└─────────────────────────┴───────────────┘
```

**CartCard（グリッドセル）:**
| 要素     | 仕様                                                                   |
| -------- | ---------------------------------------------------------------------- |
| サイズ   | 幅 = (screenWidth - 48) / 2、アスペクト比 1:1 のサムネイル            |
| 画像     | `image_urls[0]` または 🛒 プレースホルダー（bg `#f3f4f6`）             |
| タイトル | fontSize 13, fontWeight 600, 最大2行                                   |
| 場所     | 📍 municipality + station_name（fontSize 11, 灰色）                   |
| 価格     | daily_rate 優先 → weekly_rate → per_rental_rate（fontSize 15, bold）  |
| タップ   | `/search/[cart.owner_id]?cart_id=${cart.id}`                          |

**検索バー:**
| 要素          | 動作                                                                |
| ------------- | ------------------------------------------------------------------- |
| 🔍 エリアピル | タップ → AreaModal。選択中は市区町村名表示 + ×（クリアボタン）     |
| 絞り込みボタン | タップ → FilterModal。有効条件数を `(N)` バッジで表示              |

**AreaModal（pageSheet・slide）:**
- `GET /stations/municipalities` で一覧取得
- エリアグループ自動分類（台車の全地点を検索対象に含む）:
  - **東京23区**（「区」で終わる・東京都）
  - **東京市部**（「市」で終わる・東京都）
  - **神奈川県**
  - **その他**
- 各エリア行: 市区町村名 + 在庫件数バッジ（件数0はグレーアウト）
- 「すべてのエリア」選択 → フィルタ解除

**SortMenu（ドロップダウン）:**
- 位置: `top:110, right:16`（絶対位置）
- 選択肢: 新しい順 / 価格の安い順 / 価格の高い順
- 選択中: bg `#eff6ff`、text `#3b82f6` + ✓

**FilterModal（pageSheet・slide）:**
| セクション       | 内容                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| 台車カテゴリー   | チップ選択（単一）: 手押し台車 / 平台車 / ハンドトラック / アウトドアワゴン / その他 |
| スペック         | Switch「折りたたみ可能のみ」                                            |
| 料金（日額）     | チップ選択: 上限なし / 〜¥1,000 / 〜¥3,000 / 〜¥5,000                  |
| ヘッダー左       | 「リセット」ボタン（タイプ・折りたたみ・料金をクリア。エリアは保持）   |
| フッターボタン   | 「この条件で絞り込む」→ 適用してモーダルを閉じる                        |

**地点カード展開ロジック（`buildCartItems`）:**
- `cart.locations` が空ならトップレベルの `station_id` / `municipality` を使用（後方互換）
- エリアフィルタ有効時は一致する地点のカードのみ表示
- バックエンド側も `cart_locations` サブクエリで全地点を検索対象にする

---

#### `/carts` 台車管理

| 項目             | 内容                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| 表示条件         | 認証済み（自分の台車のみ）                                            |
| APIコール        | `GET /carts/mine`（active / inactive 両方）                           |
| 並び順           | 登録順↑（id ASC）デフォルト。ドロップダウンで 登録順↓ / 価格安↑ / 価格高↑ に切替 |
| 再取得           | `useFocusEffect`                                                      |
| 空状態           | 🛒「台車が登録されていません」＋「台車を登録する」ボタン              |

**カードレイアウト:**
```
┌────────────────────────────────────┐
│  [台車名]              [公開中/非公開 Badge]  🗑 │
│  ¥1,000/日  📦 在庫3台                          │
│  📍 千代田区 / 神田駅                            │
│  📍 台東区 / 浅草駅                              │
│  ─────────────────────────────────────         │
│  公開中 [──●──] ←→ [──○──] 非公開  [Switch]   │
└────────────────────────────────────┘
```

| 要素            | 仕様                                                              |
| --------------- | ----------------------------------------------------------------- |
| ステータスバッジ | 公開中: bg `#d1fae5`, text `#065f46` / 非公開: bg `#f3f4f6`, text `#6b7280` |
| 在庫            | 📦 N台（fontSize 12）                                            |
| 地点一覧        | 📍 municipality · station_name（`cart_locations` 分だけ全表示）  |
| 公開Switch      | `PATCH /carts/{id}/status`。トグル即時反映                        |
| カードタップ    | → `/carts/[id]/edit`                                             |
| 🗑 削除ボタン   | タップイベント stopPropagation → Alert「削除しますか？」→ `DELETE /carts/{id}` |
| FAB             | 「台車を登録する」全幅ボタン（画面下部固定） → `/carts/new`       |

---

#### `/carts/new` 台車登録フォーム

**APIコール:** `POST /carts`（成功後 `router.back()`）

| セクション   | フィールド                                          | バリデーション      |
| ------------ | --------------------------------------------------- | ------------------- |
| 基本情報     | タイトル（TextInput）                               | 必須                |
|              | カテゴリ（チップ選択・単一）                        | 必須                |
|              | 台数（数値入力）                                    | 必須・1以上         |
| スペック     | 重量(kg)、最大積載量(kg)、横幅(cm)、奥行(cm)       | 任意・数値          |
|              | 折りたたみ可否（Switch）                            | 任意                |
| 価格         | 日額 / 週額 / 1回あたり（TextInput・keyboardType numeric） | いずれか1つ以上必須 |
| 貸出場所     | 駅（StationPicker モーダル）                        | 最低1件必須         |
|              | 場所の詳細（TextInput）                             | 任意                |
|              | 「＋ 場所を追加」ボタン（複数地点登録可）           | ―                  |
| 画像         | 最大N枚（Supabase Storage へアップロード）          | 任意                |
| 備考         | フリーテキスト（multiline）                         | 任意                |
| 送信ボタン   | 「登録する」                                        | ―                   |

**StationPicker（モーダル）:**
1. 市区町村一覧（`GET /stations/municipalities`）をリスト表示
2. 市区町村選択 → 駅一覧（`GET /stations?municipality=X`）をリスト表示
3. 駅を選択して確定

**カテゴリ選択肢（ChipSelect）:**
| 値              | 表示ラベル       |
| --------------- | ---------------- |
| `hand_truck`    | 手押し台車       |
| `flat_cart`     | 平台車           |
| `hand_dolly`    | ハンドトラック   |
| `outdoor_wagon` | アウトドアワゴン |
| `other`         | その他           |

---

#### `/carts/[id]/edit` 台車編集フォーム

台車登録フォームと同一構成（`CartForm` コンポーネント共用）。差分:

| 項目           | 内容                                                |
| -------------- | --------------------------------------------------- |
| 初期値         | `GET /carts/{id}` で取得してフォームに反映          |
| 駅ピッカー     | 既存の `station_id` / `station_name` / `municipality` を選択済み状態で表示 |
| 送信ボタン     | 「更新する」→ `PUT /carts/{id}` → `router.back()` |
| 削除ボタン     | 画面下部「削除する」→ 確認ダイアログ → `DELETE /carts/{id}` → `router.back()` |

---

#### `/profile` プロフィール表示画面（モーダル）

> 👤 プロフィールアイコンから遷移するモーダル画面。通知設定を含む。

| セクション       | 表示内容                                                             |
| ---------------- | -------------------------------------------------------------------- |
| アバターエリア   | アバター画像（未設定時はイニシャル・背景色）                         |
|                  | 名前（display_name）、メールアドレス                                 |
| プロフィール Card | 名前 / 自己紹介（未設定時は「未設定」）/ タイプ（借主/貸主/両方）  |
| ボタン           | 「プロフィールを編集」→ `router.push('/profile-edit')` で遷移        |
| 通知設定 Card    | 通知 ON/OFF スイッチ                                                 |
|                  | （ON時）リクエスト通知 / メッセージ通知 / 予約リマインド スイッチ   |
|                  | （リマインドON時）リマインドタイミング（ドラムロールピッカー）       |
| ログアウトボタン | 確認ダイアログ → signOut                                             |

**通知設定の保存:** 各スイッチ変更時に即時 AsyncStorage (`@daishare/notif_settings`) に保存。  
**再読み込み:** `useFocusEffect` でフォーカス時に AsyncStorage から再読み込み（編集画面から戻った後も反映）。

**リマインドタイミング（ドラムロールピッカー）:**

| 項目     | 内容                                                    |
| -------- | ------------------------------------------------------- |
| 時間列   | 0〜24 時間（ScrollView ドラムロール、snap）             |
| 分列     | 0, 10, 20, 30, 40, 50 分（ScrollView ドラムロール）    |
| 最大値   | 24時間前（1440分）                                      |
| 最小値   | 10分前                                                  |
| サマリー | 「X時間Y分前に通知」として現在値を表示                  |

---

#### `/profile-edit` プロフィール編集画面（スタック）

> 通常のスタック画面。ヘッダーの「＜ 戻る」でキャンセル可能。

| セクション       | 表示内容                                            |
| ---------------- | --------------------------------------------------- |
| アバターエリア   | アバター画像（タップで変更）+ 📷 バッジ             |
|                  | 「タップして変更」ヒントテキスト                    |
|                  | アップロード中: ActivityIndicator 表示              |
| プロフィール Card | 名前（テキスト入力・必須）                          |
|                  | 自己紹介（テキスト入力・複数行・任意）              |
| 利用タイプ Card  | 借主 / 貸主 / 両方（チップ選択）                    |
| 保存ボタン       | 「保存する」→ PUT /users/me → router.back()         |
| 通知設定         | **表示しない**（プロフィール表示画面でのみ管理）    |

**アバター変更の仕様:**
- `expo-image-picker` を動的インポート（`await import('expo-image-picker')`）
- Expo Go 環境では動的インポートが失敗するため Alert を表示してグレースフルデグレード
- 選択後: Supabase Storage `avatars` バケットへアップロード（パス: `avatars/{userId}.{ext}`）
- アップロード後: `PUT /users/me` で `avatar_url` を更新 → `syncUser()`
- ローカルプレビュー（`setAvatarUri`）で即時反映

---

#### `/reservations` 予約一覧

| 項目       | 内容                                                        |
| ---------- | ----------------------------------------------------------- |
| APIコール  | `GET /rental-requests`（自分が関係するもの全件）            |
| 再取得     | `useFocusEffect` ＋ Pull-to-refresh                         |

**ロール切り替えバー（user_type が `both` の場合のみ上部表示）:**
- 「借りる」/ 「貸す」ボタン（ピル型）

**コンテンツタブ（3本）:**

| ロール    | タブ1          | タブ2   | タブ3 |
| --------- | -------------- | ------- | ----- |
| 借主      | リクエスト送信 | 予約中  | 履歴  |
| 貸主      | リクエスト受信 | 予約中  | 履歴  |

**振り分けロジック:**
| コンテンツタブ | 含まれるステータス                                                     |
| -------------- | ---------------------------------------------------------------------- |
| リクエスト     | `status === 'pending'`（+ `inquiry` も表示対象）                       |
| 予約中         | `status === 'accepted'` かつ `reservation_status` が `reserved` / `lent` |
| 履歴           | `status === 'cancelled'` / `rejected` または `reservation_status === 'returned'` |

**各タブのバッジ:** タブ名の右に件数バッジ（選択中: 青、非選択: グレー）

**RequestCard レイアウト:**
```
┌─────────────────────────────────────────┐
│ [台車名]                    [ステータスBadge] │
│ 👤 借りる人: 田中 太郎（貸主視点のみ）      │
│ 🕐 貸出希望: 6/25 10:00                     │
│ 🕐 返却希望: 6/26 18:00                     │
│ 📦 台数: 2台                                 │
│ 📍 千代田区 / 神田駅                         │
│ 🏠 〇〇ビル1F                               │
│ 💬 "メッセージプレビュー..."                 │
│ [承認] [拒否]  ← pending かつ 貸主視点のみ │
└─────────────────────────────────────────┘
```

**ステータスバッジ色:**
| status/reservation_status | ラベル     | 色                    |
| ------------------------- | ---------- | --------------------- |
| inquiry                   | 問い合わせ中 | `#6366f1`           |
| pending                   | 承認待ち   | `#f59e0b`             |
| reserved                  | 予約確定   | `#10b981`             |
| lent                      | 貸出中     | `#f59e0b`             |
| returned                  | 返却済み   | `#6b7280`             |
| rejected                  | 拒否       | `#ef4444`             |
| cancelled                 | キャンセル | `#9ca3af`             |

- カードタップ → `/requests/[id]`
- 借主: キャンセルボタンなし（チャットで貸主に依頼）

#### `/requests/[id]` チャット・取引画面

| 項目           | 内容                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------- |
| ヘッダー       | 相手のユーザー名（Stack.Screen の title に動的設定）                                        |
| リクエスト情報 | 台車名・日時（inquiry 時は「日程未定」）・台数・場所・住所・備考を常時展開表示              |
| **inquiry 時アクション（借主）** | 「📋 予約リクエストを送る」ボタン → DateQtyModal → `POST /{id}/formalize` |
| **inquiry 時アクション（貸主）** | 「✅ 予約を確定する」ボタン → DateQtyModal → `POST /{id}/direct-reserve`  |
| 貸主アクション | pending 時: 承認 / 編集 / 拒否 の3ボタン                                                   |
|                | 編集モーダル（DateQtyModal）: 日時（DateTimePicker）・台数（+/- カウンター）               |
|                | reserved 時: 貸出開始 / キャンセル                                                         |
|                | lent 時: 返却完了                                                                           |
|                | returned 時: レビューを書く                                                                 |
| チャット       | LINE 風バブル（自分: 右青・相手: 左白）。システムメッセージはグレー中央揃え                 |
| 既読表示       | 自分が送った最後の既読メッセージに「既読」表示                                              |
| リアルタイム   | Supabase Realtime（INSERT/UPDATE 購読）+ 5秒ポーリングフォールバック                        |
| Pull-to-refresh | 下スワイプでメッセージ + リクエスト情報を再取得                                            |
| キーボード     | `automaticallyAdjustKeyboardInsets` + KAV で入力欄が隠れない                               |
| 借主           | キャンセルボタンなし                                                                        |

**DateQtyModal（共通コンポーネント）:**
- 貸出開始日時・返却日時（DateTimePicker）と台数（+/- カウンター）を入力
- `onSubmit(start, end, qty)` コールバックで呼び出し元が API 呼び出し
- formalize と direct-reserve の両方で共用

---

#### `/messages` メッセージ一覧

| 項目      | 内容                                                                |
| --------- | ------------------------------------------------------------------- |
| APIコール | `GET /rental-requests`（rejected / cancelled を除外してソート）     |
| ソート    | `last_message_at` 降順（なければ `created_at`）                    |
| 再取得    | `useFocusEffect` ＋ Pull-to-refresh                                 |

**ThreadCard レイアウト:**
```
┌────────────────────────────────────────────────┐
│ [Avatar] 田中 太郎   [ステータスBadge]   10:30  │
│          🛒 台車タイトル × 2台                   │
│          🕐 6/25 10:00 〜 6/26 18:00            │
│            （日程未定の場合: 「（日程未定）」）   │
│          📍 千代田区 / 神田駅                    │
│          最後のメッセージ本文...    [未読数 Badge]│
└────────────────────────────────────────────────┘
```

| 要素             | 仕様                                                           |
| ---------------- | -------------------------------------------------------------- |
| Avatar           | 相手の名前の頭文字（bg `#dbeafe`, text `#3b82f6`）            |
| 時刻表示         | 当日 → HH:MM / 7日以内 → N日前 / それ以上 → M/D              |
| ステータスバッジ | `reservation_status ?? status` で判定（予約一覧と同じ色）     |
| 未読バッジ       | 緑（`#22c55e`）・99超は「99+」                                 |
| タップ           | → `/requests/[id]`                                            |

---

#### `/schedule` スケジュール

| 項目      | 内容                                                           |
| --------- | -------------------------------------------------------------- |
| APIコール | `GET /reservations`                                            |
| 再取得    | `useFocusEffect` ＋ Pull-to-refresh                            |

**イベント展開ロジック:**
各予約（cancelled 除く）から **貸出イベント** と **返却イベント** の2つを生成する。

| イベント種別 | `eventDate`   | 判定（activeEvents / historyEvents）                              |
| ------------ | ------------- | ----------------------------------------------------------------- |
| 貸出 (lend)  | `start_date`  | `status=reserved` → active / `status=lent or returned` → history |
| 返却 (return)| `end_date`    | `status=returned` → history / それ以外 → active                  |

過去日時になったが未完了の active イベントも history に移動。

**セクション構成（FlatList）:**
1. **「本日のスケジュール」** ヘッダー（当日のイベントがある場合）
2. 当日の EventCard
3. **「明日以降のスケジュール」** ヘッダー（未来イベントがある場合）
4. 未来の EventCard（日時昇順）
5. **「スケジュール履歴（N件）」** 折りたたみトグル
6. 履歴 EventCard（日時降順、`historyOpen === true` のみ表示）
7. 空状態: 📅「予定がありません」

**EventCard レイアウト:**
```
┌──────────────────────────────────────┐
│ ▌  [貸出/返却 Badge]  台車名 × N台   │ ← 左端のアクセントバー（5px幅）
│    貸出時間: 2026/6/25 10:00         │
│    📍 千代田区 / 神田駅              │
│    🏠 〇〇ビル1F                    │
└──────────────────────────────────────┘
```

| 要素         | 仕様                                                        |
| ------------ | ----------------------------------------------------------- |
| アクセントバー | 貸出: `#3b82f6`（青）/ 返却: `#10b981`（緑）/ 過去: `#9ca3af`（灰） |
| バッジ       | 「貸出」/ 「返却」（背景 = アクセント色 + 20%透過）         |
| 過去カード   | `opacity: 0.75`                                            |
| タップ       | → `/requests/[rental_request_id]`                          |

---

#### `/search/[lender_id]` 貸主詳細

| 項目       | 内容                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| URLパラメータ | `lender_id`（必須）、`cart_id`（任意 — 特定台車のみ表示）          |
| APIコール  | `GET /users/{lender_id}/profile`、`GET /carts?owner_id={lender_id}`、`GET /users/{lender_id}/reviews` （並列） |
| 絞込       | `cart_id` 指定時は `allCarts.filter(c => c.id === cart_id)` を表示   |

**レイアウト（FlatList + ListHeaderComponent）:**
```
┌───────────────────────────────────┐
│  [Avatar 72px]  貸主名           │ ← プロフィールカード
│               ⭐ 4.5（3件）      │
│               自己紹介テキスト   │
├───────────────────────────────────┤
│  レビュー（最大3件表示）          │
│  😊 良い  "コメント..."  田中さん │
├───────────────────────────────────┤
│  台車一覧                         │
│  ┌─────────────────────────────┐  │
│  │ [台車画像 160px高]          │  │ ← CartCard
│  │ 台車タイトル                │  │
│  │ カテゴリチップ              │  │
│  │ 説明（2行）                 │  │
│  │ ¥1,000/日                   │  │
│  │ 📦 2台  折りたたみ可        │  │
│  │ 📍 千代田区 / 神田駅        │  │
│  └─────────────────────────────┘  │
└───────────────────────────────────┘

 [💬 質問する]   [🛒 借りたい]    ← 固定フッター
```

| 要素             | 仕様                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| 平均評価         | レビューがある場合のみ表示（⭐ X.X（N件））                                       |
| レビュー評価絵文字 | 1: 😞 悪い / 2: 😐 普通 / 3: 😊 良い                                           |
| レビュー表示数   | 最大3件                                                                           |
| 質問するボタン   | InquiryModal を表示（`cart_id` を渡す）                                           |
| 借りたいボタン   | `/request-new?lender_id={id}&cart_id={id}` へ遷移（モーダル）                   |

---

#### `/request-new` リクエスト送信（モーダル）

| 項目       | 内容                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| URLパラメータ | `lender_id`（必須）、`cart_id`（任意 — 台車を1つに絞込）              |
| APIコール（並列） | `GET /users/{lender_id}/profile`、`GET /carts?owner_id={lender_id}` |
| 送信       | `POST /rental-requests`（選択台車×地点ごと）→ Alert → `router.replace('/(tabs)/reservations')` |

**レイアウト（ScrollView, padding 16）:**
```
┌─────────────────────────────────────────┐
│ [Avatar] 貸主名                         │ ← 貸主行
├─────────────────────────────────────────┤
│  貸出希望日  [📅 6/25 水]  [🕐 10:00]  │ ← 日付/時刻ピッカー
│  返却希望日  [📅 6/26 木]  [🕐 18:00]  │
├─────────────────────────────────────────┤
│ 台車を選ぶ              [合計 N 台選択中]│
│  📍 千代田区 / 神田駅                   │ ← 地点ヘッダー
│  [サムネ] 台車タイトル  ¥1,000/日      │ ← CartSelectRow
│           在庫3台        [−][1][＋]     │
├─────────────────────────────────────────┤
│ メッセージ（任意）                       │
│ [テキスト入力 100px高]                   │
├─────────────────────────────────────────┤
│ [  リクエストを送信する（N台）  ]       │ ← 送信ボタン（disabled: qty=0時）
└─────────────────────────────────────────┘
```

| 要素            | 仕様                                                                        |
| --------------- | --------------------------------------------------------------------------- |
| 日付デフォルト  | 貸出: 翌日 00:00 / 返却: 翌々日 00:00                                       |
| DateTimePicker  | 日付ボタン・時刻ボタンを個別タップ（iOS: compact / Android: default）       |
| 地点グループ    | `locationGroups`（cart × location の組み合わせ）で展開                     |
| CartSelectRow   | サムネ56px + タイトル + 在庫数 + ±ステッパー（在庫上限で＋disabled）      |
| 選択カード強調  | qty > 0 時: border `#3b82f6`、bg `#eff6ff`                                 |
| 送信バリデーション | qty = 0 → Alert / endDate ≤ startDate → Alert                          |

---

#### `/notifications` 通知一覧

| 項目      | 内容                                                        |
| --------- | ----------------------------------------------------------- |
| APIコール | `GET /notifications`                                        |
| 再取得    | 画面マウント時 ＋ Pull-to-refresh                            |
| 空状態    | 🔔「通知がありません」                                       |

**レイアウト:**
```
┌─────────────────────────────────────────┐
│ すべて既読にする（N件）                  │ ← 未読がある場合のみ表示（bg white）
├─────────────────────────────────────────┤
│ ● [タイトル]                       [✕] │ ← 未読: ●ドット + bg #eff6ff
│   本文テキスト                          │    既読: ドットなし + bg white
│   6/25 10:30                            │
├─────────────────────────────────────────┤
│   [タイトル]                       [✕] │
│   本文テキスト                          │
│   6/24 15:00                            │
└─────────────────────────────────────────┘
```

**通知タップ時のナビゲーション:**
| 通知タイプ                                                               | 遷移先                          |
| ------------------------------------------------------------------------ | ------------------------------- |
| `review_received`                                                        | `/search/[自分のuser_id]`       |
| `message_received` / `lend_started` / `returned` / `reminder_*` / `request_accepted` / `request_rejected` | `/requests/[related_id]` |
| `request_received` / `request_cancelled` / その他                       | `/(tabs)/reservations`          |

**操作:**
- 未読カードタップ → `POST /notifications/{id}/read`（既読化）→ ナビゲーション
- ✕ボタン → `DELETE /notifications/{id}`（リストから削除）
- 「すべて既読にする」→ `POST /notifications/read-all`

---

#### 質問（inquiry）フロー

```
1. 借主が「💬 質問する」ボタンをタップ（/search/[lender_id] 画面）
2. InquiryModal が表示（cart_id を渡す）
3. 借主がメッセージを入力 → 「送信する」
4. POST /rental-requests { cart_id, message }  ← start_date/end_date 省略
5. バックエンドが status=inquiry でリクエスト作成、初期システムメッセージを追加
6. 貸主へ「問い合わせが届きました」通知を送信
7. アプリが /requests/{id} チャット画面へ遷移

チャット画面での次のアクション:
  借主: 「📋 予約リクエストを送る」
    → DateQtyModal（日程・台数入力）→ POST /rental-requests/{id}/formalize
    → status が pending に昇格 → 通常の承認フローへ

  貸主: 「✅ 予約を確定する」
    → DateQtyModal（日程・台数入力）→ POST /rental-requests/{id}/direct-reserve
    → status が accepted に昇格 + reservation(reserved) 作成
    → 借主へ REQUEST_ACCEPTED 通知
```

---

### 7.4 共通UI仕様

| 要素             | 仕様                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| ヘッダー         | 全タブ共通で 🔔（未読バッジ）・👤 アイコン表示（右上、gap 8）           |
| 未読バッジ       | Zustand `badgeStore` で管理、30秒ポーリング ＋ AppState resume で更新  |
| エラー状態       | `EmptyScreen` コンポーネント（icon="⚠️" + 再試行ボタン）               |
| 空状態           | `EmptyScreen` コンポーネント（icon / message / subMessage / action）    |
| ローディング     | `LoadingScreen`（`ActivityIndicator` 中央配置）                         |
| 再取得タイミング | タブ画面: `useFocusEffect`。モーダル・スタック: `useEffect`             |
| Pull-to-refresh  | 全一覧画面で共通実装（`RefreshControl`, tintColor `#3b82f6`）           |
| システムメッセージ | チャット画面でグレー中央揃え表示（`is_system === true` の Message）   |

---

## 8. 通知設定（クライアント管理）

通知設定はサーバーではなく AsyncStorage（端末ローカル）に保存する。

```typescript
interface NotifSettings {
  enabled: boolean;        // 通知全体 ON/OFF
  request: boolean;        // リクエスト通知
  message: boolean;        // メッセージ通知
  reminder: boolean;       // 予約リマインド
  reminderMinutes: number; // リマインドタイミング（最小10・最大1440）
}

const NOTIF_KEY = '@daishare/notif_settings';

const DEFAULT_NOTIF: NotifSettings = {
  enabled: true, request: true, message: true, reminder: true, reminderMinutes: 720,
};
```

> **注**: クライアント側の通知設定はアプリ内表示制御のみに使用する。
> サーバーへは送信しない。プッシュ通知はサーバーから送信される。

---

## 9. ディレクトリ構造

```
cart-rental-ios/
├── docs/
│   ├── design.md               # 本ドキュメント
│   └── tasks.md                # 開発タスク・進捗管理
│
├── mobile/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login.tsx
│   │   ├── (tabs)/
│   │   │   ├── index.tsx          # ホーム ※ useFocusEffect
│   │   │   ├── reservations.tsx   # 予約一覧
│   │   │   ├── messages.tsx       # メッセージスレッド一覧
│   │   │   ├── schedule.tsx       # スケジュール
│   │   │   ├── carts.tsx          # 台車管理 ※ useFocusEffect
│   │   │   └── _layout.tsx
│   │   ├── carts/
│   │   │   ├── new.tsx            # 台車登録
│   │   │   └── [id]/edit.tsx      # 台車編集
│   │   ├── requests/
│   │   │   └── [id].tsx           # チャット・取引詳細
│   │   ├── search/
│   │   │   └── [lender_id].tsx    # 貸主詳細・リクエスト送信
│   │   ├── profile.tsx            # プロフィール表示（モーダル）
│   │   ├── profile-edit.tsx       # プロフィール編集（スタック）
│   │   ├── notifications.tsx      # 通知一覧
│   │   └── _layout.tsx            # ルートレイアウト
│   ├── components/
│   │   ├── CartForm.tsx           # 台車登録・編集フォーム
│   │   ├── StationPicker.tsx      # 駅選択モーダル（市区町村→駅の2段階）
│   │   └── ScreenState.tsx        # LoadingScreen / ErrorScreen / EmptyScreen
│   ├── hooks/
│   │   └── usePushNotifications.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   └── badgeStore.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── supabase.ts
│   │   └── types.ts
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── carts.py           # PATCH /{id}/status を含む
│   │       ├── rental_requests.py
│   │       ├── messages.py
│   │       ├── reservations.py
│   │       ├── reviews.py
│   │       └── notifications.py
│   ├── alembic/
│   ├── tests/
│   └── Dockerfile
│
├── docker-compose.yml
└── .github/workflows/
    ├── backend-ci.yml
    ├── backend-deploy.yml
    └── mobile-build.yml
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
| carts            | active は全員      | 認証ユーザー           | 本人のみ   | 本人のみ |
| rental_requests  | 当事者のみ         | 借主のみ               | 当事者のみ | 不可     |
| messages         | 当事者のみ         | 当事者のみ             | 不可       | 不可     |
| reservations     | 当事者のみ         | システム（承認時）     | 貸主のみ   | 不可     |
| reviews          | 関係者のみ         | 当事者（返却済みのみ） | 不可       | 不可     |
| notifications    | 本人のみ           | システムのみ           | 本人のみ   | 本人のみ |

### 10.3 RLS設計

**FastAPI経由（REST API）**: Service Role Key でRLSバイパス。アクセス制御はFastAPI層で実施。

**モバイルから直接アクセス（Realtime・Storage）**: Anon Key のためRLS適用。

| テーブル/バケット      | ポリシー概要                       |
| ---------------------- | ---------------------------------- |
| messages               | request_idの当事者のみ購読可       |
| notifications          | user_idが本人のみ購読可            |
| avatars（Storage）     | 閲覧は全員、アップロードは本人のみ |
| cart-images（Storage） | 閲覧は全員、アップロードは本人のみ |

### 10.4 シークレット管理

- `.env` ファイルは `.gitignore` 済みでgit管理外
- push前に gitleaks でシークレット漏洩スキャン

---

## 11. プッシュ通知設計

### 11.1 フロー

```
1. アプリ起動時に通知権限を取得
2. Expo Push Token を取得し、PUT /users/me/push-token で保存
3. サーバー側イベント発生時
4. FastAPI の notification_service が Expo Push API を呼び出す
5. デバイスに通知が届く
```

### 11.2 通知トリガー一覧

| イベント               | 送信先     | 通知タイプ          |
| ---------------------- | ---------- | ------------------- |
| 問い合わせ受信         | 貸主       | REQUEST_RECEIVED（タイトル: "問い合わせが届きました"）|
| リクエスト受信         | 貸主       | REQUEST_RECEIVED    |
| リクエスト承認         | 借主       | REQUEST_ACCEPTED    |
| リクエスト拒否         | 借主       | REQUEST_REJECTED    |
| キャンセル             | 相手方     | REQUEST_CANCELLED   |
| メッセージ受信         | 相手方     | MESSAGE_RECEIVED    |
| 貸出開始               | 借主       | LEND_STARTED        |
| 返却完了               | 貸主       | RETURNED            |
| レビュー投稿           | 相手方     | REVIEW_RECEIVED     |
| 貸出開始N分前          | 貸主・借主 | REMINDER_LEND_START |
| 返却時刻N分前          | 貸主・借主 | REMINDER_RETURN     |

> リマインドは APScheduler による定期バッチで送信（Render 上で動作）。
> サーバー側のリマインドタイミングは固定値（貸出60分前・返却60分前）。

---

## 12. 開発フェーズ計画

| Phase       | 期間   | 内容                                                            |
| ----------- | ------ | --------------------------------------------------------------- |
| **Phase 0** | 1〜2日 | 環境構築（Docker, Supabase CLI, Expo, GitHub Actions, Render） |
| **Phase 1** | 1週間  | 認証・ユーザー登録・プロフィール                                |
| **Phase 2** | 2週間  | 台車CRUD・検索・リクエスト送受信                                |
| **Phase 3** | 2週間  | メッセージ・承認フロー・予約管理                                |
| **Phase 4** | 1週間  | スケジュール・通知・プッシュ通知                                |
| **Phase 5** | 1週間  | テスト・UI調整・App Store申請準備                               |

---

## 13. UIデザイントークン

### 13.1 カラーパレット

| トークン名       | HEX       | 用途                               |
| ---------------- | --------- | ---------------------------------- |
| Primary Blue     | `#3b82f6` | ボタン・バッジ・アクティブタブ・リンク |
| Primary Light    | `#eff6ff` | 選択状態カード背景・アクティブチップBG |
| Success Green    | `#10b981` | 承認・返却完了・在庫バッジ・予約確定  |
| Warning Amber    | `#f59e0b` | 承認待ち・貸出中                   |
| Error Red        | `#ef4444` | 拒否・削除・通知未読バッジ         |
| Indigo           | `#6366f1` | inquiry（問い合わせ中）ステータス  |
| Purple           | `#8b5cf6` | 貸出中ステータス（messages）       |
| Gray 400         | `#9ca3af` | 非アクティブテキスト・キャンセル   |
| Gray 500         | `#6b7280` | メタ情報テキスト                   |
| Gray 700         | `#374151` | 本文テキスト（読了済みメッセージ） |
| Gray 900         | `#111827` | 見出し・主要テキスト               |
| Border           | `#e5e7eb` | カード枠・区切り線（hairline）     |
| BG Light         | `#f9fafb` | 画面背景（一覧系）                 |
| BG White         | `#ffffff` | カード背景・ヘッダー背景           |
| Unread Badge     | `#22c55e` | メッセージ未読バッジ（緑）         |

### 13.2 タイポグラフィ

| 用途             | fontSize | fontWeight | color     |
| ---------------- | -------- | ---------- | --------- |
| 大見出し         | 20       | 800        | `#111827` |
| 中見出し         | 16       | 700        | `#111827` |
| 本文（強調）     | 15       | 600        | `#111827` |
| 本文             | 14       | 400        | `#374151` |
| 補足・メタ       | 13       | 400        | `#6b7280` |
| ラベル・バッジ   | 12       | 700        | （色別）  |
| 小ラベル         | 11–10    | 600        | `#9ca3af` |
| 価格             | 15–16    | 800        | `#3b82f6` |

### 13.3 コンポーネント共通スペック

| コンポーネント   | 仕様                                                            |
| ---------------- | --------------------------------------------------------------- |
| カード           | borderRadius 12–14、bg white、shadow(opacity 0.05–0.08)        |
| ボタン（主）     | height 52–54、borderRadius 12–14、bg `#3b82f6`、text white bold |
| ボタン（副）     | border 2px `#3b82f6`、bg white                                 |
| チップ（選択中） | bg `#eff6ff`、border `#3b82f6`、text `#3b82f6`                 |
| チップ（非選択） | bg `#f3f4f6`、border `#e5e7eb`、text `#374151`                 |
| Switch           | activeThumbColor white / activeTrackColor `#3b82f6`            |
| Tab Bar          | height 80、paddingBottom 20、active `#3b82f6`、inactive `#9ca3af` |
| ヘッダー         | bg white、borderBottom hairline `#e5e7eb`                      |

---

## 14. フロントエンド型定義（`mobile/lib/types.ts`）

### 14.1 Enum / Union Types

```typescript
type CartStatus    = 'active' | 'inactive' | 'deleted';
type CartCategory  = 'hand_truck' | 'flat_cart' | 'hand_dolly' | 'outdoor_wagon' | 'other';
type RequestStatus = 'inquiry' | 'pending' | 'accepted' | 'rejected' | 'cancelled';
type ReservationStatus = 'reserved' | 'lent' | 'returned' | 'cancelled';
type UserType      = 'renter' | 'lender' | 'both';
```

### 14.2 主要インターフェース

```typescript
interface CartLocation {
  id: number;
  station_id: number;
  station_name: string;
  municipality: string;
  lending_address: string | null;
}

interface Cart {
  id: number;
  owner_id: string;
  title: string;
  category: CartCategory | null;
  description: string | null;
  weight_kg: number | null;
  max_load_kg: number | null;
  width_cm: number | null;
  length_cm: number | null;
  foldable: boolean;
  daily_rate: number | null;
  weekly_rate: number | null;
  per_rental_rate: number | null;
  quantity: number;
  image_urls: string[];
  station_id: number | null;
  lending_address: string | null;
  status: CartStatus;
  // 結合フィールド（APIレスポンスに含まれる）
  owner_name: string | null;
  station_name: string | null;
  municipality: string | null;
  locations: CartLocation[];  // cart_locations テーブルから
}

interface RentalRequest {
  id: number;
  cart_id: number;
  renter_id: string;
  quantity: number;
  start_date: string | null;   // ISO8601。inquiry 時は null
  end_date: string | null;     // ISO8601。inquiry 時は null
  message: string | null;
  status: RequestStatus;
  created_at: string;
  // 結合フィールド
  cart_title: string | null;
  renter_name: string | null;
  lender_name: string | null;
  station_name: string | null;
  municipality: string | null;
  lending_address: string | null;
  reservation_status: ReservationStatus | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Message {
  id: number;
  rental_request_id: number;
  sender_id: string;
  body: string;
  is_read: boolean;
  is_system: boolean;
  created_at: string;
  sender_name: string | null;
}

interface Reservation {
  id: number;
  rental_request_id: number;
  lender_id: string;
  renter_id: string;
  start_date: string;
  end_date: string;
  quantity: number;
  daily_rate: number;
  lent_at: string | null;
  returned_at: string | null;
  note: string | null;
  status: ReservationStatus;
  created_at: string;
  // 結合フィールド
  lender_name: string | null;
  renter_name: string | null;
  cart_title: string | null;
  station_name: string | null;
  municipality: string | null;
  lending_address: string | null;
}

interface User {
  id: string;
  display_name: string;
  email: string;
  bio: string | null;
  avatar_url: string | null;
  user_type: UserType;
  expo_push_token: string | null;
  is_active: boolean;
  is_new?: boolean;  // 初回登録フラグ（プロフィール設定誘導用）
}

interface Notification {
  id: number;
  user_id: string;
  type: string;   // NotificationType enum の文字列値
  title: string;
  body: string;
  related_id: number | null;
  is_read: boolean;
  created_at: string;
}
```

### 14.3 Zustand ストア

| ストア       | ファイル           | 状態                                                         |
| ------------ | ------------------ | ------------------------------------------------------------ |
| `authStore`  | `store/authStore.ts` | `user: User \| null`、`setUser`、`syncUser`（`GET /users/me`） |
| `badgeStore` | `store/badgeStore.ts` | `unreadNotifications: number`、`clearNotifications`、`fetchUnread`（`GET /notifications?unread=true`）|

### 14.4 価格優先順位（全画面共通）

```
effectivePrice = daily_rate ?? weekly_rate ?? per_rental_rate ?? 0
表示ラベル:
  daily_rate  → "¥N / 日"
  weekly_rate → "¥N / 週"
  per_rental_rate → "¥N / 回"
```
