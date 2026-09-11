import test from "node:test";
import assert from "node:assert/strict";

import {
  ARMORY_POOLS,
  ensureArmoryPools,
  moveHeroToPool,
  setPersonalMatchup,
} from "../src/assistant/armory-profile.js";

const empty = Object.freeze({ schemaVersion: 2, categories: [], proficiency: {}, relationships: [], itemPlans: [] });

test("armory creates the three familiar hero pools", () => {
  const profile = ensureArmoryPools(empty);
  assert.deepEqual(profile.categories.map(({ name }) => name), ARMORY_POOLS.map(({ name }) => name));
});

test("moving a hero between familiar pools is exclusive and changes recommendation proficiency", () => {
  const signature = moveHeroToPool(empty, 93, "armory-signature");
  const played = moveHeroToPool(signature, 93, "armory-played");
  assert.deepEqual(played.categories.find(({ id }) => id === "armory-signature").heroIds, []);
  assert.deepEqual(played.categories.find(({ id }) => id === "armory-played").heroIds, [93]);
  assert.equal(played.proficiency[93], 1);
});

test("personal matchup replaces the same directed hero relation", () => {
  const first = setPersonalMatchup(empty, { heroId: 93, againstHeroId: 14, direction: "afraid", intensity: 2, note: "线上难打" });
  const replaced = setPersonalMatchup(first, { heroId: 93, againstHeroId: 14, direction: "counter", intensity: 3, note: "熟练后好打" });
  assert.equal(replaced.relationships.length, 1);
  assert.deepEqual(replaced.relationships[0], { heroId: 93, againstHeroId: 14, score: 3, note: "熟练后好打", source: "personal" });
});
