import { EXERCISE_PRESETS, type ExercisePreset } from '../data/exercisePresets';
import { createSearcher, normalize } from './textSearch';

/** 運動名で候補を引く。クエリが空なら空配列 */
export const searchExercises: (query: string, limit?: number) => ExercisePreset[] =
  createSearcher(EXERCISE_PRESETS);

/**
 * 入力された運動名に対応するプリセットを1つ選ぶ。
 * 表記ゆれ("クロール"と"くろーる"など)を吸収したいので完全一致ではなく
 * 検索の最上位を採る。ただし部分一致でしかない場合は取り違えが起きる
 * ("水"で水泳が出るなど)ため、名前かよみと正規化後に一致した時だけ返す。
 */
export function matchExercise(name: string): ExercisePreset | undefined {
  const q = normalize(name);
  if (!q) return undefined;
  return searchExercises(name, 1).find(
    (p) => normalize(p.name) === q || normalize(p.kana) === q,
  );
}
