import test from "node:test";
import assert from "node:assert/strict";

import { toPublicMatch } from "../src/live-snapshot.js";

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
