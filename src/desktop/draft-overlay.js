import { createDraftGrid } from "../assistant/draft-layout.js";
import { draftTopSlotRects } from "../assistant/draft-layout.js";
import { recommendDraftHeroes } from "../assistant/draft-recommendation.js";

const board = document.querySelector("#draft-board");
const combatCooldowns = document.querySelector("#combat-cooldowns");
const catalog = await window.draftOverlay.getCatalog();
const groups = createDraftGrid(catalog.heroes);
const topSlots = draftTopSlotRects();

function heroCell(heroId) {
  const cell = document.createElement("div");
  cell.className = "draft-hero";
  cell.dataset.heroId = String(heroId);
  return cell;
}

for (const group of groups) {
  const section = document.createElement("section");
  section.className = `draft-group attribute-${group.id}`;
  const title = document.createElement("h2");
  title.textContent = group.name;
  const grid = document.createElement("div");
  grid.className = "draft-grid";
  grid.style.setProperty("--columns", group.columns);
  grid.append(...group.cells.map(({ heroId, row, column }) => {
    const cell = heroCell(heroId);
    cell.dataset.row = String(row);
    cell.dataset.column = String(column);
    return cell;
  }));
  section.append(title, grid);
  board.append(section);
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
  board.hidden = gamePhase;
  board.style.setProperty("--board-x", `${state.calibration.x * 100}vw`);
  board.style.setProperty("--board-y", `${state.calibration.y * 100}vh`);
  board.style.setProperty("--board-width", `${state.calibration.width * 100}vw`);
  board.style.setProperty("--board-height", `${state.calibration.height * 100}vh`);
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
