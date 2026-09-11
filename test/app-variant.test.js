import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppVariant } from "../src/desktop/app-variant.js";

test("formal application excludes demo operations", () => {
  assert.deepEqual(resolveAppVariant("formal"), {
    id: "formal",
    appId: "com.codex.dota-friend-watcher",
    productName: "暗黑之礁",
    title: "暗黑之礁",
    userDataDirectory: "dota-friend-watcher",
    allowsMonitoring: true,
    allowsAssistant: true,
    allowsDemo: false,
  });
});

test("demo application cannot start monitoring or access the live assistant", () => {
  assert.deepEqual(resolveAppVariant("demo"), {
    id: "demo",
    appId: "com.codex.dota-friend-watcher.demo",
    productName: "暗黑之礁演示回廊",
    title: "暗黑之礁 · 演示回廊",
    userDataDirectory: "dota-friend-watcher-demo",
    allowsMonitoring: false,
    allowsAssistant: false,
    allowsDemo: true,
  });
});

test("development defaults to formal and invalid packaged variants fail closed", () => {
  assert.equal(resolveAppVariant().id, "formal");
  assert.throws(() => resolveAppVariant("combined"), /未知应用版本/);
});
