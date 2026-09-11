const POSITION_ROLES = Object.freeze({
  1: Object.freeze(["Carry"]),
  2: Object.freeze(["Carry", "Nuker"]),
  3: Object.freeze(["Initiator", "Durable"]),
  4: Object.freeze(["Support", "Initiator", "Disabler"]),
  5: Object.freeze(["Support"]),
});

const ASSIGNED_ROLE_LABELS = Object.freeze({
  1: "优势路（常称 1 号位）",
  2: "中路（常称 2 号位）",
  3: "劣势路（常称 3 号位）",
  4: "辅助（常称 4 号位）",
  5: "纯辅助（常称 5 号位）",
});

export function assignedRoleLabel(position) {
  return ASSIGNED_ROLE_LABELS[position];
}

export function draftTeams(observation) {
  const radiantHeroIds = observation.slots.slice(0, 5).flatMap((slot) => slot.status === "recognized" ? [slot.heroId] : []);
  const direHeroIds = observation.slots.slice(5, 10).flatMap((slot) => slot.status === "recognized" ? [slot.heroId] : []);
  if (observation.localSide === "radiant") {
    return Object.freeze({ radiantHeroIds, direHeroIds, allyHeroIds: radiantHeroIds, enemyHeroIds: direHeroIds });
  }
  if (observation.localSide === "dire") {
    return Object.freeze({ radiantHeroIds, direHeroIds, allyHeroIds: direHeroIds, enemyHeroIds: radiantHeroIds });
  }
  return Object.freeze({ radiantHeroIds, direHeroIds, allyHeroIds: [], enemyHeroIds: [] });
}

export function positionCandidateIds(heroes, position, proficiency = {}) {
  const roles = POSITION_ROLES[position];
  if (!roles) return Object.freeze([]);
  return Object.freeze(heroes
    .filter((hero) => hero.roles.some((role) => roles.includes(role)))
    .sort((left, right) => Number(proficiency[right.id] ?? 0) - Number(proficiency[left.id] ?? 0) || left.id - right.id)
    .map(({ id }) => id));
}
