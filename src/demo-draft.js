import { analyzeDraft } from "./assistant/draft-analysis.js";

const ORDER = Object.freeze([
  Object.freeze({ team: "radiant", heroId: 93 }),
  Object.freeze({ team: "dire", heroId: 28 }),
  Object.freeze({ team: "dire", heroId: 6 }),
  Object.freeze({ team: "radiant", heroId: 2 }),
  Object.freeze({ team: "radiant", heroId: 5 }),
  Object.freeze({ team: "dire", heroId: 14 }),
  Object.freeze({ team: "dire", heroId: 74 }),
  Object.freeze({ team: "radiant", heroId: 8 }),
  Object.freeze({ team: "radiant", heroId: 26 }),
  Object.freeze({ team: "dire", heroId: 11 }),
]);

export const DEMO_DRAFT_PROFILE = Object.freeze({
  proficiency: Object.freeze({ 93: 5, 8: 4, 26: 3 }),
  relationships: Object.freeze([
    Object.freeze({ heroId: 93, againstHeroId: 14, score: 2, note: "黑暗契约能处理持续控制", source: "demo" }),
    Object.freeze({ heroId: 26, againstHeroId: 6, score: 2, note: "多段控制能限制站桩输出", source: "demo" }),
    Object.freeze({ heroId: 11, againstHeroId: 5, score: 1, note: "沉默后可快速压低脆弱后排", source: "demo" }),
  ]),
  itemPlans: Object.freeze([
    Object.freeze({ heroId: 93, itemId: 116, priority: 5, situation: "对方控制链集中时保证进场", againstHeroIds: [14, 74], source: "demo" }),
  ]),
});

export function createDraftDemoFrames(catalog, matchups = catalog.matchups) {
  const radiantHeroIds = [];
  const direHeroIds = [];
  const frames = [];
  for (let index = 0; index <= ORDER.length; index += 1) {
    frames.push(Object.freeze({
      step: index,
      radiantHeroIds: Object.freeze([...radiantHeroIds]),
      direHeroIds: Object.freeze([...direHeroIds]),
      currentPick: ORDER[index] ?? null,
      complete: index === ORDER.length,
      analysis: analyzeDraft({
        radiantHeroIds,
        direHeroIds,
        playerHeroId: radiantHeroIds.includes(93) ? 93 : undefined,
        catalog,
        profile: DEMO_DRAFT_PROFILE,
        matchups,
      }),
    }));
    const pick = ORDER[index];
    if (pick) (pick.team === "radiant" ? radiantHeroIds : direHeroIds).push(pick.heroId);
  }
  return Object.freeze(frames);
}
