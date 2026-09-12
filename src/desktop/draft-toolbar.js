import { assignedRoleLabel } from "../assistant/draft-perspective.js";

const message = document.querySelector("#message");
const recommendations = document.querySelector("#recommendations");
const catalog = await window.draftOverlay.getCatalog();
const heroesById = new Map(catalog.heroes.map((hero) => [hero.id, hero]));

function recommendation(heroId) {
  const hero = heroesById.get(heroId);
  const element = document.createElement("span");
  element.textContent = hero?.name ?? `英雄 #${heroId}`;
  return element;
}

function render(state) {
  const side = state.observation?.localSide;
  const position = state.observation?.assignedPosition;
  document.querySelector("#role").textContent = side && side !== "unknown"
    ? `${side === "radiant" ? "天辉" : "夜魇"} · ${position?.certainty === "confirmed" ? assignedRoleLabel(position.value) : "职责识别中"}`
    : "正在识别本机阵营与分路职责";
  document.querySelector("#recommendation-count").textContent = state.recommendedHeroIds?.length
    ? `已点亮 ${state.recommendedHeroIds.length} 名推荐英雄`
    : "等待阵容与职责确认";
  const recommendedHeroIds = state.recommendedHeroIds?.slice(0, 5) ?? [];
  recommendations.replaceChildren(...recommendedHeroIds.map(recommendation));
  recommendations.hidden = recommendedHeroIds.length === 0;
  message.textContent = state.message;
  message.dataset.tone = "";
}

document.querySelector("#close").addEventListener("click", () => window.draftOverlay.close());
window.draftOverlay.onState(render);
render(await window.draftOverlay.getState());
