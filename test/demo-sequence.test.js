import test from "node:test";
import assert from "node:assert/strict";

import { createDemoSequence } from "../src/demo-sequence.js";

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
  assert.deepEqual(scheduled.map(({ delay }) => delay), [1200, 2800]);
  scheduled[0].callback();
  scheduled[1].callback();
  assert.deepEqual(frames.map((frame) => frame.status.phase), [
    "starting",
    "unavailable",
    "detailed_stats",
  ]);
  assert.equal(frames.at(-1).notify, true);
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
  assert.deepEqual(cleared, [1200, 2800]);
});
