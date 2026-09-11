import test from "node:test";
import assert from "node:assert/strict";

import {
  assertVerifiedDotaSource,
  captureDirectoriesToRemove,
} from "../src/assistant/training-capture-policy.js";

test("training capture accepts only the source bound to the visible dota2.exe window", () => {
  assert.equal(assertVerifiedDotaSource("window:421:0", {
    status: "bound",
    sourceId: "window:421:0",
  }), "window:421:0");

  assert.throws(
    () => assertVerifiedDotaSource("screen:0:0", { status: "bound", sourceId: "window:421:0" }),
    /Dota 2/,
  );
  assert.throws(
    () => assertVerifiedDotaSource("window:421:0", { status: "source-unavailable" }),
    /Dota 2/,
  );
});

test("capture retention removes oldest completed sessions without touching the active session", () => {
  const sessions = [
    { name: "2026-09-11T100000000Z", bytes: 350, modifiedAt: 1 },
    { name: "2026-09-11T110000000Z", bytes: 300, modifiedAt: 2 },
    { name: "2026-09-11T120000000Z", bytes: 250, modifiedAt: 3 },
  ];

  assert.deepEqual(captureDirectoriesToRemove({
    sessions,
    maximumBytes: 600,
    activeName: "2026-09-11T120000000Z",
  }), ["2026-09-11T100000000Z"]);
  assert.deepEqual(captureDirectoriesToRemove({
    sessions,
    maximumBytes: 200,
    activeName: "2026-09-11T120000000Z",
  }), ["2026-09-11T100000000Z", "2026-09-11T110000000Z"]);
});

test("capture retention rejects invalid storage policies", () => {
  assert.throws(
    () => captureDirectoriesToRemove({ sessions: null, maximumBytes: 600 }),
    /存储策略无效/,
  );
  assert.throws(
    () => captureDirectoriesToRemove({ sessions: [], maximumBytes: -1 }),
    /存储策略无效/,
  );
});
