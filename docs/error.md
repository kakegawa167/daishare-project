# ダイシェア エラー記録

> 発生したエラーと対応方法を記録するドキュメント。  
> 同じ問題の再発防止・原因調査の参考として使用する。

---

## ERR-014 — リクエスト承認時に 500 エラー（daily_rate NOT NULL 違反）

| 項目     | 内容                                                                                        |
| -------- | ------------------------------------------------------------------------------------------- |
| 発生日時 | 2026-06-25                                                                                  |
| 画面     | チャット画面 → 承認ボタン / `POST /rental-requests/{id}/accept`                             |
| 症状     | 承認ボタンを押すと「操作に失敗しました」エラー。サーバーログに `null value in column "daily_rate" of relation "reservations" violates not-null constraint` |
| 原因     | `accept_request` で予約作成時に `daily_rate=r.cart.daily_rate` を設定していたが、台車が `per_rental_rate` や `weekly_rate` のみ設定している場合 `daily_rate` が `None` になり NOT NULL 制約に違反する |
| 対応方法 | `confirmed_rate = r.cart.daily_rate or r.cart.per_rental_rate or r.cart.weekly_rate or 0` で利用可能な料金を順に参照するよう修正 |
| 注意点   | 将来的には `reservations.daily_rate` を `confirmed_rate` にリネームして意味を明確にすることを検討（ISS追加不要・設計上 daily_rate カラム名は維持） |
| 対象ファイル | `backend/app/routers/rental_requests.py` |

---

## ERR-001 — 台車登録後に台車管理・ホーム画面に反映されない

| 項目     | 内容                                                                 |
| -------- | -------------------------------------------------------------------- |
| 発生日時 | 2026-06-21 頃                                                        |
| 画面     | `/carts`（台車管理）、`/`（ホーム）                                  |
| 症状     | 台車登録後に一覧画面に戻っても、新しく登録した台車が表示されない     |
| 原因     | `useEffect` はコンポーネントマウント時のみ実行される。タブ切替・画面戻り時は再マウントされないため、APIが再取得されなかった |
| 対応方法 | `useEffect` → `useFocusEffect`（`expo-router` から import）に変更。画面フォーカス時に毎回APIを再取得するようにした |
| 注意点   | `useFocusEffect` は `@react-navigation/native` ではなく `expo-router` から import する（後者はインストールされていない） |
| 対象ファイル | `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/carts.tsx` |

---

## ERR-002 — `@react-navigation/native` が見つからないエラー

| 項目     | 内容                                                                  |
| -------- | --------------------------------------------------------------------- |
| 発生日時 | 2026-06-21 頃                                                         |
| 症状     | `useFocusEffect` を `@react-navigation/native` から import したところ `Cannot find module '@react-navigation/native'` エラー |
| 原因     | このプロジェクトは Expo Router を使用しており、`@react-navigation/native` は直接インストールされていない |
| 対応方法 | import 元を `expo-router` に変更: `import { useFocusEffect } from 'expo-router'` |
| 対象ファイル | `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/carts.tsx` |

---

## ERR-003 — リマインドタイミングピッカーが表示できない

| 項目     | 内容                                                                 |
| -------- | -------------------------------------------------------------------- |
| 発生日時 | 2026-06-22 頃                                                        |
| 画面     | `/profile`（通知設定・リマインドタイミング）                         |
| 症状     | リマインドタイミングの picker が表示されない、エラーが出る           |
| 原因     | `@react-native-picker/picker` はネイティブモジュールを必要とするため Expo Go では動作しない |
| 対応方法 | ネイティブ依存なしのカスタム `DrumRoll` コンポーネントを実装。`ScrollView` + `snapToInterval` + `decelerationRate="fast"` でiOSタイマー風のドラムロールを再現 |
| 実装詳細 | 上下に PAD 個（2行）の空白行を追加することで端のアイテムも中央表示できるようにした。`contentContainerStyle` の `paddingVertical` は不安定なため行追加方式を採用 |
| 対象ファイル | `mobile/app/(tabs)/profile.tsx`, `mobile/app/profile.tsx` |

---

