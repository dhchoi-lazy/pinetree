const SCALE = 20;

export function normalize3D(
  positions: [number, number, number][]
): [number, number, number][] {
  if (positions.length === 0) return [];

  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];

  for (const p of positions) {
    for (let i = 0; i < 3; i++) {
      if (p[i] < mins[i]) mins[i] = p[i];
      if (p[i] > maxs[i]) maxs[i] = p[i];
    }
  }

  const ranges = maxs.map((max, i) => max - mins[i]);
  const maxRange = Math.max(...ranges);

  return positions.map((p) =>
    p.map((v, i) => {
      const center = (maxs[i] + mins[i]) / 2;
      return maxRange === 0 ? 0 : ((v - center) / maxRange) * SCALE * 2;
    }) as [number, number, number]
  );
}
