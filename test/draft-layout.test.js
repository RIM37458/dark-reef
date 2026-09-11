import test from "node:test";
import assert from "node:assert/strict";

import { createAssistantCatalog } from "../src/assistant/catalog.js";
import {
  adjustDraftCalibration,
  createDraftGrid,
  DEFAULT_DRAFT_COLUMNS,
  DEFAULT_DRAFT_LAYOUT_VERSION,
  draftCellRects,
  draftTopSlotRects,
  normalizeDraftCalibration,
} from "../src/assistant/draft-layout.js";

test("draft grid keeps the versioned default positions and appends future heroes safely", () => {
  const grid = createDraftGrid([
    { id: 4, name: "Bloodseeker", primaryAttribute: "agi" },
    { id: 73, name: "Alchemist", primaryAttribute: "str" },
    { id: 2, name: "Axe", primaryAttribute: "str" },
    { id: 102, name: "Abaddon", primaryAttribute: "all" },
    { id: 68, name: "Ancient Apparition", primaryAttribute: "int" },
    { id: 999, name: "Future Hero", primaryAttribute: "all" },
  ]);
  assert.deepEqual(grid.map(({ id }) => id), ["str", "agi", "int", "all"]);
  assert.equal(DEFAULT_DRAFT_COLUMNS, 4);
  assert.equal(DEFAULT_DRAFT_LAYOUT_VERSION, "7.41");
  assert.deepEqual(grid[0].heroIds, [73, 2]);
  assert.deepEqual(grid[3].heroIds, [102, 999]);
  assert.deepEqual(grid[0].cells, [
    { heroId: 73, row: 1, column: 1 },
    { heroId: 2, row: 1, column: 2 },
  ]);
});

test("top bar layout exposes five ordered slots for each side", () => {
  const slots = draftTopSlotRects();
  assert.equal(slots.length, 10);
  assert.deepEqual(slots.map(({ index, side, teamIndex }) => ({ index, side, teamIndex })), [
    { index: 0, side: "radiant", teamIndex: 0 },
    { index: 1, side: "radiant", teamIndex: 1 },
    { index: 2, side: "radiant", teamIndex: 2 },
    { index: 3, side: "radiant", teamIndex: 3 },
    { index: 4, side: "radiant", teamIndex: 4 },
    { index: 5, side: "dire", teamIndex: 0 },
    { index: 6, side: "dire", teamIndex: 1 },
    { index: 7, side: "dire", teamIndex: 2 },
    { index: 8, side: "dire", teamIndex: 3 },
    { index: 9, side: "dire", teamIndex: 4 },
  ]);
  assert.ok(slots.every(({ x, y, width, height }) => x >= 0 && y >= 0 && x + width <= 1 && y + height <= 1));
  assert.ok(slots[4].x + slots[4].width < slots[5].x);
});

test("7.41 default manifest fixes every current hero to one auditable cell", () => {
  const catalog = createAssistantCatalog();
  const grid = createDraftGrid(catalog.heroes);
  const cells = grid.flatMap((group) => group.cells.map((cell) => ({ group: group.id, ...cell })));
  assert.equal(cells.length, 127);
  assert.equal(new Set(cells.map(({ heroId }) => heroId)).size, 127);
  assert.deepEqual(cells.find(({ heroId }) => heroId === 155), { group: "str", heroId: 155, row: 4, column: 3 });
  assert.deepEqual(cells.find(({ heroId }) => heroId === 145), { group: "agi", heroId: 145, row: 3, column: 4 });
  assert.deepEqual(cells.find(({ heroId }) => heroId === 131), { group: "int", heroId: 131, row: 6, column: 3 });
  assert.deepEqual(cells.find(({ heroId }) => heroId === 102), { group: "all", heroId: 102, row: 1, column: 1 });
  assert.deepEqual(grid.map(({ heroIds }) => heroIds.length), [36, 35, 34, 22]);
});

test("draft calibration clamps overlay geometry to safe normalized bounds", () => {
  assert.deepEqual(normalizeDraftCalibration({ x: -1, y: 0.95, width: 2, height: 0.01 }), {
    x: 0,
    y: 0.8,
    width: 1,
    height: 0.2,
    opacity: 0.72,
  });
});

test("draft cell rectangles follow four vertical attribute columns", () => {
  const cells = draftCellRects([
    { id: "str", heroIds: [1, 2, 3] },
    { id: "agi", heroIds: [4] },
    { id: "int", heroIds: [5] },
    { id: "all", heroIds: [6] },
  ], { x: 0.1, y: 0.2, width: 0.8, height: 0.6, opacity: 0.5 });
  assert.equal(cells.length, 6);
  assert.ok(cells.every((cell) => cell.x >= 0.1 && cell.y >= 0.2));
  assert.ok(cells.every((cell) => cell.x + cell.width <= 0.91 && cell.y + cell.height <= 0.81));
  assert.ok(cells.find(({ heroId }) => heroId === 4).x >= 0.3);
  assert.ok(cells.find(({ heroId }) => heroId === 5).x >= 0.5);
  assert.ok(cells.find(({ heroId }) => heroId === 6).x >= 0.7);
  assert.ok(cells.every((cell) => cell.y < 0.5));
});

test("draft calibration adjustments are bounded renderer commands", () => {
  assert.ok(Math.abs(adjustDraftCalibration({ x: 0.1, y: 0.2, width: 0.8, height: 0.6 }, { dx: 0.005 }).x - 0.105) < 1e-12);
  assert.throws(() => adjustDraftCalibration({}, { dx: 1 }), /微调/);
  assert.throws(() => adjustDraftCalibration({}, []), /微调/);
});
