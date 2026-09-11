import test from "node:test";
import assert from "node:assert/strict";

import { presentCaptureSources } from "../src/desktop/capture-source-selection.js";

const sources = Object.freeze([
  Object.freeze({ id: "screen:0:0", name: "Screen 1" }),
  Object.freeze({ id: "window:4321:0", name: "Dota 2" }),
]);

test("capture source presentation automatically selects the verified Dota window", () => {
  assert.deepEqual(presentCaptureSources({
    sources,
    binding: { status: "bound", sourceId: "window:4321:0", sourceName: "Dota 2" },
  }), {
    sources,
    selectedId: "window:4321:0",
    message: "已自动锁定 dota2.exe 的可见窗口。",
    tone: "success",
  });
});

test("capture source presentation keeps manual fallback for expected Dota states", () => {
  assert.equal(presentCaptureSources({ sources, binding: { status: "not-running" } }).selectedId, "");
  assert.match(presentCaptureSources({ sources, binding: { status: "not-running" } }).message, /未发现 dota2.exe/);
  assert.match(presentCaptureSources({ sources, binding: { status: "no-visible-window" } }).message, /没有可见主窗口/);
  assert.match(presentCaptureSources({ sources, binding: { status: "source-unavailable" } }).message, /无法作为画面读取/);
});

test("capture source presentation rejects malformed IPC data", () => {
  assert.throws(() => presentCaptureSources([]), /画面来源/);
  assert.throws(() => presentCaptureSources({ sources: [{ id: "bad", name: "Dota" }], binding: { status: "not-running" } }), /画面编号/);
  assert.throws(() => presentCaptureSources({ sources, binding: { status: "bound", sourceId: "window:99:0" } }), /自动绑定/);
});
