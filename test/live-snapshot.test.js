import test from "node:test";
import assert from "node:assert/strict";

import { accountIdFromSteamId64, toPublicMatch } from "../src/live-snapshot.js";

test("accountIdFromSteamId64 derives the public Dota account id", () => {
  assert.equal(accountIdFromSteamId64("76561198000000000"), 39734272);
  assert.equal(accountIdFromSteamId64("not-a-steam-id"), undefined);
});

test("toPublicMatch normalizes a SourceTV snapshot", () => {
  assert.deepEqual(toPublicMatch({
    matchId: "8988000000",
    gameTime: 901,
    radiantScore: 12,
    direScore: 9,
    radiantLead: 2345,
    spectators: 81,
    teamNameRadiant: "Radiant",
    teamNameDire: "Dire",
  }), {
    matchId: "8988000000",
    gameTime: 901,
    radiantScore: 12,
    direScore: 9,
    radiantLead: 2345,
    spectators: 81,
    radiantName: "Radiant",
    direName: "Dire",
  });
});

test("toPublicMatch accepts the nested Valve Web API shape and drops unsafe values", () => {
  const match = toPublicMatch({ match: {
    match_id: "8988000001",
    game_time: 125,
    radiant_score: 3,
    dire_score: 4,
    radiant_lead: Number.POSITIVE_INFINITY,
    team_name_radiant: " R ".repeat(100),
  } });
  assert.deepEqual(
    { ...match, radiantName: undefined },
    {
      matchId: "8988000001",
      gameTime: 125,
      radiantScore: 3,
      direScore: 4,
      radiantName: undefined,
    },
  );
  assert.equal(match.radiantName.length, 64);
});

test("toPublicMatch rejects malformed match payloads", () => {
  assert.equal(toPublicMatch(null), null);
  assert.equal(toPublicMatch({ matchId: "not-a-match" }), null);
});

test("toPublicMatch extracts the watched player's hero, inventory, and combat record", () => {
  const match = toPublicMatch({
    match: { match_id: "8988000002", game_time: 1500 },
    teams: [
      {
        team_number: 2,
        score: 31,
        net_worth: 65500,
        players: [{
          accountid: 39734272,
          heroid: 93,
          level: 21,
          kill_count: 9,
          death_count: 3,
          assists_count: 14,
          lh_count: 221,
          denies_count: 8,
          net_worth: 17320,
          x: -2048.5,
          y: 4096.25,
          respawn_time: 0,
          items: [
            { item_ability_id: 63, name: "item_power_treads", sold: false },
            { item_ability_id: 116, name: "item_black_king_bar", sold: false },
            { item_ability_id: 174, name: "item_diffusal_blade", sold: true },
          ],
        }],
      },
      {
        team_number: 3,
        score: 27,
        net_worth: 61200,
        players: [{ accountid: 8, heroid: 2, x: 3200, y: -1800, respawn_time: 18 }],
      },
    ],
    buildings: [
      { team: 2, type: 1, lane: 2, tier: 1, x: -5200, y: -6100, destroyed: false },
      { team: 3, type: 1, lane: 3, tier: 1, x: 5200, y: 6100, destroyed: true },
    ],
  }, "76561198000000000");

  assert.equal(match.radiantScore, 31);
  assert.equal(match.direScore, 27);
  assert.equal(match.radiantLead, 4300);
  assert.deepEqual(match.target, {
    accountId: 39734272,
    heroId: 93,
    heroName: "Slark",
    heroImageUrl: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/slark.png",
    level: 21,
    kills: 9,
    deaths: 3,
    assists: 14,
    lastHits: 221,
    denies: 8,
    netWorth: 17320,
    team: 2,
    x: -2048.5,
    y: 4096.25,
    respawnTime: 0,
    items: [
      {
        id: 63,
        name: "Power Treads",
        imageUrl: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/power_treads.png",
      },
      {
        id: 116,
        name: "Black King Bar",
        imageUrl: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/black_king_bar.png",
      },
    ],
  });
  assert.deepEqual(match.players.map(({ accountId, heroName, team, x, y, respawnTime }) => ({
    accountId, heroName, team, x, y, respawnTime,
  })), [
    { accountId: 39734272, heroName: "Slark", team: 2, x: -2048.5, y: 4096.25, respawnTime: 0 },
    { accountId: 8, heroName: "Axe", team: 3, x: 3200, y: -1800, respawnTime: 18 },
  ]);
  assert.deepEqual(match.buildings, [
    { team: 2, type: 1, lane: 2, tier: 1, x: -5200, y: -6100, destroyed: false },
    { team: 3, type: 1, lane: 3, tier: 1, x: 5200, y: 6100, destroyed: true },
  ]);
});

test("toPublicMatch reads terse numeric inventory slots", () => {
  const match = toPublicMatch({
    match: { match_id: "8988000003" },
    teams: [{
      team_number: 2,
      players: [{ accountid: 39734272, heroid: 93, items: [63, 116, 0, -1] }],
    }],
  }, "76561198000000000");

  assert.deepEqual(match.target.items.map(({ id }) => id), [63, 116]);
});
