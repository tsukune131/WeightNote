import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Profile } from '../db';
import { BloodTestManager } from '../components/BloodTestManager';
import { NotificationSettings } from '../components/NotificationSettings';
import { ProfileForm } from '../components/ProfileForm';
import {
  ACTIVITY_LEVELS,
  ageAt,
  bmi,
  bmiCategory,
  bmr,
  daysUntil,
  isMetaboWaist,
  METABO_WAIST_THRESHOLD,
  requiredDailyKcal,
  tdee,
  totalKcalToGoal,
} from '../lib/calc';

export function YouPage({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [targetWeight, setTargetWeight] = useState(
    profile.targetWeightKg != null ? String(profile.targetWeightKg) : '',
  );
  const [targetFat, setTargetFat] = useState(
    profile.targetFatPct != null ? String(profile.targetFatPct) : '',
  );
  const [targetDate, setTargetDate] = useState(profile.targetDate ?? '');

  // プロフィール切替時にフォームを同期
  useEffect(() => {
    setTargetWeight(profile.targetWeightKg != null ? String(profile.targetWeightKg) : '');
    setTargetFat(profile.targetFatPct != null ? String(profile.targetFatPct) : '');
    setTargetDate(profile.targetDate ?? '');
    setEditing(false);
  }, [profile.id, profile.targetWeightKg, profile.targetFatPct, profile.targetDate]);

  const latest = useLiveQuery(
    async () => {
      const rows = await db.weights.where('profileId').equals(profile.id).toArray();
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const metrics = await db.healthMetrics.where('profileId').equals(profile.id).toArray();
      metrics.sort((a, b) => a.date.localeCompare(b.date));
      return {
        weight: rows.at(-1),
        fatPct: rows.findLast((r) => r.bodyFatPct != null)?.bodyFatPct,
        waist: metrics.findLast((m) => m.waist != null)?.waist,
      };
    },
    [profile.id],
  );

  const weightKg = latest?.weight?.kg;
  const age = ageAt(profile.birthDate);
  const activityLabel =
    ACTIVITY_LEVELS.find((a) => a.value === profile.activityLevel)?.label ??
    `係数 ${profile.activityLevel}`;

  const bmiValue = weightKg != null ? bmi(weightKg, profile.heightCm) : undefined;
  const tdeeValue =
    weightKg != null
      ? tdee(bmr(weightKg, profile.heightCm, age, profile.sex), profile.activityLevel)
      : undefined;

  const targetKg = Number(targetWeight);
  const hasGoal = targetKg > 0 && targetDate !== '' && weightKg != null;
  const totalKcal = hasGoal ? totalKcalToGoal(weightKg, targetKg) : undefined;
  const remainDays = hasGoal ? daysUntil(targetDate) : undefined;
  const dailyKcal =
    totalKcal != null && remainDays != null ? requiredDailyKcal(totalKcal, remainDays) : undefined;

  async function saveGoal() {
    const fat = Number(targetFat);
    await db.profiles.update(profile.id, {
      targetWeightKg: targetKg > 0 ? targetKg : undefined,
      targetFatPct: fat > 0 ? fat : undefined,
      targetDate: targetDate || undefined,
    });
  }

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h2>{profile.name} さんの現在</h2>
          <button className="ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? '閉じる' : '編集'}
          </button>
        </div>
        {editing && (
          <div style={{ marginBottom: 12 }}>
            <ProfileForm profile={profile} onSaved={() => setEditing(false)} />
          </div>
        )}
        <div className="stat-grid">
          <div className="stat">
            <div className="label">身長</div>
            <div className="value">
              {profile.heightCm}
              <small> cm</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">体重(最新の記録)</div>
            <div className="value">
              {weightKg != null ? weightKg.toFixed(1) : '未記録'}
              {weightKg != null && <small> kg</small>}
            </div>
          </div>
          <div className="stat">
            <div className="label">体脂肪率(最新の記録)</div>
            <div className="value">
              {latest?.fatPct != null ? latest.fatPct.toFixed(1) : '未記録'}
              {latest?.fatPct != null && <small> %</small>}
            </div>
          </div>
          <div className="stat">
            <div className="label">BMI</div>
            <div className="value">
              {bmiValue != null ? bmiValue.toFixed(1) : '—'}
              {bmiValue != null && <small> {bmiCategory(bmiValue)}</small>}
            </div>
          </div>
          <div className="stat">
            <div className="label">腹囲(最新の記録)</div>
            <div className="value">
              {latest?.waist != null ? (
                <span
                  style={{
                    color: isMetaboWaist(latest.waist, profile.sex)
                      ? 'var(--danger)'
                      : 'inherit',
                  }}
                >
                  {latest.waist.toFixed(1)}
                  <small> cm</small>
                </span>
              ) : (
                '未記録'
              )}
            </div>
          </div>
          <div className="stat">
            <div className="label">推定消費カロリー/日</div>
            <div className="value">
              {tdeeValue != null ? Math.round(tdeeValue) : '—'}
              {tdeeValue != null && <small> kcal</small>}
            </div>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          活動レベル: {activityLabel} ・ {age}歳 ・ 推定消費は基礎代謝(Mifflin-St Jeor式)×活動係数
        </p>
        {weightKg == null && (
          <p className="muted">「きょう」タブで体重を入力するとBMIなどが表示されます。</p>
        )}
      </div>

      <div className="card">
        <h2>目標</h2>
        <div className="row">
          <label className="field">
            目標体重(kg)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
            />
          </label>
          <label className="field">
            目標体脂肪率(%)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              max="80"
              value={targetFat}
              onChange={(e) => setTargetFat(e.target.value)}
            />
          </label>
          <label className="field field-fixed-date">
            目標達成日
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
        </div>
        <button onClick={() => void saveGoal()}>目標を保存</button>

        {hasGoal && totalKcal != null && remainDays != null && dailyKcal != null && (
          <div className="stat-grid" style={{ marginTop: 12 }}>
            <div className="stat">
              <div className="label">目標までの体重差</div>
              <div className="value">
                {(weightKg - targetKg).toFixed(1)}
                <small> kg</small>
              </div>
            </div>
            {latest?.fatPct != null && Number(targetFat) > 0 && (
              <div className="stat">
                <div className="label">目標までの体脂肪率差</div>
                <div className="value">
                  {(latest.fatPct - Number(targetFat)).toFixed(1)}
                  <small> %</small>
                </div>
              </div>
            )}
            <div className="stat">
              <div className="label">必要な総消費カロリー(×7200)</div>
              <div className="value">
                {Math.round(totalKcal).toLocaleString()}
                <small> kcal</small>
              </div>
            </div>
            <div className="stat">
              <div className="label">達成までの期間</div>
              <div className="value">
                {remainDays}
                <small> 日</small>
              </div>
            </div>
            <div className="stat">
              <div className="label">必要1日消費カロリー</div>
              <div className="value">
                {Number.isFinite(dailyKcal) ? Math.round(dailyKcal).toLocaleString() : '—'}
                <small> kcal/日</small>
              </div>
            </div>
          </div>
        )}
        {hasGoal && totalKcal != null && (
          <p className="muted" style={{ marginBottom: 0 }}>
            必要1日消費カロリーは、運動を増やすことでも摂取カロリーを抑えることでも達成できます。
            日々の達成状況は「ふりかえり」タブの消費・貯金で確認できます。
          </p>
        )}
        {hasGoal && remainDays === 0 && totalKcal != null && totalKcal > 0 && (
          <p className="muted">目標日を過ぎています。目標達成日を更新してください。</p>
        )}
        <p className="muted" style={{ marginBottom: 0, marginTop: hasGoal ? 8 : 0 }}>
          メタボリックシンドロームの腹囲基準: 男性 {METABO_WAIST_THRESHOLD.male}cm以上・
          女性 {METABO_WAIST_THRESHOLD.female}cm以上が該当。
          {latest?.waist != null &&
            (isMetaboWaist(latest.waist, profile.sex)
              ? ' 現在の記録は基準に該当しています。'
              : ' 現在の記録は基準内です。')}
        </p>
      </div>

      <div className="card">
        <h2>検査値の記録</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          腹囲は「きょう」タブで常に記録できます。以下はオンにした項目だけ
          「きょう」タブに入力欄が出て、「ふりかえり」タブで推移を確認できます。
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(
            [
              ['trackBloodPressure', '血圧'],
              ['trackGlucose', '血糖値'],
            ] as const satisfies readonly (readonly [
              'trackBloodPressure' | 'trackGlucose',
              string,
            ])[]
          ).map(([key, label]) => (
            <label className="checkbox-inline" key={key}>
              <input
                type="checkbox"
                checked={profile[key] ?? false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void db.profiles.update(profile.id, { [key]: checked } as Partial<Profile>);
                }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <NotificationSettings profile={profile} />

      <BloodTestManager profileId={profile.id} />

      <p className="legal-links">
        <a href={`${import.meta.env.BASE_URL}legal/privacy.html`} target="_blank" rel="noreferrer">
          プライバシーポリシー
        </a>
        ・
        <a href={`${import.meta.env.BASE_URL}legal/terms.html`} target="_blank" rel="noreferrer">
          利用規約
        </a>
      </p>
    </div>
  );
}
