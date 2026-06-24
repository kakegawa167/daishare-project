# ダイシェア モバイルアプリ 設計書

> バージョン: 2.4.0  
> 作成日: 2026-06-23  
> 最終更新: 2026-06-24  
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
ALLOWED_ORIGINS=http://localhost:8081,https://staging.daishere.app
ENVIRONMENT=local | staging | production
```

**モバイル（Expo）**

```env
EXPO_PUBLIC_SUPABASE_URL=<Supabase URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Supabase Anon Key>
EXPO_PUBLIC_API_URL=http://localhost:8000 | https://api-staging.daishere.app
```

---

## 5. データベース設計（MVP）

### 5.1 ER図（概略）

```
lines ──── stations ──── carts ──────────── owner(users)
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

#### rental_requests

| カラム     | 型             | 制約                 | 説明                                      |
| ---------- | -------------- | -------------------- | ----------------------------------------- |
| id         | SERIAL         | PK                   |                                           |
| cart_id    | INTEGER        | FK(carts), NOT NULL  | 対象台車                                  |
| renter_id  | UUID           | FK(users), NOT NULL  | 借主ユーザーID                            |
| quantity   | INTEGER        | DEFAULT 1, NOT NULL  | 希望台数                                  |
| start_date | TIMESTAMPTZ    | NOT NULL             | 貸出開始日時                              |
| end_date   | TIMESTAMPTZ    | NOT NULL             | 返却日時                                  |
| message    | TEXT           |                      | 借主からのメッセージ                      |
| status     | request_status | DEFAULT 'pending'    | pending / accepted / rejected / cancelled |
| created_at | TIMESTAMPTZ    | server default now() |                                           |

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
rental_requests:
  pending ──[承認]──► accepted ──[予約自動作成]
          ──[拒否]──► rejected
          ──[取消]──► cancelled（※ISS-008: 現在の実装は借主のみ・設計は貸主のみ・要修正）
  ※ 借主はUIからキャンセル不可。チャットで貸主に依頼する仕様

reservations:
  reserved ──[貸出]──► lent ──[返却]──► returned ──[評価]──► reviews 作成
           ──[取消]──► cancelled（reserved / lent どちらからでも可・当事者どちらでも可）

carts:
  active ⇄ inactive  （貸主がトグルで随時切替）
  active / inactive ──[削除]──► deleted（論理削除・復元不可）
```

---

## 6. API設計（FastAPI）

**ベースURL:** `https://api.daishere.app/v1`  
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

| Method | Path                           | 説明                                                              |
| ------ | ------------------------------ | ----------------------------------------------------------------- |
| GET    | `/rental-requests`             | リクエスト一覧（自分関係のもの）                                  |
| GET    | `/rental-requests/{id}`        | リクエスト詳細（`cart_title`, `renter_name`, `lender_name`, `station_name`, `municipality`, `lending_address` 含む） |
| POST   | `/rental-requests`             | リクエスト送信（借主のみ）                                        |
| PATCH  | `/rental-requests/{id}`        | リクエスト内容編集（貸主のみ・pending 時のみ・日時/台数変更）     |
| POST   | `/rental-requests/{id}/accept` | 承認（貸主のみ）→ 予約自動作成                                    |
| POST   | `/rental-requests/{id}/reject` | 拒否（貸主のみ）                                                  |
| POST   | `/rental-requests/{id}/cancel` | キャンセル（貸主のみ・※ISS-008 現在の実装は借主のみ・要修正）    |

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

#### POST `/rental-requests/{id}/accept`

```
1. rental_requests.status を accepted に更新
2. reservations を作成
3. システムメッセージを messages に作成
4. 借主への通知（REQUEST_ACCEPTED）を作成・送信
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
  └── /auth/login              Google ログイン画面

(認証済み・Bottom Tab 5タブ)
  ├── / (index)                ホーム（台車グリッド一覧 + 検索バー）
  │                              ※ useFocusEffect で再取得
  ├── /reservations            予約一覧（受信/送信タブ）
  ├── /messages                メッセージ（スレッド一覧）
  ├── /schedule                スケジュール（今後/過去の予約）
  └── /carts                   台車管理（自分の台車一覧・登録FAB）
                                 ※ useFocusEffect で再取得

  ヘッダー右アイコン（全タブ共通）
  ├── 🔔 通知アイコン（未読バッジ付き） → /notifications
  └── 👤 プロフィールアイコン          → /profile（モーダル）

(スタック画面)
  ├── /profile                 プロフィール表示画面（モーダル）
  ├── /profile-edit            プロフィール編集画面（スタック・戻るボタンあり）
  ├── /carts/new               台車登録フォーム
  ├── /carts/[id]/edit         台車編集フォーム
  ├── /search/[lender_id]      貸主詳細・台車一覧・リクエスト送信
  ├── /requests/[id]           チャット・取引詳細
  └── /notifications           通知一覧・既読管理
```

