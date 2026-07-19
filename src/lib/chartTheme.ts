import { useEffect, useState } from 'react';

/**
 * dataviz参照パレット(検証済み)。色は系列(エンティティ)に固定で割り当てる。
 * light/darkは同じ色相を各サーフェス向けにステップしたもの。
 */
const LIGHT = {
  weight: '#2a78d6', // blue (slot1)
  fat: '#4a3aa7', // violet (slot7) 体脂肪率
  breakfast: '#2a78d6', // blue
  lunch: '#008300', // green
  dinner: '#e87ba4', // magenta
  snack: '#eda100', // yellow
  water: '#2a78d6', // blue(単系列)
  steps: '#1baf7a', // aqua
  exercise: '#eb6834', // orange
  divergePos: '#2a78d6', // blue(達成超過)
  divergeNeg: '#e34948', // red(不足)
  grid: '#e0e2da',
  axis: '#8b9085',
  reference: '#5d5f56',
  surface: '#fffefb',
};

const DARK: typeof LIGHT = {
  weight: '#3987e5',
  fat: '#9085e9',
  breakfast: '#3987e5',
  lunch: '#008300',
  dinner: '#d55181',
  snack: '#c98500',
  water: '#3987e5',
  steps: '#199e70',
  exercise: '#d95926',
  divergePos: '#3987e5',
  divergeNeg: '#e66767',
  grid: '#3a3830',
  axis: '#9a968a',
  reference: '#c3c0b4',
  surface: '#292822',
};

export type ChartTheme = typeof LIGHT;

export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark ? DARK : LIGHT;
}
