import assert from "node:assert/strict";
import test from "node:test";

import {
  createMatchupIndex,
  normalizeMatchupSnapshot,
  matchupEvidence,
} from "../src/assistant/matchup-library.js";

const raw = {
  schemaVersion: 1,
  provider: "OpenDota",
  scope: "professional_matches",
  sourceUrl: "https://api.opendota.com/api/heroes/93/matchups",
  fetchedAt: "2026-09-10T00:00:00.000Z",
  minimumSample: 40,
  baselines: [[93, 200, 100]],
  rows: [[93, 14, 70, 39], [14, 93, 70, 31], [93, 6, 12, 9]],
};

test("normalizes a traceable matchup snapshot", () => {
  const snapshot = normalizeMatchupSnapshot(raw);
  assert.equal(snapshot.rows.length, 3);
  assert.equal(snapshot.provider, "OpenDota");
  assert.equal(snapshot.minimumSample, 40);
  assert.ok(Object.isFrozen(snapshot.rows));
});

test("indexes objective evidence and excludes low samples from scoring", () => {
  const index = createMatchupIndex(normalizeMatchupSnapshot(raw));
  assert.deepEqual(matchupEvidence(index, 93, 14), {
    heroId: 93,
    againstHeroId: 14,
    games: 70,
    wins: 39,
    winRate: 39 / 70,
    baselineWinRate: 0.5,
    delta: (39 / 70) - 0.5,
    eligible: true,
  });
  assert.equal(matchupEvidence(index, 93, 6).eligible, false);
  assert.equal(matchupEvidence(index, 14, 93).baselineWinRate, 31 / 70);
});

test("rejects impossible or untraceable matchup data", () => {
  assert.throws(() => normalizeMatchupSnapshot({ ...raw, fetchedAt: "unknown" }), /fetchedAt/);
  assert.throws(() => normalizeMatchupSnapshot({ ...raw, rows: [[93, 14, 10, 11]] }), /wins/);
  assert.throws(() => normalizeMatchupSnapshot({ ...raw, sourceUrl: "http://example.com" }), /sourceUrl/);
  assert.throws(() => normalizeMatchupSnapshot({ ...raw, baselines: [[93, 2, 3]] }), /baseline wins/);
});
