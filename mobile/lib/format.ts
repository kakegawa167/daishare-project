import { Cart } from './types';

/** 日時を「M/D H:mm」形式に整形（リクエスト・予約・メッセージ画面共通） */
export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/**
 * 日付を「M/D」で整形。ただし今年と異なる年のときだけ「YYYY/M/D」にする。
 * 一覧のように簡潔さが要る箇所で、年跨ぎ・翌年予約の曖昧さを防ぐ。
 */
export const fmtDateSmart = (d: string | Date) => {
  const date = new Date(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    'ja-JP',
    sameYear
      ? { month: 'numeric', day: 'numeric' }
      : { year: 'numeric', month: 'numeric', day: 'numeric' },
  );
};

/** 台車の料金を「¥X/日（or 週 / 回）」形式に整形。日額 > 週額 > 回額 の優先で表示 */
export const formatRate = (cart: Pick<Cart, 'daily_rate' | 'weekly_rate' | 'per_rental_rate'>) =>
  cart.daily_rate != null
    ? `¥${cart.daily_rate.toLocaleString()}/日`
    : cart.weekly_rate != null
    ? `¥${cart.weekly_rate.toLocaleString()}/週`
    : `¥${(cart.per_rental_rate ?? 0).toLocaleString()}/回`;