## ERR-004 — ドラムロールの最後のアイテムが選択できない

| 項目     | 内容                                                                  |
| -------- | --------------------------------------------------------------------- |
| 発生日時 | 2026-06-22 頃                                                         |
| 症状     | 時間ドラムロールで「23時間」「24時間」、分ドラムロールで「50分」が選択できない（スクロールが止まる） |
| 原因     | `ScrollView` の `contentContainerStyle` に `paddingVertical` を設定しても iOS でスクロール端が正しく計算されないケースがある |
| 対応方法 | `paddingVertical` を使うのではなく、items 配列の先頭・末尾に PAD 個分の空行（value が負数のダミー行）を追加する方式に変更 |
| 対象ファイル | `mobile/app/(tabs)/profile.tsx` の `DrumRoll` コンポーネント |

---

## ERR-005 — リマインド表示テキストの「前」が重複する

| 項目     | 内容                                                                      |
| -------- | ------------------------------------------------------------------------- |
| 発生日時 | 2026-06-22 頃                                                             |
| 症状     | リマインドタイミングのサマリー表示が「10分前前に通知」のように「前」が2つ表示される |
| 原因     | `formatReminder()` 関数が「10分前」のように「前」を含む文字列を返し、さらに呼び出し側のJSXで「前に通知」を付けていた |
| 対応方法 | `formatReminder()` の戻り値を「前」なしに変更（例: `10分`、`1時間30分`）し、JSX側で `{formatReminder(n)}前に通知` とまとめて表示するよう統一 |
| 対象ファイル | `mobile/app/(tabs)/profile.tsx`, `mobile/app/profile.tsx` の `formatReminder` 関数 |

---

## ERR-006 — expo-image-picker で Expo Go がクラッシュする

| 項目     | 内容                                                                  |
| -------- | --------------------------------------------------------------------- |
| 発生日時 | 2026-06-22 頃                                                         |
| 症状     | プロフィール画面を開くと `Uncaught Error: Cannot find native module 'ExponentImagePicker'` が表示されアプリがクラッシュ |
| 原因     | `expo-image-picker` はネイティブモジュールを含み、Expo Go では利用できない。ファイル先頭の静的 `import` でモジュール解決が失敗する |
| 対応方法 | 静的 import を削除し、関数呼び出し時に動的 import に変更: `const ImagePicker = await import('expo-image-picker')` + try/catch でエラー時に Alert を表示してグレースフルデグレード |
| 注意点   | Expo Go でのテストではアバター変更機能は動作しない。Dev Build（EAS Build）が必要 |
| 対象ファイル | `mobile/app/profile-edit.tsx`, `mobile/app/(tabs)/profile.tsx` |

---

## ERR-007 — プロフィール編集後に前の画面に戻れなくなる

| 項目     | 内容                                                                    |
| -------- | ----------------------------------------------------------------------- |
| 発生日時 | 2026-06-23 頃                                                           |
| 画面     | `/profile`                                                              |
| 症状     | 「プロフィールを編集」ボタンを押すとインライン編集モードになり、キャンセル手段がなく元の画面に戻れなくなる |
| 原因     | 同一画面内の `editing` フラグで表示を切り替える実装のため、ネイティブの戻るボタンが機能せず、キャンセルボタンも削除されていた |
| 対応方法 | プロフィール表示と編集を別ファイルに分離。`/profile`（表示専用）と `/profile-edit`（編集・通常スタック）に分割し、「プロフィールを編集」ボタンで `router.push('/profile-edit')` へ遷移。ヘッダーのネイティブ戻るボタンでキャンセルできるようになった |
| 対象ファイル | `mobile/app/(tabs)/profile.tsx`（表示専用に変更）, `mobile/app/profile-edit.tsx`（新規作成）, `mobile/app/_layout.tsx`（`profile-edit` スタック画面登録） |

---

## ERR-008 — ドラムロール ScrollView が Card の overflow:hidden でクリップされる

