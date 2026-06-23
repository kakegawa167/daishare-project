# ダイシェア エラー記録

> 発生したエラーと対応方法を記録するドキュメント。  
> 同じ問題の再発防止・原因調査の参考として使用する。

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
