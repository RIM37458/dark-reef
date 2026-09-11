import test from "node:test";
import assert from "node:assert/strict";

import { createDraftDemoFrames } from "../src/demo-draft.js";

test("integrated draft demo fills ten slots and analyzes every visible pick", () => {
  const catalog = {
    heroes: [2, 5, 6, 8, 11, 14, 26, 28, 74, 93].map((id) => ({ id, name: `Hero ${id}`, roles: ["Carry"] })),
    items: [{ id: 116, name: "Black King Bar", cost: 4050 }],
  };
  const frames = createDraftDemoFrames(catalog);
  assert.equal(frames.length, 11);
  assert.equal(frames[0].radiantHeroIds.length + frames[0].direHeroIds.length, 0);
  assert.equal(frames.at(-1).radiantHeroIds.length, 5);
  assert.equal(frames.at(-1).direHeroIds.length, 5);
  assert.equal(frames.at(-1).complete, true);
  assert.ok(frames.every((frame) => frame.analysis));
});
