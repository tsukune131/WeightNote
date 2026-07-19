import Dexie, { type EntityTable } from 'dexie';

export type Sex = 'male' | 'female';

export interface Profile {
  id: number;
  name: string;
  heightCm: number;
  birthDate: string; // YYYY-MM-DD
  sex: Sex;
  activityLevel: number;
  targetWeightKg?: number;
  targetFatPct?: number; // 目標体脂肪率(%)
  targetDate?: string; // YYYY-MM-DD
}

export interface WeightEntry {
  id: number;
  profileId: number;
  date: string; // YYYY-MM-DD
  kg: number;
  bodyFatPct?: number; // 体脂肪率(%)
}

export interface MealEntry {
  id: number;
  profileId: number;
  date: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
  breakfastTime?: string; // HH:mm
  lunchTime?: string;
  dinnerTime?: string;
  snackTime?: string;
}

export interface WaterLog {
  id: number;
  profileId: number;
  date: string;
  time: string; // HH:mm
  ml: number;
}

export interface StepEntry {
  id: number;
  profileId: number;
  date: string;
  total: number;
  hourly?: number[]; // 24要素。未入力の時間帯は0
}

export interface ExerciseEntry {
  id: number;
  profileId: number;
  date: string;
  name: string;
  kcal: number;
}

/** 1日1ページの日記メモ */
export interface NoteEntry {
  id: number;
  profileId: number;
  date: string;
  text: string;
}

/** マイメニュー(よく食べる物の登録) */
export interface Food {
  id: number;
  profileId: number;
  name: string;
  kcal: number;
  uses: number; // 使用回数(よく使う順の表示用)
}

export interface Setting {
  key: string;
  value: string;
}

export const db = new Dexie('weight-app') as Dexie & {
  profiles: EntityTable<Profile, 'id'>;
  weights: EntityTable<WeightEntry, 'id'>;
  meals: EntityTable<MealEntry, 'id'>;
  waterLogs: EntityTable<WaterLog, 'id'>;
  steps: EntityTable<StepEntry, 'id'>;
  exercises: EntityTable<ExerciseEntry, 'id'>;
  foods: EntityTable<Food, 'id'>;
  notes: EntityTable<NoteEntry, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  profiles: '++id',
  weights: '++id, profileId, [profileId+date]',
  meals: '++id, profileId, [profileId+date]',
  waterLogs: '++id, profileId, [profileId+date]',
  steps: '++id, profileId, [profileId+date]',
  exercises: '++id, profileId, [profileId+date]',
  settings: 'key',
});

// v2: マイメニュー(foods)を追加
db.version(2).stores({
  foods: '++id, profileId',
});

// v3: 日記メモ(notes)を追加
db.version(3).stores({
  notes: '++id, profileId, [profileId+date]',
});

export async function setActiveProfileId(id: number): Promise<void> {
  await db.settings.put({ key: 'activeProfileId', value: String(id) });
}

export async function deleteProfile(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.weights, db.meals, db.waterLogs, db.steps, db.exercises, db.foods, db.notes],
    async () => {
      await db.profiles.delete(id);
      for (const table of [
        db.weights,
        db.meals,
        db.waterLogs,
        db.steps,
        db.exercises,
        db.foods,
        db.notes,
      ]) {
        await table.where('profileId').equals(id).delete();
      }
    },
  );
}
