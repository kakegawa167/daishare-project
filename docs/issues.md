# ダイシェア 課題管理

> Claude が自律的に解決できないブロッカー・要対応課題を記録するドキュメント。  
> ステータス: `open`（未対応）/ `in-progress`（対応中）/ `resolved`（解決済み）

---

## ISS-001 — Supabase Storage バケットの作成・RLS 設定

| 項目         | 内容                                                                           |
| ------------ | ------------------------------------------------------------------------------ |
| 発生日時     | 2026-06-21 頃                                                                  |
| ステータス   | `resolved`                                                                     |
| 課題内容     | `cart-images`・`avatars` バケットが未作成。RLS ポリシーも未設定               |
| 影響範囲     | 台車画像アップロード機能、アバター画像アップロード機能                         |
| 必要なアクション | 解決済み |
| 解決日時     | 2026-06-26                                                                     |
| 解決方法     | Supabase ダッシュボードで `avatars` / `cart-images` バケットを Public で作成。各バケットに SELECT（全員）/ INSERT（authenticated）の RLS ポリシーを設定 |

---

## ISS-002 — Supabase Realtime の notifications テーブル有効化

| 項目         | 内容                                                                         |
| ------------ | ---------------------------------------------------------------------------- |
| 発生日時     | 2026-06-21 頃                                                                |
| ステータス   | `open`                                                                       |
| 課題内容     | `notifications` テーブルの Supabase Realtime が有効化されていない。通知のリアルタイム受信が動作しない |
| 影響範囲     | 通知バッジのリアルタイム更新、通知一覧のリアルタイム反映                     |
| 必要なアクション | Supabase ダッシュボード → Database → Replication で `notifications` テーブルを有効化。RLS ポリシー（user_id = 本人のみ購読可）も設定する |
| 解決日時     | —                                                                            |
| 解決方法     | —                                                                            |

---

## ISS-003 — Supabase Realtime の messages テーブル RLS 設定

| 項目         | 内容                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| 発生日時     | 2026-06-21 頃                                                                 |
| ステータス   | `open`                                                                        |
| 課題内容     | `messages` テーブルの Realtime は有効化済みだが RLS ポリシーが未設定。認証ユーザー全員が全メッセージを購読できる状態でセキュリティリスクがある |
| 影響範囲     | セキュリティ（他ユーザーのメッセージが閲覧できる可能性）                      |
| 必要なアクション | Supabase ダッシュボードで messages テーブルに RLS ポリシーを設定:<br>「`rental_request_id` の貸主または借主のみ購読可能」 |
| 解決日時     | —                                                                             |
| 解決方法     | —                                                                             |

---

## ISS-004 — バックエンド本番環境の未構築

| 項目         | 内容                                                           |
| ------------ | -------------------------------------------------------------- |
| 発生日時     | 2026-06-21 頃                                                  |
| ステータス   | `resolved`                                                     |
| 課題内容     | バックエンドが本番環境にデプロイされていない                    |
| 影響範囲     | TestFlight 配布・本番リリース全般                              |
| 必要なアクション | 解決済み |
| 解決日時     | 2026-06-26                                                     |
| 解決方法     | Railway から **Render**（無料プラン）に変更。`daishare-api` サービスを作成し GitHub `main` ブランチと連携。環境変数（DATABASE_URL / SUPABASE_* / ENVIRONMENT）を設定しデプロイ完了。URL: `https://daishare-api.onrender.com`。UptimeRobot で5分間隔の死活監視を設定しスリープを防止。モバイルアプリの `EXPO_PUBLIC_API_URL` を Render URL に更新済み |

---

## ISS-005 — EAS Build 未設定（TestFlight 配布不可）

| 項目         | 内容                                                             |
| ------------ | ---------------------------------------------------------------- |
| 発生日時     | 2026-06-21 頃                                                    |
| ステータス   | `open`                                                           |
| 課題内容     | EAS の設定が未完了。TestFlight / Play Store Internal Testing への配布ができない |
| 影響範囲     | 実機テスト、App Store / Play Store 申請                          |
| 必要なアクション | 1. `eas-cli` インストール・`eas login`<br>2. `eas build:configure`<br>3. `eas.json` の各プロファイル設定<br>4. GitHub Secrets に EAS Token を登録<br>5. Apple Developer Program 登録確認 |
| 解決日時     | —                                                                |
| 解決方法     | —                                                                |

---

## ISS-008 — cancel_request エンドポイントの権限が設計と逆

| 項目         | 内容                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| 発生日時     | 2026-06-24                                                                                                            |
| ステータス   | `resolved`                                                                                                            |
| 課題内容     | 設計では「借主はキャンセル不可・貸主がキャンセルする」だが、`POST /rental-requests/{id}/cancel` の実装（`rental_requests.py` L229）は `renter_id == user_id` の借主のみキャンセル可になっていた |
| 影響範囲     | リクエストのキャンセルフロー。UIでは発生しないが直接APIを叩けば借主がキャンセル可能な状態だった |
| 必要なアクション | 解決済み |
| 解決日時     | 2026-06-24                                                                                                            |
| 解決方法     | `rental_requests.py` の `cancel_request` エンドポイントで `r.renter_id` → `r.cart.owner_id` に変更。通知先も `cart.owner_id`（貸主）→ `renter_id`（借主）に修正 |

---

## ISS-007 — Supabase Realtime（messages テーブル）の動作未確認

