const ALLOWED_ROLES = new Set(["Carry", "Support", "Nuker", "Disabler", "Initiator", "Durable", "Escape", "Pusher"]);

function roles(value) {
  if (!Array.isArray(value) || value.length === 0 || value.some((role) => !ALLOWED_ROLES.has(role))) {
    throw new TypeError("高手相性规则包含未知职责");
  }
  return Object.freeze([...new Set(value)]);
}

export function normalizeExpertSynergyLibrary(value) {
  if (value?.schemaVersion !== 1 || typeof value.reviewedPatch !== "string" || !Array.isArray(value.sources) || !Array.isArray(value.rules)) {
    throw new TypeError("高手相性库格式无效");
  }
  const sources = value.sources.map((source) => {
    if (!/^[a-z0-9-]{1,64}$/.test(source?.id) || typeof source.author !== "string" || source.kind !== "expert-teaching") {
      throw new TypeError("高手相性来源格式无效");
    }
    const url = new URL(source.url);
    if (url.protocol !== "https:") throw new TypeError("高手相性来源必须使用 HTTPS");
    return Object.freeze({ id: source.id, author: source.author.slice(0, 80), url: url.href, publishedAt: String(source.publishedAt), kind: source.kind });
  });
  const sourceIds = new Set(sources.map(({ id }) => id));
  const rules = value.rules.map((rule) => {
    const score = Number(rule?.score);
    if (!/^[a-z0-9-]{1,64}$/.test(rule?.id) || !Number.isFinite(score) || Math.abs(score) > 3 || !sourceIds.has(rule.sourceId)) {
      throw new TypeError("高手相性规则格式无效");
    }
    return Object.freeze({
      id: rule.id,
      allyAnyRole: roles(rule.allyAnyRole),
      candidateAnyRole: roles(rule.candidateAnyRole),
      score,
      reason: String(rule.reason).slice(0, 240),
      sourceId: rule.sourceId,
    });
  });
  return Object.freeze({ schemaVersion: 1, reviewedPatch: value.reviewedPatch, sources: Object.freeze(sources), rules: Object.freeze(rules) });
}

export function expertSynergyEvidence(library, candidate, allies) {
  if (!library) return Object.freeze({ score: 0, reasons: Object.freeze([]) });
  const sources = new Map(library.sources.map((source) => [source.id, source]));
  const allyRoles = new Set(allies.flatMap((hero) => hero.roles));
  const matches = library.rules.filter((rule) => (
    rule.allyAnyRole.some((role) => allyRoles.has(role))
      && rule.candidateAnyRole.some((role) => candidate.roles.includes(role))
  ));
  return Object.freeze({
    score: matches.reduce((sum, rule) => sum + rule.score, 0),
    reasons: Object.freeze(matches.map((rule) => Object.freeze({
      text: rule.reason,
      score: rule.score,
      source: sources.get(rule.sourceId),
    }))),
  });
}
