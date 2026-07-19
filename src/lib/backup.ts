import { db } from '../db';
import { todayStr } from './date';

const TABLES = ['profiles', 'weights', 'meals', 'waterLogs', 'steps', 'exercises', 'foods', 'settings'] as const;

interface BackupFile {
  app: string;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function exportAllData(): Promise<void> {
  const data: Record<string, unknown[]> = {};
  for (const name of TABLES) {
    data[name] = await db.table(name).toArray();
  }
  const payload: BackupFile = {
    app: 'weight-app',
    exportedAt: new Date().toISOString(),
    data,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `weight-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAllData(file: File): Promise<void> {
  const text = await file.text();
  const payload = JSON.parse(text) as BackupFile;
  if (payload.app !== 'weight-app' || typeof payload.data !== 'object') {
    throw new Error('このアプリのバックアップファイルではありません');
  }
  await db.transaction('rw', TABLES.map((n) => db.table(n)), async () => {
    for (const name of TABLES) {
      const table = db.table(name);
      await table.clear();
      const rows = payload.data[name];
      if (Array.isArray(rows) && rows.length > 0) {
        await table.bulkAdd(rows);
      }
    }
  });
}
