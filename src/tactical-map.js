const WORLD_HALF_SIZE = 8192;
const WORLD_SIZE = WORLD_HALF_SIZE * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function worldToMapPosition(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return Object.freeze({
    left: ((clamp(x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE) + WORLD_HALF_SIZE) / WORLD_SIZE) * 100,
    top: ((WORLD_HALF_SIZE - clamp(y, -WORLD_HALF_SIZE, WORLD_HALF_SIZE)) / WORLD_SIZE) * 100,
  });
}

function heroMarker(player, index) {
  const position = worldToMapPosition(player.x, player.y);
  if (!position || !Number.isInteger(player.heroId)) return null;
  return Object.freeze({
    key: String(player.accountId ?? `${player.team}:${index}`),
    team: player.team,
    name: player.heroName ?? `英雄 #${player.heroId ?? "?"}`,
    heroId: player.heroId,
    ...position,
    dead: Number.isInteger(player.respawnTime) && player.respawnTime > 0,
  });
}

function buildingMarker(building) {
  if (building.destroyed) return null;
  const position = worldToMapPosition(building.x, building.y);
  if (!position) return null;
  return Object.freeze({
    key: `${building.team}:${building.type}:${building.tier}:${building.x}:${building.y}`,
    team: building.team,
    ...position,
    destroyed: false,
  });
}

export function presentTacticalMap(match) {
  const heroes = (match?.players ?? []).map((player, index) => (
    heroMarker(player, index)
  )).filter(Boolean);
  const buildings = (match?.buildings ?? []).map(buildingMarker).filter(Boolean);
  return Object.freeze({
    available: heroes.length > 0,
    heroes: Object.freeze(heroes),
    buildings: Object.freeze(buildings),
  });
}
