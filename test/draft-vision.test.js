import test from "node:test";
import assert from "node:assert/strict";

import { classifyVisualRect, compareDraftCells, detectDraftGridPhase, findLocalPlayerSlot, learnDraftLayout, visualSignature } from "../src/assistant/draft-vision.js";

function solid(width, height, blue, green, red) {
  return { width, height, data: Buffer.from(Array.from({ length: width * height }, () => [blue, green, red, 255]).flat()) };
}

function split(left, right) {
  const frame = solid(16, 4, ...left);
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = frame.width / 2; x < frame.width; x += 1) {
      const offset = (y * frame.width + x) * 4;
      frame.data.set([...right, 255], offset);
    }
  }
  return frame;
}

test("draft vision reports only cells whose appearance changed substantially", () => {
  const baseline = solid(4, 2, 100, 120, 140);
  const current = solid(4, 2, 100, 120, 140);
  for (const pixel of [2, 3, 6, 7]) {
    const offset = pixel * 4;
    current.data[offset] = 10;
    current.data[offset + 1] = 10;
    current.data[offset + 2] = 10;
  }
  assert.deepEqual(compareDraftCells({
    baseline,
    current,
    cells: [
      { heroId: 1, x: 0, y: 0, width: 0.5, height: 1 },
      { heroId: 2, x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
    threshold: 30,
  }), [{ heroId: 2, difference: 110 }]);
});

test("draft vision rejects mismatched frames", () => {
  assert.throws(() => compareDraftCells({
    baseline: solid(2, 2, 0, 0, 0),
    current: solid(3, 2, 0, 0, 0),
    cells: [],
  }), /尺寸/);
  assert.throws(() => compareDraftCells({ baseline: null, current: null, cells: [] }), /格式/);
  assert.throws(() => compareDraftCells({
    baseline: { width: 2, height: 2, data: Buffer.alloc(1) },
    current: solid(2, 2, 0, 0, 0),
    cells: [],
  }), /像素尺寸/);
});

test("portrait classification requires a unique close reference", () => {
  const dark = solid(8, 4, 20, 30, 40);
  const bright = solid(8, 4, 180, 190, 200);
  for (let x = 0; x < 4; x += 1) bright.data[x * 4] = 20;
  const rect = { x: 0, y: 0, width: 1, height: 1 };
  const references = [
    { heroId: 1, signature: visualSignature(dark, rect) },
    { heroId: 2, signature: visualSignature(bright, rect) },
  ];
  assert.deepEqual(classifyVisualRect(bright, rect, references, { maximumDistance: 0.05, minimumMargin: 0.1 }), {
    status: "recognized",
    heroId: 2,
    confidence: 1,
  });
  assert.equal(classifyVisualRect(solid(8, 4, 100, 100, 100), rect, references, {
    maximumDistance: 0.01,
    minimumMargin: 0.1,
  }).status, "uncertain");
});

test("draft layout learns the hero currently visible in each calibrated rectangle", () => {
  const left = [20, 30, 40];
  const right = [180, 190, 200];
  const frame = split(left, right);
  const cells = [
    { heroId: 1, x: 0, y: 0, width: 0.5, height: 1 },
    { heroId: 2, x: 0.5, y: 0, width: 0.5, height: 1 },
  ];
  const references = [
    { heroId: 1, signature: visualSignature(solid(8, 4, ...right), { x: 0, y: 0, width: 1, height: 1 }) },
    { heroId: 2, signature: visualSignature(solid(8, 4, ...left), { x: 0, y: 0, width: 1, height: 1 }) },
  ];

  assert.deepEqual(learnDraftLayout(frame, cells, references, { minimumRatio: 1 }), {
    status: "learned",
    recognizedCount: 2,
    candidateCount: 2,
    coverage: 1,
    cells: [
      { heroId: 2, x: 0, y: 0, width: 0.5, height: 1, confidence: 1 },
      { heroId: 1, x: 0.5, y: 0, width: 0.5, height: 1, confidence: 1 },
    ],
  });
});

test("draft layout stays unsupported when calibrated rectangles cannot be identified", () => {
  const rect = { heroId: 1, x: 0, y: 0, width: 1, height: 1 };
  const references = [{ heroId: 1, signature: visualSignature(solid(8, 4, 240, 240, 240), rect) }];

  assert.deepEqual(learnDraftLayout(solid(8, 4, 10, 10, 10), [rect], references, {
    maximumDistance: 0.05,
    minimumRatio: 1,
  }), {
    status: "unsupported",
    recognizedCount: 0,
    candidateCount: 1,
    coverage: 0,
    cells: [],
  });
});

test("local slot detection requires a unique gold border", () => {
  const frame = solid(20, 4, 10, 10, 10);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 10; x < 20; x += 1) {
      if (x === 10 || x === 19 || y === 0 || y === 3) {
        const offset = (y * 20 + x) * 4;
        frame.data[offset] = 30;
        frame.data[offset + 1] = 155;
        frame.data[offset + 2] = 210;
      }
    }
  }
  assert.deepEqual(findLocalPlayerSlot(frame, [
    { index: 0, x: 0, y: 0, width: 0.5, height: 1 },
    { index: 1, x: 0.5, y: 0, width: 0.5, height: 1 },
  ]), { index: 1, confidence: 1 });
});

test("draft grid phase requires enough expected hero portraits", () => {
  const portrait = solid(8, 4, 120, 150, 180);
  const cells = [{ heroId: 7, x: 0, y: 0, width: 1, height: 1 }];
  const references = [{ heroId: 7, signature: visualSignature(portrait, cells[0]) }];
  assert.equal(detectDraftGridPhase(portrait, cells, references), "grid-visible");
  assert.equal(detectDraftGridPhase(solid(8, 4, 5, 5, 5), cells, references), "strategy");
});
