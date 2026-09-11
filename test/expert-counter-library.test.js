import assert from "node:assert/strict";
import test from "node:test";

import {
  expertCounterEvidence,
  expertCounterItems,
  normalizeExpertCounterLibrary,
} from "../src/assistant/expert-counter-library.js";

const library = normalizeExpertCounterLibrary({
  schemaVersion: 1,
  reviewedPatch: "7.41",
  reviewedAt: "2026-09-11T00:00:00.000Z",
  sources: [{ id: "review", label: "Mechanic review", kind: "mechanic-review" }],
  interactions: [{
    id: "deny-recovery",
    effect: "recovery-denial",
    trait: "recovery-reliance",
    score: 3,
    reason: "封锁恢复针对依赖恢复",
    sourceId: "review",
  }],
  heroes: [
    {
      heroId: 1,
      effects: [{ mechanic: "recovery-denial", strength: 3, reason: "技能禁止恢复", sourceId: "review" }],
      traits: [],
    },
    {
      heroId: 2,
      effects: [],
      traits: [{ mechanic: "recovery-reliance", strength: 3, reason: "生存依赖恢复", sourceId: "review" }],
    },
  ],
  items: [{
    itemId: 50,
    buyerAnyRole: ["Support", "Initiator"],
    buyerNoneRole: ["Carry"],
    effects: [{ mechanic: "recovery-denial", strength: 2, reason: "主动降低恢复", sourceId: "review" }],
  }],
});

test("expert counters emerge from reusable mechanics instead of hero-pair rows", () => {
  assert.deepEqual(expertCounterEvidence(library, { id: 1, name: "Counter" }, { id: 2, name: "Enemy" }), {
    score: 3,
    reasons: [{
      text: "对 Enemy：封锁恢复针对依赖恢复（技能禁止恢复；生存依赖恢复）",
      score: 3,
      interactionId: "deny-recovery",
      source: { id: "review", label: "Mechanic review", kind: "mechanic-review" },
    }],
  });
  assert.deepEqual(expertCounterEvidence(library, { id: 2, name: "Enemy" }, { id: 1, name: "Counter" }), { score: 0, reasons: [] });
});

test("expert counter items require both a mechanic match and an applicable buyer role", () => {
  const items = [{ id: 50, name: "Response Item", cost: 2500 }];
  assert.deepEqual(expertCounterItems(library, { roles: ["Support"] }, items, [{ id: 2, name: "Enemy" }]), [{
    itemId: 50,
    score: 2,
    priority: 4,
    reason: "对 Enemy：封锁恢复针对依赖恢复（主动降低恢复；生存依赖恢复）",
    source: "expert-mechanics",
  }]);
  assert.deepEqual(expertCounterItems(library, { roles: ["Carry"] }, items, [{ id: 2, name: "Enemy" }]), []);
  assert.deepEqual(expertCounterItems(library, { roles: ["Support"] }, items, [{ id: 1, name: "Counter" }]), []);
});

test("expert counter data rejects direct pair overrides and invalid strengths", () => {
  const raw = {
    schemaVersion: 1,
    reviewedPatch: "7.41",
    reviewedAt: "2026-09-11T00:00:00.000Z",
    sources: [{ id: "review", label: "Review", kind: "mechanic-review" }],
    interactions: [],
    heroes: [{ heroId: 1, againstHeroId: 2, effects: [], traits: [] }],
    items: [],
  };
  assert.throws(() => normalizeExpertCounterLibrary(raw), /英雄机制档案格式无效/);
  assert.throws(() => normalizeExpertCounterLibrary({
    ...raw,
    heroes: [{ heroId: 1, effects: [{ mechanic: "test", strength: 4, reason: "bad", sourceId: "review" }], traits: [] }],
  }), /机制强度/);
  assert.throws(() => normalizeExpertCounterLibrary({
    ...raw,
    heroes: [{ heroId: 1, effects: [{ mechanic: 1, strength: 1, reason: "bad", sourceId: "review" }], traits: [] }],
  }), /机制编号/);
});

test("expert counter data rejects ambiguous duplicate profile and interaction ids", () => {
  const raw = {
    schemaVersion: 1,
    reviewedPatch: "7.41",
    reviewedAt: "2026-09-11T00:00:00.000Z",
    sources: [{ id: "review", label: "Review", kind: "mechanic-review" }],
    interactions: [
      { id: "same", effect: "a", trait: "b", score: 1, reason: "first", sourceId: "review" },
      { id: "same", effect: "c", trait: "d", score: 1, reason: "second", sourceId: "review" },
    ],
    heroes: [
      { heroId: 1, effects: [], traits: [] },
      { heroId: 1, effects: [], traits: [] },
    ],
    items: [],
  };
  assert.throws(() => normalizeExpertCounterLibrary(raw), /编号重复/);
  assert.throws(() => normalizeExpertCounterLibrary({
    ...raw,
    interactions: raw.interactions.slice(0, 1),
  }), /英雄机制档案编号重复/);
  assert.throws(() => normalizeExpertCounterLibrary({
    ...raw,
    interactions: raw.interactions.slice(0, 1),
    heroes: raw.heroes.slice(0, 1),
    items: [
      { itemId: 50, buyerAnyRole: ["Support"], buyerNoneRole: [], effects: [] },
      { itemId: 50, buyerAnyRole: ["Carry"], buyerNoneRole: [], effects: [] },
    ],
  }), /装备机制档案编号重复/);
});
