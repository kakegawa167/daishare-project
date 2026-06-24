# モバイルアプリ開発 学習ノート

このプロジェクト（ダイシェア）を題材にした開発の仕組み解説。

---

## 1. 全体のアーキテクチャ

```
┌─────────────────────────────────────────────┐
│              ユーザーのスマホ                │
│   ┌─────────────────────────────────────┐   │
│   │      モバイルアプリ (React Native)   │   │
│   │         ← このプロジェクト          │   │
│   └──────────────┬──────────────────────┘   │
└─────────────────-│───────────────────────────┘
                   │ HTTP通信 (API)
         ┌─────────▼──────────┐
         │  バックエンド       │
         │  FastAPI (Python)  │  ← ビジネスロジック
         └─────────┬──────────┘
                   │ SQL
         ┌─────────▼──────────┐
         │  データベース        │
         │  Supabase (PostgreSQL) │ ← データ保存
         └────────────────────┘
```

モバイルアプリは「画面を表示する」だけで、データの保存・処理はすべてサーバー側で行う。

---

## 2. 技術スタック解説

### React Native とは

JavaScript/TypeScript でiOS・Android両方のアプリを作れるフレームワーク。  
通常 iOS は Swift、Android は Kotlin という別々の言語が必要だが、React Native なら1つのコードで両方動く。

```typescript
// これだけで iOS・Android 両方に「こんにちは」と表示できる
<Text>こんにちは</Text>
```

### Expo とは

React Native をより簡単に使えるようにしたツールキット。  
カメラ・位置情報・通知など、よく使う機能がすぐ使える状態で揃っている。

```
React Native = エンジン
Expo = エンジン + 便利な部品セット
```

### FastAPI とは

Python でAPIサーバーを作るフレームワーク。  
アプリから「台車の一覧ください」とリクエストが来たら、DBから取得して返す役割。

```python
# GET /carts にアクセスされたら台車一覧を返す
@router.get("/carts")
async def search_carts():
    result = await db.execute(select(Cart))
    return result.scalars().all()
```

### Supabase とは

PostgreSQL（データベース）をクラウドで管理してくれるサービス。  
データベース以外に以下も提供している：

| 機能 | 用途 |
|---|---|
| Auth | Google ログインなどの認証 |
| Storage | 画像ファイルの保存 |
| Realtime | リアルタイムでデータ変化を受け取る |

---

## 3. ファイル構成の読み方

```
mobile/
├── app/                    ← 画面ファイル（ここがメイン）
│   ├── (tabs)/             ← タブバーに表示される画面
│   │   ├── index.tsx       ← ホーム画面（台車一覧）
│   │   ├── reservations.tsx ← 予約一覧
│   │   ├── messages.tsx    ← メッセージ
│   │   └── carts.tsx       ← 台車管理
│   ├── (auth)/
│   │   └── login.tsx       ← ログイン画面
│   └── requests/[id]/
│       └── index.tsx       ← チャット・詳細画面
├── lib/
│   ├── api.ts              ← APIとの通信設定
│   ├── supabase.ts         ← Supabase接続設定
│   └── types.ts            ← データの型定義
├── store/
│   ├── authStore.ts        ← ログイン状態を管理
│   └── badgeStore.ts       ← 通知バッジ数を管理
└── hooks/
    └── usePushNotifications.ts ← プッシュ通知の設定
```

### `(tabs)` とは何か

Expo Router はフォルダ名・ファイル名がそのまま URL（画面パス）になる。  
`(tabs)` は「このフォルダ内の画面はタブバーで表示する」という意味。  
`(丸括弧)` はURLには含まれない特別なグループ名。

```
app/(tabs)/index.tsx  →  画面パス: /
app/(tabs)/carts.tsx  →  画面パス: /carts
app/profile-edit.tsx  →  画面パス: /profile-edit
app/requests/[id]/index.tsx  →  画面パス: /requests/123 （[id]が数字になる）
```

---

## 4. データの流れ（台車一覧を表示するまで）

```
1. ユーザーがホームタブを開く

2. index.tsx の useFocusEffect が発火
   └─ fetchCarts() を呼び出す

3. fetchCarts() が API にリクエスト
   └─ GET http://localhost:8000/carts?municipality=渋谷区

4. FastAPI の carts.py が受け取る
   └─ DBから条件に合う台車を検索

5. JSONで台車一覧を返す
   [{ id: 1, title: "手押し台車", daily_rate: 500, ... }, ...]

6. index.tsx が受け取って画面に表示
   └─ FlatList で2列グリッドとして描画
```

### コードで見ると

```typescript
// mobile/app/(tabs)/index.tsx
const fetchCarts = async () => {
  const res = await api.get('/carts', { params: { municipality } });
  setCarts(res.data);  // 受け取ったデータを状態に保存
};

// 状態が更新されると画面が自動的に再描画される
return (
  <FlatList
    data={carts}  // この配列が変わると自動で画面更新
    renderItem={({ item }) => <CartCard cart={item} />}
  />
);
```

---

## 5. 認証（ログイン）の仕組み

