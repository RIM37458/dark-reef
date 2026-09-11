import test from "node:test";
import assert from "node:assert/strict";

import { assignedRoleLabel, draftTeams, positionCandidateIds } from "../src/assistant/draft-perspective.js";

test("draft perspective separates teams only after local side is known", () => {
  const slots = Array.from({ length: 10 }, (_, index) => ({
    index,
    side: index < 5 ? "radiant" : "dire",
    status: index === 0 || index === 6 ? "recognized" : "empty",
    ...(index === 0 ? { heroId: 1, confidence: 0.9 } : {}),
    ...(index === 6 ? { heroId: 2, confidence: 0.9 } : {}),
  }));
  assert.deepEqual(draftTeams({ localSide: "radiant", slots }), {
    radiantHeroIds: [1],
    direHeroIds: [2],
    allyHeroIds: [1],
    enemyHeroIds: [2],
  });
  assert.deepEqual(draftTeams({ localSide: "unknown", slots }).enemyHeroIds, []);
});

test("position candidates use broad Dota responsibilities and personal proficiency", () => {
  const heroes = [
    { id: 1, roles: ["Carry", "Escape"] },
    { id: 2, roles: ["Support", "Disabler"] },
    { id: 3, roles: ["Initiator", "Durable"] },
  ];
  assert.deepEqual(positionCandidateIds(heroes, 1, { 1: 5 }), [1]);
  assert.deepEqual(positionCandidateIds(heroes, 3, {}), [3]);
  assert.deepEqual(positionCandidateIds(heroes, 5, { 2: 4 }), [2]);
  assert.deepEqual(positionCandidateIds(heroes, undefined, {}), []);
});

test("assigned roles use client terminology before community position shorthand", () => {
  assert.equal(assignedRoleLabel(1), "优势路（常称 1 号位）");
  assert.equal(assignedRoleLabel(5), "纯辅助（常称 5 号位）");
  assert.equal(assignedRoleLabel(undefined), undefined);
});
