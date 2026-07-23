export const hash = (x, y, seed = 13) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 71.9) * 43758.5453;
  return value - Math.floor(value);
};

export function findMonsterSpawn(tileMap, monsterIndex) {
  const mapSize = tileMap.length;
  const innerSize = mapSize - 6;
  const candidateCount = innerSize * innerSize;
  const start = Math.floor(hash(monsterIndex, 4) * candidateCount);

  for (let attempt = 0; attempt < candidateCount; attempt++) {
    const candidate = (start + attempt) % candidateCount;
    const x = 3 + candidate % innerSize;
    const y = 3 + Math.floor(candidate / innerSize);
    const tile = tileMap[y]?.[x];
    const insideTownSafeZone = x > 16 && x < 31 && y > 16 && y < 30;

    if (tile && !tile.blocked && !insideTownSafeZone) return { x, y };
  }

  return null;
}
