import { useLiveQuery } from 'dexie-react-hooks';
import { type Profile } from '../db';
import { daysUntil, requiredDailyKcal, totalKcalToGoal } from '../lib/calc';
import { getRecentDayStats } from '../lib/dailyStats';
import { todayStr } from '../lib/date';
import { calcStreak } from '../lib/streak';

const WINDOW_DAYS = 7;

/** 目標進捗リング(案3由来のUIを手帳トーンで) */
function ProgressRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 41;
  const circumference = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 100 100" role="img" aria-label={`きょうの貯金 ${Math.round(clamped)}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="47" textAnchor="middle" fontSize="19" fontWeight="700" fill="var(--text)">
        {Math.round(clamped)}%
      </text>
      <text x="50" y="63" textAnchor="middle" fontSize="8.5" fill="var(--muted)">
        きょうの貯金
      </text>
    </svg>
  );
}

export function StreakSummary({ profile }: { profile: Profile }) {
  const recent = useLiveQuery(
    () => getRecentDayStats(profile, WINDOW_DAYS),
    [profile.id, profile.heightCm, profile.sex, profile.birthDate],
  );

  if (!recent) return null;

  const { days, weightDates } = recent;
  const streak = calcStreak(weightDates, todayStr());

  const recordedWeights = days.filter((d) => d.weight != null);
  const weightChange =
    recordedWeights.length >= 2
      ? recordedWeights.at(-1)!.weight! - recordedWeights[0].weight!
      : undefined;

  const deficits = days.filter((d): d is typeof d & { deficit: number } => d.deficit != null);
  const totalSavings = deficits.reduce((s, d) => s + d.deficit, 0);
  const todayDeficit = days.at(-1)?.deficit;

  const latestWeight = recordedWeights.at(-1)?.weight;
  const required =
    profile.targetWeightKg != null && profile.targetDate && latestWeight != null
      ? requiredDailyKcal(
          totalKcalToGoal(latestWeight, profile.targetWeightKg),
          daysUntil(profile.targetDate),
        )
      : undefined;
  const showRequired = required != null && Number.isFinite(required) && required > 0;
  const achievedDays = showRequired ? deficits.filter((d) => d.deficit >= required).length : undefined;

  if (streak.count === 0 && recordedWeights.length === 0) return null;

  const percent = showRequired && todayDeficit != null ? (todayDeficit / required) * 100 : undefined;
  const message = !showRequired
    ? '「あなた」タブで目標を設定すると進捗が見えます'
    : todayDeficit == null
      ? '食事と体重を記録すると貯金が見えます'
      : todayDeficit >= required
        ? 'きょうの目標を達成しました!'
        : `目標まであと ${Math.round(required - todayDeficit).toLocaleString()} kcal`;

  return (
    <div className="card">
      <div className="journal-hero">
        {percent != null && <ProgressRing percent={percent} />}
        <div className="journal-hero-info">
          {showRequired && todayDeficit != null && (
            <div className="big">
              {Math.round(todayDeficit).toLocaleString()}
              <small> / {Math.round(required).toLocaleString()} kcal</small>
            </div>
          )}
          <div className="muted">{message}</div>
          {!streak.recordedToday && streak.count > 0 && (
            <div className="muted">きょうの体重を記録してスタンプを続けましょう</div>
          )}
        </div>
        <div className="stamp" aria-label={`連続${streak.count}日記録中`}>
          <b>{streak.count}</b>
          <span>日連続</span>
        </div>
      </div>
      <div className="journal-lines">
        <div className="list-item">
          <span className="muted">直近7日の体重変化</span>
          {weightChange != null ? (
            <strong style={{ color: weightChange <= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {weightChange > 0 ? '+' : ''}
              {weightChange.toFixed(1)} kg
            </strong>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
        <div className="list-item">
          <span className="muted">7日間の貯金合計</span>
          {deficits.length > 0 ? (
            <strong>{Math.round(totalSavings).toLocaleString()} kcal</strong>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
        {showRequired && (
          <div className="list-item">
            <span className="muted">目標を達成できた日</span>
            <strong>
              {achievedDays} / {deficits.length}日
            </strong>
          </div>
        )}
      </div>
    </div>
  );
}
