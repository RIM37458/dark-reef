export const DEFAULT_DRAFT_LAYOUT_VERSION = "7.41";
export const DEFAULT_DRAFT_COLUMNS = 4;

const GROUPS = Object.freeze([
  Object.freeze({ id: "str", name: "力量", heroIds: Object.freeze([73, 2, 99, 96, 81, 51, 135, 69, 49, 107, 7, 103, 59, 23, 155, 104, 54, 77, 129, 60, 84, 57, 110, 137, 14, 28, 71, 18, 29, 98, 19, 83, 100, 108, 85, 42]) }),
  Object.freeze({ id: "agi", name: "敏捷", heroIds: Object.freeze([1, 4, 62, 61, 56, 6, 106, 41, 72, 123, 8, 145, 80, 48, 94, 82, 9, 114, 10, 89, 44, 12, 15, 32, 11, 93, 35, 67, 46, 109, 95, 70, 20, 47, 63]) }),
  Object.freeze({ id: "int", name: "智力", heroIds: Object.freeze([68, 66, 5, 55, 119, 87, 58, 121, 74, 64, 90, 52, 31, 25, 26, 138, 36, 111, 76, 13, 45, 39, 131, 86, 79, 27, 75, 101, 17, 34, 37, 112, 30, 22]) }),
  Object.freeze({ id: "all", name: "全才", heroIds: Object.freeze([102, 113, 3, 65, 38, 78, 50, 43, 33, 91, 97, 136, 53, 88, 120, 16, 128, 105, 40, 92, 126, 21]) }),
]);

const DEFAULT_CALIBRATION = Object.freeze({ x: 0.07, y: 0.14, width: 0.86, height: 0.72, opacity: 0.72 });

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function normalizeDraftCalibration(value = {}) {
  const width = clamp(value.width, 0.2, 1, DEFAULT_CALIBRATION.width);
  const height = clamp(value.height, 0.2, 1, DEFAULT_CALIBRATION.height);
  return Object.freeze({
    x: clamp(value.x, 0, 1 - width, DEFAULT_CALIBRATION.x),
    y: clamp(value.y, 0, 1 - height, DEFAULT_CALIBRATION.y),
    width,
    height,
    opacity: clamp(value.opacity, 0.2, 1, DEFAULT_CALIBRATION.opacity),
  });
}

export function adjustDraftCalibration(current, adjustment) {
  if (!adjustment || typeof adjustment !== "object" || Array.isArray(adjustment)) throw new TypeError("投影微调格式无效");
  const values = ["dx", "dy", "dScale", "dOpacity"].map((key) => Number(adjustment[key] ?? 0));
  if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > 0.05)) throw new RangeError("投影微调超出范围");
  const [dx, dy, dScale, dOpacity] = values;
  const safe = normalizeDraftCalibration(current);
  return normalizeDraftCalibration({
    x: safe.x + dx,
    y: safe.y + dy,
    width: safe.width + dScale,
    height: safe.height + dScale * 0.84,
    opacity: safe.opacity + dOpacity,
  });
}

export function createDraftGrid(heroes) {
  const heroesById = new Map(heroes.map((hero) => [Number(hero.id), hero]));
  const knownIds = new Set(GROUPS.flatMap(({ heroIds }) => heroIds));
  return GROUPS.map((group) => {
    const appendedIds = heroes
      .filter((hero) => hero.primaryAttribute === group.id && !knownIds.has(Number(hero.id)))
      .sort((left, right) => left.name.localeCompare(right.name, "en"))
      .map(({ id }) => Number(id));
    const heroIds = [...group.heroIds.filter((heroId) => heroesById.has(heroId)), ...appendedIds];
    return Object.freeze({
      id: group.id,
      name: group.name,
      columns: DEFAULT_DRAFT_COLUMNS,
      heroIds: Object.freeze(heroIds),
      cells: Object.freeze(heroIds.map((heroId, index) => Object.freeze({
        heroId,
        row: Math.floor(index / DEFAULT_DRAFT_COLUMNS) + 1,
        column: index % DEFAULT_DRAFT_COLUMNS + 1,
      }))),
    });
  });
}

export function draftCellRects(groups, calibration = DEFAULT_CALIBRATION) {
  const bounds = normalizeDraftCalibration(calibration);
  return groups.flatMap((group, groupIndex) => {
    const columns = group.columns ?? DEFAULT_DRAFT_COLUMNS;
    const rows = Math.max(1, Math.ceil(group.heroIds.length / columns));
    const groupWidth = bounds.width / 4;
    const groupX = bounds.x + groupIndex * groupWidth;
    const groupY = bounds.y;
    const header = bounds.height * 0.035;
    const innerWidth = groupWidth;
    const innerHeight = bounds.height - header;
    return group.heroIds.map((heroId, index) => Object.freeze({
      heroId,
      x: groupX + (index % columns) * innerWidth / columns,
      y: groupY + header + Math.floor(index / columns) * innerHeight / rows,
      width: innerWidth / columns,
      height: innerHeight / rows,
    }));
  });
}

export function draftTopSlotRects({
  y = 0.002,
  height = 0.058,
  radiantX = 0.292,
  direX = 0.532,
  teamWidth = 0.176,
} = {}) {
  const slotWidth = teamWidth / 5;
  return Object.freeze([radiantX, direX].flatMap((startX, sideIndex) => (
    Array.from({ length: 5 }, (_, teamIndex) => Object.freeze({
      index: sideIndex * 5 + teamIndex,
      side: SIDES_FOR_LAYOUT[sideIndex],
      teamIndex,
      x: startX + teamIndex * slotWidth,
      y,
      width: slotWidth,
      height,
    }))
  )));
}

const SIDES_FOR_LAYOUT = Object.freeze(["radiant", "dire"]);
