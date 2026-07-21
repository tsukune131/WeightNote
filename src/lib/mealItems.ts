import type { MealItem } from '../db';

/**
 * 食事の内訳(メニュー)と合計kcalの更新。
 *
 * 内訳は「何を食べたか」のメモであって合計の計算元ではない。
 * 追加すれば足し、削除すれば引くが、合計はユーザーが手で書き換えられるので
 * 両者がずれることはある。そのときは合計欄の値を正とする(内訳は触らない)。
 */

/** メニューを1つ足し、そのぶん合計kcalを増やす */
export function withItemAdded(
  items: MealItem[],
  kcal: number,
  item: MealItem,
): { items: MealItem[]; kcal: number } {
  return { items: [...items, item], kcal: kcal + item.kcal };
}

/**
 * i番目のメニューを外し、そのぶん合計kcalを減らす。
 * 合計を手で減らしたあとに削除すると負になりうるので0で止める。
 */
export function withItemRemoved(
  items: MealItem[],
  kcal: number,
  index: number,
): { items: MealItem[]; kcal: number } {
  const target = items[index];
  if (!target) return { items, kcal };
  return {
    items: items.filter((_, i) => i !== index),
    kcal: Math.max(0, kcal - target.kcal),
  };
}
