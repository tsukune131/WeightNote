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

/** 1件目(必ず届く)固定ID */
const WEIGHT_MANDATORY_ID = 100;
/** 2件目以降(その日の体重が未入力なら届く)用に予約したID */
const WEIGHT_CONDITIONAL_IDS = Array.from({ length: 9 }, (_, i) => ({ id: 101 + i }));
const ALL_WEIGHT_IDS = [{ id: WEIGHT_MANDATORY_ID }, ...WEIGHT_CONDITIONAL_IDS];
const WAIST_NOTIFICATION_ID = 200;

/**
 * 体重記録のリマインダー通知を設定する(ネイティブのみ)。
 * 仕様: times[0]は毎日必ず届く(OSの繰り返し通知で実装)。
 * times[1]以降は「その日の体重が未入力なら届く」条件付きにしたいが、
 * OSの繰り返し通知には条件判定がないため、フェーズCでは
 * 「当日ぶんの単発通知」を毎日(アプリ起動時など)補充する設計が必要になる。
 * 体重を保存した日は cancelTodaysConditionalWeightReminders() を呼んで
 * その日の2件目以降を取り消す。
 *
 * 現時点ではtimes[0]の繰り返し通知のみ実装済み。times[1]以降の単発補充は
 * フェーズCのTODO(実機がないと補充タイミングの検証ができないため)。
 */
export async function scheduleWeightReminders(times: string[]): Promise<boolean> {
  if (!isNativeApp() || times.length === 0) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  await LocalNotifications.cancel({ notifications: ALL_WEIGHT_IDS });
  const [hour, minute] = times[0].split(':').map(Number);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: WEIGHT_MANDATORY_ID,
        title: 'VitaNote',
        body: 'きょうの体重を書き込みましょう',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  });
  // TODO(フェーズC): times[1]以降を「当日ぶんの単発通知」として日々補充する
  return true;
}

/** 体重リマインダーを解除する(1件目・2件目以降とも) */
export async function cancelWeightReminders(): Promise<void> {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: ALL_WEIGHT_IDS });
}

/**
 * その日の体重を保存したときに呼ぶ。2件目以降(条件付き)のリマインダーのうち
 * 当日ぶんを取り消す。フェーズCで単発通知の補充を実装した後、
 * 「当日ぶんのIDだけ」を取り消すよう調整する(今は予約枠を丸ごと取り消す簡易実装)。
 */
export async function cancelTodaysConditionalWeightReminders(): Promise<void> {
  if (!isNativeApp()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.cancel({ notifications: WEIGHT_CONDITIONAL_IDS });
}

/**
 * 腹囲記録の週次リマインダー通知を設定する(ネイティブのみ、指定曜日の朝9時)。
 * weekdayは0(日)〜6(土)。Capacitor/iOSのweekday表現(1=日〜7=土)に+1して渡す。
 * フェーズCで実機確認する。
 */
export async function scheduleWaistReminder(weekday: number): Promise<boolean> {
  if (!isNativeApp()) return false;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: WAIST_NOTIFICATION_ID,
        title: 'VitaNote',
        body: '腹囲を記録しましょう',
        schedule: { on: { weekday: weekday + 1, hour: 9, minute: 0 }, allowWhileIdle: true },
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
