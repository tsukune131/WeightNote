import { useLiveQuery } from 'dexie-react-hooks';
import { type Profile } from '../db';
import { daysUntil, requiredDailyKcal, totalKcalToGoal } from '../lib/calc';
import { getRecentDayStats } from '../lib/dailyStats';
import { todayStr } from '../lib/date';
import { calcStreak } from '../lib/streak';

const WINDOW_DAYS = 7;

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

  return (
    <div className="card">
      <div className="streak-row">
        <span className="streak-emoji">🔥</span>
        <div>
          <div className="streak-count">{streak.count}日連続で記録中</div>
          <div className="muted">
            {streak.recordedToday ? '今日も体重を記録しました' : 'まだ今日の体重が未記録です'}
          </div>
        </div>
      </div>
      <div className="stat-grid" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="label">直近7日の体重変化</div>
          <div className="value">
            {weightChange != null ? (
              <span style={{ color: weightChange <= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {weightChange > 0 ? '+' : ''}
                {weightChange.toFixed(1)}
                <small> kg</small>
              </span>
            ) : (
              '—'
            )}
          </div>
        </div>
        <div className="stat">
          <div className="label">7日間のカロリー貯金合計</div>
          <div className="value">
            {deficits.length > 0 ? Math.round(totalSavings).toLocaleString() : '—'}
            {deficits.length > 0 && <small> kcal</small>}
          </div>
        </div>
        {showRequired && (
          <div className="stat">
            <div className="label">目標を達成できた日</div>
            <div className="value">
              {achievedDays}
              <small> / {deficits.length}日</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
