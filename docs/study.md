# ダイシェア 開発学習ノート

> 最終更新: 2026-06-28  
> このプロジェクト（ダイシェア）を題材に、モバイルアプリ開発の仕組みを解説するノート。

---

## 1. サービス概要

「ダイシェア」は台車の個人間レンタルマッチングサービス。

```
貸主（台車を持っている人）
  ↕  アプリでマッチング
借主（台車を借りたい人）
```

### MVPで実装した機能

| 機能 | 内容 |
|---|---|
| 台車登録・検索 | 貸主が台車を登録し、借主がエリア・駅・カテゴリで検索 |
| リクエスト送受信 | 借主がリクエストを送り、貸主が承認・拒否 |
| 問い合わせ（inquiry） | 日程未定のまま質問できる問い合わせフロー |
| チャット | リアルタイムメッセージ（Supabase Realtime） |
| 予約管理 | 貸出開始・返却完了・キャンセル |
| レビュー | 返却後に互いに評価 |
| プッシュ通知 | イベント発生時にスマホへ通知 |
| 画像アップロード | 台車・プロフィール画像（Supabase Storage） |
| プラン管理 | 無料プラン（1台車）／有料プラン（RevenueCat） |

---

## 2. システム全体構成

```
┌──────────────────────────────────────────────────────────┐
│                   ユーザーのスマホ                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │           モバイルアプリ                            │  │
│  │      React Native + Expo SDK 56 (TypeScript)       │  │
│  └──────┬─────────────────────────────────┬───────────┘  │
└─────────│─────────────────────────────────│──────────────┘
          │ REST API                         │ Supabase SDK
          │ (JWT認証付き)                    │ (直接接続)
          ▼                                  ▼
┌─────────────────────┐          ┌───────────────────────────────┐
│  FastAPI            │          │  Supabase                     │
│  (Python 3.12)      │◄────────►│                               │
│                     │ asyncpg  │  ┌─────────────────────────┐  │
│  ・ビジネスロジック  │ (直接SQL) │  │ PostgreSQL（DB）         │  │
│  ・APIエンドポイント │          │  │ staging / production 分離│  │
│  ・JWT検証          │          │  └─────────────────────────┘  │
│                     │          │  ┌──────────┐ ┌───────────┐  │
│  ホスティング:Render │          │  │ Auth     │ │ Realtime  │  │
│  （Docker/無料）    │          │  │(OAuth)   │ │(WS配信)   │  │
└─────────────────────┘          │  └──────────┘ └───────────┘  │
                                 │  ┌──────────────────────────┐ │
                                 │  │ Storage（画像保存）        │ │
                                 │  │ avatars / cart-images    │ │
                                 │  └──────────────────────────┘ │
                                 └───────────────────────────────┘
```

### 役割分担のポイント

| 何をするか | どこが担当するか | なぜ |
|---|---|---|
| データの保存・取得・ロジック | FastAPI | ビジネスルールをサーバー側で一元管理 |
| Google ログイン | Supabase Auth | OAuth 実装を自前でやらなくて済む |
| チャットのリアルタイム受信 | Supabase Realtime | モバイルから直接 WebSocket 接続 |
| 画像のアップロード・配信 | Supabase Storage | CDN付きで簡単 |
| API のアクセス制御 | FastAPI（Service Role Key でRLSバイパス） | ロジックはコードで管理 |
| Realtime/Storage のアクセス制御 | Supabase RLS | anon key からの直接アクセスをポリシーで制御 |

---

## 3. 環境構成（staging / production 分離）

開発中は **staging 環境** でテストし、問題なければ **production 環境** に反映する。

```
開発フロー:

  ローカル PC
     │ feature/xxx ブランチで開発
     │ develop ブランチにマージ
     ▼
  [Staging 環境]──────────────────────────────────────────
  │  API: daishare-api-staging.onrender.com               │
  │  DB:  daishare-staging（Supabase）                    │
  │  用途: 動作確認・テスト                                │
  ─────────────────────────────────────────────────────────
     │ 動作確認OK → develop → main にマージ
     ▼
  [Production 環境]────────────────────────────────────────
  │  API: daishare-api.onrender.com                       │
  │  DB:  daishare-production（Supabase Pro）             │
  │  用途: 実際のユーザーが使う本番環境                    │
  ─────────────────────────────────────────────────────────
```

