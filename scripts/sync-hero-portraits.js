import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createAssistantCatalog } from "../src/assistant/catalog.js";

const outputDirectory = path.resolve("assets", "hero-portraits");
const catalog = createAssistantCatalog();
await mkdir(outputDirectory, { recursive: true });

const entries = [];
for (const hero of catalog.heroes) {
  if (!hero.imageUrl) throw new RangeError(`英雄 ${hero.id} 缺少肖像来源`);
  const response = await fetch(hero.imageUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`英雄 ${hero.id} 肖像下载失败：HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new TypeError(`英雄 ${hero.id} 肖像不是图片`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000 || bytes.length > 1_000_000) throw new RangeError(`英雄 ${hero.id} 肖像尺寸异常`);
  const filename = `${hero.id}.png`;
  await writeFile(path.join(outputDirectory, filename), bytes, { flag: "w" });
  entries.push(Object.freeze({ heroId: hero.id, filename, source: hero.imageUrl, bytes: bytes.length }));
}

await writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify({
  schemaVersion: 1,
  catalogPatch: catalog.patch,
  fetchedAt: new Date().toISOString(),
  entries,
}, null, 2)}\n`, { flag: "w" });
