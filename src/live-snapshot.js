const MATCH_ID = /^\d{1,20}$/;

function read(root, camelCase, snakeCase) {
  return root[camelCase] ?? root[snakeCase];
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

function identifier(value) {
  const text = String(value ?? "");
  return MATCH_ID.test(text) ? text : undefined;
}

function name(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 64) : undefined;
}

export function toPublicMatch(game) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return null;
  const root = game.match && typeof game.match === "object" && !Array.isArray(game.match)
    ? game.match
    : game;
  const match = {
    matchId: identifier(read(root, "matchId", "match_id")),
    gameTime: integer(read(root, "gameTime", "game_time"), -3600, 86_400),
    radiantScore: integer(read(root, "radiantScore", "radiant_score"), 0, 999),
    direScore: integer(read(root, "direScore", "dire_score"), 0, 999),
    radiantLead: integer(read(root, "radiantLead", "radiant_lead"), -10_000_000, 10_000_000),
    spectators: integer(root.spectators, 0, 10_000_000),
    radiantName: name(read(root, "teamNameRadiant", "team_name_radiant")),
    direName: name(read(root, "teamNameDire", "team_name_dire")),
  };
  const publicEntries = Object.entries(match).filter(([, value]) => value !== undefined);
  return publicEntries.length ? Object.freeze(Object.fromEntries(publicEntries)) : null;
}
