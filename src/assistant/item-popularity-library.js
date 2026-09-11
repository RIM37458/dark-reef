const PERIODS = new Set(["start_game", "early_game", "mid_game", "late_game"]);

export function normalizeItemPopularitySnapshot(value) {
  if (!value || typeof value !== "object") throw new TypeError("item popularity snapshot must be an object");
  if (value.schemaVersion !== 1) throw new RangeError("schemaVersion must be 1");
  if (value.provider !== "OpenDota" || value.scope !== "professional_matches") throw new RangeError("provider scope is unsupported");
  const fetchedAt = new Date(value.fetchedAt);
  if (!Number.isFinite(fetchedAt.valueOf()) || fetchedAt.toISOString() !== value.fetchedAt) throw new RangeError("fetchedAt must be an ISO timestamp");
  const sourceUrl = new URL(value.sourceUrl);
  if (sourceUrl.protocol !== "https:") throw new RangeError("sourceUrl must use HTTPS");
  if (!Number.isInteger(value.minimumPurchases) || value.minimumPurchases < 1) throw new RangeError("minimumPurchases must be positive");
  if (!Array.isArray(value.rows) || value.rows.length > 20_000) throw new TypeError("rows must be a bounded array");
  const rows = value.rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 4) throw new RangeError("each item row must have four values");
    const [heroId, period, itemId, purchases] = row;
    if (!Number.isInteger(heroId) || heroId < 1) throw new RangeError("heroId must be positive");
    if (!PERIODS.has(period)) throw new RangeError("period is unsupported");
    if (!Number.isInteger(itemId) || itemId < 1) throw new RangeError("itemId must be positive");
    if (!Number.isInteger(purchases) || purchases < 1) throw new RangeError("purchases must be positive");
    return Object.freeze([heroId, period, itemId, purchases]);
  });
  return Object.freeze({
    schemaVersion: 1,
    provider: "OpenDota",
    scope: "professional_matches",
    sourceUrl: sourceUrl.href,
    fetchedAt: fetchedAt.toISOString(),
    minimumPurchases: value.minimumPurchases,
    rows: Object.freeze(rows),
  });
}

export function popularItems(snapshot, heroId, itemIds, periods = ["mid_game", "late_game"], limit = 6) {
  const normalized = normalizeItemPopularitySnapshot(snapshot);
  const allowedItems = new Set(itemIds);
  const allowedPeriods = new Set(periods);
  return Object.freeze(normalized.rows
    .filter((row) => row[0] === heroId && allowedPeriods.has(row[1]) && allowedItems.has(row[2]) && row[3] >= normalized.minimumPurchases)
    .map(([subjectId, period, itemId, purchases]) => Object.freeze({ heroId: subjectId, period, itemId, purchases }))
    .sort((left, right) => right.purchases - left.purchases || left.itemId - right.itemId)
    .slice(0, limit));
}
