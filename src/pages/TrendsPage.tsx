import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BLOOD_TEST_FIELDS,
  db,
  type BloodTestEntry,
  type ExerciseEntry,
  type HealthMetricEntry,
  type MealEntry,
  type NoteEntry,
  type Profile,
  type StepEntry,
  type WaterLog,
  type WeightEntry,
} from '../db';
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
  addMonths,
  daysInMonth,
  formatDateShort,
  formatMonth,
  monthDates,
  toMonthStr,
  todayStr,
} from '../lib/date';
import { useChartTheme, type ChartTheme } from '../lib/chartTheme';

interface DayRow {
  d: number; // 日(1〜31)
  date: string;
  weight?: number;
  bodyFat?: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
  intake: number;
  mealTimes: Partial<Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string>>;
  water: number;
  steps?: number;
  stepKcal: number;
  exerciseKcal: number;
  burn?: number; // 活動消費合計(記録がない未来日はundefined)
  deficit?: number; // カロリー貯金 = BMR×1.2 + 活動消費 − 摂取(食事記録がある日のみ)
  waist?: number;
  glucose?: number;
  systolic?: number;
  diastolic?: number;
}

type ChartKey = 'weight' | 'intake' | 'steps' | 'burn' | 'health' | 'bloodtest';

const CHART_TABS: { key: ChartKey; label: string }[] = [
  { key: 'weight', label: '体重・体脂肪率・腹囲' },
  { key: 'burn', label: 'カロリー収支' },
  { key: 'intake', label: '摂取カロリー・飲水量' },
  { key: 'steps', label: '歩数' },
];

