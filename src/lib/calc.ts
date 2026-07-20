import type { Sex } from '../db';

/** 体脂肪1kgの消費に必要なカロリー */
export const KCAL_PER_KG = 7200;

export const ACTIVITY_LEVELS: { value: number; label: string }[] = [
  { value: 1.2, label: 'ほとんど運動しない' },
  { value: 1.375, label: '軽い運動(週1〜3回)' },
  { value: 1.55, label: '中程度の運動(週3〜5回)' },
  { value: 1.725, label: '激しい運動(週6〜7回)' },
  { value: 1.9, label: '非常に激しい運動・肉体労働' },
];

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(v: number): string {
  if (v < 18.5) return '低体重';
  if (v < 25) return '普通体重';
  if (v < 30) return '肥満(1度)';
  if (v < 35) return '肥満(2度)';
  if (v < 40) return '肥満(3度)';
  return '肥満(4度)';
}

/** メタボリックシンドロームの腹囲判定基準(日本内科学会等の基準。男性85cm/女性90cm以上で該当) */
export const METABO_WAIST_THRESHOLD: Record<Sex, number> = { male: 85, female: 90 };

/** 腹囲がメタボ基準に該当するか */
export function isMetaboWaist(waistCm: number, sex: Sex): boolean {
  return waistCm >= METABO_WAIST_THRESHOLD[sex];
}

export function ageAt(birthDate: string, on: Date = new Date()): number {
  const b = new Date(birthDate + 'T00:00:00');
  let age = on.getFullYear() - b.getFullYear();
  const beforeBirthday =
    on.getMonth() < b.getMonth() ||
    (on.getMonth() === b.getMonth() && on.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** 基礎代謝量(Mifflin-St Jeor式) */
export function bmr(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/** 1日の推定消費カロリー(TDEE) */
export function tdee(bmrKcal: number, activityLevel: number): number {
  return bmrKcal * activityLevel;
}

/** 目標体重達成に必要な総消費カロリー(差分×7200kcal)。既に達成済みなら0 */
export function totalKcalToGoal(currentKg: number, targetKg: number): number {
  return Math.max(0, (currentKg - targetKg) * KCAL_PER_KG);
}

/** from(省略時は今日)からtargetDateまでの残日数。過ぎていれば0 */
export function daysUntil(targetDate: string, from: Date = new Date()): number {
  const t = new Date(targetDate + 'T00:00:00');
  const f = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.max(0, Math.round((t.getTime() - f.getTime()) / 86400000));
}

/** 期間から逆算した必要1日消費カロリー */
export function requiredDailyKcal(totalKcal: number, days: number): number {
  if (days <= 0) return totalKcal > 0 ? Infinity : 0;
  return totalKcal / days;
}

/** 座位ベースの活動係数。カロリー貯金の計算では活動を記録から積み上げるため、二重計上を避けてこれを使う */
export const SEDENTARY_FACTOR = 1.2;

/**
 * 1日のカロリー貯金(消費と摂取の差) = 座位ベース消費(BMR×1.2) + 活動消費(歩数+運動) − 摂取。
 * 運動を増やしても摂取を抑えても貯金は増える。プラスなら体重が減る方向。
 */
export function dailyDeficit(
  bmrKcal: number,
  activityKcal: number,
  intakeKcal: number,
): number {
  return bmrKcal * SEDENTARY_FACTOR + activityKcal - intakeKcal;
}

/**
 * 歩数からの消費カロリー推定。
 * 歩幅0.7m・時速4.8km・歩行3.0METsとして kcal = METs × 体重 × 時間 × 1.05
 */
export function stepsToKcal(steps: number, weightKg: number): number {
  const km = steps * 0.0007;
  const hours = km / 4.8;
  return 3.0 * weightKg * hours * 1.05;
}

/** stepsToKcalの逆算。指定カロリー分を歩くのに必要な歩数 */
export function kcalToSteps(kcal: number, weightKg: number): number {
  if (kcal <= 0 || weightKg <= 0) return 0;
  return kcal / ((0.0007 / 4.8) * 3.0 * weightKg * 1.05);
}

/** ご飯茶碗1杯(中盛り、白米150g)のおおよそのカロリー。食事量の目安換算に使う */
export const RICE_BOWL_KCAL = 240;
