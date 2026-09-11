import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { normalizeDraftProfile } from "../src/assistant/draft-profile.js";
import { createDraftProfileStore } from "../src/assistant/draft-profile-store.js";

test("draft profile normalizes custom categories and proficiency", () => {
  assert.deepEqual(normalizeDraftProfile({
    categories: [{ id: "comfort", name: "  我的绝活 ", heroIds: [93, 1, 93] }],
    proficiency: { 93: 5, 1: 2 },
    relationships: [{ heroId: 93, againstHeroId: 14, score: 2, note: "躲开钩后反打" }],
    itemPlans: [{ heroId: 93, itemId: 116, priority: 5, situation: "对方控制集中", againstHeroIds: [14, 26] }],
  }), {
    schemaVersion: 2,
    categories: [{ id: "comfort", name: "我的绝活", heroIds: [93, 1] }],
    proficiency: { 1: 2, 93: 5 },
    relationships: [{ heroId: 93, againstHeroId: 14, score: 2, note: "躲开钩后反打", source: "personal" }],
    itemPlans: [{ heroId: 93, itemId: 116, priority: 5, situation: "对方控制集中", againstHeroIds: [14, 26], source: "personal" }],
  });
  assert.throws(() => normalizeDraftProfile({ categories: [{ id: "carry", name: "冲突", heroIds: [] }] }), /保留/);
  assert.throws(() => normalizeDraftProfile({ proficiency: { 93: 9 } }), /熟练度/);
});

test("draft profile store persists one local editable library", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-draft-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const store = createDraftProfileStore({ file: path.join(directory, "draft-profile.json") });
  assert.deepEqual(await store.load(), { schemaVersion: 2, categories: [], proficiency: {}, relationships: [], itemPlans: [] });
  const saved = await store.save({ categories: [{ id: "safe", name: "稳手", heroIds: [93] }], proficiency: { 93: 4 } });
  assert.deepEqual(await store.load(), saved);
});

test("draft profile migrates v1 categories and proficiency without loss", () => {
  assert.deepEqual(normalizeDraftProfile({
    schemaVersion: 1,
    categories: [{ id: "safe", name: "稳手", heroIds: [93] }],
    proficiency: { 93: 4 },
  }), {
    schemaVersion: 2,
    categories: [{ id: "safe", name: "稳手", heroIds: [93] }],
    proficiency: { 93: 4 },
    relationships: [],
    itemPlans: [],
  });
});

test("draft profile rejects malformed renderer input", () => {
  assert.throws(() => normalizeDraftProfile(null), /格式/);
  assert.throws(() => normalizeDraftProfile({ schemaVersion: 3 }), /版本/);
  assert.throws(() => normalizeDraftProfile({ categories: Array(25).fill({}) }), /24/);
  assert.throws(() => normalizeDraftProfile({ categories: [{ id: "A", name: "x" }] }), /编号/);
  assert.throws(() => normalizeDraftProfile({ categories: [{ id: "a", name: "" }] }), /分类名/);
  assert.throws(() => normalizeDraftProfile({ categories: [{ id: "a", name: "x", heroIds: "bad" }] }), /列表/);
  assert.throws(() => normalizeDraftProfile({ categories: [{ id: "a", name: "x" }, { id: "a", name: "y" }] }), /重复/);
  assert.throws(() => normalizeDraftProfile({ proficiency: [] }), /熟练度格式/);
  assert.throws(() => normalizeDraftProfile({ proficiency: { 0: 2 } }), /英雄编号/);
  assert.throws(() => normalizeDraftProfile({ relationships: [{ heroId: 93, againstHeroId: 14, score: 5 }] }), /克制强度/);
  assert.throws(() => normalizeDraftProfile({ itemPlans: [{ heroId: 93, itemId: 116, priority: 0 }] }), /优先级/);
});

test("draft profile store rejects unsafe paths and corrupted storage", async (context) => {
  assert.throws(() => createDraftProfileStore({ file: "relative.json" }), /absolute/);
  const directory = await mkdtemp(path.join(tmpdir(), "dark-reef-draft-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "draft-profile.json");
  await import("node:fs/promises").then(({ writeFile }) => writeFile(file, "{bad", "utf8"));
  await assert.rejects(createDraftProfileStore({ file }).load(), /JSON/);
});
