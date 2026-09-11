import test from "node:test";
import assert from "node:assert/strict";

import { createScreenClockReader } from "../src/assistant/screen-clock-reader.js";

test("screen clock reader requires an explicit application-data cache", () => {
  assert.throws(
    () => createScreenClockReader({ getSources: async () => [] }),
    /cache path/,
  );
});

test("screen clock reader lists sources, crops the HUD, and reuses one OCR worker", async () => {
  let cropBounds;
  let parameters;
  let workerCreations = 0;
  let terminations = 0;
  const resized = { toPNG: () => Buffer.from("clock") };
  const thumbnail = {
    isEmpty: () => false,
    getSize: () => ({ width: 1_000, height: 500 }),
    crop(bounds) {
      cropBounds = bounds;
      return {
        resize(options) {
          assert.deepEqual(options, { width: 900, quality: "best" });
          return resized;
        },
      };
    },
  };
  const sources = [{ id: "window:1", name: "Dota 2".padEnd(180, "x"), thumbnail }];
  const reader = createScreenClockReader({
    getSources: async (options) => {
      assert.deepEqual(options.types, ["window", "screen"]);
      return sources;
    },
    cachePath: "C:\\AppData\\DarkReef\\ocr-cache",
    languageData: { code: "eng", langPath: "C:\\models" },
    pageSegMode: 7,
    createOcrWorker: async (code, count, options) => {
      workerCreations += 1;
      assert.equal(code, "eng");
      assert.equal(count, 1);
      assert.equal(options.cachePath, "C:\\AppData\\DarkReef\\ocr-cache");
      return {
        async setParameters(value) { parameters = value; },
        async recognize(image) {
          assert.equal(image.toString(), "clock");
          return { data: { text: "12:34", confidence: 91.4 } };
        },
        async terminate() { terminations += 1; },
      };
    },
  });

  assert.deepEqual(await reader.listSources(), [{ id: "window:1", name: sources[0].name.slice(0, 160) }]);
  assert.deepEqual(await reader.read("window:1"), { gameTime: 754, confidence: 91 });
  assert.deepEqual(await reader.read("window:1"), { gameTime: 754, confidence: 91 });
  assert.deepEqual(cropBounds, { x: 420, y: 0, width: 160, height: 55 });
  assert.equal(parameters.tessedit_pageseg_mode, 7);
  assert.equal(workerCreations, 1);
  await reader.close();
  await reader.close();
  assert.equal(terminations, 1);
});

test("screen clock reader refuses missing and empty capture sources", async () => {
  const missing = createScreenClockReader({
    getSources: async () => [],
    cachePath: "cache",
  });
  await assert.rejects(missing.read("missing"), /不可用/);
  const empty = createScreenClockReader({
    getSources: async () => [{ id: "empty", name: "Empty", thumbnail: { isEmpty: () => true } }],
    cachePath: "cache",
  });
  await assert.rejects(empty.read("empty"), /不可用/);
});
