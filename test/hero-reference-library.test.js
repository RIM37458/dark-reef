import test from "node:test";
import assert from "node:assert/strict";

import { createHeroReferenceLibrary } from "../src/assistant/hero-reference-library.js";

function imageFrame(value) {
  return { width: 8, height: 4, data: Buffer.alloc(8 * 4 * 4, value) };
}

test("hero reference library validates manifest and produces immutable signatures", async () => {
  const library = await createHeroReferenceLibrary({
    directory: "C:\\portraits",
    manifest: {
      schemaVersion: 1,
      catalogPatch: "7.41",
      entries: [{ heroId: 1, filename: "1.png", source: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png" }],
    },
    loadImage: async (file) => {
      assert.equal(file, "C:\\portraits\\1.png");
      return imageFrame(80);
    },
  });
  assert.equal(library.patch, "7.41");
  assert.equal(library.references.length, 1);
  assert.equal(library.references[0].heroId, 1);
  assert.equal(library.references[0].signature.length, 96);
});

test("hero reference library rejects duplicate ids and unsafe files", async () => {
  const base = { schemaVersion: 1, catalogPatch: "7.41" };
  await assert.rejects(createHeroReferenceLibrary({
    directory: "C:\\portraits",
    manifest: { ...base, entries: [{ heroId: 1, filename: "../1.png", source: "https://cdn.cloudflare.steamstatic.com/apps/dota2/a.jpg" }] },
    loadImage: async () => imageFrame(0),
  }), /清单/);
  await assert.rejects(createHeroReferenceLibrary({
    directory: "C:\\portraits",
    manifest: { ...base, entries: [
      { heroId: 1, filename: "1.png", source: "https://cdn.cloudflare.steamstatic.com/apps/dota2/a.jpg" },
      { heroId: 1, filename: "1.png", source: "https://cdn.cloudflare.steamstatic.com/apps/dota2/a.jpg" },
    ] },
    loadImage: async () => imageFrame(0),
  }), /重复/);
});
