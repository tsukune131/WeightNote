import { addDays } from './date';

export interface Streak {
  count: number;
  recordedToday: boolean;
}

/**
 * 記録がある日付一覧から、連続記録日数を数える。
 * 今日の記録があれば今日を起点に、まだなければ「今日はまだ」として昨日を起点に数える
 * (今日中に記録すればストリークが継続する状態を維持するため)。
 */
export function calcStreak(recordedDates: string[], today: string): Streak {
  const set = new Set(recordedDates);
  const recordedToday = set.has(today);
  let cursor = recordedToday ? today : addDays(today, -1);
  if (!set.has(cursor)) return { count: 0, recordedToday };

  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return { count, recordedToday };
}
