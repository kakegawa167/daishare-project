# ダイシェア — 課題管理

> 最終更新: 2026-06-21  
> ステータス凡例: `[ ]` 未対応 / `[→]` 対応中 / `[x]` 解消済み / `[-]` 対応しない

---

## ISSUE-001: Apple Developer Program 未登録

**ステータス**: `[ ]` **対応者**: ユーザー  
**優先度**: 高（リリース前に必須）

**内容**  
Apple Developer Program（$99/年）への登録が完了していない。  
以下の作業がブロックされている。

**影響するタスク**
- `5-2` TestFlight / Internal Testing 配布・動作確認
- `5-4` EAS Build（Production）実行
- `5-4` App Store 審査申請
- `0-7` EAS 設定（eas login / eas build:configure）

**対応手順**
1. https://developer.apple.com/programs/ から登録（$99/年）
2. 登録完了後、Xcode で Apple ID を紐付け
3. EAS Build 設定: `eas build --platform ios --profile production`

---

## ISSUE-002: Railway アカウント・プロジェクト未設定

**ステータス**: `[ ]` **対応者**: ユーザー  
**優先度**: 中（本番デプロイ前に必要）

**内容**  
バックエンドの本番・staging デプロイ先として Railway を使う予定だが未設定。  
現在はローカル Docker のみで動作確認できている状態。

**影響するタスク**
- `0-6` Railway 設定（サービス作成・環境変数・GitHub 連携）
- `0-8` GitHub Actions CD が通ることの確認

**対応手順**
1. https://railway.app にアクセス、GitHub アカウントでサインアップ
2. 新規プロジェクト作成 → GitHub リポジトリ連携
3. `develop` ブランチを staging サービスに、`main` を production に設定
4. 以下の環境変数を Railway 側に設定:
   - `DATABASE_URL` (Supabase connection string)
   - `SUPABASE_JWT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_ORIGINS`

---

## ISSUE-003: GitHub Secrets 未登録

**ステータス**: `[ ]` **対応者**: ユーザー  
**優先度**: 中（CI/CD 完全稼働に必要）

**内容**  
GitHub Actions の backend-deploy.yml / mobile-build.yml が参照する Secrets が未登録。  
現在 `develop` push 時の EAS Build は `main` のみに限定して回避済み。

**影響するタスク**
- `0-8` PR 作成して CI が通ることを確認

**登録が必要な Secrets**（Settings → Secrets and variables → Actions）

| Secret 名 | 値の取得元 |
|-----------|-----------|
| `RAILWAY_TOKEN` | Railway ダッシュボード → Account Settings → Tokens |
| `EXPO_TOKEN` | https://expo.dev → Account → Access Tokens |
| `SUPABASE_DB_URL` | Supabase staging プロジェクト → Settings → Database → Connection string |
| `SUPABASE_JWT_SECRET` | Supabase staging → Settings → API → JWT Secret |

---

## ISSUE-004: Supabase 本番プロジェクト未作成

**ステータス**: `[ ]` **対応者**: ユーザー  
**優先度**: 低（リリース直前に対応）

**内容**  
現在は staging（`daishare-staging`）のみ作成済み。  
本番（`daishare-prod`）は未作成。

**影響するタスク**
- `0-4` production プロジェクト作成
- `5-3` Supabase RLS ポリシーの動作確認

**対応手順**
1. https://supabase.com → New Project → `daishare-prod`
2. URL / Anon Key / JWT Secret / Service Role Key を取得
3. `supabase db push` でマイグレーション適用（本番プロジェクトへ）
4. Storage バケット作成（`cart-images` / `avatar-images`）+ RLS 設定
5. Realtime → Tables で `messages` / `notifications` を有効化
6. Railway の production 環境変数を本番 Supabase に更新

---

## ISSUE-005: プライバシーポリシー URL 未用意

**ステータス**: `[ ]` **対応者**: ユーザー  
**優先度**: 中（App Store 申請に必須）

