import test from "node:test";
import assert from "node:assert/strict";

import { createDraftObservationTracker, normalizeAssignedPosition } from "../src/assistant/draft-observation.js";

function raw(slots, extra = {}) {
  return {
    phase: "grid-visible",
    slots: Array.from({ length: 10 }, (_, index) => slots[index] ?? { index, status: "empty" }),
    bannedHeroIds: [],
    localSlotIndex: undefined,
    assignedPosition: undefined,
    mode: "ranked-roles",
    ...extra,
  };
}

test("ranked positions preserve confirmed and inferred evidence", () => {
  assert.deepEqual(normalizeAssignedPosition({ value: 2, confidence: 0.91, source: "ranked-roles-marker" }), {
    value: 2,
    confidence: 0.91,
    certainty: "confirmed",
    source: "ranked-roles-marker",
  });
  assert.deepEqual(normalizeAssignedPosition({ value: 4, confidence: 0.7, source: "composition-inference" }), {
    value: 4,
    confidence: 0.7,
    certainty: "inferred",
    source: "composition-inference",
  });
  assert.equal(normalizeAssignedPosition(undefined), undefined);
  assert.throws(() => normalizeAssignedPosition({ value: 6, confidence: 1, source: "ranked-roles-marker" }), /位置/);
  assert.throws(() => normalizeAssignedPosition({ value: 2, confidence: 1, source: "guess" }), /来源/);
});

test("two agreeing frames confirm picks and local side without inventing a position", () => {
  const tracker = createDraftObservationTracker({ confirmationFrames: 2, expiryFrames: 2 });
  const first = tracker.update(raw({ 1: { index: 1, status: "recognized", heroId: 1, confidence: 0.92 } }, { localSlotIndex: 1 }));
  assert.equal(first.slots[1].status, "uncertain");
  assert.equal(first.localSide, "unknown");
  assert.equal(first.assignedPosition, undefined);

  const second = tracker.update(raw({ 1: { index: 1, status: "recognized", heroId: 1, confidence: 0.93 } }, { localSlotIndex: 1 }));
  assert.deepEqual(second.slots[1], { index: 1, side: "radiant", status: "recognized", heroId: 1, confidence: 0.93 });
  assert.equal(second.localSide, "radiant");
});

test("collapsed grid retains stable lineup and duplicate hero matches stay uncertain", () => {
  const tracker = createDraftObservationTracker({ confirmationFrames: 2, expiryFrames: 2 });
  const picks = {
    0: { index: 0, status: "recognized", heroId: 4, confidence: 0.9 },
    5: { index: 5, status: "recognized", heroId: 8, confidence: 0.88 },
  };
  tracker.update(raw(picks));
  tracker.update(raw(picks));
  const strategy = tracker.update(raw({}, { phase: "strategy" }));
  assert.equal(strategy.slots[0].heroId, 4);
  assert.equal(strategy.slots[5].heroId, 8);

  const duplicate = tracker.update(raw({
    0: { index: 0, status: "recognized", heroId: 12, confidence: 0.95 },
    5: { index: 5, status: "recognized", heroId: 12, confidence: 0.94 },
  }));
  assert.equal(duplicate.slots[0].status, "uncertain");
  assert.equal(duplicate.slots[5].status, "uncertain");
});

test("confirmed Ranked Roles marker persists after its label leaves the screen", () => {
  const tracker = createDraftObservationTracker({ confirmationFrames: 2 });
  const marker = { value: 4, confidence: 0.9, source: "ranked-roles-marker" };
  const input = raw({});
  assert.equal(tracker.update({ ...input, assignedPosition: marker }).assignedPosition, undefined);
  assert.equal(tracker.update({ ...input, assignedPosition: marker }).assignedPosition.value, 4);
  assert.equal(tracker.update(input).assignedPosition.value, 4);
});
