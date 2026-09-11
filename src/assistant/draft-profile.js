import { BUILTIN_DRAFT_CATEGORIES } from "./draft-recommendation.js";

export const DRAFT_PROFILE_SCHEMA_VERSION = 2;
const RESERVED_IDS = new Set(BUILTIN_DRAFT_CATEGORIES.map(({ id }) => id));

function heroId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 1_000_000) throw new TypeError("英雄编号无效");
  return id;
}

function boundedText(value, field, maximum) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maximum) throw new TypeError(`${field}过长`);
  return text;
}

function relationships(value) {
  if (!Array.isArray(value) || value.length > 1_000) throw new TypeError("克制关系格式无效");
  return value.map((entry) => {
    if (!Number.isInteger(entry?.score) || entry.score < -3 || entry.score > 3 || entry.score === 0) {
      throw new TypeError("克制强度须为 -3 至 3 且不能为 0");
    }
    return Object.freeze({
      heroId: heroId(entry.heroId),
      againstHeroId: heroId(entry.againstHeroId),
      score: entry.score,
      note: boundedText(entry.note, "克制说明", 160),
      source: "personal",
    });
  });
}

function itemPlans(value) {
  if (!Array.isArray(value) || value.length > 1_000) throw new TypeError("出装方案格式无效");
  return value.map((entry) => {
    if (!Number.isInteger(entry?.priority) || entry.priority < 1 || entry.priority > 5) {
      throw new TypeError("装备优先级须为 1–5");
    }
    const against = entry.againstHeroIds ?? [];
    if (!Array.isArray(against) || against.length > 20) throw new TypeError("装备针对英雄列表无效");
    return Object.freeze({
      heroId: heroId(entry.heroId),
      itemId: heroId(entry.itemId),
      priority: entry.priority,
      situation: boundedText(entry.situation, "装备情境", 160),
      againstHeroIds: Object.freeze([...new Set(against.map(heroId))]),
      source: "personal",
    });
  });
}

export function normalizeDraftProfile(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("英雄池格式无效");
  if (input.schemaVersion !== undefined && ![1, DRAFT_PROFILE_SCHEMA_VERSION].includes(input.schemaVersion)) {
    throw new TypeError("英雄池版本不兼容");
  }
  const sourceCategories = input.categories ?? [];
  if (!Array.isArray(sourceCategories) || sourceCategories.length > 24) throw new TypeError("自定义分类不能超过 24 个");
  const ids = new Set();
  const categories = sourceCategories.map((category) => {
    const id = String(category?.id ?? "");
    const name = typeof category?.name === "string" ? category.name.trim() : "";
    if (!/^[a-z0-9-]{1,40}$/.test(id)) throw new TypeError("分类编号无效");
    if (RESERVED_IDS.has(id)) throw new TypeError("该分类编号为官方分类保留");
    if (ids.has(id)) throw new TypeError("分类编号不能重复");
    if (!name || name.length > 20) throw new TypeError("分类名须为 1–20 个字符");
    ids.add(id);
    const sourceHeroIds = category.heroIds ?? [];
    if (!Array.isArray(sourceHeroIds) || sourceHeroIds.length > 200) throw new TypeError("分类英雄列表无效");
    return Object.freeze({ id, name, heroIds: Object.freeze([...new Set(sourceHeroIds.map(heroId))]) });
  });
  const sourceProficiency = input.proficiency ?? {};
  if (!sourceProficiency || typeof sourceProficiency !== "object" || Array.isArray(sourceProficiency)) {
    throw new TypeError("熟练度格式无效");
  }
  const proficiency = {};
  for (const [key, value] of Object.entries(sourceProficiency)) {
    const id = heroId(key);
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new TypeError("熟练度须为 1–5");
    proficiency[id] = value;
  }
  return Object.freeze({
    schemaVersion: DRAFT_PROFILE_SCHEMA_VERSION,
    categories: Object.freeze(categories),
    proficiency: Object.freeze(proficiency),
    relationships: Object.freeze(relationships(input.relationships ?? [])),
    itemPlans: Object.freeze(itemPlans(input.itemPlans ?? [])),
  });
}