### 7.2 画面詳細

---

#### `/auth/login` ログイン画面

| 項目     | 内容                             |
| -------- | -------------------------------- |
| 表示条件 | 未認証時のみ                     |
| 表示内容 | アプリロゴ、Googleでログインボタン |
| 遷移先   | ログイン成功 → `/`（ホーム）      |

---

#### `/ (index)` ホーム（台車検索）

| 項目     | 内容                                                            |
| -------- | --------------------------------------------------------------- |
| 表示条件 | 認証済み                                                        |
| 表示内容 | 台車カードグリッド（active のみ）                              |
| 並び順   | 登録順（id DESC）                                               |
| 再取得   | useFocusEffect（タブフォーカス時に自動再取得）                  |
| タップ   | 台車カード → `/search/[lender_id]`                              |
| 空状態   | 条件を変えるよう促すメッセージ                                  |

**検索バー（テキスト入力なし）:**

| ボタン       | 動作                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| 📍 エリア    | エリア選択モーダルを開く。選択中は市区町村名を表示、× で解除          |
| 絞り込み     | 絞り込みモーダルを開く。有効条件数を `(N)` バッジで表示               |

**エリア選択モーダル:**
- `/stations/municipalities` から市区町村一覧を取得
- 以下のグループに自動分類して表示:
  - **東京23区**: 千代田区・中央区・港区 … など23区
  - **東京市部**: 武蔵野市・三鷹市など（`市` で終わる東京の自治体）
  - **神奈川県**: 横浜市〜 / 川崎市〜
  - **その他**: 上記以外
- 「すべてのエリア」を選択すると絞り込み解除

**絞り込みモーダル:**

| 項目           | 内容                                                      |
| -------------- | --------------------------------------------------------- |
| 台車タイプ     | チップ選択（手押し台車 / 平台車 / ハンドトラック / アウトドアワゴン / その他）1択 |
| 折りたたみ可能 | Switch（ON のみに絞り込む）                               |
| リセット       | タイプ・折りたたみをリセット（エリアは保持）              |
| この条件で検索 | 選択を確定してモーダルを閉じる                            |

**アクティブフィルタ チップ（検索バー下）:**
- 有効な絞り込み条件をチップとして横スクロールで表示
- チップ右の × で個別解除

---

#### `/carts` 台車管理

| 項目           | 内容                                                         |
| -------------- | ------------------------------------------------------------ |
| 表示条件       | 認証済み                                                     |
| 表示内容       | 自分の台車一覧（active / inactive 両方表示）                 |
| デフォルト並び順 | 登録が早い順（id ASC）                                     |
| 並び替えオプション | 登録順↑ / 登録順↓ / 価格安い順 / 価格高い順（ドロップダウン） |
| 各カード       | 台車名、料金、ステータスラベル（公開中/非公開）              |
|                | Switch: 公開/非公開トグル → `PATCH /carts/{id}/status`      |
|                | カードタップ → `/carts/[id]/edit`（編集画面）                |
|                | 🗑 ボタン（カードタップのstopPropagation）→ 削除確認 → DELETE |
| FAB            | 「台車を登録」ボタン（画面下部全幅） → `/carts/new`          |
| 再取得         | useFocusEffect（登録・編集後の戻り時に自動再取得）           |
| 空状態         | 台車なしメッセージ + 登録ボタン                              |

---

#### `/carts/new` 台車登録フォーム

