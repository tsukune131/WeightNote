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
  trackWaist?: boolean;
  trackBloodPressure?: boolean;
  trackGlucose?: boolean;
  // リマインダー通知の設定(発火自体はネイティブアプリ化後に実装。設定のみ先行)
  notifyWeight?: boolean;
  notifyWeightTimes?: string[]; // HH:mmの配列。デフォルト ['07:00', '20:00']
  notifyWaist?: boolean;
  notifyWaistDay?: number; // 毎月の通知日(1〜28)。デフォルト1
}

export const DEFAULT_WEIGHT_NOTIFY_TIMES = ['07:00', '20:00'];
export const DEFAULT_WAIST_NOTIFY_DAY = 1;

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
  waist?: number; // 腹囲(cm)
  systolic?: number; // 血圧・収縮期(mmHg)
  diastolic?: number; // 血圧・拡張期(mmHg)
  glucose?: number; // 血糖値(mg/dL)
}

/**
 * 健康診断・数か月に一度の血液検査の結果。日々の「きょう」入力ではなく、
 * 「あなた」タブで検査日を指定して都度登録する(1回=1行)
 */
export interface BloodTestEntry {
  id: number;
  profileId: number;
  date: string; // 検査日 YYYY-MM-DD
  hba1c?: number; // HbA1c(%)
  ldl?: number; // LDLコレステロール(mg/dL)
  hdl?: number; // HDLコレステロール(mg/dL)
  tg?: number; // 中性脂肪(mg/dL)
  ast?: number; // AST/GOT(U/L)
  alt?: number; // ALT/GPT(U/L)
  ggtp?: number; // γ-GTP(U/L)
  uricAcid?: number; // 尿酸(mg/dL)
  egfr?: number; // eGFR(mL/分/1.73㎡)
}

type BloodTestMetricKey = keyof Omit<BloodTestEntry, 'id' | 'profileId' | 'date'>;

/** 血液検査の項目一覧(あなたタブの入力フォーム・ふりかえりの表で共用) */
export const BLOOD_TEST_FIELDS: { key: BloodTestMetricKey; label: string; unit: string }[] = [
  { key: 'hba1c', label: 'HbA1c', unit: '%' },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL' },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL' },
  { key: 'tg', label: '中性脂肪(TG)', unit: 'mg/dL' },
  { key: 'ast', label: 'AST', unit: 'U/L' },
  { key: 'alt', label: 'ALT', unit: 'U/L' },
  { key: 'ggtp', label: 'γ-GTP', unit: 'U/L' },
  { key: 'uricAcid', label: '尿酸', unit: 'mg/dL' },
  { key: 'egfr', label: 'eGFR', unit: '' },
];

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
  bloodTests: EntityTable<BloodTestEntry, 'id'>;
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

// v8: 健康診断・血液検査の結果(不定期、あなたタブで管理)を追加
db.version(8).stores({
  bloodTests: '++id, profileId, [profileId+date]',
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
      db.bloodTests,
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
        db.bloodTests,
      ]) {
        await table.where('profileId').equals(id).delete();
      }
    },
  );
}
