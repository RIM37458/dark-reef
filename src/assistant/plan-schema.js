import { randomUUID } from "node:crypto";

export const PLAN_SCHEMA_VERSION = 1;

function boundedText(value, field, maximum, { required = false } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if ((required && !text) || text.length > maximum) {
    throw new TypeError(`${field} must contain ${required ? `1-${maximum}` : `at most ${maximum}`} characters`);
  }
  return text;
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
    throw new TypeError(`${field} must be a positive integer`);
  }
  return value;
}

function normalizeAbilityLevels(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("abilityLevels must be an object");
  }
  const result = {};
  for (const [key, level] of Object.entries(value)) {
    if (!/^[a-z0-9_]{1,80}$/.test(key) || !Number.isInteger(level) || level < 1 || level > 4) {
      throw new TypeError("abilityLevels contains an invalid entry");
    }
    result[key] = level;
  }
  return result;
}

function normalizeSlot(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new TypeError("enemy slot must be an object");
  return Object.freeze({
    heroId: positiveInteger(value.heroId, "heroId"),
    notes: boundedText(value.notes, "slot notes", 500),
    abilityLevels: Object.freeze(normalizeAbilityLevels(value.abilityLevels)),
  });
}

function safeTimestamp(value, fallback) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return fallback;
  return new Date(value).toISOString();
}

export function normalizePlan(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("plan must be an object");
  }
  if (input.schemaVersion !== undefined && input.schemaVersion !== PLAN_SCHEMA_VERSION) {
    throw new TypeError("unsupported plan schema version");
  }
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? randomUUID;
  const timestamp = now();
  const inputSlots = input.enemySlots ?? [];
  if (!Array.isArray(inputSlots) || inputSlots.length > 5) {
    throw new TypeError("enemySlots must contain at most five entries");
  }
  const enemySlots = Array.from({ length: 5 }, (_unused, index) => normalizeSlot(inputSlots[index]));
  const items = input.itemIds ?? [];
  if (!Array.isArray(items) || items.length > 24) throw new TypeError("itemIds must contain at most 24 entries");
  const itemIds = [...new Set(items.map((value) => positiveInteger(value, "item id")))];
  const id = input.id === undefined
    ? createId()
    : boundedText(input.id, "plan id", 80, { required: true });
  return Object.freeze({
    schemaVersion: PLAN_SCHEMA_VERSION,
    id,
    title: boundedText(input.title, "title", 120, { required: true }),
    description: boundedText(input.description, "description", 4_000),
    enemySlots: Object.freeze(enemySlots),
    itemIds: Object.freeze(itemIds),
    source: "personal",
    createdAt: safeTimestamp(input.createdAt, timestamp),
    updatedAt: safeTimestamp(input.updatedAt, timestamp),
  });
}