### なぜ環境を分けるのか

```
staging環境でテスト中
  ↓
バグを発見・修正
  ↓
productionには影響なし（本番ユーザーにはバグが届かない）

もし分けていなかったら...
  テストのデータが本番に混入
  バグが本番ユーザーに影響
  テスト中にサービスが止まる
```

### 各環境の設定ファイル

| ファイル | 接続先 | 用途 |
|---|---|---|
| `mobile/.env.local` | staging Supabase + Docker API | ローカル開発 |
| `mobile/.env.staging` | staging Supabase + staging API | Staging テスト |
| `mobile/.env.production` | production Supabase + production API | App Store 配布版 |

---

## 4. ホスティング（Render）の仕組み

```
GitHub リポジトリ
  │ push / merge
  ▼
Render（自動デプロイ）
  │
  ├── daishare-api（main ブランチ監視）
  │     → https://daishare-api.onrender.com
  │
  └── daishare-api-staging（develop ブランチ監視）
        → https://daishare-api-staging.onrender.com
```

### Render 無料プランのスリープ問題と対策

```
無料プランは15分アクセスがないと「スリープ」する
  ↓ スリープすると最初のリクエストで30秒〜1分待たされる

対策: UptimeRobot（死活監視サービス）
  5分ごとに /health エンドポイントを自動アクセス
  → 常に起きている状態をキープ
```

### Render から Supabase DB への接続（重要な落とし穴）

```
❌ NG: 直接接続 URL
postgresql+asyncpg://postgres:pass@db.XXX.supabase.co:5432/postgres
             ↑ IPv6 アドレスに解決される
             Render 無料プランは IPv6 非対応 → 接続不可

✅ OK: IPv4 接続プーラー URL（Supabase が提供）
postgresql+asyncpg://postgres.PROJECT_REF:pass@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
                    ↑ IPv4 で接続できる
```

Supabase ダッシュボード → Settings → Database → Connection string → Session mode で取得できる。

---

## 5. 技術スタック詳解

### React Native + Expo

```
React Native = JavaScript/TypeScript で iOS・Android 両方のアプリを作れる
Expo = React Native の便利ツールセット

┌──────────────────────────────────────┐
│  Expo SDK 56                          │
│  ┌──────────────────────────────────┐ │
│  │  React Native 0.76               │ │
│  │  ┌────────────────────────────┐  │ │
│  │  │  JavaScript エンジン       │  │ │
│  │  │  (Hermes)                  │  │ │
│  │  └────────────────────────────┘  │ │
│  └──────────────────────────────────┘ │
└──────────────────────────────────────┘
         ↓ ネイティブ変換
┌──────────────┐  ┌──────────────┐
│  iOS (Swift) │  │ Android (Kotlin)│
└──────────────┘  └──────────────┘
```

### Expo Router（画面ナビゲーション）

ファイル名 = 画面パス というシンプルな仕組み。

```
mobile/app/
├── (auth)/login.tsx         → /login
├── (tabs)/
│   ├── index.tsx            → /（ホーム）
│   ├── reservations.tsx     → /reservations
│   ├── messages.tsx         → /messages
│   ├── schedule.tsx         → /schedule
│   └── carts.tsx            → /carts
├── requests/[id].tsx        → /requests/123（[id]が動的パラメータ）
├── profile.tsx              → /profile
└── notifications.tsx        → /notifications

( ) = URLに含まれないグループ（タブバーの設定などに使う）
[ ] = 動的パラメータ（URLの一部が変わる）
```

### FastAPI（バックエンド）

```python
# エンドポイントの例
@router.get("/carts")
async def search_carts(
    municipality: str | None = None,  # クエリパラメータ（任意）
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),  # JWT検証
):
    # DBから条件に合う台車を検索して返す
    ...
```

### Supabase（クラウドサービス）

```
Supabase が提供するもの:

1. PostgreSQL（DB）
   ・普通のSQL が使える
   ・Alembic でマイグレーション管理

2. Auth（認証）
   ・Google OAuth をワンストップで処理
   ・JWT を発行してくれる

3. Realtime
   ・DB の INSERT/UPDATE/DELETE をリアルタイム配信
   ・WebSocket で接続

4. Storage
   ・画像などのファイルを保存
   ・CDN で高速配信
   ・RLS でアクセス制御
```

---

## 6. 認証（ログイン）の仕組み

