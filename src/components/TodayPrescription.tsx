import { useLiveQuery } from 'dexie-react-hooks';
import { type Profile } from '../db';
import {
  RICE_BOWL_KCAL,
  daysUntil,
  kcalToSteps,
  requiredDailyKcal,
  stepsToKcal,
  totalKcalToGoal,
} from '../lib/calc';
import { getRecentDayStats } from '../lib/dailyStats';
import { prescriptionView } from '../lib/prescription';

const WINDOW_DAYS = 7;

const kcal = (n: number) => `${Math.round(n).toLocaleString()}kcal`;
const bowls = (n: number) => `${(n / RICE_BOWL_KCAL).toFixed(1)}杯分`;

/**
 * きょうの目標まで「あと何をすればいいか」を、歩数とご飯換算という具体的な行動に変換する。
 * 夕食が入る前は「あと何kcal食べられるか(予算)」、入った後は「達成/オーバー」を見せる。
 */
export function TodayPrescription({ profile }: { profile: Profile }) {
  const recent = useLiveQuery(
    () => getRecentDayStats(profile, WINDOW_DAYS),
    [profile.id, profile.heightCm, profile.sex, profile.birthDate],
  );

  if (!recent) return null;
  const { days } = recent;
  const today = days.at(-1);

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

  const view = prescriptionView(today?.deficit, required, today?.dinnerLogged ?? false);

  // 歩数換算(体重ベース)。1,000歩あたりの消費と、指定kcalを歩くのに必要な歩数
  const kcalPer1000 = latestWeight != null ? Math.round(stepsToKcal(1000, latestWeight)) : undefined;
  const stepsFor = (k: number) =>
    latestWeight != null ? Math.round(kcalToSteps(k, latestWeight)).toLocaleString() : '—';

  return (
    <div className="card">
      <h2>きょうの処方箋</h2>

      {view.kind === 'need-record' && (
        <p className="muted" style={{ margin: 0 }}>
          食事と体重を記録すると、きょう必要な散歩・食事量の目安が分かります。
        </p>
      )}

      {view.kind === 'budget-ok' && (
        <>
          <p style={{ marginTop: 0 }}>
            きょうは <strong>あと {kcal(view.budget)}</strong> 食べられます(ご飯 約
            {bowls(view.budget)})。
          </p>
          {kcalPer1000 != null && (
            <p className="muted" style={{ margin: 0 }}>
              🚶 歩けばもう少し食べられます(1,000歩ごとに約{kcalPer1000}kcal)。
            </p>
          )}
        </>
      )}

      {view.kind === 'budget-over' && (
        <>
          <p style={{ marginTop: 0 }}>
            いまのままだと <strong>{kcal(view.over)} オーバー</strong>します。
          </p>
          <p className="muted" style={{ margin: 0 }}>
            夕食を軽くするか、🚶 {stepsFor(view.over)}歩 歩くと取り返せます。
          </p>
        </>
      )}

      {view.kind === 'achieved' && (
        <p style={{ margin: 0 }}>きょうの目標を達成しました。よく頑張りましたね！</p>
      )}

      {view.kind === 'over' && (
        <>
          <p style={{ marginTop: 0 }}>
            きょうは <strong>{kcal(view.over)} オーバー</strong>でした。
          </p>
          <p className="muted" style={{ margin: 0 }}>
            夜に取り返すのは大変なので、明日の活動で調整しましょう。
            <br />
            歩数では🚶 {stepsFor(view.over)}歩 頑張って歩きましょう。
          </p>
        </>
      )}
    </div>
  );
}
