import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Food, type MealSlot, type Profile } from '../db';
import { MedicationManager } from '../components/MedicationManager';
import { StreakSummary } from '../components/StreakSummary';
import { TodayPrescription } from '../components/TodayPrescription';
import {
  ageAt,
  bmr,
  dailyDeficit,
  daysUntil,
  requiredDailyKcal,
  stepsToKcal,
  totalKcalToGoal,
} from '../lib/calc';
import {
  addDays,
  dayOfMonthOf,
  formatDateShort,
  isLastDayOfMonth,
  nowTimeStr,
  todayStr,
  weekdayOf,
} from '../lib/date';
import { cancelTodaysConditionalWeightReminders } from '../lib/platform';
import { tipForDate } from '../lib/tips';

export function RecordPage({ profile }: { profile: Profile }) {
  const [date, setDate] = useState(todayStr());

  return (
    <div>
      <StreakSummary profile={profile} />
      <TodayPrescription profile={profile} />

      <div className="tip-card">
        <span className="tip-label">きょうのひとこと</span>
        <p>{tipForDate(todayStr(), profile.useMedication ?? false)}</p>
      </div>

      <div className="date-nav">
        <button onClick={() => setDate((d) => addDays(d, -1))}>◀</button>
        <div className="title">{formatDateShort(date)}</div>
        <button onClick={() => setDate((d) => addDays(d, 1))} disabled={date >= todayStr()}>
          ▶
        </button>
        <button onClick={() => setDate(todayStr())} disabled={date === todayStr()}>
          今日
        </button>
      </div>

      <WeightSection key={`w-${profile.id}-${date}`} profileId={profile.id} date={date} />
      <HealthMetricsSection key={`h-${profile.id}-${date}`} profile={profile} date={date} />
      <MealSection key={`m-${profile.id}-${date}`} profile={profile} date={date} />
      <WaterSection profileId={profile.id} date={date} />
      <StepsSection key={`s-${profile.id}-${date}`} profileId={profile.id} date={date} />
      <ExerciseSection profileId={profile.id} date={date} />
      <NoteSection key={`n-${profile.id}-${date}`} profileId={profile.id} date={date} />
      <DailySummary profile={profile} date={date} />
    </div>
  );
}

function useEntry<T>(table: string, profileId: number, date: string): T | undefined {
  return useLiveQuery(
    () => db.table(table).where('[profileId+date]').equals([profileId, date]).first() as Promise<T | undefined>,
    [table, profileId, date],
  );
}

/* ---------- 体重 ---------- */

function WeightSection({ profileId, date }: { profileId: number; date: string }) {
  const entry = useEntry<{ id: number; kg: number; bodyFatPct?: number }>(
    'weights',
    profileId,
    date,
  );
  const [kg, setKg] = useState('');
  const [fat, setFat] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (entry) {
      setKg(String(entry.kg));
      setFat(entry.bodyFatPct != null ? String(entry.bodyFatPct) : '');
    }
  }, [entry?.id]);

  async function save() {
    const v = Number(kg);
    if (!(v > 0)) return;
    const f = Number(fat);
    const data = { kg: v, bodyFatPct: f > 0 ? f : undefined };
    if (entry) await db.weights.update(entry.id, data);
    else await db.weights.add({ profileId, date, ...data } as never);
    // 今日の体重を記録したら、2件目以降のリマインダー通知は不要なので取り消す
    if (date === todayStr()) await cancelTodaysConditionalWeightReminders();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card">
      <h2>体重・体脂肪率</h2>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          体重(kg)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          体脂肪率(%)
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            max="80"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
          />
        </label>
        <button onClick={() => void save()} disabled={!(Number(kg) > 0)} style={{ flex: '0 0 auto' }}>
          {saved ? '保存済み✓' : '保存'}
        </button>
      </div>
    </div>
  );
}

/* ---------- 検査値 ---------- */

// 腹囲はメタボ基準の必須項目のため常時表示。血糖値は任意
const OPTIONAL_METRIC_FIELDS = [['glucose', '血糖値', 'mg/dL', 'trackGlucose']] as const;

