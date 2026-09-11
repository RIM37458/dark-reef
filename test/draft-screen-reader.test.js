import test from "node:test";
import assert from "node:assert/strict";

import { createDraftScreenReader } from "../src/assistant/draft-screen-reader.js";
import { visualSignature } from "../src/assistant/draft-vision.js";

function thumbnail(value) {
  const data = Buffer.from([value, value, value, 255, value, value, value, 255]);
  return {
    isEmpty: () => false,
    getSize: () => ({ width: 2, height: 1 }),
    getBitmap: () => data,
  };
}

test("draft screen reader calibrates and compares only an explicitly selected source", async () => {
  let frame = thumbnail(100);
  const reader = createDraftScreenReader({
    getSources: async (options) => {
      assert.deepEqual(options, {
        types: ["window", "screen"],
        thumbnailSize: { width: 1280, height: 720 },
        fetchWindowIcons: false,
      });
      return [{ id: "window:dota", name: "Dota 2", display_id: "7", thumbnail: frame }];
    },
  });
  const cells = [{ heroId: 1, x: 0, y: 0, width: 1, height: 1 }];
  assert.deepEqual(await reader.calibrate("window:dota", cells), { width: 2, height: 1, cellCount: 1 });
  frame = thumbnail(10);
  assert.deepEqual(await reader.scan("window:dota", cells), {
    unavailableHeroIds: [1],
    changes: [{ heroId: 1, difference: 90 }],
  });
});

test("draft screen reader requires baseline and a live source", async () => {
  const reader = createDraftScreenReader({ getSources: async () => [] });
  await assert.rejects(reader.scan("missing", []), /校准/);
  await assert.rejects(reader.calibrate("missing", []), /不可用/);
});

test("draft observer combines ten-slot recognition, local side, and changed grid cells", async () => {
  const width = 20;
  const height = 4;
  const pixels = Buffer.alloc(width * height * 4, 20);
  for (let y = 0; y < height; y += 1) {
    for (let x = 10; x < 20; x += 1) {
      const offset = (y * width + x) * 4;
      pixels[offset] = 30;
      pixels[offset + 1] = 155;
      pixels[offset + 2] = 210;
      pixels[offset + 3] = 255;
    }
  }
  const frame = { width, height, data: pixels };
  const sourceThumbnail = {
    isEmpty: () => false,
    getSize: () => ({ width, height }),
    getBitmap: () => pixels,
  };
  const slotRects = Array.from({ length: 10 }, (_, index) => ({
    index,
    x: index < 2 ? index * 0.5 : 0,
    y: 0,
    width: index < 2 ? 0.5 : 0,
    height: 1,
  }));
  const references = [
    { heroId: 1, signature: visualSignature(frame, slotRects[0]) },
    { heroId: 2, signature: visualSignature(frame, slotRects[1]) },
  ];
  const reader = createDraftScreenReader({
    getSources: async () => [{ id: "window:dota", thumbnail: sourceThumbnail }],
    heroReferences: references,
    confirmationFrames: 2,
    roleReader: {
      read: async (_thumbnail, rect) => rect.index === 1
        ? { value: 2, confidence: 0.91, source: "ranked-roles-marker" }
        : undefined,
    },
  });
  const options = { cells: [], slotRects, phase: "strategy", mode: "ranked-roles" };
  assert.equal((await reader.observe("window:dota", options)).slots[1].status, "uncertain");
  const observed = await reader.observe("window:dota", options);
  assert.equal(observed.slots[0].heroId, 1);
  assert.equal(observed.slots[1].heroId, 2);
  assert.equal(observed.localSlotIndex, 1);
  assert.equal(observed.localSide, "radiant");
  assert.equal(observed.assignedPosition.value, 2);
  assert.equal(observed.assignedPosition.certainty, "confirmed");
});
