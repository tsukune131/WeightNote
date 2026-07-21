import { FOOD_PRESETS, type FoodPreset } from '../data/foodPresets';
import { createSearcher } from './textSearch';

export { normalize } from './textSearch';

/** 料理名で候補を引く。クエリが空なら空配列 */
export const searchFoods: (query: string, limit?: number) => FoodPreset[] =
  createSearcher(FOOD_PRESETS);

/** 量の倍率。少なめ/普通/大盛 */
export const PORTIONS = [
  { label: '少なめ', mult: 0.7 },
  { label: '普通', mult: 1 },
  { label: '大盛', mult: 1.5 },
] as const;

export function applyPortion(kcal: number, mult: number): number {
  return Math.round(kcal * mult);
}
