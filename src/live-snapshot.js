import { heroes, item_ids as itemIds, items } from "dotaconstants";

const MATCH_ID = /^\d{1,20}$/;
const STEAM_ID64 = /^7656119\d{10}$/;
const STEAM_ACCOUNT_BASE = 76561197960265728n;
const CDN_BASE = "https://cdn.cloudflare.steamstatic.com";

function read(root, camelCase, snakeCase) {
  return root?.[camelCase] ?? root?.[snakeCase];
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

function finiteNumber(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

function identifier(value) {
  const text = String(value ?? "");
  return MATCH_ID.test(text) ? text : undefined;
}

function name(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 64) : undefined;
}

function imageUrl(path) {
  const clean = typeof path === "string" ? path.split("?")[0] : "";
  return /^\/apps\/dota2\/images\/dota_react\/(?:heroes|items)\/[a-z0-9_]+\.png$/.test(clean)
    ? `${CDN_BASE}${clean}`
    : undefined;
}

function compact(object) {
  return Object.freeze(Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ));
}

export function accountIdFromSteamId64(steamId64) {
  if (!STEAM_ID64.test(String(steamId64 ?? ""))) return undefined;
  const accountId = BigInt(steamId64) - STEAM_ACCOUNT_BASE;
  return accountId >= 0n && accountId <= 0xffff_ffffn ? Number(accountId) : undefined;
}

function publicItem(raw) {
  if (raw && typeof raw === "object" && raw.sold === true) return null;
  const rawId = typeof raw === "number" ? raw : read(raw, "itemAbilityId", "item_ability_id");
  const id = integer(rawId, 1, 100_000);
  if (!id) return null;
  const suppliedName = name(typeof raw === "object" ? raw.name : undefined)?.replace(/^item_/, "");
  const internalName = /^[a-z0-9_]{1,64}$/.test(suppliedName ?? "")
    ? suppliedName
    : itemIds[String(id)];
  const definition = internalName ? items[internalName] : undefined;
  return compact({
    id,
    name: name(definition?.dname) ?? internalName?.replaceAll("_", " ") ?? `物品 #${id}`,
    imageUrl: imageUrl(definition?.img),
  });
}

function publicPlayer(player, fallbackTeam) {
  const heroId = integer(read(player, "heroId", "heroid"), 1, 1000);
  const hero = heroId ? heroes[String(heroId)] : undefined;
  const rawItems = Array.isArray(player?.items) ? player.items : [];
  return compact({
    accountId: integer(read(player, "accountId", "accountid"), 1, 0xffff_ffff),
    heroId,
    heroName: name(hero?.localized_name),
    heroImageUrl: imageUrl(hero?.img),
    level: integer(player?.level, 0, 100),
    kills: integer(read(player, "kills", "kill_count"), 0, 999),
    deaths: integer(read(player, "deaths", "death_count"), 0, 999),
    assists: integer(read(player, "assists", "assists_count"), 0, 999),
    lastHits: integer(read(player, "lastHits", "lh_count"), 0, 100_000),
    denies: integer(read(player, "denies", "denies_count"), 0, 100_000),
    netWorth: integer(
      read(player, "netWorth", "net_worth") ?? read(player, "netGold", "net_gold"),
      0,
      100_000_000,
    ),
    team: integer(read(player, "team", "team_number") ?? fallbackTeam, 2, 3),
    x: finiteNumber(player?.x, -32_768, 32_768),
    y: finiteNumber(player?.y, -32_768, 32_768),
    respawnTime: integer(read(player, "respawnTime", "respawn_time"), 0, 3600),
    items: Object.freeze(rawItems.map(publicItem).filter(Boolean).slice(-9)),
  });
}

function publicBuilding(building) {
  if (!building || typeof building !== "object") return null;
  return compact({
    team: integer(read(building, "team", "team_number"), 2, 3),
    type: integer(building.type, 0, 32),
    lane: integer(building.lane, 0, 8),
    tier: integer(building.tier, 0, 8),
    x: finiteNumber(building.x, -32_768, 32_768),
    y: finiteNumber(building.y, -32_768, 32_768),
    destroyed: typeof building.destroyed === "boolean" ? building.destroyed : undefined,
  });
}

function teamNumber(team) {
  return integer(read(team, "teamNumber", "team_number"), 0, 16);
}

export function toPublicMatch(game, friendSteamId64) {
  if (!game || typeof game !== "object" || Array.isArray(game)) return null;
  const root = game.match && typeof game.match === "object" && !Array.isArray(game.match)
    ? game.match
    : game;
  const teams = Array.isArray(game.teams) ? game.teams.filter((team) => team && typeof team === "object") : [];
  const radiant = teams.find((team) => teamNumber(team) === 2) ?? teams[0];
  const dire = teams.find((team) => teamNumber(team) === 3) ?? teams[1];
  const targetAccountId = accountIdFromSteamId64(friendSteamId64);
  const players = teams.length
    ? teams.flatMap((team) => (Array.isArray(team.players)
      ? team.players.map((player) => publicPlayer(player, teamNumber(team)))
      : []))
    : (Array.isArray(game.players) ? game.players.map((player) => publicPlayer(player)) : []);
  const targetPlayer = targetAccountId
    ? players.find((player) => player.accountId === targetAccountId)
    : undefined;
  const buildings = Array.isArray(game.buildings)
    ? game.buildings.slice(0, 64).map(publicBuilding).filter(Boolean)
    : [];
  const radiantNetWorth = integer(read(radiant, "netWorth", "net_worth"), 0, 100_000_000);
  const direNetWorth = integer(read(dire, "netWorth", "net_worth"), 0, 100_000_000);
  const match = compact({
    matchId: identifier(read(root, "matchId", "match_id")),
    gameTime: integer(read(root, "gameTime", "game_time"), -3600, 86_400),
    radiantScore: integer(read(root, "radiantScore", "radiant_score") ?? radiant?.score, 0, 999),
    direScore: integer(read(root, "direScore", "dire_score") ?? dire?.score, 0, 999),
    radiantLead: integer(
      read(root, "radiantLead", "radiant_lead")
        ?? (radiantNetWorth !== undefined && direNetWorth !== undefined
          ? radiantNetWorth - direNetWorth
          : undefined),
      -10_000_000,
      10_000_000,
    ),
    spectators: integer(game.spectators ?? root.spectators, 0, 10_000_000),
    radiantName: name(read(root, "teamNameRadiant", "team_name_radiant") ?? read(radiant, "teamName", "team_name")),
    direName: name(read(root, "teamNameDire", "team_name_dire") ?? read(dire, "teamName", "team_name")),
    target: targetPlayer,
    players: players.length ? Object.freeze(players.slice(0, 32)) : undefined,
    buildings: buildings.length ? Object.freeze(buildings) : undefined,
  });
  return Object.keys(match).length ? match : null;
}
