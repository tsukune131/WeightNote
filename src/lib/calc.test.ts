import { describe, expect, it } from 'vitest';
import {
  ageAt,
  bmi,
  bmiCategory,
  bmr,
  dailyDeficit,
  daysUntil,
  isMetaboWaist,
  kcalToSteps,
  requiredDailyKcal,
  stepsToKcal,
  tdee,
  totalKcalToGoal,
} from './calc';

describe('bmi', () => {
  it('身長170cm・体重70kgでBMI約24.2', () => {
    expect(bmi(70, 170)).toBeCloseTo(24.22, 1);
  });
  it('カテゴリ判定', () => {
    expect(bmiCategory(18)).toBe('低体重');
    expect(bmiCategory(22)).toBe('普通体重');
    expect(bmiCategory(27)).toBe('肥満(1度)');
  });
});

describe('isMetaboWaist', () => {
  it('男性は85cm以上で該当', () => {
    expect(isMetaboWaist(85, 'male')).toBe(true);
    expect(isMetaboWaist(84.9, 'male')).toBe(false);
  });
  it('女性は90cm以上で該当', () => {
    expect(isMetaboWaist(90, 'female')).toBe(true);
    expect(isMetaboWaist(89.9, 'female')).toBe(false);
  });
});

describe('ageAt', () => {
  it('誕生日前は1歳少ない', () => {
    expect(ageAt('1990-06-15', new Date('2026-06-14T00:00:00'))).toBe(35);
    expect(ageAt('1990-06-15', new Date('2026-06-15T00:00:00'))).toBe(36);
  });
});

describe('bmr / tdee', () => {
  it('男性70kg・170cm・36歳のBMR', () => {
    // 10*70 + 6.25*170 - 5*36 + 5 = 1587.5
    expect(bmr(70, 170, 36, 'male')).toBeCloseTo(1587.5);
  });
  it('女性は-161の補正', () => {
    expect(bmr(55, 160, 30, 'female')).toBeCloseTo(10 * 55 + 6.25 * 160 - 150 - 161);
  });
  it('TDEEは活動係数を掛ける', () => {
    expect(tdee(1600, 1.55)).toBeCloseTo(2480);
  });
});

describe('goal calculations', () => {
  it('体重差×7200kcal', () => {
    expect(totalKcalToGoal(70, 65)).toBe(5 * 7200);
  });
  it('目標達成済みなら0', () => {
    expect(totalKcalToGoal(60, 65)).toBe(0);
  });
  it('残日数の計算', () => {
    expect(daysUntil('2026-08-01', new Date('2026-07-19T10:30:00'))).toBe(13);
    expect(daysUntil('2026-07-01', new Date('2026-07-19T00:00:00'))).toBe(0);
  });
  it('必要1日消費カロリー', () => {
    expect(requiredDailyKcal(36000, 30)).toBe(1200);
    expect(requiredDailyKcal(36000, 0)).toBe(Infinity);
    expect(requiredDailyKcal(0, 0)).toBe(0);
  });
});

describe('dailyDeficit', () => {
  it('座位消費+活動−摂取', () => {
    // 1500×1.2 + 300 − 1800 = 300
    expect(dailyDeficit(1500, 300, 1800)).toBeCloseTo(300);
  });
  it('食べ過ぎればマイナス', () => {
    expect(dailyDeficit(1500, 0, 2500)).toBeCloseTo(-700);
  });
});

describe('stepsToKcal', () => {
  it('10000歩・70kgで約322kcal', () => {
    // 7km ÷ 4.8km/h = 1.458h, 3.0 × 70 × 1.458 × 1.05 ≈ 321.6
    expect(stepsToKcal(10000, 70)).toBeCloseTo(321.6, 0);
  });
  it('0歩は0kcal', () => {
    expect(stepsToKcal(0, 70)).toBe(0);
  });
});

describe('kcalToSteps', () => {
  it('stepsToKcalの逆算になっている', () => {
    const steps = kcalToSteps(stepsToKcal(10000, 70), 70);
    expect(steps).toBeCloseTo(10000, 5);
  });
  it('0kcal以下は0歩', () => {
    expect(kcalToSteps(0, 70)).toBe(0);
    expect(kcalToSteps(-10, 70)).toBe(0);
  });
});
