import test from "node:test";
import assert from "node:assert/strict";

import { presentTacticalMap, worldToMapPosition } from "../src/tactical-map.js";

test("worldToMapPosition projects Dota world coordinates onto the minimap", () => {
  assert.deepEqual(worldToMapPosition(0, 0), { left: 50, top: 50 });
  assert.deepEqual(worldToMapPosition(-8192, -8192), { left: 0, top: 100 });
  assert.deepEqual(worldToMapPosition(8192, 8192), { left: 100, top: 0 });
  assert.equal(worldToMapPosition(Number.NaN, 0), undefined);
});

test("presentTacticalMap exposes minimap hero ids and living structures", () => {
  assert.deepEqual(presentTacticalMap({
    target: { accountId: 7 },
    players: [
      { accountId: 7, team: 2, heroId: 93, heroName: "Slark", heroImageUrl: "slark.png", x: -2048, y: -4096 },
      { accountId: 8, team: 3, heroId: 28, heroName: "Slardar", heroImageUrl: "slardar.png", x: 4096, y: 2048, respawnTime: 13 },
      { accountId: 9, team: 3, heroName: "Hidden" },
    ],
    buildings: [
      { team: 2, type: 1, tier: 2, x: -4096, y: -1024, destroyed: false },
      { team: 3, type: 1, tier: 1, x: 2048, y: 4096, destroyed: true },
    ],
  }), {
    available: true,
    heroes: [
      {
        key: "7",
        team: 2,
        name: "Slark",
        heroId: 93,
        left: 37.5,
        top: 75,
        dead: false,
      },
      {
        key: "8",
        team: 3,
        name: "Slardar",
        heroId: 28,
        left: 75,
        top: 37.5,
        dead: true,
      },
    ],
    buildings: [{ key: "2:1:2:-4096:-1024", team: 2, left: 25, top: 56.25, destroyed: false }],
  });
});

test("presentTacticalMap keeps the battlefield under fog when no coordinates are public", () => {
  assert.deepEqual(presentTacticalMap({ players: [{ heroName: "Slark" }] }), {
    available: false,
    heroes: [],
    buildings: [],
  });
});