| 項目     | 内容                                                                    |
| -------- | ----------------------------------------------------------------------- |
| 発生日時 | 2026-06-22 頃                                                           |
| 症状     | ドラムロールの上下のアイテムが Card コンポーネントの境界で切れて表示される |
| 原因     | Card コンポーネントに `overflow: 'hidden'` が設定されており、ScrollView の内容がはみ出て表示されるのを妨げていた |
| 対応方法 | Card の StyleSheet から `overflow: 'hidden'` を削除 |
| 対象ファイル | `mobile/app/(tabs)/profile.tsx` の `s.card` スタイル |

---

## ERR-010 — Supabase Realtime チャンネル "cannot add postgres_changes callbacks after subscribe()" エラー

| 項目     | 内容                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------- |
| 発生日時 | 2026-06-24                                                                                     |
| 画面     | `/requests/[id]`（チャット画面）                                                               |
| 症状     | Supabase Realtime の購読設定時に `cannot add postgres_changes callbacks after subscribe()` エラーが発生し、リアルタイム受信が動作しない |
| 原因     | React StrictMode / ホットリロードで `useEffect` が2回実行される。`supabase.channel(同名)` は既に購読済みのチャンネルを返すため、`.on()` を後から追加しようとするとエラーになる |
| 対応方法 | チャンネル名にタイムスタンプを付与してユニーク化（`messages:request:${id}:${Date.now()}`）。`useRef` でチャンネル参照を保持し、`useEffect` の先頭で既存チャンネルを `supabase.removeChannel()` してから新規作成する |
| 注意点   | チャンネル名は同一コンポーネント内でも毎回ユニークにする必要がある。5秒ポーリングフォールバックも追加してRealtime未到達時の補完を実装 |
| 対象ファイル | `mobile/app/requests/[id]/index.tsx` |

---

## ERR-011 — キーボードでメッセージ入力欄が隠れる

| 項目     | 内容                                                                                      |
| -------- | ----------------------------------------------------------------------------------------- |
| 発生日時 | 2026-06-24                                                                                |
| 画面     | `/requests/[id]`（チャット画面）                                                          |
| 症状     | メッセージを入力しようとするとキーボードが表示され、入力欄がキーボードの後ろに隠れてしまう |
| 原因     | `KeyboardAvoidingView` でスクリーン全体を囲っており `keyboardVerticalOffset` が不適切だった |
| 対応方法 | `FlatList` に `automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}` を設定してリストのスクロール領域を自動調整。入力バーのみを `KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}` で囲む構成に変更 |
| 注意点   | `automaticallyAdjustKeyboardInsets` は iOS 15+ で有効。Androidは別途対応が必要 |
| 対象ファイル | `mobile/app/requests/[id]/index.tsx` |

---

## ERR-012 — チャット画面のヘッダーに相手のユーザー名でなく台車名が表示される

| 項目     | 内容                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| 発生日時 | 2026-06-24                                                                    |
| 画面     | `/requests/[id]`（チャット画面）                                              |
| 症状     | チャット画面のヘッダータイトルが相手のユーザー名ではなく台車名になっていた   |
| 原因     | バックエンドの `RentalRequestResponse` に `lender_name` フィールドがなく、フロントエンドも相手の名前を取得・表示していなかった |
| 対応方法 | バックエンド: `Cart.owner` の `selectinload` を追加し `lender_name = r.cart.owner.display_name` をレスポンスに含める。フロントエンド: `Stack.Screen options={{ title: otherName }}` で動的ヘッダータイトルを設定 |
| 対象ファイル | `backend/app/routers/rental_requests.py`, `backend/app/schemas/cart.py`, `mobile/lib/types.ts`, `mobile/app/requests/[id]/index.tsx` |

---

## ERR-013 — 通知タップでチャット画面が開かない（キルド状態）

| 項目     | 内容                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| 発生日時 | 2026-06-24                                                                                    |
| 画面     | プッシュ通知 → アプリ起動フロー                                                               |
| 症状     | アプリがキルド状態のときに通知をタップしてもチャット画面に遷移しない                         |
| 原因     | `addNotificationResponseReceivedListener` はアプリがメモリ上にある場合のみ機能する。キルド状態から起動した場合はリスナーが登録される前に通知イベントが消えてしまう |
| 対応方法 | `Notifications.getLastNotificationResponseAsync()` でキルド状態からの起動を検出し、`setTimeout(300ms)` でナビゲーター準備完了後に遷移を実行。既存リスナーにも `setTimeout(100ms)` のディレイを追加 |
| 注意点   | 通知タイプ `request_received` → 予約一覧、それ以外（メッセージ等）→ チャット画面 の型別遷移も同時に実装 |
| 対象ファイル | `mobile/hooks/usePushNotifications.ts` |

