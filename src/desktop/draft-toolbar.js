import { assignedRoleLabel } from "../assistant/draft-perspective.js";

const message = document.querySelector("#message");

function render(state) {
  const side = state.observation?.localSide;
  const position = state.observation?.assignedPosition;
  document.querySelector("#role").textContent = side && side !== "unknown"
    ? `${side === "radiant" ? "天辉" : "夜魇"} · ${position?.certainty === "confirmed" ? assignedRoleLabel(position.value) : "职责识别中"}`
    : "正在识别本机阵营与分路职责";
  document.querySelector("#recommendation-count").textContent = state.recommendedHeroIds?.length
    ? `已点亮 ${state.recommendedHeroIds.length} 名推荐英雄`
    : "等待阵容与职责确认";
  message.textContent = state.message;
  message.dataset.tone = "";
}

document.querySelector("#close").addEventListener("click", () => window.draftOverlay.close());
window.draftOverlay.onState(render);
render(await window.draftOverlay.getState());
