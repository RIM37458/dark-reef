import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAssistantCatalog } from "../src/assistant/catalog.js";
import { normalizeItemPopularitySnapshot } from "../src/assistant/item-popularity-library.js";

const API_ORIGIN = "https://api.opendota.com";
const directory = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.resolve(directory, "../assets/data/opendota-pro-items.json");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchPopularity(heroId) {
  const url = `${API_ORIGIN}/api/heroes/${heroId}/itemPopularity`;
  let lastError;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { headers: { accept: "application/json" } });
    } catch (error) {
      lastError = error;
    }
    if (response?.ok) return response.json();
    if (response && response.status !== 429 && response.status < 500) throw new Error(`${url} returned ${response.status}`);
    if (response) lastError = new Error(`${url} returned ${response.status}`);
    await wait(response?.status === 429 ? 30_000 : 2_000 * (attempt + 1));
  }
  throw new Error(`${url} did not recover after retries`, { cause: lastError });
}

const heroes = createAssistantCatalog().heroes;
const rows = [];
for (let offset = 0; offset < heroes.length; offset += 2) {
  const batch = heroes.slice(offset, offset + 2);
  const results = await Promise.all(batch.map(async (hero) => ({ hero, data: await fetchPopularity(hero.id) })));
  for (const { hero, data } of results) {
    for (const [rawPeriod, counts] of Object.entries(data)) {
      const period = rawPeriod.replace(/_items$/, "");
      for (const [itemId, purchases] of Object.entries(counts)) rows.push([hero.id, period, Number(itemId), purchases]);
    }
  }
  process.stdout.write(`\rOpenDota items ${Math.min(offset + batch.length, heroes.length)}/${heroes.length}`);
  if (offset + batch.length < heroes.length) await wait(1_500);
}

rows.sort((left, right) => left[0] - right[0] || left[1].localeCompare(right[1]) || left[2] - right[2]);
const snapshot = normalizeItemPopularitySnapshot({
  schemaVersion: 1,
  provider: "OpenDota",
  scope: "professional_matches",
  sourceUrl: `${API_ORIGIN}/api/heroes/{hero_id}/itemPopularity`,
  fetchedAt: new Date().toISOString(),
  minimumPurchases: 5,
  rows,
});
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(snapshot)}\n`, "utf8");
process.stdout.write(`\nWrote ${rows.length} item observations to ${outputFile}\n`);
