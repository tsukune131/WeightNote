import {
  db,
  type ExerciseEntry,
  type MealEntry,
  type Profile,
  type StepEntry,
  type WeightEntry,
} from '../db';
import { ageAt, bmr, dailyDeficit, stepsToKcal } from './calc';
import { addDays, todayStr } from './date';

export interface DayStat {
  date: string;
  weight?: number;
  intake?: number;
  burn: number;
  /** カロリー貯金(消費−摂取)。食事と体重の記録が揃っている日のみ算出 */
  deficit?: number;
}

export interface RecentStats {
  days: DayStat[];
  /** このプロフィールで体重を記録した全日付(昇順)。ストリーク計算に使う */
  weightDates: string[];
}

/** 今日を含む直近windowDays日分の記録を集計する */
export async function getRecentDayStats(profile: Profile, windowDays: number): Promise<RecentStats> {
  const today = todayStr();
  const start = addDays(today, -(windowDays - 1));

  const range = <T,>(table: 'weights' | 'meals' | 'steps' | 'exercises') =>
    db
      .table(table)
      .where('[profileId+date]')
      .between([profile.id, start], [profile.id, today], true, true)
      .toArray() as Promise<T[]>;

  const [weights, meals, steps, exercises, allWeights] = await Promise.all([
    range<WeightEntry>('weights'),
    range<MealEntry>('meals'),
    range<StepEntry>('steps'),
    range<ExerciseEntry>('exercises'),
    db.weights.where('profileId').equals(profile.id).toArray(),
  ]);

  const sortedWeights = [...allWeights].sort((a, b) => a.date.localeCompare(b.date));
  const age = ageAt(profile.birthDate);

  const days: DayStat[] = [];
  for (let i = 0; i < windowDays; i++) {
    const date = addDays(start, i);
    const w = weights.find((x) => x.date === date);
    const meal = meals.find((x) => x.date === date);
    const step = steps.find((x) => x.date === date);
    const exs = exercises.filter((x) => x.date === date);

    const refWeight =
      w?.kg ?? sortedWeights.filter((x) => x.date <= date).at(-1)?.kg ?? sortedWeights.at(-1)?.kg;

    const stepKcal = step && refWeight != null ? stepsToKcal(step.total, refWeight) : 0;
    const exerciseKcal = exs.reduce((s, e) => s + e.kcal, 0);
    const burn = stepKcal + exerciseKcal;
    const intake = meal ? meal.breakfast + meal.lunch + meal.dinner + meal.snack : undefined;
    const deficit =
      meal != null && refWeight != null
        ? dailyDeficit(bmr(refWeight, profile.heightCm, age, profile.sex), burn, intake ?? 0)
        : undefined;

    days.push({ date, weight: w?.kg, intake, burn, deficit });
  }

  return { days, weightDates: sortedWeights.map((w) => w.date) };
}
