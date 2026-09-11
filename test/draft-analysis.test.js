import test from "node:test";
import assert from "node:assert/strict";

import { analyzeDraft } from "../src/assistant/draft-analysis.js";
import { normalizeExpertCounterLibrary } from "../src/assistant/expert-counter-library.js";
import { normalizeMatchupSnapshot } from "../src/assistant/matchup-library.js";

const heroes = [
  { id: 1, name: "Carry", roles: ["Carry"] },
  { id: 2, name: "Starter", roles: ["Initiator", "Disabler"] },
  { id: 3, name: "Support", roles: ["Support", "Disabler"] },
  { id: 4, name: "Enemy", roles: ["Carry", "Escape"] },
];
const items = [{ id: 116, name: "Black King Bar", cost: 4050 }];
const matchups = normalizeMatchupSnapshot({
  schemaVersion: 1,
  provider: "OpenDota",
  scope: "professional_matches",
  sourceUrl: "https://api.opendota.com/api/heroes/2/matchups",
  fetchedAt: "2026-09-10T00:00:00.000Z",
  minimumSample: 40,
  baselines: [[2, 200, 100], [3, 100, 50], [4, 100, 50]],
  rows: [[2, 4, 100, 60], [3, 4, 20, 15]],
});
const itemPopularity = {
  schemaVersion: 1,
  provider: "OpenDota",
  scope: "professional_matches",
  sourceUrl: "https://api.opendota.com/api/heroes/1/itemPopularity",
  fetchedAt: "2026-09-10T00:00:00.000Z",
  minimumPurchases: 5,
  rows: [[1, "mid_game", 116, 23]],
};

test("draft analysis reports role gaps and scores counters plus familiarity", () => {
  const analysis = analyzeDraft({
    radiantHeroIds: [1],
    direHeroIds: [4],
    catalog: { heroes, items },
    profile: {
      proficiency: { 2: 4, 3: 2 },
      relationships: [{ heroId: 2, againstHeroId: 4, score: 3, note: "稳定留人", source: "personal" }],
      itemPlans: [],
    },
    matchups,
    perspective: "radiant",
  });
  assert.equal(analysis.coverage.Initiator, 0);
  assert.ok(analysis.warnings.includes("缺少先手"));
  assert.equal(analysis.recommendations[0].heroId, 2);
  assert.ok(analysis.recommendations[0].reasons.includes("对 Enemy：稳定留人"));
  assert.deepEqual(analysis.recommendations[0].evidence, [{
    heroId: 2,
    againstHeroId: 4,
    games: 100,
    wins: 60,
    winRate: 0.6,
    baselineWinRate: 0.5,
    delta: (60 / 100) - 0.5,
    eligible: true,
  }]);
  assert.equal(analysis.recommendations.find(({ heroId }) => heroId === 3).evidence.length, 0);
});

test("draft analysis recommends only applicable personal item plans", () => {
  const analysis = analyzeDraft({
    radiantHeroIds: [1],
    direHeroIds: [4],
    playerHeroId: 1,
    catalog: { heroes, items },
    profile: {
      proficiency: {},
      relationships: [],
      itemPlans: [
        { heroId: 1, itemId: 116, priority: 5, situation: "正面免控", againstHeroIds: [4], source: "personal" },
        { heroId: 2, itemId: 116, priority: 5, situation: "不属于当前英雄", againstHeroIds: [], source: "personal" },
      ],
    },
  });
  assert.deepEqual(analysis.items, [{ itemId: 116, name: "Black King Bar", cost: 4050, priority: 5, reason: "正面免控", source: "personal" }]);
});

test("draft analysis keeps objective purchase counts distinct from personal plans", () => {
  const analysis = analyzeDraft({
    radiantHeroIds: [1],
    direHeroIds: [4],
    playerHeroId: 1,
    catalog: { heroes, items, itemPopularity },
    profile: { proficiency: {}, relationships: [], itemPlans: [] },
  });
  assert.deepEqual(analysis.items, [{
    itemId: 116,
    name: "Black King Bar",
    cost: 4050,
    purchases: 23,
    period: "mid_game",
    source: "OpenDota",
  }]);
});

test("draft analysis can restrict recommendations to the confirmed player position pool", () => {
  const result = analyzeDraft({
    radiantHeroIds: [],
    direHeroIds: [2],
    catalog: { heroes, items },
    profile: { proficiency: {}, relationships: [], itemPlans: [] },
    perspective: "radiant",
    candidateHeroIds: [1],
  });
  assert.deepEqual(result.recommendations.map(({ heroId }) => heroId), [1]);
});