---

## ERR-009 — Google Sign-In で "nonce in id_token" エラー (iPhone実機)

| 項目     | 内容                                                                    |
| -------- | ----------------------------------------------------------------------- |
| 発生日時 | 2026-06-24                                                              |
| 画面     | `/(auth)/login`                                                         |
| 症状     | iPhoneでGoogleログイン後、「passed nonce and nonce in id_token should either both exist or not」エラーが表示されてログインできない |
| 原因     | iOS の Google Sign-In SDK v7 が内部でナンスを自動生成して ID トークン（JWT）に埋め込む。しかし `@react-native-google-signin` v16 はこのナンスを JS 層に公開しないため、Supabase に渡せず検証失敗となる |
| 対応方法 | ネイティブ Google Sign-In SDK を使う `signInWithIdToken` フローを廃止し、`expo-auth-session` + `expo-web-browser` を使った Web OAuth フロー（`supabase.auth.signInWithOAuth`）に切り替えた。ブラウザで Google 認証後、`daishare://auth/callback` にリダイレクトされ URL からトークンを取得する |
| 注意点   | Supabase ダッシュボード → Authentication → URL Configuration → Redirect URLs に `daishare://auth/callback` を追加する必要がある |
| 対象ファイル | `mobile/app/(auth)/login.tsx` |

---

## ERR-015 — Render から Supabase DB に IPv6 で接続できない

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-015                                                                                  |
| 発生日時   | 2026-06-28                                                                               |
| 発生箇所   | Render `daishare-api` / `daishare-api-staging`                                          |
| 症状       | `/stations/municipalities` など全 DB アクセスエンドポイントが 500 Internal Server Error  |
| 原因       | Render free tier は IPv6 非対応。Supabase の直接接続 URL（`db.XXX.supabase.co:5432`）が IPv6 解決されるため接続不可。エラー: `OSError: [Errno 101] Network is unreachable` |
| 対応方法   | DATABASE_URL を Supabase の **IPv4 接続プーラー URL** に変更する。<br>形式: `postgresql+asyncpg://postgres.PROJECT_REF:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`<br>正確な URL は Supabase → Settings → Database → Connection string → Session mode で取得 |
| 注意点     | プーラーホストは `aws-0-` でなく `aws-1-` の場合あり（ダッシュボードで要確認）。新しい Supabase プロジェクトを Render に接続する際は必ずプーラー URL を使用する |
| 対象ファイル | Render 環境変数 `DATABASE_URL`（staging / production 両方）                             |

---

## ERR-016 — 初回ログイン後プロフィール保存で GO_BACK エラー

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-016                                                                                  |
| 発生日時   | 2026-06-29                                                                               |
| 発生箇所   | `mobile/app/profile-edit.tsx` `handleSave()`                                            |
| 症状       | 初回ログイン後にプロフィールを保存すると `GO_BACK was not handled by any navigator` エラー |
| 原因       | `syncUser()`（GET /users/me）が `is_new` フラグを返さないため、`syncUser()` 後に `user?.is_new` をチェックすると `undefined` になり `router.back()` が呼ばれる。初回登録直後はスタックに戻り先がないためエラー |
| 対応方法   | `syncUser()` を呼ぶ前に `const wasNew = user?.is_new` で保存し、そちらで分岐する |
| 対象ファイル | `mobile/app/profile-edit.tsx`                                                           |

---