```
ユーザー操作                   アプリ内                      サーバー側

「Googleでログイン」
ボタンをタップ
      │
      ▼
Google のログイン画面を表示
      │
      ▼
Googleアカウントで認証
      │
      ▼ IDトークン + nonce を受け取る
      │
      ▼
Supabase.auth.signInWithIdToken()
      │
      ▼                                              SupabaseがGoogleトークンを検証
      │                                              ↓
      │                                              JWTを発行
      │
      ▼ JWT（アクセストークン）を受け取る
      │
      ▼
authStore.setUser() で保存
      │
      ▼
以降のAPIリクエストに自動付与
Authorization: Bearer eyJhbGc...
                                                     FastAPIがJWTを検証
                                                     ↓
                                                     ユーザーIDを取り出して処理
```

### nonce とは（セキュリティ用語）

```
nonce（ナンス）= 使い捨ての乱数

なぜ必要か:
  Googleから「このトークンは本物です」という証明書を受け取る
  でも中間者が「そのトークン、私にちょうだい」と盗む可能性がある

  nonce があると:
  「このトークンは nonce=abc123 で作りました」
  Supabase に nonce=abc123 を渡して「一致しますか？」と確認
  盗まれたトークンでは nonce が一致しないので弾ける
```

---

## 7. データの流れ（台車一覧表示の例）

```
[ホーム画面を開く]
      │
      ▼
useFocusEffect 発火（タブを開くたびに実行）
      │
      ▼
fetchCarts() を呼び出す
      │
      ▼
GET /carts?municipality=渋谷区
Authorization: Bearer <JWT>
      │
      ▼ FastAPI が受け取る
      │
      ▼
JWTを検証（正規ユーザーか確認）
      │
      ▼
SELECT * FROM carts WHERE municipality='渋谷区' AND status='active'
（DBから台車を取得）
      │
      ▼
JSON配列で返す
[{ id:1, title:"手押し台車", daily_rate:500, ... }, ...]
      │
      ▼
setCarts(res.data) でReactの状態を更新
      │
      ▼
FlatListが自動的に再描画（2列グリッド）
```

---

## 8. リクエスト〜返却の全フロー

### 通常リクエスト

```
借主                          バックエンド                    貸主

「借りたい」ボタンタップ
      │
      ▼
POST /rental-requests
{ cart_id, start_date,
  end_date, quantity }
                              rental_requests テーブルに
                              status='pending' で INSERT
                                     │
                                     ▼
                              貸主に通知送信
                              （REQUEST_RECEIVED）
                                                         通知受信
                                                         「リクエストが届きました」
                                                              │
                                                              ▼
                                                         「承認」ボタンタップ
                                                              │
                              POST /rental-requests/{id}/accept
                                     │
                                     ▼
                              status → 'accepted' に更新
                              reservations テーブルに INSERT
                              （status='reserved'）
                                     │
                                     ▼
                              借主に通知送信
                              （REQUEST_ACCEPTED）
借主に通知
「承認されました」
```

### 問い合わせ（inquiry）フロー

日程が決まっていない場合の問い合わせ機能。

```
借主                          バックエンド                    貸主

「質問する」ボタンタップ
InquiryModal で
メッセージを入力
      │
      ▼
POST /rental-requests
{ cart_id, message }
← start_date/end_date なし
                              status='inquiry' で INSERT
                              システムメッセージも追加
                                     │
                                     ▼
                              「問い合わせが届きました」通知
                                                         チャット画面で返信
                                                              │
                              ─────────────────────────────────
                              ここから2つのルート:

  ルート①: 借主が日程を決める
  「予約リクエストを送る」
  → DateQtyModal
  → POST /{id}/formalize
  status: inquiry → pending
  → 通常承認フローへ

  ルート②: 貸主が直接確定
  「予約を確定する」
  → DateQtyModal
  → POST /{id}/direct-reserve
  status: inquiry → accepted
  reservation も同時作成
```

### ステータス遷移図

```
rental_requests のステータス:

  [問い合わせ] inquiry ─────────────────────────────────►
                │  (借主: formalize)                     │(貸主: direct-reserve)
                ▼                                        ▼
  [予約待ち]  pending ──► accepted ──────────────────────┘
                │         │  (承認)
                │         ▼
  [拒否]      rejected  reservations 自動作成（status=reserved）
                │
  [キャンセル] cancelled（貸主のみキャンセル可）

reservations のステータス:

  reserved ──► lent ──► returned
    │(貸出開始) │(返却)
    └──────────┴──► cancelled（いつでもキャンセル可）
```

