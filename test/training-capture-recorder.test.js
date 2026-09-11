import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createTrainingCaptureRecorder } from "../src/assistant/training-capture-recorder.js";

test("training recorder writes silent local frames from a verified Dota window only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dark-reef-capture-"));
  const calls = [];
  let scheduled;
  const thumbnail = {
    isEmpty: () => false,
    toJPEG: (quality) => {
      assert.equal(quality, 55);
      return Buffer.from("jpeg-frame");
    },
  };
  const recorder = createTrainingCaptureRecorder({
    directory,
    getSources: async (options) => {
      calls.push(options);
      return [{ id: "window:421:0", name: "Dota 2", thumbnail }];
    },
    locate: async () => ({ status: "bound", sourceId: "window:421:0", sourceName: "Dota 2" }),
    schedule: (callback) => {
      scheduled = callback;
      return 7;
    },
    cancel: () => {},
    now: () => Date.UTC(2026, 8, 11, 12, 0, 0),
  });

  try {
    const state = await recorder.start("window:421:0");
    assert.equal(state.running, true);
    assert.deepEqual(calls[0].types, ["window"]);
    assert.equal(calls[0].thumbnailSize.width, 960);
    assert.equal(typeof scheduled, "function");
    const session = (await readdir(directory))[0];
    const files = await readdir(join(directory, session));
    assert.ok(files.some((name) => name.endsWith(".jpg")));
    const manifest = JSON.parse(await readFile(join(directory, session, "session.json"), "utf8"));
    assert.equal(manifest.audio, false);
    assert.equal(manifest.sourceKind, "verified-dota-window");
  } finally {
    await recorder.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("training recorder refuses an unverified source before creating a session", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dark-reef-capture-"));
  const recorder = createTrainingCaptureRecorder({
    directory,
    getSources: async () => [{ id: "screen:0:0", name: "Entire screen", thumbnail: {} }],
    locate: async () => ({ status: "source-unavailable" }),
  });
  try {
    await assert.rejects(() => recorder.start("screen:0:0"), /Dota 2/);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("training recorder prunes completed sessions and reports queued capture errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dark-reef-capture-"));
  const oldSession = join(directory, "2026-09-10T00-00-00-000Z");
  await mkdir(oldSession);
  await writeFile(join(oldSession, "frame.jpg"), Buffer.alloc(16));

  let scheduled;
  let currentTime = Date.UTC(2026, 8, 11, 12, 0, 0);
  let sourceVisible = true;
  const thumbnail = {
    isEmpty: () => false,
    toJPEG: () => Buffer.from("jpeg-frame"),
  };
  const recorder = createTrainingCaptureRecorder({
    directory,
    getSources: async () => sourceVisible
      ? [{ id: "window:421:0", name: "Dota 2", thumbnail }]
      : [],
    locate: async () => ({ status: "bound", sourceId: "window:421:0", sourceName: "Dota 2" }),
    schedule: (callback) => {
      scheduled = callback;
      return 7;
    },
    cancel: () => {},
    now: () => currentTime,
    maximumBytes: 12,
  });

  try {
    await recorder.start("window:421:0");
    assert.equal((await readdir(directory)).includes("2026-09-10T00-00-00-000Z"), false);

    currentTime += 15_000;
    sourceVisible = false;
    scheduled();
    scheduled();
    await new Promise((resolve) => setImmediate(resolve));

    assert.match(recorder.getState().error, /当前不可见/);
  } finally {
    await recorder.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
