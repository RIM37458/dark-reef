import test from "node:test";
import assert from "node:assert/strict";

import { createAssistantCatalog } from "../src/assistant/catalog.js";

test("assistant catalog exposes versioned sanitized hero abilities", () => {
  const catalog = createAssistantCatalog();
  assert.match(catalog.patch, /^\d+\.\d+/);
  assert.ok(catalog.heroes.length > 120);
  const slark = catalog.heroes.find((hero) => hero.key === "npc_dota_hero_slark");
  assert.equal(slark.name, "Slark");
  assert.match(slark.imageUrl, /^https:\/\/cdn\.cloudflare\.steamstatic\.com\//);
  const darkPact = slark.abilities.find((ability) => ability.key === "slark_dark_pact");
  assert.deepEqual(darkPact.cooldowns, [9, 8, 7, 6]);
  assert.equal(darkPact.name, "Dark Pact");
  assert.equal(Object.hasOwn(darkPact, "desc"), false);
});

test("assistant catalog excludes talents and abilities without cooldowns", () => {
  const catalog = createAssistantCatalog();
  for (const hero of catalog.heroes) {
    for (const ability of hero.abilities) {
      assert.equal(ability.key.startsWith("special_bonus"), false);
      assert.ok(ability.cooldowns.length > 0);
      assert.ok(ability.cooldowns.every((value) => Number.isFinite(value) && value > 0));
    }
  }
});

test("assistant catalog exposes sanitized purchasable item facts", () => {
  const catalog = createAssistantCatalog();
  assert.ok(catalog.items.length > 150);
  const bkb = catalog.items.find((item) => item.key === "black_king_bar");
  assert.deepEqual({ id: bkb.id, name: bkb.name, cost: bkb.cost }, { id: 116, name: "Black King Bar", cost: 4050 });
  assert.match(bkb.imageUrl, /^https:\/\/cdn\.cloudflare\.steamstatic\.com\//);
  assert.ok(bkb.abilities.some(({ name }) => name === "Avatar"));
  assert.equal(Object.hasOwn(bkb, "lore"), false);
  assert.equal(catalog.items.some(({ key }) => key.startsWith("recipe_")), false);
});