export function TrendsPage({ profile }: { profile: Profile }) {
  const [month, setMonth] = useState(() => toMonthStr(new Date()));
  const [chart, setChart] = useState<ChartKey>('weight');
  const [stepsDate, setStepsDate] = useState<string | undefined>();
  const theme = useChartTheme();

  useEffect(() => {
    document
      .querySelector('.chart-tab.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [chart]);

  const bloodTests = useLiveQuery(
    async () => {
      const rows = await db.bloodTests.where('profileId').equals(profile.id).toArray();
      rows.sort((a, b) => a.date.localeCompare(b.date));
      return rows;
    },
    [profile.id],
  );

  const bloodTestsByYear = useMemo(() => {
    if (!bloodTests) return [];
    const years = new Map<string, BloodTestEntry[]>();
    for (const t of bloodTests) {
      const y = t.date.slice(0, 4);
      if (!years.has(y)) years.set(y, []);
      years.get(y)!.push(t);
    }
    return [...years.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [bloodTests]);

  const hasOptionalHealthTracking = profile.trackBloodPressure || profile.trackGlucose;

  const tabs = [
    ...CHART_TABS,
    ...(hasOptionalHealthTracking ? [{ key: 'health' as ChartKey, label: '検査値' }] : []),
    ...((bloodTests?.length ?? 0) > 0 ? [{ key: 'bloodtest' as ChartKey, label: '血液検査' }] : []),
  ];

  function moveChart(delta: number) {
    const i = tabs.findIndex((t) => t.key === chart);
    const next = (i + delta + tabs.length) % tabs.length;
    setChart(tabs[next].key);
  }

  const raw = useLiveQuery(
    async () => {
      const start = `${month}-01`;
      const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
      const range = (table: 'weights' | 'meals' | 'waterLogs' | 'steps' | 'exercises' | 'notes') =>
        db
          .table(table)
          .where('[profileId+date]')
          .between([profile.id, start], [profile.id, end], true, true)
          .toArray();
      const [
        weights,
        meals,
        waterLogs,
        steps,
        exercises,
        notes,
        allWeights,
        healthMetrics,
      ] = await Promise.all([
          range('weights'),
          range('meals'),
          range('waterLogs'),
          range('steps'),
          range('exercises'),
          range('notes'),
          db.weights.where('profileId').equals(profile.id).toArray(),
          db.healthMetrics
            .where('[profileId+date]')
            .between([profile.id, start], [profile.id, end], true, true)
            .toArray(),
        ]);
      return {
        weights: weights as WeightEntry[],
        meals: meals as MealEntry[],
        waterLogs: waterLogs as WaterLog[],
        steps: steps as StepEntry[],
        exercises: exercises as ExerciseEntry[],
        notes: notes as NoteEntry[],
        healthMetrics: healthMetrics as HealthMetricEntry[],
        allWeights,
      };
    },
    [profile.id, month],
  );

  // 目標から必要1日消費カロリー(基準線)を算出
  const required = useMemo(() => {
    if (!raw || profile.targetWeightKg == null || !profile.targetDate) return undefined;
    const sorted = [...raw.allWeights].sort((a, b) => a.date.localeCompare(b.date));
    const current = sorted.at(-1)?.kg;
    if (current == null) return undefined;
    const total = totalKcalToGoal(current, profile.targetWeightKg);
    const days = daysUntil(profile.targetDate);
    const v = requiredDailyKcal(total, days);
    return Number.isFinite(v) && v > 0 ? v : undefined;
  }, [raw, profile.targetWeightKg, profile.targetDate]);

  const rows: DayRow[] = useMemo(() => {
    if (!raw) return [];
    const today = todayStr();
    const age = ageAt(profile.birthDate);
    const sortedWeights = [...raw.allWeights].sort((a, b) => a.date.localeCompare(b.date));
    return monthDates(month).map((date, i) => {
      const w = raw.weights.find((x) => x.date === date);
      const meal = raw.meals.find((x) => x.date === date);
      const step = raw.steps.find((x) => x.date === date);
      const exs = raw.exercises.filter((x) => x.date === date);
      const water = raw.waterLogs
        .filter((x) => x.date === date)
        .reduce((s, x) => s + x.ml, 0);
      const health = raw.healthMetrics.find((x) => x.date === date);

      // 歩数→kcal換算に使う体重(当日→それ以前の直近→最新)
      const refWeight =
        w?.kg ??
        sortedWeights.filter((x) => x.date <= date).at(-1)?.kg ??
        sortedWeights.at(-1)?.kg;

      const stepKcal = step && refWeight != null ? stepsToKcal(step.total, refWeight) : 0;
      const exerciseKcal = exs.reduce((s, e) => s + e.kcal, 0);
      const hasActivity = step != null || exs.length > 0;
      const isPastOrToday = date <= today;
      const burn = hasActivity && isPastOrToday ? stepKcal + exerciseKcal : undefined;
      const intake = meal ? meal.breakfast + meal.lunch + meal.dinner + meal.snack : 0;

      // カロリー貯金は摂取(食事記録)と体重が揃っている日のみ計算
      const deficit =
        isPastOrToday && meal != null && refWeight != null
          ? dailyDeficit(
              bmr(refWeight, profile.heightCm, age, profile.sex),
              stepKcal + exerciseKcal,
              intake,
            )
          : undefined;

      return {
        d: i + 1,
        date,
        weight: w?.kg,
        bodyFat: w?.bodyFatPct,
        breakfast: meal?.breakfast ?? 0,
        lunch: meal?.lunch ?? 0,
        dinner: meal?.dinner ?? 0,
        snack: meal?.snack ?? 0,
        intake,
        mealTimes: {
          breakfast: meal?.breakfastTime,
          lunch: meal?.lunchTime,
          dinner: meal?.dinnerTime,
          snack: meal?.snackTime,
        },
        water,
        steps: step?.total,
        stepKcal: Math.round(stepKcal),
        exerciseKcal,
        burn: burn != null ? Math.round(burn) : undefined,
        deficit: deficit != null ? Math.round(deficit) : undefined,
        waist: health?.waist,
        glucose: health?.glucose,
        systolic: health?.systolic,
        diastolic: health?.diastolic,
      };
    });
  }, [raw, month, required, profile.birthDate, profile.heightCm, profile.sex]);

  const hasAnyData =
    rows.some(
      (r) =>
        r.weight != null || r.intake > 0 || r.water > 0 || r.steps != null || r.exerciseKcal > 0,
    );

  // タップがなければ、その月で記録がある最新の日をデフォルト表示する
  const defaultStepsDate = (raw?.steps ?? [])
    .filter((x) => x.hourly?.some((v) => v > 0))
    .map((x) => x.date)
    .sort()
    .at(-1);
  const effStepsDate = stepsDate ?? defaultStepsDate;

  const selectedStepsRow = effStepsDate ? rows.find((r) => r.date === effStepsDate) : undefined;
  const selectedStepEntry = raw?.steps.find((x) => x.date === effStepsDate);
  const selectedHourly =
    selectedStepEntry?.hourly && selectedStepEntry.hourly.some((v) => v > 0)
      ? selectedStepEntry.hourly
      : undefined;

  function barClickHandler(setDate: (fn: (cur: string | undefined) => string | undefined) => void) {
    return (state: { activeLabel?: string | number } | null) => {
      const d = Number(state?.activeLabel);
      if (d >= 1) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        setDate((cur) => (cur === date ? undefined : date));
      }
    };
  }

  return (
    <div>
      {chart !== 'bloodtest' && (
        <div className="date-nav">
          <button onClick={() => { setMonth((m) => addMonths(m, -1)); setStepsDate(undefined); }}>◀</button>
          <div className="title">{formatMonth(month)}</div>
          <button onClick={() => { setMonth((m) => addMonths(m, 1)); setStepsDate(undefined); }}>▶</button>
        </div>
      )}

      <div className="chart-nav">
        <button onClick={() => moveChart(-1)} aria-label="前のグラフ">◀</button>
        <div className="chart-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`chart-tab ${chart === t.key ? 'active' : ''}`}
              onClick={() => setChart(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => moveChart(1)} aria-label="次のグラフ">▶</button>
      </div>

      {chart !== 'bloodtest' && !hasAnyData && (
        <div className="card">
          <div className="empty-note">
            この月の記録がまだありません。
            <br />
            「きょう」タブから入力するとグラフが表示されます。
          </div>
        </div>
      )}

      {chart === 'bloodtest' &&
        (bloodTestsByYear.length === 0 ? (
          <div className="card">
            <div className="empty-note">
              血液検査の記録がまだありません。
              <br />
              「あなた」タブから健康診断・血液検査の結果を登録できます。
            </div>
          </div>
        ) : (
          bloodTestsByYear.map(([year, tests]) => (
            <div className="card" key={year}>
              <h2>{year}年</h2>
              <div className="table-scroll">
                <table className="bloodtest-table">
                  <thead>
                    <tr>
                      <th>項目</th>
                      {tests.map((t) => (
                        <th key={t.id}>{formatDateShort(t.date)}</th>
                      ))}
                      <th className="bloodtest-ref">基準値</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BLOOD_TEST_FIELDS.map((f) => (
                      <tr key={f.key}>
                        <td>
                          {f.label}
                          {f.unit && <span className="muted"> {f.unit}</span>}
                        </td>
                        {tests.map((t) => (
                          <td key={t.id}>{t[f.key] ?? '—'}</td>
                        ))}
                        <td className="bloodtest-ref">{f.ref}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                基準値は日本人間ドック学会の基準範囲の目安です。実際の基準値は検査施設・性別・年齢で
                異なるため、お手元の検査結果表の基準値をご確認ください。
              </p>
            </div>
          ))
        ))}

      {chart === 'weight' && (
      <ChartCard
        title="体重・腹囲"
        sub={`左軸=体重kg・右軸=腹囲cm${
          profile.targetWeightKg != null ? `・体重目標 ${profile.targetWeightKg}kg` : ''
        }${profile.targetWaistCm != null ? `・腹囲目標 ${profile.targetWaistCm}cm` : ''}`}
      >
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis {...xAxisProps(theme)} />
          <YAxis
            yAxisId="left"
            {...yAxisProps(theme)}
            domain={['dataMin - 1', 'dataMax + 1']}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            {...yAxisProps(theme)}
            domain={['dataMin - 1', 'dataMax + 1']}
            allowDecimals={false}
          />
          <Tooltip {...tooltipProps(theme)} formatter={fmtWeightWaist} labelFormatter={fmtDay} />
          <Legend {...legendProps()} />
          {profile.targetWeightKg != null && (
            <ReferenceLine
              yAxisId="left"
              y={profile.targetWeightKg}
              stroke={theme.reference}
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
          )}
          {profile.targetWaistCm != null && (
            <ReferenceLine
              yAxisId="right"
              y={profile.targetWaistCm}
              stroke={theme.exercise}
              strokeDasharray="2 2"
              ifOverflow="extendDomain"
            />
          )}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="weight"
            name="体重"
            stroke={theme.weight}
            strokeWidth={2}
            dot={{ r: 2, fill: theme.weight, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="waist"
            name="腹囲"
            stroke={theme.exercise}
            strokeWidth={2}
            dot={{ r: 2, fill: theme.exercise, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ChartCard>
      )}

      {chart === 'weight' && !rows.some((r) => r.waist != null) && (
        <div className="card">
          <div className="empty-note">
            この月の腹囲の記録がまだありません。「きょう」タブで体重と一緒に入力できます。
          </div>
        </div>
      )}

      {chart === 'weight' && !rows.some((r) => r.bodyFat != null) && (
        <div className="card">
          <div className="empty-note">
            この月の体脂肪率の記録がまだありません。「きょう」タブで体重と一緒に入力できます。
          </div>
        </div>
      )}
      {chart === 'weight' && rows.some((r) => r.bodyFat != null) && (
        <ChartCard
          title="体脂肪率"
          sub={profile.targetFatPct != null ? `点線 = 目標 ${profile.targetFatPct}%` : undefined}
        >
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis {...xAxisProps(theme)} />
            <YAxis
              {...yAxisProps(theme)}
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('%')} labelFormatter={fmtDay} />
            {profile.targetFatPct != null && (
              <ReferenceLine
                y={profile.targetFatPct}
                stroke={theme.reference}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            <Line
              type="monotone"
              dataKey="bodyFat"
              name="体脂肪率"
              stroke={theme.fat}
              strokeWidth={2}
              dot={{ r: 2, fill: theme.fat, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ChartCard>
      )}

      {chart === 'intake' && (
      <ChartCard title="摂取カロリー" sub="朝・昼・夕・間食の1日合計(ツールチップに食事時刻を表示)">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis {...xAxisProps(theme)} />
          <YAxis {...yAxisProps(theme)} />
          <Tooltip {...tooltipProps(theme)} formatter={fmtMeal as never} labelFormatter={fmtDay} />
          <Legend {...legendProps()} />
          <Bar dataKey="breakfast" name="朝食" stackId="meal" fill={theme.breakfast} stroke={theme.surface} strokeWidth={1} />
          <Bar dataKey="lunch" name="昼食" stackId="meal" fill={theme.lunch} stroke={theme.surface} strokeWidth={1} />
          <Bar dataKey="dinner" name="夕食" stackId="meal" fill={theme.dinner} stroke={theme.surface} strokeWidth={1} />
          <Bar dataKey="snack" name="間食" stackId="meal" fill={theme.snack} stroke={theme.surface} strokeWidth={1} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
      )}

      {chart === 'intake' && (
      <ChartCard title="飲水量">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis {...xAxisProps(theme)} />
          <YAxis {...yAxisProps(theme)} />
          <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('ml')} labelFormatter={fmtDay} />
          <Bar dataKey="water" name="飲水量" fill={theme.water} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
      )}

      {chart === 'steps' && (
      <ChartCard title="歩数">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} onClick={barClickHandler(setStepsDate)}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis {...xAxisProps(theme)} />
          <YAxis {...yAxisProps(theme)} />
          <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('歩')} labelFormatter={fmtDay} />
          <Bar dataKey="steps" name="歩数" fill={theme.steps} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
      )}

      {chart === 'steps' && !selectedHourly && (
        <div className="card">
          <div className="empty-note">
            「きょう」タブで時間帯別の歩数を入力すると、1時間ごとのグラフが表示されます。
          </div>
        </div>
      )}
      {chart === 'steps' && selectedStepsRow && selectedHourly && (
        <ChartCard title={`${selectedStepsRow.d}日の歩数(時間帯別)`}>
          <BarChart
            data={selectedHourly.map((v, h) => ({ h: `${h}`, steps: v }))}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: theme.axis }} stroke={theme.grid} interval={2} />
            <YAxis {...yAxisProps(theme)} />
            <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('歩')} labelFormatter={(h) => `${h}時台`} />
            <Bar dataKey="steps" name="歩数" fill={theme.steps} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ChartCard>
      )}

      {chart === 'burn' && (
      <ChartCard title="活動消費カロリー" sub="歩数からの推定+運動入力">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis {...xAxisProps(theme)} />
          <YAxis {...yAxisProps(theme)} />
          <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('kcal')} labelFormatter={fmtDay} />
          <Legend {...legendProps()} />
          <Bar dataKey="stepKcal" name="歩数から推定" stackId="burn" fill={theme.steps} stroke={theme.surface} strokeWidth={1} />
          <Bar dataKey="exerciseKcal" name="運動入力" stackId="burn" fill={theme.exercise} stroke={theme.surface} strokeWidth={1} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
      )}

      {chart === 'burn' && (
        <ChartCard
          title="カロリー貯金"
          sub={
            required != null
              ? `点線 = 1日の目標 ${Math.round(required).toLocaleString()}kcal(青 = 達成した日)`
              : '「あなた」タブで目標を設定すると目標ラインを表示'
          }
        >
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis {...xAxisProps(theme)} />
            <YAxis {...yAxisProps(theme)} />
            <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('kcal')} labelFormatter={fmtDay} />
            <ReferenceLine y={0} stroke={theme.axis} />
            {required != null && (
              <ReferenceLine
                y={required}
                stroke={theme.reference}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            <Bar dataKey="deficit" name="カロリー貯金" radius={[3, 3, 0, 0]}>
              {rows.map((r) => {
                const achieved =
                  required != null ? (r.deficit ?? 0) >= required : (r.deficit ?? 0) >= 0;
                return (
                  <Cell key={r.date} fill={achieved ? theme.divergePos : theme.divergeNeg} />
                );
              })}
            </Bar>
          </BarChart>
        </ChartCard>
      )}
      {chart === 'burn' && (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            カロリー貯金は「その日に使ったカロリー(基礎代謝×1.2+歩数・運動)−
            食べたカロリー」。貯金がプラスの日は体重が減る方向で、運動を増やしても食事を抑えても貯まります。
            貯金が約7,200kcal貯まるごとに体重が1kg減る計算です。食事と体重を記録した日に表示されます。
          </p>
        </div>
      )}

      {chart === 'health' && (
        <>
          {!rows.some((r) => r.glucose != null || r.systolic != null) && (
            <div className="card">
              <div className="empty-note">
                この月の検査値の記録がまだありません。
                <br />
                「きょう」タブから入力できます。
              </div>
            </div>
          )}
          {profile.trackGlucose && rows.some((r) => r.glucose != null) && (
            <ChartCard title="血糖値" sub="単位: mg/dL">
              <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis {...xAxisProps(theme)} />
                <YAxis {...yAxisProps(theme)} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip
                  {...tooltipProps(theme)}
                  formatter={fmtUnit('mg/dL')}
                  labelFormatter={fmtDay}
                />
                <Line
                  type="monotone"
                  dataKey="glucose"
                  name="血糖値"
                  stroke={theme.exercise}
                  strokeWidth={2}
                  dot={{ r: 2, fill: theme.exercise, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ChartCard>
          )}
          {profile.trackBloodPressure && rows.some((r) => r.systolic != null) && (
            <ChartCard title="血圧" sub="単位: mmHg">
              <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis {...xAxisProps(theme)} />
                <YAxis {...yAxisProps(theme)} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip
                  {...tooltipProps(theme)}
                  formatter={fmtUnit('mmHg')}
                  labelFormatter={fmtDay}
                />
                <Legend {...legendProps()} />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  name="収縮期"
                  stroke={theme.divergeNeg}
                  strokeWidth={2}
                  dot={{ r: 2, fill: theme.divergeNeg, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  name="拡張期"
                  stroke={theme.steps}
                  strokeWidth={2}
                  dot={{ r: 2, fill: theme.steps, strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ChartCard>
          )}
        </>
      )}

      {(raw?.notes.length ?? 0) > 0 && (
        <div className="card">
          <h2>この月のメモ</h2>
          {[...raw!.notes]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((n) => (
              <div className="month-note" key={n.id}>
                <div className="month-note-date">{formatDateShort(n.date)}</div>
                <p>{n.text}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 共通パーツ ---------- */

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="card chart-block">
      <div className="chart-title">
        {title} {sub && <span className="chart-sub">{sub}</span>}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

function xAxisProps(theme: ChartTheme) {
  return {
    dataKey: 'd',
    tick: { fontSize: 10, fill: theme.axis },
    stroke: theme.grid,
    interval: 4,
  } as const;
}

function yAxisProps(theme: ChartTheme) {
  return {
    tick: { fontSize: 10, fill: theme.axis },
    stroke: 'transparent',
    width: 60,
  } as const;
}

function tooltipProps(theme: ChartTheme) {
  return {
    contentStyle: {
      background: theme.surface,
      border: `1px solid ${theme.grid}`,
      borderRadius: 8,
      fontSize: 12,
    },
    cursor: { fill: theme.grid, fillOpacity: 0.4 },
  } as const;
}

function legendProps() {
  return { wrapperStyle: { fontSize: 11 } } as const;
}

function fmtUnit(unit: string) {
  return (value: unknown) =>
    `${typeof value === 'number' ? value.toLocaleString() : String(value ?? '')}${unit}`;
}

function fmtDay(d: unknown) {
  return `${String(d ?? '')}日`;
}

/** 体重・腹囲の合成グラフ用: 系列名で単位(kg/cm)を切り替える */
function fmtWeightWaist(value: unknown, name: unknown): [string, string] {
  const v = typeof value === 'number' ? value.toFixed(1) : String(value ?? '');
  return [`${v}${name === '腹囲' ? 'cm' : 'kg'}`, String(name ?? '')];
}

/** 摂取カロリーのツールチップ: 値に食事時刻を添える */
function fmtMeal(
  value: unknown,
  name: unknown,
  item: { dataKey?: unknown; payload?: DayRow },
): [string, string] {
  const key = String(item?.dataKey ?? '') as keyof DayRow['mealTimes'];
  const time = item?.payload?.mealTimes?.[key];
  const v = typeof value === 'number' ? value.toLocaleString() : String(value ?? '');
  return [`${v}kcal${time ? ` (${time})` : ''}`, String(name ?? '')];
}