| セクション | フィールド                                         | バリデーション      |
| ---------- | -------------------------------------------------- | ------------------- |
| 基本情報   | タイトル（テキスト）                               | 必須                |
|            | カテゴリ（チップ選択）                             | 必須                |
| スペック   | 重量(kg)、最大積載量(kg)、横幅(cm)、奥行(cm)      | 任意・数値          |
|            | 折りたたみ可否（Switch）                           | 任意                |
| 価格       | 日額 / 週額 / 1回あたり（各テキスト入力）          | いずれか1つ以上必須 |
| 貸出場所   | 駅（モーダルピッカー）                             | 必須                |
|            | 場所の詳細（テキスト）                             | 任意                |
| 備考       | フリーテキスト                                     | 任意                |

**駅選択モーダル:** 市区町村一覧 → 駅一覧 の2段階選択。選択済みは駅名を表示。

---

#### `/carts/[id]/edit` 台車編集フォーム

台車登録フォームと同一構成。差分:
- 台車データをAPIから取得してフォームに初期値設定
- `station_id` / `station_name` / `municipality` から駅ピッカーを選択済み状態で表示
- 送信ボタンラベル: 「更新する」
- 保存成功後: `router.back()`（台車管理画面へ戻る）

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

| 項目         | 内容                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| タブ（貸主） | リクエスト受信 / 予約中 / 履歴                                          |
| タブ（借主） | リクエスト送信 / 予約中 / 履歴                                          |
| カード表示   | 台車名・ステータスバッジ・貸出/返却日時・台数・場所・住所・備考         |
| カードタップ | → `/requests/[id]`（チャット画面）                                      |
| 貸主ボタン   | 承認・拒否ボタン（pending 時のみカード内表示）                          |
| 借主         | キャンセルボタンなし（チャットで貸主に依頼）                            |

#### `/requests/[id]` チャット・取引画面

| 項目           | 内容                                                                        |
| -------------- | --------------------------------------------------------------------------- |
| ヘッダー       | 相手のユーザー名（Stack.Screen の title に動的設定）                        |
| リクエスト情報 | 台車名・日時・台数・場所・住所・備考を常時展開表示                          |
| 貸主アクション | pending 時: 承認 / 編集 / 拒否 の3ボタン                                   |
|                | 編集モーダル: 日時（DateTimePicker）・台車カード（+/- カウンター）         |
|                | reserved 時: 貸出開始 / キャンセル                                         |
|                | lent 時: 返却完了                                                           |
|                | returned 時: レビューを書く                                                 |
| チャット       | LINE 風バブル（自分: 右青・相手: 左白）                                     |
| 既読表示       | 自分が送った最後の既読メッセージに「既読」表示                              |
| リアルタイム   | Supabase Realtime（INSERT/UPDATE 購読）+ 5秒ポーリングフォールバック        |
| Pull-to-refresh | 下スワイプでメッセージ + リクエスト情報を再取得                            |
| キーボード     | `automaticallyAdjustKeyboardInsets` + KAV で入力欄が隠れない               |
| 借主           | キャンセルボタンなし                                                        |

#### その他のスタック画面

| 画面                  | 説明                                              |
| --------------------- | ------------------------------------------------- |
| `/messages`           | メッセージスレッド一覧（未読バッジ）              |
| `/schedule`           | 今後7日間 + 全予約一覧                            |
| `/notifications`      | 通知一覧・既読管理                                |
| `/search/[lender_id]` | 貸主詳細・台車一覧・リクエスト送信                |
| `/request-new`        | リクエスト送信画面（日時選択・台車+/- 選択）      |

---

### 7.3 共通UI仕様

| 要素             | 仕様                                                            |
| ---------------- | --------------------------------------------------------------- |
| ヘッダー         | 全タブ共通で 🔔（未読バッジ）・👤 アイコン表示                 |
| 未読バッジ       | Zustand `badgeStore` で管理、Realtime で自動更新               |
| エラー状態       | `ErrorScreen` コンポーネント（再試行ボタン付き）               |
| 空状態           | `EmptyScreen` コンポーネント（説明テキスト + 行動ボタン）      |
| ローディング     | `ActivityIndicator` または `LoadingScreen`                     |
| 再取得タイミング | タブフォーカス時は `useFocusEffect`、定期ポーリングは不要       |

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

> リマインドは APScheduler（または Railway Cron）による定期バッチで送信。
> サーバー側のリマインドタイミングは固定値（貸出60分前・返却60分前）。

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
