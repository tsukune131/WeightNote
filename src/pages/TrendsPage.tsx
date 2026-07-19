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
  db,
  type ExerciseEntry,
  type MealEntry,
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
import { addMonths, daysInMonth, formatMonth, monthDates, toMonthStr, todayStr } from '../lib/date';
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
}

type ChartKey = 'weight' | 'intake' | 'water' | 'steps' | 'burn';

const CHART_TABS: { key: ChartKey; label: string }[] = [
  { key: 'weight', label: '体重・体脂肪率' },
  { key: 'intake', label: '摂取カロリー' },
  { key: 'water', label: '飲水' },
  { key: 'steps', label: '歩数' },
  { key: 'burn', label: '消費・貯金' },
];

export function TrendsPage({ profile }: { profile: Profile }) {
  const [month, setMonth] = useState(() => toMonthStr(new Date()));
  const [chart, setChart] = useState<ChartKey>('weight');
  const [waterDate, setWaterDate] = useState<string | undefined>();
  const [stepsDate, setStepsDate] = useState<string | undefined>();
  const theme = useChartTheme();

  useEffect(() => {
    document
      .querySelector('.chart-tab.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [chart]);

  function moveChart(delta: number) {
    const i = CHART_TABS.findIndex((t) => t.key === chart);
    const next = (i + delta + CHART_TABS.length) % CHART_TABS.length;
    setChart(CHART_TABS[next].key);
  }

  const raw = useLiveQuery(
    async () => {
      const start = `${month}-01`;
      const end = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
      const range = (table: 'weights' | 'meals' | 'waterLogs' | 'steps' | 'exercises') =>
        db
          .table(table)
          .where('[profileId+date]')
          .between([profile.id, start], [profile.id, end], true, true)
          .toArray();
      const [weights, meals, waterLogs, steps, exercises, allWeights] = await Promise.all([
        range('weights'),
        range('meals'),
        range('waterLogs'),
        range('steps'),
        range('exercises'),
        db.weights.where('profileId').equals(profile.id).toArray(),
      ]);
      return {
        weights: weights as WeightEntry[],
        meals: meals as MealEntry[],
        waterLogs: waterLogs as WaterLog[],
        steps: steps as StepEntry[],
        exercises: exercises as ExerciseEntry[],
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
      };
    });
  }, [raw, month, required, profile.birthDate, profile.heightCm, profile.sex]);

  const hasAnyData =
    rows.some(
      (r) =>
        r.weight != null || r.intake > 0 || r.water > 0 || r.steps != null || r.exerciseKcal > 0,
    );

  // タップがなければ、その月で記録がある最新の日をデフォルト表示する
  const defaultWaterDate = (raw?.waterLogs ?? [])
    .map((x) => x.date)
    .sort()
    .at(-1);
  const defaultStepsDate = (raw?.steps ?? [])
    .filter((x) => x.hourly?.some((v) => v > 0))
    .map((x) => x.date)
    .sort()
    .at(-1);
  const effWaterDate = waterDate ?? defaultWaterDate;
  const effStepsDate = stepsDate ?? defaultStepsDate;

  const selectedWaterRow = effWaterDate ? rows.find((r) => r.date === effWaterDate) : undefined;
  const selectedStepsRow = effStepsDate ? rows.find((r) => r.date === effStepsDate) : undefined;
  const selectedStepEntry = raw?.steps.find((x) => x.date === effStepsDate);
  const selectedHourly =
    selectedStepEntry?.hourly && selectedStepEntry.hourly.some((v) => v > 0)
      ? selectedStepEntry.hourly
      : undefined;
  const selectedWaterLogs = (raw?.waterLogs ?? [])
    .filter((x) => x.date === effWaterDate)
    .sort((a, b) => a.time.localeCompare(b.time));

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
      <div className="date-nav">
        <button onClick={() => { setMonth((m) => addMonths(m, -1)); setWaterDate(undefined); setStepsDate(undefined); }}>◀</button>
        <div className="title">{formatMonth(month)}</div>
        <button onClick={() => { setMonth((m) => addMonths(m, 1)); setWaterDate(undefined); setStepsDate(undefined); }}>▶</button>
      </div>

      <div className="chart-nav">
        <button onClick={() => moveChart(-1)} aria-label="前のグラフ">◀</button>
        <div className="chart-tabs">
          {CHART_TABS.map((t) => (
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

      {!hasAnyData && (
        <div className="card">
          <div className="empty-note">
            この月の記録がまだありません。
            <br />
            「きょう」タブから入力するとグラフが表示されます。
          </div>
        </div>
      )}

      {chart === 'weight' && (
      <ChartCard title="体重" sub={profile.targetWeightKg != null ? `点線 = 目標 ${profile.targetWeightKg}kg` : undefined}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis {...xAxisProps(theme)} />
          <YAxis
            {...yAxisProps(theme)}
            domain={['dataMin - 1', 'dataMax + 1']}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('kg')} labelFormatter={fmtDay} />
          {profile.targetWeightKg != null && (
            <ReferenceLine
              y={profile.targetWeightKg}
              stroke={theme.reference}
              strokeDasharray="4 4"
            />
          )}
          <Line
            type="monotone"
            dataKey="weight"
            name="体重"
            stroke={theme.weight}
            strokeWidth={2}
            dot={{ r: 2, fill: theme.weight, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ChartCard>
      )}

      {chart === 'weight' && !rows.some((r) => r.bodyFat != null) && (
        <div className="card">
          <div className="empty-note">
            この月の体脂肪率の記録がまだありません。「きょう」タブで体重と一緒に入力できます。
          </div>
        </div>
      )}
      {chart === 'weight' && rows.some((r) => r.bodyFat != null) && (
        <ChartCard title="体脂肪率">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis {...xAxisProps(theme)} />
            <YAxis
              {...yAxisProps(theme)}
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('%')} labelFormatter={fmtDay} />
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

      {chart === 'water' && (
      <ChartCard title="飲水量">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} onClick={barClickHandler(setWaterDate)}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis {...xAxisProps(theme)} />
          <YAxis {...yAxisProps(theme)} />
          <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('ml')} labelFormatter={fmtDay} />
          <Bar dataKey="water" name="飲水量" fill={theme.water} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
      )}

      {chart === 'water' && selectedWaterRow && selectedWaterLogs.length > 0 && (
        <ChartCard title={`${selectedWaterRow.d}日の飲水(累積)`} sub={`合計 ${selectedWaterRow.water.toLocaleString()}ml`}>
          <LineChart
            data={selectedWaterLogs.reduce<{ time: string; sum: number }[]>((acc, l) => {
              acc.push({ time: l.time, sum: (acc.at(-1)?.sum ?? 0) + l.ml });
              return acc;
            }, [])}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: theme.axis }} stroke={theme.grid} />
            <YAxis {...yAxisProps(theme)} />
            <Tooltip {...tooltipProps(theme)} formatter={fmtUnit('ml')} />
            <Line type="stepAfter" dataKey="sum" name="累積" stroke={theme.water} strokeWidth={2} dot={{ r: 3, fill: theme.water, strokeWidth: 0 }} />
          </LineChart>
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
