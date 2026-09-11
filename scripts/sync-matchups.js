import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAssistantCatalog } from "../src/assistant/catalog.js";
import { normalizeMatchupSnapshot } from "../src/assistant/matchup-library.js";

const API_ORIGIN = "https://api.opendota.com";
const directory = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.resolve(directory, "../assets/data/opendota-pro-matchups.json");
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchRows(heroId) {
  const url = `${API_ORIGIN}/api/heroes/${heroId}/matchups`;
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
const validHeroIds = new Set(heroes.map(({ id }) => id));
const rows = [];
const batchSize = 2;
for (let offset = 0; offset < heroes.length; offset += batchSize) {
  const batch = heroes.slice(offset, offset + batchSize);
  const results = await Promise.all(batch.map(async (hero) => ({ hero, matchups: await fetchRows(hero.id) })));
  for (const { hero, matchups } of results) {
    for (const matchup of matchups) {
      if (!validHeroIds.has(matchup.hero_id)) continue;
      rows.push([hero.id, matchup.hero_id, matchup.games_played, matchup.wins]);
    }
  }
  process.stdout.write(`\rOpenDota ${Math.min(offset + batch.length, heroes.length)}/${heroes.length}`);
  if (offset + batch.length < heroes.length) await wait(1_500);
}

rows.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
const baselinesByHero = new Map();
for (const hero of heroes) {
  const heroRows = rows.filter((row) => row[0] === hero.id);
  baselinesByHero.set(hero.id, [
    hero.id,
    heroRows.reduce((sum, row) => sum + row[2], 0),
    heroRows.reduce((sum, row) => sum + row[3], 0),
  ]);
}
const snapshot = normalizeMatchupSnapshot({
  schemaVersion: 1,
  provider: "OpenDota",
  scope: "professional_matches",
  sourceUrl: `${API_ORIGIN}/api/heroes/{hero_id}/matchups`,
  fetchedAt: new Date().toISOString(),
  minimumSample: 40,
  baselines: [...baselinesByHero.values()],
  rows,
});
await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(snapshot)}\n`, "utf8");
process.stdout.write(`\nWrote ${rows.length} directed matchup rows to ${outputFile}\n`);