---

## 9. チャット（リアルタイム）の仕組み

```
[メッセージを送信]
ユーザーA                    FastAPI                    ユーザーB

「送信」ボタン
      │
      ▼
POST /rental-requests/{id}/messages
{ body: "明日は使えますか？" }
                    messages テーブルに INSERT
                           │
                           ▼
                    Supabase の PostgreSQL が変化を検知
                           │
                           ▼ WebSocket（Realtime）
                                               ユーザーBのアプリが受信
                                               画面にメッセージが追加される
                                               （リロード不要）
```

### Realtime 購読のコード

```typescript
// チャット画面が開いたとき
const channel = supabase
  .channel(`messages:request:${requestId}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages',
      filter: `rental_request_id=eq.${requestId}` },
    (payload) => {
      // 新メッセージが届いたら画面に追加
      setMessages(prev => [...prev, payload.new as Message]);
    }
  )
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'messages',
      filter: `rental_request_id=eq.${requestId}` },
    (payload) => {
      // 既読更新があったら「既読」表示を更新
      setMessages(prev => prev.map(m =>
        m.id === payload.new.id ? { ...m, is_read: true } : m
      ));
    }
  )
  .subscribe();
```

### フォールバック（Realtime が失敗したとき）

```
Supabase Realtime が繋がらない場合:
  5秒ごとに GET /rental-requests/{id}/messages でポーリング
  （古い方式だが確実）
```

---

## 10. 画像アップロードの仕組み

```
[台車画像を追加]
      │
      ▼
expo-image-picker で端末のカメラロールを開く
（Expo Go では動作しない → Dev Build が必要）
      │
      ▼
画像 URI を取得（ローカルファイルパス）
      │
      ▼
fetch(uri) でバイナリデータに変換
      │
      ▼
supabase.storage.from('cart-images').upload(path, arrayBuffer)
      │
      ▼
Supabase Storage に保存
      │
      ▼
getPublicUrl() でアクセス可能な URL を取得
https://XXX.supabase.co/storage/v1/object/public/cart-images/carts/user123/1234567890.jpg
      │
      ▼
cart の image_urls 配列に追加
POST /carts で台車登録時に一緒に送信
```

### Supabase Storage の RLS（アクセス制御）

```
バケット: cart-images
  ├── SELECT（閲覧）: 全員OK（public）
  │     → 台車画像は誰でも見られる
  └── INSERT（アップロード）: authenticated（ログイン済みのみ）
        → ログインしないと画像を上げられない
```

---

## 11. プッシュ通知の仕組み

```
[リクエストが届いたとき]

FastAPI
   │
   ▼
Expo Push API に POST
https://exp.host/--/api/v2/push/send
{
  to: "ExponentPushToken[xxxxxx]",  ← DBに保存しておいたトークン
  title: "リクエストが届きました",
  body: "手押し台車のリクエスト",
  data: { type: "request_received", related_id: 123 }
}
   │
   ▼
Expo のサーバー
   │ 振り分け
   ├──► Apple APNs ──► iPhone に通知
   └──► Google FCM  ──► Android に通知

[通知をタップ]
      │
      ▼
アプリが data.type を見て遷移先を決める
  request_received   → /(tabs)/reservations
  message_received   → /requests/[related_id]
  review_received    → /search/[自分のuser_id]
```

---

## 12. 状態管理（Zustand）

画面をまたいで共有する情報を管理するしくみ。

```typescript
// authStore: ログインユーザー情報
const authStore = {
  user: User | null,  // ログイン中ユーザー（nullなら未ログイン）
  setUser(user),      // ユーザー情報をセット
  syncUser(),         // GET /users/me で最新情報を取得して更新
}

// badgeStore: 通知バッジ数
const badgeStore = {
  unreadNotifications: number,   // 未読通知数
  fetchUnread(),                 // GET /notifications?unread=true
  clearNotifications(),          // バッジをクリア
}
```

```
ヘッダーの🔔バッジが常に最新になる仕組み:
  ・アプリ起動時に fetchUnread()
  ・30秒ごとにポーリング（setInterval）
  ・AppState が background → active になったとき（アプリ復帰）
  ・通知一覧画面を開いたとき
