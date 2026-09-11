import test from "node:test";
import assert from "node:assert/strict";

import {
  BUILTIN_DRAFT_CATEGORIES,
  normalizeDraftSelection,
  recommendDraftHeroes,
} from "../src/assistant/draft-recommendation.js";

const heroes = [
  { id: 1, roles: ["Carry", "Nuker"] },
  { id: 2, roles: ["Support", "Disabler"] },
  { id: 3, roles: ["Carry", "Disabler"] },
];

test("built-in draft categories cover the official hero roles", () => {
  assert.deepEqual(
    BUILTIN_DRAFT_CATEGORIES.map(({ id }) => id),
    ["carry", "support", "nuker", "disabler", "initiator", "durable", "escape", "pusher"],
  );
});

test("draft recommendations require every selected category and exclude unavailable heroes", () => {
  assert.deepEqual(recommendDraftHeroes({
    heroes,
    selectedCategoryIds: ["carry", "disabler"],
    unavailableHeroIds: [1],
  }), [3]);
});

test("no selected category keeps every available hero visible", () => {
  assert.deepEqual(recommendDraftHeroes({ heroes, unavailableHeroIds: [2] }), [1, 3]);
});

test("custom categories can be combined with official role categories", () => {
  assert.deepEqual(recommendDraftHeroes({
    heroes,
    selectedCategoryIds: ["carry", "comfort"],
    customCategories: [{ id: "comfort", name: "绝活", heroIds: [2, 3] }],
  }), [3]);
});

test("personal proficiency orders equally matching recommendations", () => {
  assert.deepEqual(recommendDraftHeroes({
    heroes,
    selectedCategoryIds: ["carry"],
    proficiency: { 1: 2, 3: 5 },
  }), [3, 1]);
});

test("draft selection accepts only known bounded categories", () => {
  assert.deepEqual(normalizeDraftSelection(["carry", "comfort", "carry"], [{ id: "comfort" }]), ["carry", "comfort"]);
  assert.throws(() => normalizeDraftSelection("carry", []), /分类/);
  assert.throws(() => normalizeDraftSelection(["unknown"], []), /未知/);
});
