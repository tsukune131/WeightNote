import { describe, expect, it } from 'vitest';
import { calcStreak } from './streak';

describe('calcStreak', () => {
  it('今日まで連続していれば今日を含めて数える', () => {
    const dates = ['2026-07-17', '2026-07-18', '2026-07-19'];
    expect(calcStreak(dates, '2026-07-19')).toEqual({ count: 3, recordedToday: true });
  });

  it('今日が未記録でも昨日まで連続していれば継続中として数える', () => {
    const dates = ['2026-07-17', '2026-07-18'];
    expect(calcStreak(dates, '2026-07-19')).toEqual({ count: 2, recordedToday: false });
  });

  it('昨日も記録がなければストリークは0', () => {
    const dates = ['2026-07-10'];
    expect(calcStreak(dates, '2026-07-19')).toEqual({ count: 0, recordedToday: false });
  });

  it('記録が1件もなければ0', () => {
    expect(calcStreak([], '2026-07-19')).toEqual({ count: 0, recordedToday: false });
  });

  it('途中に空白日があればそこで打ち切る', () => {
    const dates = ['2026-07-10', '2026-07-17', '2026-07-18', '2026-07-19'];
    expect(calcStreak(dates, '2026-07-19')).toEqual({ count: 3, recordedToday: true });
  });
});
