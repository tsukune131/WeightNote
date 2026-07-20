import { Capacitor } from '@capacitor/core';

/** Capacitorのネイティブアプリとして動いているか(WebやPWAならfalse) */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * その日の歩数をネイティブ(HealthKit)から取得する。
 * フェーズCでHealthKitプラグイン(候補: @perfood/capacitor-healthkit)を
 * 差し込むまではundefinedを返し、UIは手入力のまま動く。
 */
export async function fetchNativeSteps(_date: string): Promise<number | undefined> {
  if (!isNativeApp()) return undefined;
  // TODO(フェーズC): HealthKitから歩数を取得する
  return undefined;
}

const WEIGHT_NOTIFICATION_IDS = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i }));
const WAIST_NOTIFICATION_ID = 200;

/**
 * 体重記録のリマインダー通知を設定する(ネイティブのみ)。時刻は複数指定できる
 * (Profile.notifyWeightTimesの値をそのまま渡す想定)。フェーズCで実機確認する。
 */
export async function scheduleWeightReminders(times: string[]): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  await LocalNotifications.cancel({ notifications: WEIGHT_NOTIFICATION_IDS });
  await LocalNotifications.schedule({
    notifications: times.map((t, i) => {
      const [hour, minute] = t.split(':').map(Number);
      return {
        id: 100 + i,
        title: 'WeightNote',
        body: 'きょうの体重を書き込みましょう',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      };
    }),
  });
  return true;
}

/** 体重リマインダーを解除する */
export async function cancelWeightReminders(): Promise<void> {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: WEIGHT_NOTIFICATION_IDS });
}

/**
 * 腹囲記録の月次リマインダー通知を設定する(ネイティブのみ、毎月dayOfMonth日の朝9時)。
 * フェーズCで実機確認する。
 */
export async function scheduleWaistReminder(dayOfMonth: number): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: WAIST_NOTIFICATION_ID,
        title: 'WeightNote',
        body: '腹囲を記録しましょう',
        schedule: { on: { day: dayOfMonth, hour: 9, minute: 0 }, allowWhileIdle: true },
      },
    ],
  });
  return true;
}

/** 腹囲リマインダーを解除する */
export async function cancelWaistReminder(): Promise<void> {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: [{ id: WAIST_NOTIFICATION_ID }] });
}