| 項目         | 内容                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| 発生日時     | 2026-06-24                                                                                    |
| ステータス   | `open`                                                                                        |
| 課題内容     | Alembicマイグレーションで `messages` テーブルに `REPLICA IDENTITY FULL` を設定し `supabase_realtime` パブリケーションへの追加を試みたが、Supabase クラウドの Replication 設定はダッシュボードでの有効化が必要な場合がある。実際にリアルタイムでメッセージが届くかは2端末テストで未確認 |
| 影響範囲     | チャット画面のリアルタイムメッセージ受信・既読 UPDATE 通知                                    |
| 必要なアクション | 1. Supabase ダッシュボード → Database → Replication で `messages` テーブルが `supabase_realtime` パブリケーションに含まれているか確認<br>2. 2アカウントでメッセージ送信テストを実施し、相手側にリアルタイムで届くかを確認<br>3. 未動作の場合は 5秒ポーリングのみで運用 or ダッシュボードから手動で有効化 |
| 解決日時     | —                                                                                             |
| 解決方法     | —                                                                                             |

---

## ISS-006 — expo-image-picker が Expo Go で利用不可

| 項目         | 内容                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| 発生日時     | 2026-06-22                                                                    |
| ステータス   | `in-progress`                                                                 |
| 課題内容     | `expo-image-picker` はネイティブモジュールのため Expo Go では動作しない。アバター変更機能が Expo Go でテストできない |
| 影響範囲     | プロフィール編集画面のアバター変更機能                                        |
| 必要なアクション | EAS Build で Development Build を作成して実機にインストールする（ISS-005 解決後） |
| 暫定対応     | 動的インポート + try/catch で Expo Go 時はアラート表示（グレースフルデグレード）実装済み（ERR-006 参照） |
| 解決日時     | —（ISS-005 解決後に対応予定）                                                |
| 解決方法     | —                                                                             |

---

## ISS-009 — App Store Connect サブスクリプション商品の登録

| 項目             | 内容                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| 発生日時         | 2026-06-25                                                                                             |
| ステータス       | `open`                                                                                                 |
| 課題内容         | App Store Connect に Pro プランのサブスクリプション商品が未登録。RevenueCat との連携に必要              |
| 影響範囲         | 課金フロー全般（購入・更新・解約）                                                                     |
| 必要なアクション | 1. App Store Connect → マイ App → サブスクリプション → 新規作成<br>2. 参照名: 「ダイシェア Pro」、商品 ID: `com.daishare.pro.monthly`<br>3. 価格: ¥300/月<br>4. 説明文・スクリーンショット追加（審査用）<br>5. RevenueCat ダッシュボードに同じ商品 ID を登録 |
| 解決日時         | —                                                                                                      |
| 解決方法         | —                                                                                                      |

---

## ISS-010 — RevenueCat プロジェクト設定・Webhook 設定

| 項目             | 内容                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| 発生日時         | 2026-06-25                                                                                                |
| ステータス       | `open`                                                                                                    |
| 課題内容         | RevenueCat のプロジェクト・アプリ設定が未完了。Webhook 未設定のため Pro/Normal 自動切替が動作しない       |
| 影響範囲         | サブスクリプション状態の自動同期（Pro 昇格・期限切れ後の Normal 降格）                                    |
| 必要なアクション | 1. [RevenueCat](https://app.revenuecat.com) でプロジェクト作成<br>2. iOS アプリ追加（Bundle ID 設定）<br>3. App Store Connect API キーを RevenueCat に登録<br>4. ISS-009 で作成した商品 ID を Entitlement に追加<br>5. Webhook 設定: URL = `https://daishare-api.onrender.com/webhooks/revenuecat`、Authorization ヘッダーにシークレット設定<br>6. `REVENUECAT_WEBHOOK_SECRET` 環境変数を Render に追加<br>7. `EXPO_PUBLIC_REVENUECAT_API_KEY` を mobile/.env に追加（RevenueCat の iOS API キー） |
| 解決日時         | —                                                                                                         |
| 解決方法         | —                                                                                                         |

---

## ISS-011 — react-native-purchases の Dev Build 対応

| 項目             | 内容                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| 発生日時         | 2026-06-25                                                                                       |
| ステータス       | `open`                                                                                           |
| 課題内容         | `react-native-purchases`（RevenueCat SDK）はネイティブモジュールのため Expo Go では動作しない。購入フローが Expo Go でテストできない |
| 影響範囲         | Pro プラン購入・復元フロー                                                                       |
| 必要なアクション | ISS-005（EAS Build）解決後、Dev Build を作成して実機で購入フローをテストする                     |
| 暫定対応         | Expo Go 時は購入ボタンを表示するが、タップ時に「実機ビルドが必要です」Alert を表示するよう実装済み |
| 解決日時         | —（ISS-005 解決後に対応予定）                                                                    |
| 解決方法         | —                                                                                                |

---

## ISS-012 — staging / production 環境分離

| 項目             | 内容                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| 発生日時         | 2026-06-28                                                                             |
| ステータス       | `in-progress`                                                                          |
| 課題内容         | staging と production が同一 Supabase プロジェクトを共用しており、テストデータが本番に混入するリスクがある |
| 影響範囲         | テスト品質・本番データ汚染リスク                                                       |
| 必要なアクション | 1. Supabase Pro にアップグレード（完了）<br>2. `daishare-production` プロジェクト作成（完了）<br>3. production DB にマイグレーション・シード適用（完了）<br>4. Render `daishare-api`（main）の環境変数を production Supabase に更新（ユーザー作業待ち）<br>5. Render `daishare-api-staging`（develop）を新規作成し staging Supabase に接続（ユーザー作業待ち）<br>6. Supabase production に Storage バケット・RLS 設定<br>7. Supabase production に Google OAuth リダイレクト URL 登録 |
| 解決日時         | —                                                                                      |
| 解決方法         | —                                                                                      |
