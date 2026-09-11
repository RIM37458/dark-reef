import test from "node:test";
import assert from "node:assert/strict";

import {
  captureSourceWindowHandle,
  createDotaWindowLocator,
  parseDotaWindowQuery,
  queryDotaWindow,
} from "../src/desktop/dota-window-locator.js";

test("capture source ids expose only valid Windows window handles", () => {
  assert.equal(captureSourceWindowHandle("window:4321:0"), "4321");
  assert.equal(captureSourceWindowHandle("screen:0:0"), undefined);
  assert.equal(captureSourceWindowHandle("window:not-a-handle:0"), undefined);
});

test("Dota process query distinguishes missing and hidden game windows", () => {
  assert.deepEqual(parseDotaWindowQuery("not-running\r\n"), { status: "not-running" });
  assert.deepEqual(parseDotaWindowQuery("no-visible-window"), { status: "no-visible-window" });
  assert.deepEqual(parseDotaWindowQuery("4321"), { status: "ready", windowHandle: "4321" });
  assert.throws(() => parseDotaWindowQuery("Dota 2\n4321"), /窗口查询结果/);
});

test("Dota window locator binds only the capture source owned by dota2.exe", async () => {
  const locator = createDotaWindowLocator({ queryWindow: async () => ({ status: "ready", windowHandle: "4321" }) });
  const result = await locator.locate([
    { id: "window:99:0", name: "Fake Dota 2" },
    { id: "screen:0:0", name: "Screen 1" },
    { id: "window:4321:0", name: "Dota 2" },
  ]);
  assert.deepEqual(result, { status: "bound", sourceId: "window:4321:0", sourceName: "Dota 2" });
});

test("Dota window locator exposes expected operational states", async () => {
  const notRunning = createDotaWindowLocator({ queryWindow: async () => ({ status: "not-running" }) });
  assert.deepEqual(await notRunning.locate([]), { status: "not-running" });
  const hidden = createDotaWindowLocator({ queryWindow: async () => ({ status: "no-visible-window" }) });
  assert.deepEqual(await hidden.locate([]), { status: "no-visible-window" });
  const unavailable = createDotaWindowLocator({ queryWindow: async () => ({ status: "ready", windowHandle: "4321" }) });
  assert.deepEqual(await unavailable.locate([{ id: "screen:0:0", name: "Screen 1" }]), { status: "source-unavailable" });
});

test("Windows process query runs one fixed hidden PowerShell command", async () => {
  let invocation;
  const result = await queryDotaWindow({
    execute(file, args, options, callback) {
      invocation = { file, args, options };
      callback(null, "4321");
    },
  });
  assert.deepEqual(result, { status: "ready", windowHandle: "4321" });
  assert.equal(invocation.file, "powershell.exe");
  assert.deepEqual(invocation.args.slice(0, 5), ["-NoLogo", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden"]);
  assert.equal(invocation.options.windowsHide, true);
  assert.equal(invocation.options.timeout, 3_000);
});

test("Windows process query translates execution failures and rejects malformed output", async () => {
  await assert.rejects(queryDotaWindow({
    execute(_file, _args, _options, callback) { callback(new Error("blocked"), ""); },
  }), /无法读取 Windows/);
  await assert.rejects(queryDotaWindow({
    execute(_file, _args, _options, callback) { callback(null, "unexpected output"); },
  }), /窗口查询结果/);
});