## ERR-017 — アバター画像アップロード失敗（blob.arrayBuffer 未サポート）

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-017                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | `mobile/app/profile-edit.tsx` アバターアップロード処理                                   |
| 症状       | アイコン変更しようとすると「アイコンのアップロードに失敗しました」エラーが表示される      |
| 原因       | React Native 環境では `blob.arrayBuffer()` がサポートされておらず、Blob → ArrayBuffer の変換でエラーが発生する |
| 対応方法   | `expo-image-picker` で `base64: true` オプションを有効にし、`atob()` + `Uint8Array` で手動変換してアップロードする。`blob.arrayBuffer()` は使用しない |
| 注意点     | React Native で Blob を Supabase Storage にアップロードする際は base64 経由が必須 |
| 対象ファイル | `mobile/app/profile-edit.tsx`                                                           |

---

## ERR-018 — 貸主詳細画面で台車カードが見切れる

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-018                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | `mobile/app/search/[lender_id].tsx`                                                     |
| 症状       | 台車カードの下部がフッターボタンやホームインジケーターに隠れて見切れる                   |
| 原因       | 固定値 `paddingBottom: 120` がフッター高さ + safe area インセットを正確に加味していなかった |
| 対応方法   | `useSafeAreaInsets` を導入し `paddingBottom: 16 + 52 + 16 + insets.bottom + 24` で動的計算。フッターも `paddingBottom: insets.bottom + 16` に変更 |
| 対象ファイル | `mobile/app/search/[lender_id].tsx`                                                     |

---

## ERR-019 — 貸主詳細画面に重複する戻るボタンと "search" テキスト

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-019                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | `mobile/app/search/[lender_id].tsx`、`mobile/app/search/_layout.tsx`、`mobile/app/_layout.tsx` |
| 症状       | ①ナビゲーションヘッダーに "search" と表示される。②カスタム戻るボタンとヘッダーの戻るボタンが重複する |
| 原因       | ルートの `_layout.tsx` が `search` グループのヘッダーを表示していた。グループ名（"search"）がタイトルとして表示された |
| 対応方法   | ルート `_layout.tsx` で `<Stack.Screen name="search" options={{ headerShown: false }} />` を設定してヘッダーを非表示に。画面内のカスタム戻るボタンのみ使用する |
| 対象ファイル | `mobile/app/_layout.tsx`、`mobile/app/search/_layout.tsx`                               |

---

## ERR-020 — ログアウト後にローディングスピナーが無限に回転

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-020                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | `mobile/store/authStore.ts` `signOut()`                                                  |
| 症状       | ログアウト後にローディング画面のスピナーがずっと表示され続け、ログイン画面に遷移しない   |
| 原因       | `signOut()` 内で `loading: false` に設定していなかった。`supabase.auth.signOut()` 後の `onAuthStateChange` イベント（`SIGNED_OUT`）が発火するまでの間、`loading` が `true` のままになる可能性があった |
| 対応方法   | `signOut()` の `set()` 呼び出しに `loading: false` を追加: `set({ session: null, user: null, loading: false })` |
| 対象ファイル | `mobile/store/authStore.ts`                                                              |

---

## ERR-021 — カレンダーで同じ日付を選択しても閉じない

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-021                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | `mobile/app/request-new.tsx` 日付選択                                                    |
| 症状       | ①カレンダーが日付タップ時にインライン表示されず、別ボタンを押す必要があった。②同じ日付を選択してもカレンダーが閉じない |
| 原因       | ①`display="compact"` が iOS で外部ボタン式を使用していた。②`@react-native-community/datetimepicker` の `display="inline"` モードでは同じ日付タップ時に `onChange` が発火しないため、`onChange` でモーダルを閉じる方式では閉じられない |
| 対応方法   | `display="inline"` + `locale="ja-JP"` でカレンダーをインライン表示。Modal内に「確定」ボタンを設置して手動クローズ。`onChange` は `tempDate` のみ更新し、確定ボタン押下時に実際の値をセットしてモーダルを閉じる |
| 対象ファイル | `mobile/app/request-new.tsx`                                                             |

---