function HealthMetricsSection({ profile, date }: { profile: Profile; date: string }) {
  const profileId = profile.id;
  const entry = useEntry<{
    id: number;
    waist?: number;
    glucose?: number;
    systolic?: number;
    diastolic?: number;
  }>('healthMetrics', profileId, date);

  const [values, setValues] = useState<Record<string, string>>({});
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (entry) {
      setValues({
        waist: entry.waist != null ? String(entry.waist) : '',
        glucose: entry.glucose != null ? String(entry.glucose) : '',
      });
      setSystolic(entry.systolic != null ? String(entry.systolic) : '');
      setDiastolic(entry.diastolic != null ? String(entry.diastolic) : '');
    }
  }, [entry?.id]);

  const activeFields = OPTIONAL_METRIC_FIELDS.filter(([, , , flag]) => profile[flag]);

  async function save() {
    const data: Record<string, number | undefined> = {};
    const w = Number(values.waist);
    data.waist = w > 0 ? w : undefined;
    for (const [key] of OPTIONAL_METRIC_FIELDS) {
      const v = Number(values[key]);
      data[key] = v > 0 ? v : undefined;
    }
    const sys = Number(systolic);
    const dia = Number(diastolic);
    data.systolic = sys > 0 ? sys : undefined;
    data.diastolic = dia > 0 ? dia : undefined;

    if (entry) await db.healthMetrics.update(entry.id, data);
    else await db.healthMetrics.add({ profileId, date, ...data } as never);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card">
      <h2>検査値</h2>
      <label className="field">
        腹囲(cm)
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={values.waist ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, waist: e.target.value }))}
        />
      </label>
      {activeFields.map(([key, label, unit]) => (
        <label className="field" key={key}>
          {label}({unit})
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={values[key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </label>
      ))}
      {profile.trackBloodPressure && (
        <div className="row">
          <label className="field">
            血圧・収縮期(mmHg)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value)}
            />
          </label>
          <label className="field">
            血圧・拡張期(mmHg)
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value)}
            />
          </label>
        </div>
      )}
      <button onClick={() => void save()}>{saved ? '保存済み✓' : '保存'}</button>
    </div>
  );
}

/* ---------- 食事カロリー ---------- */

const MEAL_FIELDS = [
  ['breakfast', '朝食'],
  ['lunch', '昼食'],
  ['dinner', '夕食'],
  ['snack', '間食'],
] as const;

