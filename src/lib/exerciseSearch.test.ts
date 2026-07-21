import { describe, expect, it } from 'vitest';
import { matchExercise, searchExercises } from './exerciseSearch';

describe('searchExercises', () => {
  it('よみでも漢字でも引ける', () => {
    expect(searchExercises('すいえい')[0].name).toBe('水泳');
    expect(searchExercises('水泳')[0].name).toBe('水泳');
  });

  it('クエリが空なら候補を返さない', () => {
    expect(searchExercises('')).toEqual([]);
  });
});

describe('matchExercise', () => {
  it('表記ゆれを吸収してMETsを返す', () => {
    expect(matchExercise('クロール')?.mets).toBe(8.3);
    expect(matchExercise('くろーる')?.mets).toBe(8.3);
  });

  it('部分一致しかしない入力では取り違えない', () => {
    // "水"は水泳・水中ウォーキングに部分一致するが、どれとも言い切れない
    expect(matchExercise('水')).toBeUndefined();
    expect(matchExercise('社内清掃')).toBeUndefined();
  });

  it('一覧にない運動はundefined(自由入力を許す)', () => {
    expect(matchExercise('けん玉')).toBeUndefined();
    expect(matchExercise('')).toBeUndefined();
  });
});