**内容**  
App Store / Google Play への申請にはプライバシーポリシーの公開 URL が必要。  
個人間取引サービスのため、以下を含むポリシーの作成が必要。

**含めるべき主な項目**
- 収集する情報（Googleアカウント情報、位置情報等）
- 情報の利用目的
- 第三者への提供（Supabase / Expo / Google）
- データ保存期間・削除方法
- お問い合わせ先

**推奨対応**
- GitHub Pages / Notion / Webサイトに公開
- 無料テンプレート例: https://www.freeprivacypolicy.com

---

## ISSUE-006: アプリアイコン・スプラッシュ画像 未作成

**ステータス**: `[ ]` **対応者**: ユーザー（またはデザイナー）  
**優先度**: 中（App Store 申請前に必要）

**内容**  
App Store / Google Play 申請には規定サイズのアイコン・スプラッシュ画像が必要。  
現在はデフォルトの Expo アイコンを使用。

**必要なアセット**

| ファイル | サイズ | 場所 |
|---------|--------|------|
| アプリアイコン | 1024×1024px (PNG) | `mobile/assets/images/icon.png` |
| Adaptive Icon（Android） | 1024×1024px (PNG) | `mobile/assets/images/adaptive-icon.png` |
| スプラッシュ画像 | 1284×2778px (PNG) | `mobile/assets/images/splash-icon.png` |

**デザイン候補**
- 台車のシルエット + 「ダイシェア」テキスト
- メインカラー: `#3b82f6`（青）、背景: `#ffffff`

---

## ISSUE-007: Supabase Storage バケット・RLS 未設定

**ステータス**: `[ ]` **対応者**: ユーザー（Supabase ダッシュボード操作）  
**優先度**: 中（画像アップロード機能に必要）

**内容**  
台車画像・プロフィール画像のアップロードに必要な Storage バケットが未作成。  
コード側の実装（ISSUE 解消後すぐ動く）は先行して進める。

**影響するタスク**
- `2-1` Storage バケット作成 + RLS
- `2-4` 台車画像アップロード
- `1-3` プロフィール画像アップロード

**Supabase ダッシュボードでの手順**
1. Storage → New bucket → `cart-images`（Public: OFF）
2. Storage → New bucket → `avatar-images`（Public: ON）
3. `cart-images` の RLS ポリシー:
   - SELECT: `auth.uid()::text = (storage.foldername(name))[1]` （本人のみ閲覧）  
     ※ または Public にして URL を秘匿する設計でも可
   - INSERT: `auth.uid()::text = (storage.foldername(name))[1]`
   - DELETE: `auth.uid()::text = (storage.foldername(name))[1]`
4. `avatar-images` の RLS ポリシー:
   - SELECT: `true`（全員閲覧可）
   - INSERT/DELETE: `auth.uid()::text = (storage.foldername(name))[1]`

---

## ISSUE-008: Supabase Realtime 設定未対応

**ステータス**: `[ ]` **対応者**: ユーザー（Supabase ダッシュボード操作）  
**優先度**: 中（メッセージリアルタイム受信に必要）

**内容**  
Supabase Realtime でメッセージ・通知をリアルタイム受信するために、  
ダッシュボードでテーブルの Realtime 有効化と RLS 設定が必要。  
モバイル側コードは実装済み（本 issue 解消後に動作する）。

**Supabase ダッシュボードでの手順**
1. Database → Replication → Source → `supabase_realtime` → Tables
2. `messages` テーブルの `INSERT` を有効化
3. `notifications` テーブルの `INSERT` / `UPDATE` を有効化
4. RLS: `messages` に以下ポリシーを追加（Realtime 購読用）
   ```sql
   -- messages の SELECT RLS（当事者のみ）
   CREATE POLICY "messages_select" ON messages
     FOR SELECT USING (
       auth.uid() IN (
         SELECT renter_id FROM rental_requests WHERE id = rental_request_id
         UNION
         SELECT owner_id FROM carts WHERE id IN (
           SELECT cart_id FROM rental_requests WHERE id = rental_request_id
         )
       )
     );
   ```
