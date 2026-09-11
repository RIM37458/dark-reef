const ALLOWED_ROLES = new Set(["Carry", "Support", "Nuker", "Disabler", "Initiator", "Durable", "Escape", "Pusher"]);
const IDENTIFIER = /^[a-z0-9-]{1,64}$/;

function exactObject(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label}格式无效`);
  if (Object.keys(value).some((key) => !keys.has(key))) throw new TypeError(`${label}格式无效`);
  return value;
}

function boundedArray(value, maximum, label) {
  if (!Array.isArray(value) || value.length > maximum) throw new TypeError(`${label}格式无效`);
  return value;
}

function positiveId(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000) throw new TypeError(`${label}无效`);
  return value;
}

function identifier(value, label) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw new TypeError(`${label}无效`);
  return value;
}

function requireUnique(values, label) {
  if (new Set(values).size !== values.length) throw new TypeError(`${label}编号重复`);
}

function mechanicEntry(value, sourceIds) {
  exactObject(value, new Set(["mechanic", "strength", "reason", "sourceId"]), "英雄机制");
  if (!Number.isInteger(value.strength) || value.strength < 1 || value.strength > 3) throw new TypeError("机制强度须为 1 至 3");
  if (!sourceIds.has(value.sourceId)) throw new TypeError("英雄机制来源无效");
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (!reason || reason.length > 160) throw new TypeError("英雄机制说明无效");
  return Object.freeze({
    mechanic: identifier(value.mechanic, "机制编号"),
    strength: value.strength,
    reason,
    sourceId: value.sourceId,
  });
}

function mechanicEntries(value, sourceIds) {
  return Object.freeze(boundedArray(value, 40, "英雄机制列表").map((entry) => mechanicEntry(entry, sourceIds)));
}

function roles(value) {
  const entries = boundedArray(value, ALLOWED_ROLES.size, "装备适用职责");
  if (entries.length === 0 || entries.some((role) => !ALLOWED_ROLES.has(role))) throw new TypeError("装备适用职责格式无效");
  return Object.freeze([...new Set(entries)]);
}

export function normalizeExpertCounterLibrary(value) {
  exactObject(value, new Set(["schemaVersion", "reviewedPatch", "reviewedAt", "sources", "interactions", "heroes", "items"]), "专家克制库");
  if (value.schemaVersion !== 1 || typeof value.reviewedPatch !== "string" || !/^\d+\.\d+/.test(value.reviewedPatch)) {
    throw new TypeError("专家克制库格式无效");
  }
  const reviewedAt = new Date(value.reviewedAt);
  if (!Number.isFinite(reviewedAt.valueOf()) || reviewedAt.toISOString() !== value.reviewedAt) throw new TypeError("专家克制库复核时间无效");
  const sources = boundedArray(value.sources, 100, "专家克制来源").map((source) => {
    exactObject(source, new Set(["id", "label", "kind"]), "专家克制来源");
    const label = typeof source.label === "string" ? source.label.trim() : "";
    if (!label || label.length > 100 || !["bundled-game-data", "mechanic-review"].includes(source.kind)) throw new TypeError("专家克制来源格式无效");
    return Object.freeze({ id: identifier(source.id, "来源编号"), label, kind: source.kind });
  });
  const sourceIds = new Set(sources.map(({ id }) => id));
  if (sourceIds.size !== sources.length) throw new TypeError("专家克制来源编号重复");
  const interactions = boundedArray(value.interactions, 200, "机制交互").map((interaction) => {
    exactObject(interaction, new Set(["id", "effect", "trait", "score", "reason", "sourceId"]), "机制交互");
    const reason = typeof interaction.reason === "string" ? interaction.reason.trim() : "";
    if (!Number.isInteger(interaction.score) || interaction.score < 1 || interaction.score > 3 || !reason || reason.length > 160 || !sourceIds.has(interaction.sourceId)) {
      throw new TypeError("机制交互格式无效");
    }
    return Object.freeze({
      id: identifier(interaction.id, "交互编号"),
      effect: identifier(interaction.effect, "效果编号"),
      trait: identifier(interaction.trait, "特性编号"),
      score: interaction.score,
      reason,
      sourceId: interaction.sourceId,
    });
  });
  requireUnique(interactions.map(({ id }) => id), "机制交互");
  const heroes = boundedArray(value.heroes, 200, "英雄机制档案").map((hero) => {
    exactObject(hero, new Set(["heroId", "effects", "traits"]), "英雄机制档案");
    return Object.freeze({
      heroId: positiveId(hero.heroId, "英雄编号"),
      effects: mechanicEntries(hero.effects, sourceIds),
      traits: mechanicEntries(hero.traits, sourceIds),
    });
  });
  requireUnique(heroes.map(({ heroId }) => heroId), "英雄机制档案");
  const items = boundedArray(value.items, 500, "装备机制档案").map((item) => {
    exactObject(item, new Set(["itemId", "buyerAnyRole", "buyerNoneRole", "effects"]), "装备机制档案");
    return Object.freeze({
      itemId: positiveId(item.itemId, "装备编号"),
      buyerAnyRole: roles(item.buyerAnyRole),
      buyerNoneRole: Object.freeze(boundedArray(item.buyerNoneRole, ALLOWED_ROLES.size, "装备排除职责").map((role) => {
        if (!ALLOWED_ROLES.has(role)) throw new TypeError("装备排除职责格式无效");
        return role;
      })),
      effects: mechanicEntries(item.effects, sourceIds),
    });
  });
  requireUnique(items.map(({ itemId }) => itemId), "装备机制档案");
  return Object.freeze({
    schemaVersion: 1,
    reviewedPatch: value.reviewedPatch,
    reviewedAt: reviewedAt.toISOString(),
    sources: Object.freeze(sources),
    interactions: Object.freeze(interactions),
    heroes: Object.freeze(heroes),
    items: Object.freeze(items),
  });
}

function interactionEvidence(library, effects, enemy) {
  const profile = library.heroes.find(({ heroId }) => heroId === enemy.id);
  if (!profile) return [];
  const sources = new Map(library.sources.map((source) => [source.id, source]));
  return library.interactions.flatMap((interaction) => {
    const effect = effects.filter(({ mechanic }) => mechanic === interaction.effect).sort((left, right) => right.strength - left.strength)[0];
    const trait = profile.traits.filter(({ mechanic }) => mechanic === interaction.trait).sort((left, right) => right.strength - left.strength)[0];
    if (!effect || !trait) return [];
    const score = interaction.score * Math.min(effect.strength, trait.strength) / 3;
    return [Object.freeze({
      text: `对 ${enemy.name ?? `英雄 #${enemy.id}`}：${interaction.reason}（${effect.reason}；${trait.reason}）`,
      score,
      interactionId: interaction.id,
      source: sources.get(interaction.sourceId),
    })];
  });
}

export function expertCounterEvidence(library, candidate, enemy) {
  if (!library) return Object.freeze({ score: 0, reasons: Object.freeze([]) });
  const profile = library.heroes.find(({ heroId }) => heroId === candidate.id);
  if (!profile) return Object.freeze({ score: 0, reasons: Object.freeze([]) });
  const reasons = interactionEvidence(library, profile.effects, enemy);
  return Object.freeze({
    score: Math.min(3, reasons.reduce((sum, reason) => sum + reason.score, 0)),
    reasons: Object.freeze(reasons),
  });
}

export function expertCounterItems(library, buyer, items, enemies) {
  if (!library || !buyer) return Object.freeze([]);
  const itemFacts = new Map(items.map((item) => [item.id, item]));
  return Object.freeze(library.items.flatMap((profile) => {
    const applies = profile.buyerAnyRole.some((role) => buyer.roles.includes(role))
      && !profile.buyerNoneRole.some((role) => buyer.roles.includes(role));
    if (!applies || !itemFacts.has(profile.itemId)) return [];
    const reasons = enemies.flatMap((enemy) => interactionEvidence(library, profile.effects, enemy));
    const score = Math.min(3, reasons.reduce((sum, reason) => sum + reason.score, 0));
    if (score === 0) return [];
    return [Object.freeze({
      itemId: profile.itemId,
      score,
      priority: Math.min(5, Math.round(score) + 2),
      reason: reasons.map(({ text }) => text).join("；"),
      source: "expert-mechanics",
    })];
  }).sort((left, right) => right.score - left.score || left.itemId - right.itemId));
}