## ERR-022 — 時刻ピッカーで時刻変更直後にモーダルが閉じてしまう

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-022                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | `mobile/app/request-new.tsx` 時刻選択                                                    |
| 症状       | 時刻ドラムロールを回すと、変更直後にモーダルが閉じてしまいUXが悪い                       |
| 原因       | `onChange` イベントハンドラー内で `setShowTime(false)` を呼び出していたため、スクロール中に即座にモーダルが閉じていた |
| 対応方法   | Modal ヘッダーにキャンセル/確定ボタンを設置。`onChange` は `tempTime` のみ更新し、確定ボタン押下時にのみ値をセットしてモーダルを閉じる |
| 対象ファイル | `mobile/app/request-new.tsx`                                                             |

---

## ERR-023 — staging 環境でDBパスワード変更後に500エラー

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-023                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | Render `daishare-api-staging`                                                            |
| 症状       | Supabase staging DBのパスワード変更後、全エンドポイントが 500 エラー。ログに `password authentication failed` |
| 原因       | Supabase ダッシュボードでDBパスワードを変更したが、Render の環境変数 `DATABASE_URL` が古いパスワードのままだった |
| 対応方法   | Render ダッシュボード → `daishare-api-staging` → Environment → `DATABASE_URL` を新しいパスワードを含む Session Pooler URL に更新してデプロイ |
| 注意点     | Supabase でパスワードをリセットした場合は必ず Render の環境変数も同時に更新すること。同様に production（`daishare-api`）も更新が必要 |
| 対象ファイル | Render 環境変数 `DATABASE_URL`                                                           |

---

## ERR-024 — iPhone実機デプロイでプロビジョニングプロファイルエラー

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-024                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | `npx expo run:ios --device` コマンド                                                     |
| 症状       | `npx expo run:ios --device` を実行するとプロビジョニングプロファイルエラーが発生してビルド失敗 |
| 原因       | `npx expo run:ios` は内部で `xcodebuild` を呼び出すが、`-allowProvisioningUpdates` フラグを渡さないためプロビジョニングプロファイルの自動更新ができない |
| 対応方法   | `xcodebuild` を直接実行してビルド: `xcodebuild -workspace mobile/ios/DaiShare.xcworkspace -scheme DaiShare -configuration Debug -destination 'id=DEVICE_UDID' -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=R4SN5Y96MF`。その後 `xcrun devicectl device install app --device DEVICE_UDID --path build/Debug-iphoneos/DaiShare.app` でインストール |
| 注意点     | JS コードの変更は Metro（`npx expo start`）+ Fast Refresh で自動反映される。ネイティブコードの変更時のみ `xcodebuild` 再実行が必要 |
| 対象ファイル | `mobile/ios/` ビルド設定                                                                 |

---

## ERR-025 — iOS「利用できません」エラー（開発者を信頼していない）

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-025                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | iPhone アプリ起動時                                                                      |
| 症状       | Dev Build をインストールしてアプリを起動しようとすると「利用できません」と表示される      |
| 原因       | 開発者証明書が iPhone に信頼されていない。サードパーティの開発者アプリを信頼するには手動設定が必要 |
| 対応方法   | iPhone の設定 → 一般 → VPN とデバイス管理 → 開発者アプリ（開発者メールアドレス）→「信頼する」をタップ |
| 注意点     | 証明書を新たにインストールするたびに信頼設定が必要になる場合がある |
| 対象ファイル | iPhone 端末設定                                                                          |

---

## ERR-026 — gitleaks が .env.staging / .env.production をシークレット検知してpushをブロック

| 項目       | 内容                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| エラーID   | ERR-026                                                                                  |
| 発生日時   | 2026-06-30                                                                               |
| 発生箇所   | git push 時の gitleaks pre-push フック                                                   |
| 症状       | `.env.staging` / `.env.production` に含まれる Supabase JWT トークン等がシークレットとして検知され、push がブロックされる |
| 原因       | `.env.staging` / `.env.production` は `.gitignore` で除外済みだが、gitleaks のスキャン対象に含まれていた |
| 対応方法   | `.gitleaks.toml` の `[allowlist]` に `'''\.env\.staging$'''` および `'''\.env\.production$'''` を追加 |
| 注意点     | これらのファイルは `.gitignore` で除外されており git 管理外のため、allowlist 設定のみで問題ない |
| 対象ファイル | `.gitleaks.toml`                                                                         |
