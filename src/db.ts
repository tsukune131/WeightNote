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
  useMedication?: boolean; // 服薬管理を使うか
  // 任意の検査値記録。オンにしたものだけ「きょう」に入力欄が出る
  trackHbA1c?: boolean;
  trackGlucose?: boolean;
  trackBloodPressure?: boolean;
  trackLDL?: boolean;
  trackTG?: boolean;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MedicationTiming = 'before' | 'after';
/** meal: 食事ごと(食前後) / weekly: 週1回(曜日指定) / monthly: 月1回(日にち指定) */
export type MedicationFrequency = 'meal' | 'weekly' | 'monthly';

/** 薬の登録情報(日を跨いで引き継がれるマスタ) */
export interface Medication {
  id: number;
  profileId: number;
  name: string;
  /** 未設定の既存データは'meal'として扱う */
  frequency?: MedicationFrequency;
  timing?: MedicationTiming; // 食前・食後(frequency='meal'のみ)
  meals?: MealSlot[]; // 対象の食事(frequency='meal'のみ)
  weekday?: number; // 0(日)〜6(土)。frequency='weekly'のみ
  dayOfMonth?: number; // 1〜31。frequency='monthly'のみ
  startDate?: string; // 登録日(YYYY-MM-DD)。これより前の日は飲み忘れに数えない
}

/** ある日、その薬を飲んだ記録(存在すれば服用済み)。食事ひもづけの薬のみmealを持つ */
export interface MedicationLog {
  id: number;
  profileId: number;
  date: string;
  medicationId: number;
  meal?: MealSlot;
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

/** 任意の検査値。その日ぶんだけ入力があるフィールドを持つ */
export interface HealthMetricEntry {
  id: number;
  profileId: number;
  date: string;
  hba1c?: number; // HbA1c(%)
  glucose?: number; // 血糖値(mg/dL)
  systolic?: number; // 血圧・収縮期(mmHg)
  diastolic?: number; // 血圧・拡張期(mmHg)
  ldl?: number; // LDLコレステロール(mg/dL)
  tg?: number; // 中性脂肪(mg/dL)
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
  medications: EntityTable<Medication, 'id'>;
  medicationLogs: EntityTable<MedicationLog, 'id'>;
  healthMetrics: EntityTable<HealthMetricEntry, 'id'>;
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

// v4: クラウド同期を試験導入(uuid・updatedAt・tombstones)したが、
// ローカルのみのシンプルな構成に戻すため撤去。v4で付いた余分なフィールドは
// 無害な未使用データとして残るのみで、インデックスと墓標テーブルだけ削除する
db.version(5).stores({
  waterLogs: '++id, profileId, [profileId+date]',
  exercises: '++id, profileId, [profileId+date]',
  foods: '++id, profileId',
  tombstones: null,
});

// v6: 服薬管理(薬マスタ+日ごとの服用チェック)を追加
db.version(6).stores({
  medications: '++id, profileId',
  medicationLogs: '++id, profileId, [profileId+date]',
});

// v7: medicationLogsにmedicationIdのインデックスを追加。
// (削除時に where('medicationId') が未定義インデックスでエラーになり、
// トランザクションごと削除がロールバックしていたバグの修正)
// あわせて任意の血液検査値(HbA1c・血糖値・血圧・LDL・中性脂肪)を追加
db.version(7).stores({
  medicationLogs: '++id, profileId, [profileId+date], medicationId',
  healthMetrics: '++id, profileId, [profileId+date]',
});

export async function setActiveProfileId(id: number): Promise<void> {
  await db.settings.put({ key: 'activeProfileId', value: String(id) });
}

export async function deleteProfile(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.profiles,
      db.weights,
      db.meals,
      db.waterLogs,
      db.steps,
      db.exercises,
      db.foods,
      db.notes,
      db.medications,
      db.medicationLogs,
      db.healthMetrics,
    ],
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
        db.medications,
        db.medicationLogs,
        db.healthMetrics,
      ]) {
        await table.where('profileId').equals(id).delete();
      }
    },
  );
}