```
1. ユーザーが「Googleでログイン」ボタンを押す

2. Google のログイン画面が開く

3. ログイン成功 → Google が「IDトークン」を発行
   （このユーザーは本物のGoogleユーザーですよ、という証明書）

4. IDトークンを Supabase に送る
   supabase.auth.signInWithIdToken({ token: idToken, nonce })

5. Supabase がトークンを検証し、JWTセッションを発行
   （JWT = JSON Web Token、ログイン状態を証明する文字列）

6. 以降のAPIリクエストには JWT を添付
   Authorization: Bearer eyJhbGc...

7. FastAPI が JWT を検証してユーザーを特定
```

### なぜ nonce が必要か（最近修正したバグ）

nonce（ナンス）は「使い捨ての乱数」。  
なりすまし攻撃を防ぐために使う。  
`google-signin v16` から nonce が ID トークンに含まれるようになったため、  
Supabase にも同じ nonce を渡さないとエラーになる。

```typescript
// 修正前（エラー）
const { data } = await GoogleSignin.signIn();
await supabase.auth.signInWithIdToken({ token: data.idToken });
//                                            nonce を渡していない ↑

// 修正後（正常）
const { data } = await GoogleSignin.signIn();
await supabase.auth.signInWithIdToken({ token: data.idToken, nonce: data.nonce });
//                                            nonce も渡す ↑
```

---

## 6. リアルタイム通信の仕組み

チャット画面でメッセージが届いたとき、ページをリロードせずに自動で表示される仕組み。

### ポーリング vs WebSocket vs Supabase Realtime

| 方式 | 仕組み | デメリット |
|---|---|---|
| ポーリング | 一定間隔でAPIに「新着ある？」と聞く | サーバーへの無駄なリクエストが多い |
| WebSocket | サーバーと常時接続、変化があれば即座に受信 | 実装が複雑 |
| Supabase Realtime | PostgreSQLの変更をWebSocketで配信 | Supabase の設定が必要 |

このプロジェクトでは Supabase Realtime を使っている（設定が必要）。  
未設定の間は30秒ポーリングで代替している。

```typescript
// チャット画面でのRealtime購読
const channel = supabase
  .channel(`messages:request:${id}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      // 新しいメッセージが届いたら状態に追加
      setMessages(prev => [...prev, payload.new as Message]);
    }
  )
  .subscribe();
```

---

## 7. プッシュ通知の仕組み

アプリを開いていないときでも通知を受け取れる仕組み。

```
1. アプリ起動時に Expo に「プッシュトークン」を要求
   ExponentPushToken[xxxx-xxxx-xxxx]

2. トークンをバックエンドに保存
   PUT /users/me/push-token

3. 誰かがリクエストを送ったとき、バックエンドが Expo のサーバーに送信依頼
   POST https://exp.host/--/api/v2/push/send
   { to: "ExponentPushToken[xxx]", title: "リクエストが届きました" }

4. Expo のサーバーが Apple/Google の通知サーバーに転送

5. スマホに通知が届く
```

### シミュレーターでは動かない理由

プッシュトークンは実機にしか発行されない。  
シミュレーターはあくまで「Mac上で動く仮想スマホ」なので、  
Apple の通知サーバーに繋がれていない。

---

## 8. 今テストしているフロー

```
リクエスト送信 → 承認 → チャット → 貸出開始 → 返却 → レビュー
```

### 各ステップで何が起きているか

| ステップ | アプリの操作 | バックエンド | 通知 |
|---|---|---|---|
| リクエスト送信 | 台車詳細 → 申請ボタン | rental_requests にINSERT | 貸主に「リクエストが届きました」 |
| 承認 | 予約一覧 → 承認ボタン | status を accepted に更新、reservations にINSERT | 借主に「承認されました」 |
| チャット | チャット画面でメッセージ送信 | messages にINSERT | 相手に「メッセージが届きました」 |
| 貸出開始 | チャット画面 → 貸出開始ボタン | reservations.status を lent に更新 | 借主に「貸出が開始されました」 |
| 返却 | チャット画面 → 返却完了ボタン | status を returned に更新 | 貸主に「返却が完了しました」 |
| レビュー | チャット画面 → レビューを書くボタン | reviews にINSERT | 相手に「レビューが届きました」 |

---

## 9. よく使う開発コマンド

```bash
# アプリ起動（ブラウザでQRコード表示）
cd mobile && npx expo start

# iPhone実機にビルドしてインストール
npx expo run:ios --device

# TypeScriptの型エラーチェック
npx tsc --noEmit

# バックエンド起動（Docker）
docker compose up

# DBマイグレーション実行
docker compose exec api alembic upgrade head

# APIの動作確認
curl http://localhost:8000/carts | python3 -m json.tool
```

---

## 10. 詰まったときの確認ポイント

| 症状 | 確認場所 |
|---|---|
| 画面が更新されない | `useFocusEffect` や `useEffect` の依存配列を確認 |
| APIエラー | Docker が起動しているか確認 `docker compose ps` |
| ログインできない | Supabase の Auth 設定、Google Client ID を確認 |
| 通知が来ない | expo_push_token がDBに保存されているか確認 |
| 型エラー | `npx tsc --noEmit` でエラー内容を確認 |
| iPhoneで動かない | 開発者モードが有効か、署名設定を確認 |
