import { useState } from 'react';
import { db, setActiveProfileId } from '../db';
import { ProfileForm } from './ProfileForm';

type Step = 'welcome' | 'profile' | 'goal' | 'guide';

const STEPS: Step[] = ['welcome', 'profile', 'goal', 'guide'];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [profileId, setProfileId] = useState<number | null>(null);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetFat, setTargetFat] = useState('');
  const [targetDate, setTargetDate] = useState('');

  async function saveGoalAndContinue() {
    const w = Number(targetWeight);
    const f = Number(targetFat);
    if (profileId != null && (w > 0 || f > 0 || targetDate)) {
      await db.profiles.update(profileId, {
        targetWeightKg: w > 0 ? w : undefined,
        targetFatPct: f > 0 ? f : undefined,
        targetDate: targetDate || undefined,
      });
    }
    setStep('guide');
  }

  return (
    <div>
      <div className="app-header">
        <h1>WeightNote</h1>
      </div>

      <div className="onboarding-dots">
        {STEPS.map((s) => (
          <span key={s} className={`dot ${step === s ? 'active' : ''}`} />
        ))}
      </div>

      {step === 'welcome' && (
        <div className="card">
          <h2>ようこそ 👋</h2>
          <p className="muted">
            体重・食事・飲水・歩数を毎日記録して、目標体重の達成までを見える化するアプリです。
            記録データはこの端末の中だけに保存され、外部には送信されません。
          </p>
          <ul className="onboarding-list">
            <li>体重・体脂肪率を記録</li>
            <li>食事のカロリーと時刻を記録</li>
            <li>歩数・運動の消費カロリーを記録</li>
            <li>推移をグラフでふりかえり</li>
          </ul>
          <button onClick={() => setStep('profile')}>はじめる</button>
        </div>
      )}

      {step === 'profile' && (
        <div className="card">
          <h2>あなたについて教えてください</h2>
          <p className="muted">
            身長・生年月日・活動レベルから、1日の推定消費カロリーを計算します。
          </p>
          <ProfileForm
            onSaved={async (id) => {
              await setActiveProfileId(id);
              setProfileId(id);
              setStep('goal');
            }}
          />
        </div>
      )}

      {step === 'goal' && (
        <div className="card">
          <h2>目標を設定しましょう</h2>
          <p className="muted">あとから「あなた」タブでいつでも変更できます。</p>
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
          <div className="row">
            <button onClick={() => void saveGoalAndContinue()}>設定してつづける</button>
            <button className="secondary" onClick={() => setStep('guide')}>
              あとで設定する
            </button>
          </div>
        </div>
      )}

      {step === 'guide' && (
        <div className="card">
          <h2>使い方</h2>
          <div className="onboarding-guide-item">
            <span className="tab-name">あなた</span>
            <div>
              <p className="muted">プロフィールと目標、必要な1日消費カロリーを確認します。</p>
            </div>
          </div>
          <div className="onboarding-guide-item">
            <span className="tab-name">きょう</span>
            <div>
              <p className="muted">毎日ここで体重・食事・飲水・歩数を書き込みます。</p>
            </div>
          </div>
          <div className="onboarding-guide-item">
            <span className="tab-name">ふりかえり</span>
            <div>
              <p className="muted">グラフで体重やカロリー貯金の推移を確認します。</p>
            </div>
          </div>
          <button onClick={onComplete}>はじめる</button>
        </div>
      )}
    </div>
  );
}
