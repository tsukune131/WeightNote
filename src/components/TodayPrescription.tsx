import { useLiveQuery } from 'dexie-react-hooks';
import { type Profile } from '../db';
import {
  RICE_BOWL_KCAL,
  daysUntil,
  kcalToSteps,
  requiredDailyKcal,
  totalKcalToGoal,
} from '../lib/calc';
import { getRecentDayStats } from '../lib/dailyStats';

const WINDOW_DAYS = 7;

/**
 * きょうの目標まで「あと何をすればいいか」を、歩数とご飯換算という
 * 具体的な行動に変換して見せるカード。散歩+ちょっと我慢という
 * コンセプトに直結させ、記録を振り返るだけの道具から一歩進める。
 */
export function TodayPrescription({ profile }: { profile: Profile }) {
  const recent = useLiveQuery(
    () => getRecentDayStats(profile, WINDOW_DAYS),
    [profile.id, profile.heightCm, profile.sex, profile.birthDate],
  );

  if (!recent) return null;
  const { days } = recent;

  const latestWeight = days.filter((d) => d.weight != null).at(-1)?.weight;
  const required =
    profile.targetWeightKg != null && profile.targetDate && latestWeight != null
      ? requiredDailyKcal(
          totalKcalToGoal(latestWeight, profile.targetWeightKg),
          daysUntil(profile.targetDate),
        )
      : undefined;
  const showRequired = required != null && Number.isFinite(required) && required > 0;
  if (!showRequired) return null; // 目標未設定では「あと何」を計算できない

  const todayDeficit = days.at(-1)?.deficit;

  return (
    <div className="card">
      <h2>きょうの処方箋</h2>
      {todayDeficit == null ? (
        <p className="muted" style={{ margin: 0 }}>
          食事と体重を記録すると、きょう必要な散歩・食事量の目安が分かります。
        </p>
      ) : todayDeficit >= required ? (
        <p style={{ margin: 0 }}>もうきょうの目標は達成しています。よくやりました。</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            あと {Math.round(required - todayDeficit).toLocaleString()}kcal
            で、きょうの目標です。どちらか一つで十分です。
          </p>
          <div className="prescription-row">
            <div className="prescription-item">
              <span className="prescription-icon">🚶</span>
              <div>
                <div className="prescription-value">
                  {latestWeight != null
                    ? `${Math.round(kcalToSteps(required - todayDeficit, latestWeight)).toLocaleString()}歩`
                    : '—'}
                </div>
                <div className="muted">歩くなら</div>
              </div>
            </div>
            <div className="prescription-item">
              <span className="prescription-icon">🍚</span>
              <div>
                <div className="prescription-value">
                  ご飯 {((required - todayDeficit) / RICE_BOWL_KCAL).toFixed(1)}杯分
                </div>
                <div className="muted">控えるなら</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