```

---

## 13. セキュリティ設計

```
┌─────────────────────────────────────────────────────────┐
│  モバイルアプリ（ユーザーが触れる）                      │
│  anon key（公開可）で Supabase に接続                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Supabase RLS（Row Level Security）               │   │
│  │  SELECT avatars: 全員OK                          │   │
│  │  INSERT avatars: authenticated のみ              │   │
│  │  messages 購読: 当事者のみ                       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  FastAPI（サーバー側）                                    │
│  service_role key（秘密）でRLSをバイパス                 │
│  アクセス制御はコードで実装                              │
│                                                          │
│  ・JWT 検証 → ユーザーID を確認                         │
│  ・台車の更新: owner_id == current_user.id を確認        │
│  ・他人の台車は更新できない                              │
└─────────────────────────────────────────────────────────┘
```

---

## 14. データベース構造（ER図）

```
lines（路線）
  │ 1:N
  ▼
stations（駅）
  │           ┌── 1:N ──► cart_locations（台車の貸出拠点）
  │           │
users（ユーザー）
  │ 1:N       │ 1:N
  ▼           ▼
carts（台車）
  │
  │ 1:N（borrower側）
  ▼
rental_requests（リクエスト）
  │ 1:N
  ▼
messages（チャットメッセージ）

rental_requests
  │ 1:1（承認時に自動作成）
  ▼
reservations（予約）
  │ 1:N
  ▼
reservation_carts（予約された台車）

reservations
  │ 1:N（返却後に作成可）
  ▼
reviews（レビュー）

users
  │ 1:N
  ▼
notifications（通知）
```

### 主要テーブルのステータス enum

```
rental_requests.status:
  inquiry   → 問い合わせ（日程未定）
  pending   → 承認待ち
  accepted  → 承認済み
  rejected  → 拒否
  cancelled → キャンセル

reservations.status:
  reserved  → 予約確定（貸出前）
  lent      → 貸出中
  returned  → 返却済み
  cancelled → キャンセル

carts.status:
  active    → 公開中（検索に表示される）
  inactive  → 非公開（自分の管理画面のみ）
  deleted   → 論理削除（表示されない）
```

---

## 15. よく使う開発コマンド

```bash
# ──── モバイル ────
cd mobile

# アプリ起動（Expo Go でスキャン）
npx expo start

# TypeScript 型チェック
npx tsc --noEmit

# ──── バックエンド（ローカル Docker）────
# Docker 起動
docker compose up

# マイグレーション実行
docker compose exec api alembic upgrade head

# API 動作確認
curl http://localhost:8000/health
curl http://localhost:8000/stations/municipalities | python3 -m json.tool

# ──── DB マイグレーション（Supabase クラウド直接）────
cd backend
DATABASE_URL="postgresql+asyncpg://postgres.REF:PASS@aws-1-REGION.pooler.supabase.com:5432/postgres" \
SUPABASE_JWT_SECRET=xxx SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx \
ALLOWED_ORIGINS=http://localhost ENVIRONMENT=staging \
.venv/bin/alembic upgrade head

# ──── Staging/Production API 確認 ────
curl https://daishare-api-staging.onrender.com/health
curl https://daishare-api.onrender.com/health
```

---

## 16. 詰まったときの確認ポイント

| 症状 | 確認場所・コマンド |
|---|---|
| 画面が更新されない | `useFocusEffect` や `useEffect` の依存配列を確認 |
| API 500 エラー | Render のログタブを確認（Logs タブ） |
| DB 接続エラー（Network is unreachable）| DATABASE_URL が IPv4 プーラー URL になっているか確認（ERR-015 参照） |
| ログインできない | Supabase Auth → Redirect URLs に `daishare://auth/callback` があるか |
| 通知が来ない | expo_push_token が DB に保存されているか確認 |
| 画像アップロードできない | Supabase Storage の RLS ポリシーを確認（INSERT: authenticated） |
| Expo Go でカメラロールが開かない | expo-image-picker は Expo Go 非対応（Dev Build が必要）。動的 import でグレースフル対応済み |
| 型エラー | `npx tsc --noEmit` でエラー内容を確認 |
| Staging と Production で挙動が違う | 環境変数（.env.staging / .env.production）とRender環境変数を確認 |
