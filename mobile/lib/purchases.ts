/**
 * RevenueCat SDK ラッパー
 *
 * react-native-purchases はネイティブモジュールのため Expo Go では動作しない。
 * 全関数を try/catch でラップし、Expo Go 時は isAvailable() が false を返す。
 *
 * セットアップ手順 (ISS-010):
 *   1. RevenueCat ダッシュボードで iOS API キーを取得
 *   2. .env に EXPO_PUBLIC_REVENUECAT_API_KEY=appl_xxxxxxxxx を追加
 *   3. EAS Build でネイティブビルドを作成
 */

import { Platform } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const PRO_ENTITLEMENT = 'pro';

/** ネイティブモジュールが利用可能かどうか */
export function isAvailable(): boolean {
  try {
    // モジュールが存在する場合のみ import が成功する
    require('react-native-purchases');
    return true;
  } catch {
    return false;
  }
}

/** アプリ起動時に一度だけ呼ぶ初期化関数 */
export async function initRevenueCat(): Promise<void> {
  if (!isAvailable() || !API_KEY) return;
  try {
    const Purchases = require('react-native-purchases').default;
    if (Platform.OS === 'ios') {
      await Purchases.configure({ apiKey: API_KEY });
    }
  } catch (e) {
    console.warn('[RevenueCat] init failed:', e);
  }
}

/** ログインユーザーの Supabase UUID を RevenueCat に紐付ける */
export async function loginRevenueCat(userId: string): Promise<void> {
  if (!isAvailable()) return;
  try {
    const Purchases = require('react-native-purchases').default;
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn('[RevenueCat] login failed:', e);
  }
}

/** ログアウト時に RevenueCat セッションをリセット */
export async function logoutRevenueCat(): Promise<void> {
  if (!isAvailable()) return;
  try {
    const Purchases = require('react-native-purchases').default;
    await Purchases.logOut();
  } catch (e) {
    console.warn('[RevenueCat] logout failed:', e);
  }
}

export interface PackageInfo {
  identifier: string;
  product: {
    title: string;
    priceString: string;
    description: string;
  };
  rawPackage: unknown;
}

/** 購入可能なパッケージ一覧を取得 */
export async function fetchPackages(): Promise<PackageInfo[]> {
  if (!isAvailable()) return [];
  try {
    const Purchases = require('react-native-purchases').default;
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return [];
    return current.availablePackages.map((pkg: any) => ({
      identifier: pkg.identifier,
      product: {
        title: pkg.product.title,
        priceString: pkg.product.priceString,
        description: pkg.product.description,
      },
      rawPackage: pkg,
    }));
  } catch (e) {
    console.warn('[RevenueCat] fetchPackages failed:', e);
    return [];
  }
}

/** パッケージを購入する。成功時 true、キャンセル時 false */
export async function purchasePackage(rawPackage: unknown): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const Purchases = require('react-native-purchases').default;
    const { customerInfo } = await Purchases.purchasePackage(rawPackage as any);
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] != null;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

/** 購入を復元する。成功時 true */
export async function restorePurchases(): Promise<boolean> {
  if (!isAvailable()) return false;
  try {
    const Purchases = require('react-native-purchases').default;
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT] != null;
  } catch (e) {
    console.warn('[RevenueCat] restore failed:', e);
    return false;
  }
}
