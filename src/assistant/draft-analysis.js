import { popularItems } from "./item-popularity-library.js";
import { createMatchupIndex, matchupEvidence } from "./matchup-library.js";
import { expertSynergyEvidence } from "./expert-synergy-library.js";
import { expertCounterEvidence, expertCounterItems } from "./expert-counter-library.js";

const EXPERT_COUNTER_WEIGHT = 20;
const MATCHUP_SCORE_LIMIT = 15;

const COVERAGE_RULES = Object.freeze([
  Object.freeze({ role: "Carry", label: "核心", minimum: 1 }),
  Object.freeze({ role: "Support", label: "辅助", minimum: 1 }),
  Object.freeze({ role: "Initiator", label: "先手", minimum: 1 }),
  Object.freeze({ role: "Disabler", label: "控制", minimum: 2 }),
]);

function selectedHeroes(heroIds, heroesById) {
  return heroIds.map((id) => heroesById.get(id)).filter(Boolean);
}

export function analyzeDraft({
  radiantHeroIds = [],
  direHeroIds = [],
  playerHeroId,
  catalog,
  profile,
  perspective = "radiant",
  matchups,
  itemPopularity,
  candidateHeroIds,
  expertSynergy,
}) {
  const heroesById = new Map(catalog.heroes.map((hero) => [hero.id, hero]));
  const itemsById = new Map((catalog.items ?? []).map((item) => [item.id, item]));
  const matchupIndex = matchups ? createMatchupIndex(matchups) : undefined;
  const expertCounterLibrary = !catalog.patch || catalog.expertCounters?.reviewedPatch === catalog.patch
    ? catalog.expertCounters
    : undefined;
  const allies = perspective === "dire" ? direHeroIds : radiantHeroIds;
  const enemies = perspective === "dire" ? radiantHeroIds : direHeroIds;
  const alliedHeroes = selectedHeroes(allies, heroesById);
  const enemyHeroes = selectedHeroes(enemies, heroesById);
  const coverage = Object.fromEntries(COVERAGE_RULES.map(({ role }) => [
    role,
    alliedHeroes.filter((hero) => hero.roles.includes(role)).length,
  ]));
  const warnings = COVERAGE_RULES
    .filter(({ role, minimum }) => coverage[role] < minimum)
    .map(({ label }) => `缺少${label}`);
  const picked = new Set([...radiantHeroIds, ...direHeroIds]);
  const candidates = candidateHeroIds ? new Set(candidateHeroIds.map(Number)) : undefined;
  const recommendations = catalog.heroes.filter((hero) => !picked.has(hero.id) && (!candidates || candidates.has(hero.id))).map((hero) => {
    let score = Number(profile.proficiency?.[hero.id] ?? 0) * 2;
    const reasons = [];
    const evidence = [];
    const mechanicEvidence = [];
    const synergy = expertSynergyEvidence(expertSynergy ?? catalog.expertSynergy, hero, alliedHeroes);
    score += synergy.score;
    reasons.push(...synergy.reasons.map(({ text }) => text));
    for (const enemyId of enemies) {
      const enemy = heroesById.get(enemyId);
      const expert = expertCounterEvidence(expertCounterLibrary, hero, enemy ?? { id: enemyId });
      score += expert.score * EXPERT_COUNTER_WEIGHT;
      mechanicEvidence.push(...expert.reasons);
      reasons.push(...expert.reasons.map(({ text }) => text));
      const row = matchupEvidence(matchupIndex, hero.id, enemyId);
      if (!row?.eligible) continue;
      evidence.push(row);
      const confidence = Math.min(1, Math.sqrt(row.games / 200));
      const matchupScore = row.delta * 200 * confidence;
      score += Math.max(-MATCHUP_SCORE_LIMIT, Math.min(MATCHUP_SCORE_LIMIT, matchupScore));
      const delta = `${row.delta >= 0 ? "+" : ""}${(row.delta * 100).toFixed(1)}%`;
      reasons.push(`对 ${enemy?.name ?? `英雄 #${enemyId}`}：职业赛 ${(row.winRate * 100).toFixed(1)}%，较英雄基准 ${delta}（${row.games} 局）`);
    }
    for (const rule of COVERAGE_RULES) {
      if (coverage[rule.role] < rule.minimum && hero.roles.includes(rule.role)) {
        score += 3;
        reasons.push(`补足${rule.label}`);
      }
    }
    for (const relation of profile.relationships ?? []) {
      if (relation.heroId !== hero.id || !enemies.includes(relation.againstHeroId)) continue;
      score += relation.score * 4;
      const enemy = heroesById.get(relation.againstHeroId);
      reasons.push(`对 ${enemy?.name ?? `英雄 #${relation.againstHeroId}`}：${relation.note || `${relation.score > 0 ? "优势" : "劣势"}${Math.abs(relation.score)}级`}`);
    }
    return Object.freeze({
      heroId: hero.id,
      score,
      reasons: Object.freeze(reasons),
      evidence: Object.freeze(evidence),
      mechanicEvidence: Object.freeze(mechanicEvidence),
    });
  }).sort((left, right) => right.score - left.score || left.heroId - right.heroId).slice(0, 8);
  const personalItems = (profile.itemPlans ?? []).flatMap((plan) => {
    if (plan.heroId !== playerHeroId) return [];
    if (plan.againstHeroIds.length && !plan.againstHeroIds.some((id) => enemies.includes(id))) return [];
    const item = itemsById.get(plan.itemId);
    if (!item) return [];
    return [Object.freeze({
      itemId: item.id,
      name: item.name,
      cost: item.cost,
      priority: plan.priority,
      reason: plan.situation,
      source: plan.source,
    })];
  }).sort((left, right) => right.priority - left.priority || left.cost - right.cost);
  const objectiveItems = playerHeroId && (itemPopularity ?? catalog.itemPopularity)
    ? popularItems(itemPopularity ?? catalog.itemPopularity, playerHeroId, [...itemsById.keys()]).map((entry) => {
      const item = itemsById.get(entry.itemId);
      return Object.freeze({
        itemId: item.id,
        name: item.name,
        cost: item.cost,
        purchases: entry.purchases,
        period: entry.period,
        source: "OpenDota",
      });
    })
    : [];
  const playerHero = heroesById.get(playerHeroId);
  const expertItems = expertCounterItems(expertCounterLibrary, playerHero, [...itemsById.values()], enemyHeroes).map((entry) => {
    const item = itemsById.get(entry.itemId);
    return Object.freeze({
      itemId: item.id,
      name: item.name,
      cost: item.cost,
      priority: entry.priority,
      reason: entry.reason,
      source: entry.source,
    });
  });
  const targetedItemIds = new Set([...personalItems, ...expertItems].map(({ itemId }) => itemId));
  return Object.freeze({
    coverage: Object.freeze(coverage),
    warnings: Object.freeze(warnings),
    recommendations: Object.freeze(recommendations),
    items: Object.freeze([...personalItems, ...expertItems.filter(({ itemId }) => !personalItems.some((item) => item.itemId === itemId)), ...objectiveItems.filter(({ itemId }) => !targetedItemIds.has(itemId))]),
    picked: Object.freeze({ radiant: [...radiantHeroIds], dire: [...direHeroIds] }),
    visiblePickCount: radiantHeroIds.length + direHeroIds.length,
    matchupSource: matchupIndex ? Object.freeze({
      provider: matchupIndex.snapshot.provider,
      scope: matchupIndex.snapshot.scope,
      fetchedAt: matchupIndex.snapshot.fetchedAt,
      minimumSample: matchupIndex.snapshot.minimumSample,
    }) : undefined,
    expertCounterSource: expertCounterLibrary ? Object.freeze({
      reviewedPatch: expertCounterLibrary.reviewedPatch,
      reviewedAt: expertCounterLibrary.reviewedAt,
    }) : undefined,
  });
}
