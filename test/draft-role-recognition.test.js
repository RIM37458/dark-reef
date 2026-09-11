import test from "node:test";
import assert from "node:assert/strict";

import { createDraftRoleReader, parseAssignedPositionText } from "../src/assistant/draft-role-recognition.js";

test("assigned role text maps Chinese and English Ranked Roles labels to positions", () => {
  assert.equal(parseAssignedPositionText("你的职责：优势路"), 1);
  assert.equal(parseAssignedPositionText("MID LANE"), 2);
  assert.equal(parseAssignedPositionText("劣势路"), 3);
  assert.equal(parseAssignedPositionText("Soft Support"), 4);
  assert.equal(parseAssignedPositionText("纯辅助"), 5);
  assert.equal(parseAssignedPositionText("Hard Support"), 5);
  assert.equal(parseAssignedPositionText("倒计时 45 秒"), undefined);
  assert.equal(parseAssignedPositionText("英雄筛选"), undefined);
});

test("draft role reader crops only the local player card band and returns marker evidence", async () => {
  const calls = [];
  const worker = {
    setParameters: async (parameters) => calls.push(["parameters", parameters]),
    recognize: async (image) => {
      calls.push(["recognize", image]);
      return { data: { text: "你的职责 纯辅助", confidence: 88 } };
    },
    terminate: async () => calls.push(["terminate"]),
  };
  const image = {
    getSize: () => ({ width: 1920, height: 1080 }),
    crop: (rect) => {
      calls.push(["crop", rect]);
      return { resize: () => ({ toPNG: () => Buffer.from("role") }) };
    },
  };
  const reader = createDraftRoleReader({
    cachePath: "C:/cache",
    createOcrWorker: async () => worker,
    languageData: { code: "chi_sim", langPath: "C:/lang" },
  });
  const result = await reader.read(image, { x: 0.3, y: 0.002, width: 0.04, height: 0.058 });
  assert.deepEqual(result, { value: 5, confidence: 0.88, source: "ranked-roles-marker" });
  assert.deepEqual(calls.find(([name]) => name === "crop")[1], {
    x: 557,
    y: 0,
    width: 154,
    height: 151,
  });
  await reader.close();
  assert.equal(calls.at(-1)[0], "terminate");
});

test("draft role reader rejects weak OCR results", async () => {
  const worker = {
    setParameters: async () => {},
    recognize: async () => ({ data: { text: "辅助", confidence: 39 } }),
    terminate: async () => {},
  };
  const image = {
    getSize: () => ({ width: 1280, height: 720 }),
    crop: () => ({ resize: () => ({ toPNG: () => Buffer.from("role") }) }),
  };
  const reader = createDraftRoleReader({
    cachePath: "C:/cache",
    createOcrWorker: async () => worker,
    languageData: { code: "chi_sim", langPath: "C:/lang" },
  });
  assert.equal(await reader.read(image, { x: 0.3, y: 0, width: 0.04, height: 0.06 }), undefined);
});
