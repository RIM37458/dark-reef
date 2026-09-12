import { draftTopSlotRects } from "../assistant/draft-layout.js";
import { recommendDraftHeroes } from "../assistant/draft-recommendation.js";

const board = document.querySelector("#draft-board");
const combatCooldowns = document.querySelector("#combat-cooldowns");
const catalog = await window.draftOverlay.getCatalog();
const topSlots = draftTopSlotRects();
let layoutKey = "";

function heroCell({ heroId, x, y, width, height, confidence }) {
  const cell = document.createElement("div");
  cell.className = "draft-hero";
  cell.dataset.heroId = String(heroId);
  cell.dataset.confidence = String(confidence);
  cell.style.setProperty("--cell-x", `${x * 100}vw`);
  cell.style.setProperty("--cell-y", `${y * 100}vh`);
  cell.style.setProperty("--cell-width", `${width * 100}vw`);
  cell.style.setProperty("--cell-height", `${height * 100}vh`);
  return cell;
}

function renderLayout(layout) {
  const cells = layout?.status === "learned" ? layout.cells : [];
  const nextKey = cells.map(({ heroId, x, y, width, height }) => `${heroId}:${x}:${y}:${width}:${height}`).join("|");
  if (nextKey !== layoutKey) {
    board.replaceChildren(...cells.map(heroCell));
    layoutKey = nextKey;
  }
  return cells.length > 0;
}

function render(state) {
  const manualRecommended = recommendDraftHeroes({
    heroes: catalog.heroes,
    selectedCategoryIds: state.selectedCategoryIds,
    unavailableHeroIds: state.unavailableHeroIds,
    customCategories: state.profile.categories,
    proficiency: state.profile.proficiency,
  });
  const recommended = new Set(state.recommendedHeroIds?.length ? state.recommendedHeroIds : manualRecommended);
  const unavailable = new Set(state.unavailableHeroIds);
  const filtering = Boolean(state.recommendedHeroIds?.length || state.selectedCategoryIds.length);
  const gamePhase = state.observation?.phase === "strategy";
  const hasLearnedLayout = renderLayout(state.observation?.layout);
  board.hidden = gamePhase || !hasLearnedLayout;
  board.style.setProperty("--board-opacity", state.calibration.opacity);
  for (const cell of board.querySelectorAll(".draft-hero")) {
    const heroId = Number(cell.dataset.heroId);
    cell.classList.toggle("recommended", filtering && recommended.has(heroId));
    cell.classList.toggle("dimmed", filtering && !recommended.has(heroId));
    cell.classList.toggle("unavailable", unavailable.has(heroId));
    cell.style.setProperty("--proficiency", state.profile.proficiency[heroId] ?? 1);
  }
  const enemyStart = state.observation?.localSide === "radiant" ? 5 : 0;
  const hasPerspective = state.observation?.localSide === "radiant" || state.observation?.localSide === "dire";
  combatCooldowns.hidden = !gamePhase || !hasPerspective;
  if (!combatCooldowns.hidden) {
    combatCooldowns.replaceChildren(...topSlots.slice(enemyStart, enemyStart + 5).map((rect) => {
      const hero = state.observation.slots[rect.index];
      const cooldown = state.visualCooldowns?.[hero?.heroId] ?? {};
      const slot = document.createElement("div");
      slot.className = "combat-cooldown-slot";
      slot.style.setProperty("--slot-x", `${rect.x * 100}vw`);
      slot.style.setProperty("--slot-y", `${(rect.y + rect.height + 0.004) * 100}vh`);
      slot.style.setProperty("--slot-width", `${rect.width * 100}vw`);
      slot.dataset.heroId = hero?.status === "recognized" ? String(hero.heroId) : "";
      const ultimate = document.createElement("span");
      ultimate.dataset.state = cooldown.ultimate?.state ?? "watching";
      ultimate.textContent = `大招 ${cooldown.ultimate?.label ?? "观察中"}`;
      const bkb = document.createElement("span");
      bkb.dataset.state = cooldown.bkb?.state ?? "watching";
      bkb.textContent = `BKB ${cooldown.bkb?.label ?? "观察中"}`;
      slot.append(ultimate, bkb);
      return slot;
    }));
  }
}

window.draftOverlay.onState(render);
render(await window.draftOverlay.getState());