test("reviewed mechanism counters outrank aggregate matchup-only candidates", () => {
  const expertCounters = normalizeExpertCounterLibrary({
    schemaVersion: 1,
    reviewedPatch: "7.41",
    reviewedAt: "2026-09-11T00:00:00.000Z",
    sources: [{ id: "review", label: "Review", kind: "mechanic-review" }],
    interactions: [{ id: "disable", effect: "disable-defence", trait: "active-defence", score: 3, reason: "封锁主动保命", sourceId: "review" }],
    heroes: [
      { heroId: 3, effects: [{ mechanic: "disable-defence", strength: 3, reason: "禁止施法", sourceId: "review" }], traits: [] },
      { heroId: 4, effects: [], traits: [{ mechanic: "active-defence", strength: 3, reason: "依赖主动技能存活", sourceId: "review" }] },
    ],
    items: [],
  });
  const extremeMatchups = normalizeMatchupSnapshot({
    schemaVersion: 1,
    provider: "OpenDota",
    scope: "professional_matches",
    sourceUrl: "https://api.opendota.com/api/heroes/2/matchups",
    fetchedAt: "2026-09-10T00:00:00.000Z",
    minimumSample: 40,
    baselines: [[2, 200, 100]],
    rows: [[2, 4, 100, 100]],
  });
  const analysis = analyzeDraft({
    radiantHeroIds: [],
    direHeroIds: [4],
    catalog: { heroes, items, expertCounters },
    profile: { proficiency: {}, relationships: [], itemPlans: [] },
    matchups: extremeMatchups,
    perspective: "radiant",
  });
  assert.equal(analysis.recommendations[0].heroId, 3);
  assert.ok(analysis.recommendations[0].reasons.some((reason) => reason.includes("封锁主动保命")));
  const stale = analyzeDraft({
    radiantHeroIds: [],
    direHeroIds: [4],
    catalog: { patch: "7.42", heroes, items, expertCounters },
    profile: { proficiency: {}, relationships: [], itemPlans: [] },
    matchups: extremeMatchups,
    perspective: "radiant",
  });
  assert.equal(stale.recommendations[0].heroId, 2);
  assert.equal(stale.expertCounterSource, undefined);
});

test("targeted mechanism items replace generic popularity entries for the same item", () => {
  const expertCounters = normalizeExpertCounterLibrary({
    schemaVersion: 1,
    reviewedPatch: "7.41",
    reviewedAt: "2026-09-11T00:00:00.000Z",
    sources: [{ id: "review", label: "Review", kind: "mechanic-review" }],
    interactions: [{ id: "response", effect: "survival-answer", trait: "survival-reliance", score: 2, reason: "装备针对生存机制", sourceId: "review" }],
    heroes: [{ heroId: 4, effects: [], traits: [{ mechanic: "survival-reliance", strength: 3, reason: "依赖生存机制", sourceId: "review" }] }],
    items: [{
      itemId: 116,
      buyerAnyRole: ["Carry"],
      buyerNoneRole: [],
      effects: [{ mechanic: "survival-answer", strength: 3, reason: "提供针对效果", sourceId: "review" }],
    }],
  });
  const analysis = analyzeDraft({
    radiantHeroIds: [1],
    direHeroIds: [4],
    playerHeroId: 1,
    catalog: { heroes, items, itemPopularity, expertCounters },
    profile: { proficiency: {}, relationships: [], itemPlans: [] },
  });
  assert.deepEqual(analysis.items, [{
    itemId: 116,
    name: "Black King Bar",
    cost: 4050,
    priority: 4,
    reason: "对 Enemy：装备针对生存机制（提供针对效果；依赖生存机制）",
    source: "expert-mechanics",
  }]);
});

test("expert mechanics do not crash on an enemy id absent from the catalog", () => {
  const result = analyzeDraft({
    radiantHeroIds: [],
    direHeroIds: [999],
    catalog: {
      heroes,
      items,
      expertCounters: normalizeExpertCounterLibrary({
        schemaVersion: 1,
        reviewedPatch: "7.41",
        reviewedAt: "2026-09-11T00:00:00.000Z",
        sources: [],
        interactions: [],
        heroes: [{ heroId: 1, effects: [], traits: [] }],
        items: [],
      }),
    },
    profile: { proficiency: {}, relationships: [], itemPlans: [] },
  });
  assert.equal(result.visiblePickCount, 1);
  assert.ok(result.recommendations.length > 0);
});
