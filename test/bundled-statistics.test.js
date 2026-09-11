import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createAssistantCatalog } from "../src/assistant/catalog.js";
import { analyzeDraft } from "../src/assistant/draft-analysis.js";
import { expertCounterEvidence, expertCounterItems, normalizeExpertCounterLibrary } from "../src/assistant/expert-counter-library.js";
import { normalizeItemPopularitySnapshot } from "../src/assistant/item-popularity-library.js";
import { normalizeMatchupSnapshot } from "../src/assistant/matchup-library.js";

const readJson = (name) => JSON.parse(readFileSync(new URL(`../assets/data/${name}`, import.meta.url), "utf8"));

test("bundled OpenDota snapshots have broad hero coverage and symmetric matchup evidence", () => {
  const matchups = normalizeMatchupSnapshot(readJson("opendota-pro-matchups.json"));
  const items = normalizeItemPopularitySnapshot(readJson("opendota-pro-items.json"));
  assert.ok(matchups.rows.length > 15_000);
  assert.ok(new Set(matchups.rows.map((row) => row[0])).size >= 125);
  assert.ok(matchups.rows.filter((row) => row[2] >= matchups.minimumSample).length > 9_000);
  const directed = new Map(matchups.rows.map((row) => [`${row[0]}:${row[1]}`, row]));
  for (const row of matchups.rows) {
    const reverse = directed.get(`${row[1]}:${row[0]}`);
    assert.ok(reverse);
    assert.equal(reverse[2], row[2]);
    assert.equal(reverse[3] + row[3], row[2]);
  }
  assert.ok(items.rows.length > 10_000);
  assert.ok(new Set(items.rows.map((row) => row[0])).size >= 125);
  assert.ok(items.rows.filter((row) => row[3] >= items.minimumPurchases).length > 5_000);
});

test("bundled mechanics rank Ancient Apparition and Doom as Morphling counters", () => {
  const catalog = createAssistantCatalog();
  const matchups = normalizeMatchupSnapshot(readJson("opendota-pro-matchups.json"));
  const expertCounters = normalizeExpertCounterLibrary(readJson("expert-counter-rules.json"));
  const analysis = analyzeDraft({
    radiantHeroIds: [],
    direHeroIds: [10],
    catalog: { ...catalog, expertCounters },
    profile: { proficiency: {}, relationships: [], itemPlans: [] },
    matchups,
    perspective: "radiant",
  });
  assert.deepEqual(new Set(analysis.recommendations.slice(0, 2).map(({ heroId }) => heroId)), new Set([68, 69]));
  assert.ok(analysis.recommendations.slice(0, 2).every(({ mechanicEvidence }) => mechanicEvidence.length > 0));
});

test("bundled mechanics recommend anti-restoration items by buyer role", () => {
  const catalog = createAssistantCatalog();
  const expertCounters = normalizeExpertCounterLibrary(readJson("expert-counter-rules.json"));
  const morphling = catalog.heroes.find(({ id }) => id === 10);
  const support = catalog.heroes.find(({ id }) => id === 68);
  const carry = catalog.heroes.find(({ id }) => id === 54);
  const supportItems = expertCounterItems(expertCounters, support, catalog.items, [morphling]).map(({ itemId }) => itemId);
  const carryItems = expertCounterItems(expertCounters, carry, catalog.items, [morphling]).map(({ itemId }) => itemId);
  assert.deepEqual(supportItems.filter((itemId) => [160, 267].includes(itemId)), [267]);
  assert.deepEqual(carryItems.filter((itemId) => [160, 267].includes(itemId)), [160]);
});

test("bundled knowledge covers independent counter mechanic families", () => {
  const catalog = createAssistantCatalog();
  const expertCounters = normalizeExpertCounterLibrary(readJson("expert-counter-rules.json"));
  const catalogHeroIds = new Set(catalog.heroes.map(({ id }) => id));
  const catalogItemIds = new Set(catalog.items.map(({ id }) => id));
  assert.ok(expertCounters.interactions.length >= 12);
  assert.ok(expertCounters.heroes.length >= 25);
  assert.ok(expertCounters.items.length >= 10);
  assert.ok(expertCounters.heroes.every(({ heroId }) => catalogHeroIds.has(heroId)));
  assert.ok(expertCounters.items.every(({ itemId }) => catalogItemIds.has(itemId)));
  const hero = (heroId) => catalog.heroes.find(({ id }) => id === heroId);
  const cases = [
    [123, 99, "passive-defence-disable"],
    [1, 94, "mana-based-survival-pressure"],
    [4, 17, "movement-punishment"],
    [7, 12, "unit-count-punishment"],
    [131, 12, "illusion-destruction"],
    [58, 21, "defensive-buff-dispel"],
    [111, 6, "attack-output-disable"],
    [68, 59, "restoration-denial"],
  ];
  for (const [candidateId, enemyId, interactionId] of cases) {
    const evidence = expertCounterEvidence(expertCounters, hero(candidateId), hero(enemyId));
    assert.ok(evidence.score > 0, `${candidateId} should counter ${enemyId}`);
    assert.ok(evidence.reasons.some((reason) => reason.interactionId === interactionId));
  }
});

test("bundled knowledge recommends role-applicable items across mechanic families", () => {
  const catalog = createAssistantCatalog();
  const expertCounters = normalizeExpertCounterLibrary(readJson("expert-counter-rules.json"));
  const hero = (heroId) => catalog.heroes.find(({ id }) => id === heroId);
  const itemIds = (buyerId, enemyId) => new Set(expertCounterItems(
    expertCounters,
    hero(buyerId),
    catalog.items,
    [hero(enemyId)],
  ).map(({ itemId }) => itemId));
  assert.ok(itemIds(54, 99).has(249));
  assert.ok(itemIds(12, 94).has(174));
  assert.ok(itemIds(6, 21).has(135));
  assert.ok(itemIds(54, 12).has(158));
  assert.ok(itemIds(44, 36).has(225));
  assert.ok(itemIds(96, 6).has(210));
});
