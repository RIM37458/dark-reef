import assert from "node:assert/strict";
import test from "node:test";

import { normalizeItemPopularitySnapshot, popularItems } from "../src/assistant/item-popularity-library.js";

const snapshot = {
  schemaVersion: 1,
  provider: "OpenDota",
  scope: "professional_matches",
  sourceUrl: "https://api.opendota.com/api/heroes/93/itemPopularity",
  fetchedAt: "2026-09-10T00:00:00.000Z",
  minimumPurchases: 5,
  rows: [[93, "mid_game", 116, 7], [93, "late_game", 116, 29], [93, "late_game", 1, 2]],
};

test("returns sufficiently observed item choices without inventing a win rate", () => {
  assert.deepEqual(popularItems(snapshot, 93, [1, 116]), [
    { heroId: 93, period: "late_game", itemId: 116, purchases: 29 },
    { heroId: 93, period: "mid_game", itemId: 116, purchases: 7 },
  ]);
});

test("rejects malformed item popularity data", () => {
  assert.throws(() => normalizeItemPopularitySnapshot({ ...snapshot, rows: [[93, "never", 116, 7]] }), /period/);
});
