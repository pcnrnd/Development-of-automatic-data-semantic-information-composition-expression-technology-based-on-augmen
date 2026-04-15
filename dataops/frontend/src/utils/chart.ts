/**
 * 데모용 시계열을 SVG polyline points 문자열로 변환 (viewBox 0 0 100 22)
 */
export const sparklinePoints = (data: number[]): string => {
  const peak = Math.max(...data, 1e-6);
  const n = data.length;
  if (n === 0) return '';
  return data
    .map((v, j) => {
      const x = n === 1 ? 0 : (j / (n - 1)) * 100;
      const y = 22 - (v / peak) * 20;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
};

/**
 * 스토리지 I/O·세션 등 처리량형 카드용: 하단 기준 영역 + 라인 path (viewBox 0 0 100 32)
 */
export const throughputSparkPaths = (data: number[]): { areaD: string; lineD: string } => {
  const peak = Math.max(...data, 1e-6);
  const n = data.length;
  const W = 100;
  const H = 32;
  const py = 4;
  const innerH = H - py * 2;
  if (n === 0) return { areaD: '', lineD: '' };
  let lineD = '';
  data.forEach((v, j) => {
    const x = n === 1 ? 0 : (j / (n - 1)) * W;
    const y = H - py - (v / peak) * innerH;
    lineD += j === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : ` L${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  const areaD = `${lineD} L${W} ${H} L0 ${H}Z`;
  return { areaD, lineD };
};

/**
 * stable bar heights per range (seeded so they don't randomize on re-render)
 */
export const makeBarData = (count: number, seed: number): { h1: number; h2: number }[] =>
  Array.from({ length: count }, (_, i) => ({
    h1: 30 + ((seed * (i + 1) * 7) % 60),
    h2: 20 + ((seed * (i + 1) * 3) % 40),
  }));
