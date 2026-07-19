import { lazy, Suspense, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Profile } from './db';
import { Onboarding } from './components/Onboarding';
import { YouPage } from './pages/YouPage';
import { RecordPage } from './pages/RecordPage';

// Rechartsを使う推移画面はバンドルの大部分を占めるため、選んだ時だけ読み込む
const TrendsPage = lazy(() => import('./pages/TrendsPage').then((m) => ({ default: m.TrendsPage })));

type Tab = 'you' | 'record' | 'trends';

const TABS: { key: Tab; label: string }[] = [
  { key: 'you', label: 'あなた' },
  { key: 'record', label: 'きょう' },
  { key: 'trends', label: 'ふりかえり' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('record');
  // プロフィール作成の途中でprofiles.length が 0→1 に変わっても
  // オンボーディングの残りのステップ(目標設定・使い方)が飛ばされないよう、
  // 一度決めたら明示的にonComplete()が呼ばれるまで維持する
  const [onboarding, setOnboarding] = useState<boolean | undefined>(undefined);

  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const activeIdSetting = useLiveQuery(() => db.settings.get('activeProfileId'), []);

  useEffect(() => {
    if (profiles === undefined) return;
    if (profiles.length === 0) {
      // プロフィールが無ければ常にオンボーディングへ(削除して0件に戻った場合も含む)
      setOnboarding(true);
    } else if (onboarding === undefined) {
      // 既存ユーザーの起動時のみ、初回判定としてスキップする
      setOnboarding(false);
    }
  }, [profiles, onboarding]);

  if (profiles === undefined || onboarding === undefined) return null; // 読み込み中

  if (onboarding) {
    return <Onboarding onComplete={() => setOnboarding(false)} />;
  }

  const activeId = activeIdSetting ? Number(activeIdSetting.value) : undefined;
  const profile: Profile = profiles.find((p) => p.id === activeId) ?? profiles[0];

  return (
    <div>
      <div className="app-header">
        <h1>WeightNote</h1>
      </div>

      {tab === 'you' && <YouPage profile={profile} />}
      {tab === 'record' && <RecordPage profile={profile} />}
      {tab === 'trends' && (
        <Suspense fallback={<div className="empty-note">読み込み中…</div>}>
          <TrendsPage profile={profile} />
        </Suspense>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
