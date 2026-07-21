/**
 * 日本語の名前検索の共通部分。料理プリセットと運動プリセットで共有する。
 */

/**
 * 検索キー用の正規化。
 * カタカナ→ひらがな、全角英数→半角、大文字→小文字に寄せ、
 * 記号・空白・長音は落とす("カレー ライス" も "かれーらいす" も同じキーになる)。
 */
export function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・()（）ー\-_,、.。]/g, '');
}

/**
 * スコア。小さいほど上位。
 * 完全一致 < 前方一致 < 部分一致 の順に優先し、同点なら
 * 名前が短いもの(=より一般的な呼び方)を上に出す。
 */
function score(keys: string[], q: string, nameLen: number): number | null {
  let best: number | null = null;
  for (const k of keys) {
    let s: number | null = null;
    if (k === q) s = 0;
    else if (k.startsWith(q)) s = 1000;
    else if (k.includes(q)) s = 2000;
    if (s != null && (best == null || s < best)) best = s;
  }
  return best == null ? null : best + nameLen;
}

/**
 * 名前とよみで引ける検索関数を作る。
 * インデックスは呼び出し時ではなくここで1度だけ作る。
 */
export function createSearcher<T extends { name: string; kana: string }>(
  items: readonly T[],
): (query: string, limit?: number) => T[] {
  const index = items.map((item, order) => ({
    item,
    keys: [normalize(item.name), normalize(item.kana)],
    order,
  }));

  return (query: string, limit = 20): T[] => {
    const q = normalize(query);
    if (!q) return [];
    const hits: { item: T; s: number; order: number }[] = [];
    for (const e of index) {
      const s = score(e.keys, q, e.item.name.length);
      if (s != null) hits.push({ item: e.item, s, order: e.order });
    }
    hits.sort((a, b) => a.s - b.s || a.order - b.order);
    return hits.slice(0, limit).map((h) => h.item);
  };
}
