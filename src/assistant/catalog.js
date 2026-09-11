import dotaConstants from "dotaconstants";

const CDN_ORIGIN = "https://cdn.cloudflare.steamstatic.com";

function assetUrl(value) {
  if (typeof value !== "string" || !value.startsWith("/apps/dota2/")) return undefined;
  return `${CDN_ORIGIN}${value.replace(/\?$/, "")}`;
}

function cooldowns(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map(Number).filter((entry) => Number.isFinite(entry) && entry > 0);
}

function heroAbilities(heroKey) {
  const keys = (dotaConstants.hero_abilities[heroKey]?.abilities ?? []).flat(Infinity);
  return keys.flatMap((key) => {
    if (typeof key !== "string" || key.startsWith("special_bonus")) return [];
    const ability = dotaConstants.abilities[key];
    const values = cooldowns(ability?.cd);
    if (!ability?.dname || values.length === 0) return [];
    return [Object.freeze({
      key,
      name: String(ability.dname),
      cooldowns: Object.freeze(values),
      imageUrl: assetUrl(ability.img),
    })];
  });
}

function itemAbilities(value) {
  return (Array.isArray(value) ? value : []).flatMap((ability) => {
    if (!ability?.title || !ability?.description) return [];
    return [Object.freeze({
      name: String(ability.title).slice(0, 100),
      type: String(ability.type ?? "passive").slice(0, 40),
      description: String(ability.description).slice(0, 1_000),
    })];
  });
}

function itemCatalog() {
  return Object.entries(dotaConstants.items).flatMap(([key, item]) => {
    if (!item?.id || !item?.dname || !item?.img || key.startsWith("recipe_") || item.tier || !(item.cost > 0)) return [];
    return [Object.freeze({
      id: item.id,
      key,
      name: String(item.dname),
      imageUrl: assetUrl(item.img),
      cost: Number(item.cost),
      quality: String(item.qual ?? "standard"),
      components: Object.freeze(Array.isArray(item.components) ? item.components.map(String) : []),
      abilities: Object.freeze(itemAbilities(item.abilities)),
    })];
  }).sort((left, right) => left.cost - right.cost || left.name.localeCompare(right.name, "en"));
}

export function createAssistantCatalog() {
  const latestPatch = dotaConstants.patch.at(-1)?.name ?? "unknown";
  const heroes = Object.values(dotaConstants.heroes)
    .filter((hero) => hero?.id && hero?.localized_name && !hero.name.includes("placeholder"))
    .map((hero) => Object.freeze({
      id: hero.id,
      key: hero.name,
      name: hero.localized_name,
      primaryAttribute: hero.primary_attr,
      roles: Object.freeze(Array.isArray(hero.roles) ? hero.roles.map(String) : []),
      imageUrl: assetUrl(hero.img),
      iconUrl: assetUrl(hero.icon),
      abilities: Object.freeze(heroAbilities(hero.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "en"));
  return Object.freeze({
    schemaVersion: 1,
    patch: String(latestPatch),
    source: "dotaconstants",
    heroes: Object.freeze(heroes),
    items: Object.freeze(itemCatalog()),
  });
}
