import path from "node:path";

import { visualSignature } from "./draft-vision.js";

const SOURCE_PREFIX = "https://cdn.cloudflare.steamstatic.com/apps/dota2/";

function validatedEntries(manifest) {
  if (manifest?.schemaVersion !== 1 || typeof manifest.catalogPatch !== "string" || !Array.isArray(manifest.entries)) {
    throw new TypeError("英雄肖像清单无效");
  }
  const ids = new Set();
  return manifest.entries.map((entry) => {
    const heroId = Number(entry?.heroId);
    if (!Number.isInteger(heroId) || heroId < 1 || entry.filename !== `${heroId}.png` || !entry.source?.startsWith(SOURCE_PREFIX)) {
      throw new TypeError("英雄肖像清单包含不安全条目");
    }
    if (ids.has(heroId)) throw new RangeError("英雄肖像清单包含重复编号");
    ids.add(heroId);
    return Object.freeze({ heroId, filename: entry.filename });
  });
}

export function withBundledHeroPortraits(catalog, manifest, urlPrefix) {
  if (!catalog || !Array.isArray(catalog.heroes) || !/^(?:\.\.\/)+assets\/hero-portraits$/u.test(urlPrefix)) {
    throw new TypeError("本地英雄肖像目录无效");
  }
  const filenames = new Map(validatedEntries(manifest).map((entry) => [entry.heroId, entry.filename]));
  return Object.freeze({
    ...catalog,
    heroes: Object.freeze(catalog.heroes.map((hero) => Object.freeze({
      ...hero,
      imageUrl: filenames.has(hero.id) ? `${urlPrefix}/${filenames.get(hero.id)}` : hero.imageUrl,
    }))),
  });
}

export async function createHeroReferenceLibrary({ directory, manifest, loadImage }) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || typeof loadImage !== "function") {
    throw new TypeError("英雄肖像库配置无效");
  }
  const references = [];
  for (const entry of validatedEntries(manifest)) {
    const { heroId } = entry;
    const frame = await loadImage(path.join(directory, entry.filename));
    references.push(Object.freeze({
      heroId,
      signature: visualSignature(frame, { x: 0, y: 0, width: 1, height: 1 }),
    }));
  }
  return Object.freeze({ patch: manifest.catalogPatch, references: Object.freeze(references) });
}
