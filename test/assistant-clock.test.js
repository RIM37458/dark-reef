import test from "node:test";
import assert from "node:assert/strict";

import {
  cooldownObservation,
  formatGameTime,
  parseGameTime,
  presentCooldown,
} from "../src/assistant/game-clock.js";

test("game clock parses and formats match time including pre-game", () => {
  assert.equal(parseGameTime("12:34"), 754);
  assert.equal(parseGameTime("-1:05"), -65);
  assert.equal(formatGameTime(754), "12:34");
  assert.equal(formatGameTime(-65), "−1:05");
  assert.throws(() => parseGameTime("12:99"), /game time/);
  assert.throws(() => parseGameTime("tomorrow"), /game time/);
});

test("cooldown observation is exact when level is known", () => {
  assert.deepEqual(
    cooldownObservation({ observedAt: 620, cooldowns: [9, 8, 7, 6], level: 3 }),
    { observedAt: 620, readyFrom: 627, readyTo: 627, confidence: "exact" },
  );
  assert.deepEqual(presentCooldown({ observedAt: 620, readyFrom: 627, readyTo: 627 }, 623), {
    state: "cooling",
    label: "4秒",
  });
});

test("unknown level and modifiers produce a bounded cooldown", () => {
  assert.deepEqual(
    cooldownObservation({ observedAt: 100, cooldowns: [20, 16, 12], reductionPercent: 10 }),
    { observedAt: 100, readyFrom: 111, readyTo: 118, confidence: "range" },
  );
  assert.deepEqual(presentCooldown({ readyFrom: 111, readyTo: 118 }, 113), {
    state: "uncertain",
    label: "可能就绪 · 最迟5秒",
  });
  assert.deepEqual(presentCooldown({ readyFrom: 111, readyTo: 118 }, 118), {
    state: "ready",
    label: "已就绪",
  });
});

test("cooldown rejects invalid observations instead of inventing readiness", () => {
  assert.deepEqual(presentCooldown(undefined, 1), { state: "unknown", label: "未记录" });
  assert.throws(() => cooldownObservation({ observedAt: 1, cooldowns: [] }), /cooldown/);
  assert.throws(() => cooldownObservation({ observedAt: 1.5, cooldowns: [10] }), /game time/);
  assert.throws(() => cooldownObservation({ observedAt: 1, cooldowns: [10], level: 2 }), /level/);
  assert.throws(
    () => cooldownObservation({ observedAt: 1, cooldowns: [10], reductionPercent: 80 }),
    /reduction/,
  );
});
