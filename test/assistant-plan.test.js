import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { normalizePlan } from "../src/assistant/plan-schema.js";
import { createPlanStore } from "../src/assistant/plan-store.js";

const NOW = "2026-09-10T05:00:00.000Z";

test("personal plan normalization bounds renderer and imported input", () => {
  const plan = normalizePlan(
    {
      title: "  对阵小鱼人  ",
      description: "留控制打断黑暗契约",
      enemySlots: [{ heroId: 93, notes: "看二技能" }, null],
      itemIds: [1, 1, 50],
      ignored: "drop me",
    },
    { createId: () => "plan-1", now: () => NOW },
  );
  assert.deepEqual(plan, {
    schemaVersion: 1,
    id: "plan-1",
    title: "对阵小鱼人",
    description: "留控制打断黑暗契约",
    enemySlots: [{ heroId: 93, notes: "看二技能", abilityLevels: {} }, null, null, null, null],
    itemIds: [1, 50],
    source: "personal",
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.throws(() => normalizePlan({ title: "x".repeat(121) }), /title/);
  assert.throws(() => normalizePlan({ schemaVersion: 99, title: "old" }), /schema version/);
  assert.throws(() => normalizePlan(null), /plan/);
  assert.throws(() => normalizePlan({ title: "x", enemySlots: Array(6) }), /five/);
  assert.throws(() => normalizePlan({ title: "x", enemySlots: ["slark"] }), /enemy slot/);
  assert.throws(
    () => normalizePlan({ title: "x", enemySlots: [{ heroId: 93, abilityLevels: [] }] }),
    /abilityLevels/,
  );
  assert.throws(
    () => normalizePlan({ title: "x", enemySlots: [{ heroId: 93, abilityLevels: { bad: 9 } }] }),
    /invalid entry/,
  );
  assert.throws(() => normalizePlan({ title: "x", itemIds: Array(25).fill(1) }), /24/);
  assert.throws(() => normalizePlan({ title: "x", itemIds: [0] }), /positive integer/);
});

test("plan store persists, exports, imports, and deletes normalized plans", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-plans-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "assistant-plans.json");
  const store = createPlanStore({ file, createId: () => "plan-a", now: () => NOW });

  const saved = await store.save({ title: "Roshan 争夺", enemySlots: [{ heroId: 93 }] });
  assert.equal(saved.id, "plan-a");
  assert.deepEqual(await store.list(), [saved]);
  assert.equal(JSON.parse(await readFile(file, "utf8")).schemaVersion, 1);

  const reopened = createPlanStore({ file, createId: () => "plan-b", now: () => NOW });
  const exported = await reopened.exportJson(saved.id);
  await reopened.delete(saved.id);
  assert.deepEqual(await reopened.list(), []);
  const imported = await reopened.importJson(exported);
  assert.equal(imported.id, "plan-b");
  assert.equal(imported.title, saved.title);

  const updated = await reopened.save({ ...imported, title: "第二版" });
  assert.equal(updated.createdAt, imported.createdAt);
  assert.equal((await reopened.list()).length, 1);
  assert.equal(await reopened.delete("missing"), false);
  await assert.rejects(reopened.exportJson("missing"), /not found/);
});

test("listing a plan preserves its stored modification timestamp", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-plans-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  let time = "2026-09-10T05:00:00.000Z";
  const store = createPlanStore({
    file: path.join(directory, "plans.json"),
    createId: () => "stable-plan",
    now: () => time,
  });
  const saved = await store.save({ title: "时间封印" });
  time = "2026-09-11T05:00:00.000Z";
  assert.equal((await store.list())[0].updatedAt, saved.updatedAt);
  assert.equal((await store.save({ ...saved, title: "时间封印二" })).updatedAt, time);
});

test("plan store rejects oversized and malformed imports", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-plans-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = createPlanStore({ file: path.join(directory, "plans.json") });
  await assert.rejects(store.importJson("x".repeat(100_001)), /too large/);
  await assert.rejects(store.importJson("{broken"), /valid JSON/);
});

test("plan store refuses unsafe locations and corrupted storage", async (context) => {
  assert.throws(() => createPlanStore({ file: "relative.json" }), /absolute path/);
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-plans-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const malformed = path.join(directory, "malformed.json");
  await import("node:fs/promises").then(({ writeFile }) => writeFile(malformed, "{bad", "utf8"));
  await assert.rejects(createPlanStore({ file: malformed }).list(), /not valid JSON/);
  const obsolete = path.join(directory, "obsolete.json");
  await import("node:fs/promises").then(({ writeFile }) => writeFile(
    obsolete,
    JSON.stringify({ schemaVersion: 9, plans: [] }),
    "utf8",
  ));
  await assert.rejects(createPlanStore({ file: obsolete }).list(), /unsupported schema/);
});
