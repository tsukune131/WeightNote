import { db, DEFAULT_WAIST_NOTIFY_DAY, DEFAULT_WEIGHT_NOTIFY_TIMES, type Profile } from '../db';

/**
 * リマインダー通知の設定(体重の時刻・腹囲の毎月の日)。
 * 実際の通知発火はネイティブアプリ化(フェーズC)後に対応する。
 * ここでは設定値の保存のみを行う(src/lib/platform.tsに発火用の関数を用意済み)。
 */
export function NotificationSettings({ profile }: { profile: Profile }) {
  const weightOn = profile.notifyWeight ?? false;
  const weightTimes = profile.notifyWeightTimes ?? DEFAULT_WEIGHT_NOTIFY_TIMES;
  const waistOn = profile.notifyWaist ?? false;
  const waistDay = profile.notifyWaistDay ?? DEFAULT_WAIST_NOTIFY_DAY;

  async function toggleWeight(checked: boolean) {
    await db.profiles.update(profile.id, {
      notifyWeight: checked,
      notifyWeightTimes: profile.notifyWeightTimes ?? DEFAULT_WEIGHT_NOTIFY_TIMES,
    });
  }

  async function updateWeightTime(i: number, value: string) {
    const next = [...weightTimes];
    next[i] = value;
    await db.profiles.update(profile.id, { notifyWeightTimes: next });
  }

  async function addWeightTime() {
    await db.profiles.update(profile.id, { notifyWeightTimes: [...weightTimes, '12:00'] });
  }

  async function removeWeightTime(i: number) {
    await db.profiles.update(profile.id, {
      notifyWeightTimes: weightTimes.filter((_, idx) => idx !== i),
    });
  }

  async function toggleWaist(checked: boolean) {
    await db.profiles.update(profile.id, {
      notifyWaist: checked,
      notifyWaistDay: profile.notifyWaistDay ?? DEFAULT_WAIST_NOTIFY_DAY,
    });
  }

  return (
    <div className="card">
      <h2>リマインダー通知</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        ここでは設定のみ行えます。実際に通知が届くのは、アプリ版(近日公開予定)からになります。
      </p>

      <label className="checkbox-inline" style={{ marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={weightOn}
          onChange={(e) => void toggleWeight(e.target.checked)}
        />
        体重の記録を知らせる
      </label>
      {weightOn && (
        <div style={{ marginBottom: 12 }}>
          {weightTimes.map((t, i) => (
            <div className="row" key={i} style={{ alignItems: 'flex-end', marginBottom: 6 }}>
              <label className="field field-fixed-time" style={{ marginBottom: 0 }}>
                通知時刻
                <input
                  type="time"
                  value={t}
                  onChange={(e) => void updateWeightTime(i, e.target.value)}
                />
              </label>
              {weightTimes.length > 1 && (
                <button
                  className="ghost"
                  onClick={() => void removeWeightTime(i)}
                  style={{ flex: '0 0 auto' }}
                >
                  削除
                </button>
              )}
            </div>
          ))}
          <button className="secondary" onClick={() => void addWeightTime()}>
            + 時刻を追加
          </button>
        </div>
      )}

      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={waistOn}
          onChange={(e) => void toggleWaist(e.target.checked)}
        />
        腹囲の記録を知らせる(毎月)
      </label>
      {waistOn && (
        <label className="field" style={{ marginTop: 8, marginBottom: 0 }}>
          通知日
          <select
            value={waistDay}
            onChange={(e) =>
              void db.profiles.update(profile.id, { notifyWaistDay: Number(e.target.value) })
            }
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                毎月{d}日
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
