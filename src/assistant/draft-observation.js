const SIDES = Object.freeze(["radiant", "dire"]);
const PHASES = new Set(["grid-visible", "strategy", "unknown"]);
const MODES = new Set(["ranked-roles", "ranked-classic", "immortal-draft", "unknown"]);

function confidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) throw new RangeError("识图置信度无效");
  return number;
}

export function normalizeAssignedPosition(value) {
  if (value === undefined) return undefined;
  const position = Number(value?.value);
  if (!Number.isInteger(position) || position < 1 || position > 5) throw new RangeError("分配位置必须是 1–5");
  if (!["ranked-roles-marker", "composition-inference"].includes(value.source)) throw new TypeError("位置证据来源无效");
  const source = value.source;
  return Object.freeze({
    value: position,
    confidence: confidence(value.confidence),
    certainty: source === "ranked-roles-marker" ? "confirmed" : "inferred",
    source,
  });
}

function emptySlot(index) {
  return Object.freeze({ index, side: SIDES[index < 5 ? 0 : 1], status: "empty" });
}

function normalizeSlot(value, index) {
  if (!value || Number(value.index) !== index) return emptySlot(index);
  if (value.status !== "recognized") return Object.freeze({ ...emptySlot(index), status: value.status === "uncertain" ? "uncertain" : "empty" });
  const heroId = Number(value.heroId);
  if (!Number.isInteger(heroId) || heroId < 1) throw new RangeError("英雄识别编号无效");
  return Object.freeze({ index, side: SIDES[index < 5 ? 0 : 1], status: "recognized", heroId, confidence: confidence(value.confidence) });
}

function uncertainSlot(index) {
  return Object.freeze({ ...emptySlot(index), status: "uncertain" });
}

export function createDraftObservationTracker({ confirmationFrames = 2, expiryFrames = 3 } = {}) {
  if (!Number.isInteger(confirmationFrames) || confirmationFrames < 1) throw new RangeError("确认帧数无效");
  if (!Number.isInteger(expiryFrames) || expiryFrames < 1) throw new RangeError("失效帧数无效");
  const stable = Array.from({ length: 10 }, () => undefined);
  const pending = Array.from({ length: 10 }, () => ({ heroId: undefined, count: 0 }));
  const missing = Array.from({ length: 10 }, () => 0);
  let bannedHeroIds = Object.freeze([]);
  let localSlotIndex;
  let pendingLocal = { index: undefined, count: 0 };
  let stablePosition;
  let pendingPosition = { value: undefined, count: 0 };

  return Object.freeze({
    update(raw) {
      if (!raw || !PHASES.has(raw.phase) || !MODES.has(raw.mode)) throw new TypeError("选人识图状态无效");
      if (!Array.isArray(raw.slots) || raw.slots.length !== 10) throw new RangeError("顶部英雄槽必须恰好为十个");
      const incoming = raw.slots.map(normalizeSlot);
      const counts = new Map();
      for (const slot of incoming) {
        if (slot.status === "recognized") counts.set(slot.heroId, (counts.get(slot.heroId) ?? 0) + 1);
      }
      const duplicateIds = new Set([...counts].filter(([, count]) => count > 1).map(([heroId]) => heroId));
      const slots = incoming.map((slot, index) => {
        if (slot.status === "recognized" && duplicateIds.has(slot.heroId)) {
          pending[index] = { heroId: undefined, count: 0 };
          return uncertainSlot(index);
        }
        if (slot.status === "recognized") {
          missing[index] = 0;
          pending[index] = pending[index].heroId === slot.heroId
            ? { heroId: slot.heroId, count: pending[index].count + 1 }
            : { heroId: slot.heroId, count: 1 };
          if (pending[index].count >= confirmationFrames) stable[index] = slot;
          return stable[index]?.heroId === slot.heroId ? stable[index] : uncertainSlot(index);
        }
        pending[index] = { heroId: undefined, count: 0 };
        if (raw.phase === "strategy" && stable[index]) return stable[index];
        missing[index] += 1;
        if (missing[index] >= expiryFrames) stable[index] = undefined;
        return stable[index] ?? (slot.status === "uncertain" ? uncertainSlot(index) : emptySlot(index));
      });
      if (raw.phase === "grid-visible") {
        const picked = new Set(slots.flatMap((slot) => slot.status === "recognized" ? [slot.heroId] : []));
        bannedHeroIds = Object.freeze([...new Set((raw.bannedHeroIds ?? []).map(Number))]
          .filter((heroId) => Number.isInteger(heroId) && heroId > 0 && !picked.has(heroId))
          .sort((left, right) => left - right));
      }
      const observedLocal = Number.isInteger(raw.localSlotIndex) && raw.localSlotIndex >= 0 && raw.localSlotIndex < 10
        ? raw.localSlotIndex
        : undefined;
      if (observedLocal !== undefined) {
        pendingLocal = pendingLocal.index === observedLocal
          ? { index: observedLocal, count: pendingLocal.count + 1 }
          : { index: observedLocal, count: 1 };
        if (pendingLocal.count >= confirmationFrames) localSlotIndex = observedLocal;
      } else {
        pendingLocal = { index: undefined, count: 0 };
      }
      const observedPosition = normalizeAssignedPosition(raw.assignedPosition);
      if (observedPosition?.source === "ranked-roles-marker") {
        pendingPosition = pendingPosition.value === observedPosition.value
          ? { value: observedPosition.value, count: pendingPosition.count + 1 }
          : { value: observedPosition.value, count: 1 };
        if (pendingPosition.count >= confirmationFrames) stablePosition = observedPosition;
      } else if (observedPosition) {
        stablePosition = observedPosition;
      } else {
        pendingPosition = { value: undefined, count: 0 };
      }
      return Object.freeze({
        phase: raw.phase,
        mode: raw.mode,
        slots: Object.freeze(slots),
        bannedHeroIds,
        localSlotIndex,
        localSide: localSlotIndex === undefined ? "unknown" : SIDES[localSlotIndex < 5 ? 0 : 1],
        assignedPosition: stablePosition,
      });
    },
  });
}
