export const BUILTIN_DRAFT_CATEGORIES = Object.freeze([
  ["carry", "核心", "Carry"],
  ["support", "辅助", "Support"],
  ["nuker", "爆发", "Nuker"],
  ["disabler", "控制", "Disabler"],
  ["initiator", "先手", "Initiator"],
  ["durable", "前排", "Durable"],
  ["escape", "机动", "Escape"],
  ["pusher", "推进", "Pusher"],
].map(([id, name, role]) => Object.freeze({ id, name, role })));

const rolesByCategory = new Map(BUILTIN_DRAFT_CATEGORIES.map(({ id, role }) => [id, role]));

export function normalizeDraftSelection(value, customCategories = []) {
  if (!Array.isArray(value) || value.length > 12) throw new TypeError("选人分类格式无效");
  const allowed = new Set([...rolesByCategory.keys(), ...customCategories.map(({ id }) => id)]);
  const categories = [...new Set(value.map(String))];
  if (categories.some((id) => !allowed.has(id))) throw new RangeError("包含未知的选人分类");
  return Object.freeze(categories);
}

export function recommendDraftHeroes({
  heroes,
  selectedCategoryIds = [],
  unavailableHeroIds = [],
  customCategories = [],
  proficiency = {},
}) {
  const unavailable = new Set(unavailableHeroIds.map(Number));
  const customById = new Map(customCategories.map((category) => [
    String(category.id),
    new Set((category.heroIds ?? []).map(Number)),
  ]));
  return heroes.filter((hero) => {
    if (unavailable.has(hero.id)) return false;
    return selectedCategoryIds.every((categoryId) => {
      const role = rolesByCategory.get(categoryId);
      if (role) return hero.roles?.includes(role);
      return customById.get(categoryId)?.has(hero.id) ?? false;
    });
  }).map(({ id }, index) => ({ id, index, level: Number(proficiency[id] ?? 0) }))
    .sort((left, right) => right.level - left.level || left.index - right.index)
    .map(({ id }) => id);
}
