export const ARMORY_POOLS = Object.freeze([
  Object.freeze({ id: "armory-signature", name: "绝活", proficiency: 5 }),
  Object.freeze({ id: "armory-won", name: "赢过", proficiency: 3 }),
  Object.freeze({ id: "armory-played", name: "玩过", proficiency: 1 }),
]);

const POOL_IDS = new Set(ARMORY_POOLS.map(({ id }) => id));

export function ensureArmoryPools(profile) {
  const present = new Set((profile.categories ?? []).map(({ id }) => id));
  return {
    ...profile,
    categories: [
      ...(profile.categories ?? []),
      ...ARMORY_POOLS.filter(({ id }) => !present.has(id)).map(({ id, name }) => ({ id, name, heroIds: [] })),
    ],
    proficiency: { ...(profile.proficiency ?? {}) },
    relationships: [...(profile.relationships ?? [])],
    itemPlans: [...(profile.itemPlans ?? [])],
  };
}

export function moveHeroToPool(input, heroId, poolId) {
  const pool = ARMORY_POOLS.find(({ id }) => id === poolId);
  if (!pool) throw new RangeError("熟练英雄分组无效");
  const profile = ensureArmoryPools(input);
  return {
    ...profile,
    categories: profile.categories.map((category) => ({
      ...category,
      heroIds: POOL_IDS.has(category.id)
        ? [...category.heroIds.filter((id) => id !== heroId), ...(category.id === poolId ? [heroId] : [])]
        : [...category.heroIds],
    })),
    proficiency: { ...profile.proficiency, [heroId]: pool.proficiency },
  };
}

export function setPersonalMatchup(input, { heroId, againstHeroId, direction, intensity, note = "" }) {
  if (heroId === againstHeroId) throw new RangeError("不能把英雄与自己设为克制关系");
  if (!Number.isInteger(intensity) || intensity < 1 || intensity > 3) throw new RangeError("影响程度须为 1–3");
  if (!["afraid", "counter"].includes(direction)) throw new RangeError("克制方向无效");
  const profile = ensureArmoryPools(input);
  const relation = { heroId, againstHeroId, score: direction === "counter" ? intensity : -intensity, note: String(note).trim(), source: "personal" };
  return {
    ...profile,
    relationships: [
      ...profile.relationships.filter((entry) => entry.heroId !== heroId || entry.againstHeroId !== againstHeroId),
      relation,
    ],
  };
}
