import test from "node:test";
import assert from "node:assert/strict";

import {
  createHeroReferenceLibrary,
  withBundledHeroPortraits,
} from "../src/assistant/hero-reference-library.js";

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

test("desktop catalog uses bundled hero portraits instead of remote image requests", () => {
  const catalog = {
    heroes: [
      { id: 1, name: "Anti-Mage", imageUrl: "https://cdn.example/antimage.png" },
      { id: 2, name: "Axe", imageUrl: "https://cdn.example/axe.png" },
    ],
  };
  const manifest = {
    schemaVersion: 1,
    catalogPatch: "7.41",
    entries: [{
      heroId: 1,
      filename: "1.png",
      source: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/antimage.png",
    }],
  };

  const local = withBundledHeroPortraits(catalog, manifest, "../../assets/hero-portraits");

  assert.equal(local.heroes[0].imageUrl, "../../assets/hero-portraits/1.png");
  assert.equal(local.heroes[1].imageUrl, "https://cdn.example/axe.png");
  assert.equal(catalog.heroes[0].imageUrl, "https://cdn.example/antimage.png");
});
