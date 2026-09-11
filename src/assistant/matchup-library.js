const VALID_SCOPES = new Set(["professional_matches", "high_rank_public_matches"]);

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive integer`);
  return value;
}

export function normalizeMatchupSnapshot(value) {
  if (!value || typeof value !== "object") throw new TypeError("matchup snapshot must be an object");
  if (value.schemaVersion !== 1) throw new RangeError("schemaVersion must be 1");
  if (typeof value.provider !== "string" || !value.provider.trim()) throw new RangeError("provider is required");
  if (!VALID_SCOPES.has(value.scope)) throw new RangeError("scope is unsupported");
  let sourceUrl;
  try {
    sourceUrl = new URL(value.sourceUrl);
  } catch {
    throw new RangeError("sourceUrl must be a valid HTTPS URL");
  }
  if (sourceUrl.protocol !== "https:") throw new RangeError("sourceUrl must use HTTPS");
  const fetchedAt = new Date(value.fetchedAt);
  if (!Number.isFinite(fetchedAt.valueOf()) || fetchedAt.toISOString() !== value.fetchedAt) {
    throw new RangeError("fetchedAt must be an ISO timestamp");
  }
  const minimumSample = positiveInteger(value.minimumSample, "minimumSample");
  if (!Array.isArray(value.baselines) || value.baselines.length > 200) throw new TypeError("baselines must be a bounded array");
  const baselines = value.baselines.map((row) => {
    if (!Array.isArray(row) || row.length !== 3) throw new RangeError("each baseline row must have three values");
    const heroId = positiveInteger(row[0], "baseline heroId");
    const games = positiveInteger(row[1], "baseline games");
    const wins = row[2];
    if (!Number.isInteger(wins) || wins < 0 || wins > games) throw new RangeError("baseline wins must be between zero and games");
    return Object.freeze([heroId, games, wins]);
  });
  if (!Array.isArray(value.rows) || value.rows.length > 20_000) throw new TypeError("rows must be a bounded array");
  const rows = value.rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 4) throw new RangeError("each matchup row must have four values");
    const heroId = positiveInteger(row[0], "heroId");
    const againstHeroId = positiveInteger(row[1], "againstHeroId");
    const games = positiveInteger(row[2], "games");
    const wins = row[3];
    if (!Number.isInteger(wins) || wins < 0 || wins > games) throw new RangeError("wins must be between zero and games");
    return Object.freeze([heroId, againstHeroId, games, wins]);
  });
  return Object.freeze({
    schemaVersion: 1,
    provider: value.provider.trim(),
    scope: value.scope,
    sourceUrl: sourceUrl.href,
    fetchedAt: fetchedAt.toISOString(),
    minimumSample,
    baselines: Object.freeze(baselines),
    rows: Object.freeze(rows),
  });
}

export function createMatchupIndex(snapshot) {
  const normalized = normalizeMatchupSnapshot(snapshot);
  const rows = new Map(normalized.rows.map((row) => [`${row[0]}:${row[1]}`, row]));
  const baselines = new Map(normalized.baselines.map((row) => [row[0], row]));
  const totals = new Map();
  for (const [heroId, , games, wins] of normalized.rows) {
    const total = totals.get(heroId) ?? [heroId, 0, 0];
    total[1] += games;
    total[2] += wins;
    totals.set(heroId, total);
  }
  for (const [heroId, total] of totals) {
    if (!baselines.has(heroId)) baselines.set(heroId, Object.freeze(total));
  }
  return Object.freeze({ snapshot: normalized, rows, baselines });
}

export function matchupEvidence(index, heroId, againstHeroId) {
  const row = index?.rows?.get(`${heroId}:${againstHeroId}`);
  if (!row) return undefined;
  const [subjectId, opponentId, games, wins] = row;
  const baseline = index.baselines.get(subjectId);
  const baselineWinRate = baseline ? baseline[2] / baseline[1] : 0.5;
  return Object.freeze({
    heroId: subjectId,
    againstHeroId: opponentId,
    games,
    wins,
    winRate: wins / games,
    baselineWinRate,
    delta: (wins / games) - baselineWinRate,
    eligible: games >= index.snapshot.minimumSample,
  });
}