function MealSection({ profile, date }: { profile: Profile; date: string }) {
  const profileId = profile.id;
  const entry = useEntry<{
    id: number;
    breakfast: number;
    lunch: number;
    dinner: number;
    snack: number;
    breakfastTime?: string;
    lunchTime?: string;
    dinnerTime?: string;
    snackTime?: string;
  }>('meals', profileId, date);
  const [values, setValues] = useState<Record<string, string>>({
    breakfast: '',
    lunch: '',
    dinner: '',
    snack: '',
  });
  const [times, setTimes] = useState<Record<string, string>>({
    breakfast: '',
    lunch: '',
    dinner: '',
    snack: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (entry) {
      setValues({
        breakfast: entry.breakfast ? String(entry.breakfast) : '',
        lunch: entry.lunch ? String(entry.lunch) : '',
        dinner: entry.dinner ? String(entry.dinner) : '',
        snack: entry.snack ? String(entry.snack) : '',
      });
      setTimes({
        breakfast: entry.breakfastTime ?? '',
        lunch: entry.lunchTime ?? '',
        dinner: entry.dinnerTime ?? '',
        snack: entry.snackTime ?? '',
      });
    }
  }, [entry?.id]);

  const total = MEAL_FIELDS.reduce((sum, [k]) => sum + (Number(values[k]) || 0), 0);

  // マイメニュー
  const foods = useLiveQuery(
    async () => {
      const rows = await db.foods.where('profileId').equals(profileId).toArray();
      rows.sort((a, b) => b.uses - a.uses);
      return rows;
    },
    [profileId],
  );
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newKcal, setNewKcal] = useState('');

  async function applyFood(key: string, food: Food) {
    // 選んだメニューのkcalをその食事に加算。時刻が未入力なら現在時刻を入れる
    setValues((v) => ({ ...v, [key]: String((Number(v[key]) || 0) + food.kcal) }));
    setTimes((t) => (t[key] ? t : { ...t, [key]: nowTimeStr() }));
    await db.foods.update(food.id, { uses: food.uses + 1 });
  }

  async function addFood() {
    const k = Number(newKcal);
    if (!newName.trim() || !(k > 0)) return;
    await db.foods.add({ profileId, name: newName.trim(), kcal: k, uses: 0 } as never);
    setNewName('');
    setNewKcal('');
  }

  // 服薬管理
  const useMedication = profile.useMedication ?? false;
  const [showMedManager, setShowMedManager] = useState(false);
  const medications = useLiveQuery(
    async () => (useMedication ? db.medications.where('profileId').equals(profileId).toArray() : []),
    [profileId, useMedication],
  );
  const medLogs = useLiveQuery(
    async () =>
      useMedication
        ? db.medicationLogs.where('[profileId+date]').equals([profileId, date]).toArray()
        : [],
    [profileId, date, useMedication],
  );

  async function toggleUseMedication(checked: boolean) {
    await db.profiles.update(profileId, { useMedication: checked });
    if (!checked) setShowMedManager(false);
  }

  async function toggleTaken(medicationId: number, meal: MealSlot | undefined, taken: boolean) {
    const existing = medLogs?.find((l) => l.medicationId === medicationId && l.meal === meal);
    if (taken && !existing) {
      await db.medicationLogs.add({ profileId, date, medicationId, meal } as never);
    } else if (!taken && existing) {
      await db.medicationLogs.delete(existing.id);
    }
  }

  const mealMedications = (medications ?? []).filter((m) => (m.frequency ?? 'meal') === 'meal');
  const otherMedications = (medications ?? []).filter((m) => {
    const freq = m.frequency ?? 'meal';
    if (freq === 'weekly') return (m.weekday ?? 0) === weekdayOf(date);
    if (freq === 'monthly')
      return m.dayOfMonth === dayOfMonthOf(date) || ((m.dayOfMonth ?? 1) > 28 && isLastDayOfMonth(date));
    return false;
  });

  async function save() {
    const data = {
      breakfast: Number(values.breakfast) || 0,
      lunch: Number(values.lunch) || 0,
      dinner: Number(values.dinner) || 0,
      snack: Number(values.snack) || 0,
      breakfastTime: times.breakfast || undefined,
      lunchTime: times.lunch || undefined,
      dinnerTime: times.dinner || undefined,
      snackTime: times.snack || undefined,
    };
    if (entry) await db.meals.update(entry.id, data);
    else await db.meals.add({ profileId, date, ...data } as never);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>食事</h2>
        <label className="checkbox-inline muted">
          <input
            type="checkbox"
            checked={useMedication}
            onChange={(e) => void toggleUseMedication(e.target.checked)}
          />
          💊 服薬も記録する
        </label>
      </div>
      {useMedication && (
        <>
          <button
            className={`ghost menu-toggle ${showMedManager ? 'active' : ''}`}
            onClick={() => setShowMedManager((v) => !v)}
          >
            💊 薬を管理
          </button>
          {showMedManager && <MedicationManager profileId={profileId} />}
        </>
      )}
      {useMedication && otherMedications.length > 0 && (
        <div className="medicine-box">
          <div className="muted" style={{ fontSize: 11 }}>
            きょうのその他のお薬
          </div>
          {otherMedications.map((m) => {
            const taken = medLogs?.some((l) => l.medicationId === m.id && l.meal == null) ?? false;
            return (
              <label className="checkbox-inline medicine-row" key={m.id}>
                <input
                  type="checkbox"
                  checked={taken}
                  onChange={(e) => void toggleTaken(m.id, undefined, e.target.checked)}
                />
                💊 {m.name}
                <span className="muted">
                  ({(m.frequency ?? 'meal') === 'weekly' ? '週1回' : '月1回'})
                </span>
              </label>
            );
          })}
        </div>
      )}
      {MEAL_FIELDS.map(([key, label]) => {
        const medsForMeal = mealMedications.filter((m) => (m.meals ?? []).includes(key));
        return (
        <div key={key}>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field">
              {label}(kcal)
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </label>
            <label className="field field-fixed-time">
              時刻
              <input
                type="time"
                value={times[key]}
                onChange={(e) => setTimes((t) => ({ ...t, [key]: e.target.value }))}
              />
            </label>
          </div>
          {useMedication && medsForMeal.length > 0 && (
            <div className="medicine-box">
              {medsForMeal.map((m) => {
                const taken =
                  medLogs?.some((l) => l.medicationId === m.id && l.meal === key) ?? false;
                return (
                  <label className="checkbox-inline medicine-row" key={m.id}>
                    <input
                      type="checkbox"
                      checked={taken}
                      onChange={(e) => void toggleTaken(m.id, key, e.target.checked)}
                    />
                    💊 {m.name}
                    <span className="muted">({m.timing === 'before' ? '食前' : '食後'})</span>
                  </label>
                );
              })}
            </div>
          )}
          <button
            className={`ghost menu-toggle ${menuFor === key ? 'active' : ''}`}
            onClick={() => setMenuFor((cur) => (cur === key ? null : key))}
          >
            ＋ マイメニューから選ぶ
          </button>
          {menuFor === key && (
            <div className="menu-panel">
              {(foods ?? []).length === 0 && (
                <p className="muted" style={{ margin: '0 0 6px' }}>
                  よく食べる物を登録すると、タップするだけでカロリーを入力できます。
                </p>
              )}
              {(foods ?? []).length > 0 && (
                <div className="chips">
                  {foods!.map((f) => (
                    <span className="chip" key={f.id}>
                      <button className="chip-main" onClick={() => void applyFood(key, f)}>
                        {f.name} {f.kcal}kcal
                      </button>
                      <button
                        className="chip-x"
                        aria-label={`${f.name}を削除`}
                        onClick={() => void db.foods.delete(f.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
                <label className="field" style={{ marginBottom: 0 }}>
                  名前
                  <input
                    type="text"
                    placeholder="例: 納豆ごはん"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </label>
                <label className="field" style={{ marginBottom: 0 }}>
                  kcal
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={newKcal}
                    onChange={(e) => setNewKcal(e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  style={{ flex: '0 0 auto' }}
                  onClick={() => void addFood()}
                  disabled={!newName.trim() || !(Number(newKcal) > 0)}
                >
                  登録
                </button>
              </div>
            </div>
          )}
        </div>
        );
      })}
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="muted">合計 {total.toLocaleString()} kcal</div>
        <button onClick={() => void save()} style={{ flex: '0 0 auto' }}>
          {saved ? '保存済み✓' : '保存'}
        </button>
      </div>
    </div>
  );
}

/* ---------- 飲水 ---------- */

function WaterSection({ profileId, date }: { profileId: number; date: string }) {
  const logs = useLiveQuery(
    async () => {
      const rows = await db.waterLogs.where('[profileId+date]').equals([profileId, date]).toArray();
      rows.sort((a, b) => a.time.localeCompare(b.time));
      return rows;
    },
    [profileId, date],
  );
  const [custom, setCustom] = useState('');

  const total = (logs ?? []).reduce((s, l) => s + l.ml, 0);

  async function add(ml: number) {
    if (!(ml > 0)) return;
    await db.waterLogs.add({ profileId, date, time: nowTimeStr(), ml } as never);
  }

  return (
    <div className="card">
      <h2>飲水 <span className="chart-sub">合計 {total.toLocaleString()} ml</span></h2>
      <div className="row">
        {(
          [
            { ml: 100, label: '1〜2口' },
            { ml: 200, label: 'コップ1杯' },
            { ml: 500, label: 'ペットボトル' },
          ] as const
        ).map(({ ml, label }) => (
          <button key={ml} className="secondary water-btn" onClick={() => void add(ml)}>
            {label}
            <small>{ml}ml</small>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          その他(ml)
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            void add(Number(custom));
            setCustom('');
          }}
          disabled={!(Number(custom) > 0)}
          style={{ flex: '0 0 auto' }}
        >
          追加
        </button>
      </div>
      {(logs ?? []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {logs!.map((l) => (
            <div className="list-item" key={l.id}>
              <span>
                {l.time} <strong>{l.ml}ml</strong>
              </span>
              <button className="danger" onClick={() => void db.waterLogs.delete(l.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 歩数 ---------- */

function StepsSection({ profileId, date }: { profileId: number; date: string }) {
  const entry = useEntry<{ id: number; total: number; hourly?: number[] }>(
    'steps',
    profileId,
    date,
  );
  const [total, setTotal] = useState('');
  const [hourly, setHourly] = useState<string[]>(Array(24).fill(''));
  const [showHourly, setShowHourly] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (entry) {
      setTotal(String(entry.total));
      if (entry.hourly) {
        setHourly(entry.hourly.map((v) => (v ? String(v) : '')));
        setShowHourly(entry.hourly.some((v) => v > 0));
      }
    }
  }, [entry?.id]);

  const hourlyNums = hourly.map((v) => Number(v) || 0);
  const hourlySum = hourlyNums.reduce((a, b) => a + b, 0);
  const hasHourly = hourlySum > 0;

  async function save() {
    const t = hasHourly ? hourlySum : Number(total) || 0;
    const data = { total: t, hourly: hasHourly ? hourlyNums : undefined };
    if (entry) await db.steps.update(entry.id, data);
    else await db.steps.add({ profileId, date, ...data } as never);
    setTotal(String(t));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card">
      <h2>歩数</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        iPhoneのヘルスケアアプリの歩数を転記してください。
      </p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          1日の合計歩数{hasHourly && '(時間帯別の合計で上書き)'}
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={hasHourly ? String(hourlySum) : total}
            disabled={hasHourly}
            onChange={(e) => setTotal(e.target.value)}
          />
        </label>
        <button onClick={() => void save()} style={{ flex: '0 0 auto' }}>
          {saved ? '保存済み✓' : '保存'}
        </button>
      </div>
      <button
        className="ghost"
        style={{ marginTop: 8 }}
        onClick={() => setShowHourly((v) => !v)}
      >
        {showHourly ? '▲ 時間帯別入力を閉じる' : '▼ 時間帯別(1時間ごと)に入力する'}
      </button>
      {showHourly && (
        <div className="hourly-grid" style={{ marginTop: 8 }}>
          {hourly.map((v, h) => (
            <label key={h}>
              {h}時
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={v}
                onChange={(e) =>
                  setHourly((arr) => arr.map((x, i) => (i === h ? e.target.value : x)))
                }
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 運動 ---------- */

function ExerciseSection({ profileId, date }: { profileId: number; date: string }) {
  const items = useLiveQuery(
    () => db.exercises.where('[profileId+date]').equals([profileId, date]).toArray(),
    [profileId, date],
  );
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');

  async function add() {
    const v = Number(kcal);
    if (!(v > 0)) return;
    await db.exercises.add({ profileId, date, name: name.trim() || '運動', kcal: v } as never);
    setName('');
    setKcal('');
  }

  return (
    <div className="card">
      <h2>運動での消費カロリー</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        歩数以外の運動(筋トレ・水泳など)の消費カロリーを追加します。
      </p>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ marginBottom: 0 }}>
          内容
          <input
            type="text"
            placeholder="例: 筋トレ"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          消費(kcal)
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </label>
        <button onClick={() => void add()} disabled={!(Number(kcal) > 0)} style={{ flex: '0 0 auto' }}>
          追加
        </button>
      </div>
      {(items ?? []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {items!.map((it) => (
            <div className="list-item" key={it.id}>
              <span>
                {it.name} <strong>{it.kcal}kcal</strong>
              </span>
              <button className="danger" onClick={() => void db.exercises.delete(it.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 日記メモ ---------- */

function NoteSection({ profileId, date }: { profileId: number; date: string }) {
  const entry = useEntry<{ id: number; text: string }>('notes', profileId, date);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (entry) setText(entry.text);
  }, [entry?.id]);

  const dirty = text !== (entry?.text ?? '');

  async function save() {
    const t = text.trim();
    if (entry) {
      if (t) await db.notes.update(entry.id, { text: t });
      else await db.notes.delete(entry.id); // 空にして保存したら消す
    } else if (t) {
      await db.notes.add({ profileId, date, text: t } as never);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="card">
      <h2>この日のメモ</h2>
      <textarea
        className="note-area"
        rows={4}
        placeholder="がんばったこと、気づいたこと、明日の自分へのひとことなど"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <span className="muted" style={{ alignSelf: 'center' }}>
          {entry != null && !dirty ? '書き込み済み' : ''}
        </span>
        <button onClick={() => void save()} disabled={!dirty} style={{ flex: '0 0 auto' }}>
          {saved ? '保存済み✓' : '保存'}
        </button>
      </div>
    </div>
  );
}

/* ---------- 当日サマリー ---------- */

function DailySummary({ profile, date }: { profile: Profile; date: string }) {
  const data = useLiveQuery(
    async () => {
      const key = [profile.id, date] as [number, string];
      const [meal, step, exercises, weight, allWeights] = await Promise.all([
        db.meals.where('[profileId+date]').equals(key).first(),
        db.steps.where('[profileId+date]').equals(key).first(),
        db.exercises.where('[profileId+date]').equals(key).toArray(),
        db.weights.where('[profileId+date]').equals(key).first(),
        db.weights.where('profileId').equals(profile.id).toArray(),
      ]);
      return { meal, step, exercises, weight, allWeights };
    },
    [profile.id, date],
  );

  if (!data) return null;
  const { meal, step, exercises, weight, allWeights } = data;

  // 歩数消費の推定に使う体重: 当日 > それ以前の最新 > 全体の最新
  const sorted = [...allWeights].sort((a, b) => a.date.localeCompare(b.date));
  const refWeight =
    weight?.kg ??
    sorted.filter((w) => w.date <= date).at(-1)?.kg ??
    sorted.at(-1)?.kg;

  const intake = meal ? meal.breakfast + meal.lunch + meal.dinner + meal.snack : 0;
  const stepKcal = step && refWeight != null ? stepsToKcal(step.total, refWeight) : 0;
  const exerciseKcal = exercises.reduce((s, e) => s + e.kcal, 0);
  const burn = stepKcal + exerciseKcal;

  // カロリー貯金 = 基礎代謝×1.2 + 活動消費 − 摂取(食事と体重の記録がある日のみ)
  const deficit =
    meal != null && refWeight != null
      ? dailyDeficit(
          bmr(refWeight, profile.heightCm, ageAt(profile.birthDate), profile.sex),
          burn,
          intake,
        )
      : undefined;

  // 必要1日消費(目標設定がある場合)
  const latestKg = sorted.at(-1)?.kg;
  const required =
    profile.targetWeightKg != null && profile.targetDate && latestKg != null
      ? requiredDailyKcal(
          totalKcalToGoal(latestKg, profile.targetWeightKg),
          daysUntil(profile.targetDate),
        )
      : undefined;
  const showRequired = required != null && Number.isFinite(required) && required > 0;

  return (
    <div className="card">
      <h2>この日のまとめ</h2>
      <div className="stat-grid">
        <div className="stat">
          <div className="label">摂取カロリー</div>
          <div className="value">
            {intake.toLocaleString()}
            <small> kcal</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">活動消費(歩数+運動)</div>
          <div className="value">
            {Math.round(burn).toLocaleString()}
            <small> kcal</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">今日のカロリー貯金</div>
          <div className="value">
            {deficit != null ? Math.round(deficit).toLocaleString() : '—'}
            {deficit != null && <small> kcal</small>}
          </div>
        </div>
        <div className="stat">
          <div className="label">1日の目標との差</div>
          <div className="value">
            {deficit != null && showRequired ? (
              <span style={{ color: deficit >= required ? 'var(--success)' : 'var(--danger)' }}>
                {deficit >= required ? '+' : ''}
                {Math.round(deficit - required).toLocaleString()}
                <small> kcal</small>
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        歩数分 {Math.round(stepKcal)}kcal + 運動分 {exerciseKcal}kcal。
        カロリー貯金は「使ったカロリー(基礎代謝×1.2+歩数・運動)−食べたカロリー」。
        プラスなら体重が減る方向で、運動でも食事を抑えることでも貯まります。
        {refWeight == null && ' ※体重が未記録のため計算できません。'}
        {refWeight != null && meal == null && ' ※食事を記録するとカロリー貯金が表示されます。'}
      </p>
    </div>
  );
}
