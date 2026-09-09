import test from "node:test";
import assert from "node:assert/strict";

import { createDemoSequence } from "../src/demo-sequence.js";
import { toPublicMatch } from "../src/live-snapshot.js";

test("createDemoSequence stages a patrol before marking the bot prisoner", () => {
  const frames = [];
  const scheduled = [];
  const sequence = createDemoSequence({
    onFrame: (frame) => frames.push(frame),
    setTimeoutFn: (callback, delay) => {
      scheduled.push({ callback, delay });
      return delay;
    },
    clearTimeoutFn: () => {},
  });

  assert.deepEqual(frames.map((frame) => frame.status.phase), ["starting"]);
  assert.deepEqual(scheduled.map(({ delay }) => delay), [1200, 2800, 4800, 6800]);
  for (const { callback } of scheduled) callback();
  assert.deepEqual(frames.map((frame) => frame.status.phase), [
    "starting",
    "unavailable",
    "detailed_stats",
    "detailed_stats",
    "detailed_stats",
  ]);
  assert.equal(frames.at(-1).status.game.teams[0].score, 22);
  assert.deepEqual(frames.at(-1).status.game.teams[0].players[0].items, [63, 174, 152, 116, 143]);
  const visibleMatch = toPublicMatch(frames.at(-1).status.game, "76561197960265735");
  assert.equal(visibleMatch.target.heroName, "Slark");
  assert.equal(visibleMatch.players.length, 10);
  assert.equal(visibleMatch.players.filter(({ team }) => team === 2).length, 5);
  assert.equal(visibleMatch.players.filter(({ team }) => team === 3).length, 5);
  assert.equal(visibleMatch.buildings.length, 12);
  assert.ok(visibleMatch.players.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
  const firstMatch = toPublicMatch(frames.at(-3).status.game, "76561197960265735");
  assert.notDeepEqual(
    visibleMatch.players.map(({ x, y }) => [x, y]),
    firstMatch.players.map(({ x, y }) => [x, y]),
  );
  assert.deepEqual(visibleMatch.target.items.map(({ name }) => name), [
    "Power Treads",
    "Diffusal Blade",
    "Shadow Blade",
    "Black King Bar",
    "Skull Basher",
  ]);
  assert.equal(frames.at(-1).notify, undefined);
  sequence.cancel();
});

test("createDemoSequence cancels every pending frame", () => {
  const cleared = [];
  const sequence = createDemoSequence({
    onFrame: () => {},
    setTimeoutFn: (_callback, delay) => delay,
    clearTimeoutFn: (timer) => cleared.push(timer),
  });

  sequence.cancel();
  assert.deepEqual(cleared, [1200, 2800, 4800, 6800]);
});
