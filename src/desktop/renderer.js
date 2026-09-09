import {
  isTargetMarked,
  presentLiveMatch,
  presentStatus,
  screenForState,
} from "./status-view.js";
import { describeBattleChanges } from "../battle-feed.js";
import { renderTacticalMap } from "./tactical-map-view.js";

const form = document.querySelector("#watcher-form");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const demoButton = document.querySelector("#demo-button");
const formError = document.querySelector("#form-error");
const runState = document.querySelector("#run-state");
const statusIndicator = document.querySelector("#status-indicator");
const statusTitle = document.querySelector("#status-title");
const statusDetail = document.querySelector("#status-detail");
const observedAt = document.querySelector("#observed-at");
const prisonerAvatar = document.querySelector("#prisoner-avatar");
const prisonerSeal = document.querySelector("#prisoner-seal");
const prisonerName = document.querySelector("#prisoner-name");
const prisonerNumber = document.querySelector("#prisoner-number");
const prisonerCell = document.querySelector("#prisoner-cell");
const hazeMark = document.querySelector("#haze-mark");
const loginScreen = document.querySelector("#login-screen");
const watchScreen = document.querySelector("#watch-screen");
const matchPanel = document.querySelector("#match-panel");
const matchFields = Object.freeze({
  matchId: document.querySelector("#match-id"),
  gameTime: document.querySelector("#game-time"),
  radiantScore: document.querySelector("#radiant-score"),
  direScore: document.querySelector("#dire-score"),
  radiantLead: document.querySelector("#radiant-lead"),
  spectators: document.querySelector("#spectators"),
  radiantName: document.querySelector("#radiant-name"),
  direName: document.querySelector("#dire-name"),
  source: document.querySelector("#match-source"),
});
const targetSealed = document.querySelector("#target-sealed");
const targetDetails = document.querySelector("#target-details");
const targetHeroImage = document.querySelector("#target-hero-image");
const targetHeroName = document.querySelector("#target-hero-name");
const targetLevel = document.querySelector("#target-level");
const targetKda = document.querySelector("#target-kda");
const targetLastHits = document.querySelector("#target-last-hits");
const targetNetWorth = document.querySelector("#target-net-worth");
const equipmentList = document.querySelector("#equipment-list");
const battleFeed = document.querySelector("#battle-feed");
const rememberedFields = ["account-name", "friend-steam-id"];
let previousMatch;
let battleEntries = [];

function renderEquipment(items) {
  const slots = [];
  for (let index = 0; index < 9; index += 1) {
    const slot = document.createElement("li");
    const item = items[index];
    slot.className = item ? "equipment-slot occupied" : "equipment-slot";
    if (item) {
      if (item.imageUrl) {
        const image = document.createElement("img");
        image.src = item.imageUrl;
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        slot.append(image);
      }
      const label = document.createElement("span");
      label.textContent = item.name;
      label.title = item.name;
      slot.append(label);
    } else {
      slot.setAttribute("aria-label", "空装备栏");
      slot.textContent = "—";
    }
    slots.push(slot);
  }
  equipmentList.replaceChildren(...slots);
}

function renderTarget(target) {
  targetSealed.hidden = Boolean(target);
  targetDetails.hidden = !target;
  if (!target) return;
  targetHeroImage.hidden = !target.heroImageUrl;
  targetHeroImage.src = target.heroImageUrl ?? "";
  targetHeroImage.alt = target.heroImageUrl ? `${target.heroName} 英雄肖像` : "";
  targetHeroImage.referrerPolicy = "no-referrer";
  targetHeroName.textContent = target.heroName;
  targetLevel.textContent = target.level;
  targetKda.textContent = target.kda;
  targetLastHits.textContent = target.lastHits;
  targetNetWorth.textContent = target.netWorth;
  renderEquipment(target.items);
}

function renderBattleFeed(match, observedAt) {
  if (!match) {
    previousMatch = undefined;
    battleEntries = [];
    battleFeed.replaceChildren();
    return;
  }
  if (previousMatch?.matchId !== match.matchId) battleEntries = [];
  const timestamp = observedAt ? new Date(observedAt).toLocaleTimeString() : "当前";
  for (const event of describeBattleChanges(previousMatch, match)) {
    battleEntries.push(`${timestamp} · ${event}`);
  }
  battleEntries = battleEntries.slice(-8);
  battleFeed.replaceChildren(...battleEntries.map((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    return item;
  }));
  previousMatch = match;
}

function rememberSettings() {
  for (const id of rememberedFields) {
    localStorage.setItem(id, document.querySelector(`#${id}`).value.trim());
  }
}

function restoreSettings() {
  for (const id of rememberedFields) {
    document.querySelector(`#${id}`).value = localStorage.getItem(id) ?? "";
  }
}

function render(state) {
  const connecting = state.running === "connecting";
  const running = state.running === true;
  const demoRunning = state.running === "demo";
  const presentation = presentStatus(state.status);
  const screen = screenForState(state);
  loginScreen.hidden = screen !== "login";
  watchScreen.hidden = screen !== "watch";
  runState.textContent = connecting ? "接入中" : running ? "凝视中" : demoRunning ? "演习中" : "沉寂";
  runState.className = `run-state ${connecting || demoRunning ? "working" : running ? "active" : ""}`;
  statusIndicator.className = `status-indicator ${presentation.tone}`;
  statusTitle.textContent = presentation.title;
  statusDetail.textContent = presentation.detail;
  observedAt.textContent = state.status?.observedAt
    ? `最近一次回响 · ${new Date(state.status.observedAt).toLocaleString()}`
    : "";
  observedAt.dateTime = state.status?.observedAt ?? "";
  formError.hidden = !state.error;
  formError.textContent = state.error ?? "";
  startButton.disabled = connecting || running || demoRunning;
  startButton.textContent = connecting ? "正在下潜…" : "呈交许可并巡猎";
  demoButton.disabled = connecting || running || demoRunning;
  demoButton.textContent = demoRunning ? "小鱼人押送中…" : "押入小鱼人演示囚徒";
  stopButton.disabled = !connecting && !running && !demoRunning;
  for (const element of form.elements) {
    element.disabled = connecting || running || demoRunning;
  }
  const prisoner = state.prisoner;
  const marked = isTargetMarked(state.status);
  prisonerCell.classList.toggle("marked", marked);
  prisonerCell.classList.toggle("released", marked);
  prisonerCell.classList.toggle("hero-portrait", prisoner?.portraitShape === "hero");
  hazeMark.hidden = !marked;
  prisonerAvatar.hidden = !prisoner?.avatarDataUrl;
  prisonerAvatar.src = prisoner?.avatarDataUrl ?? "";
  prisonerAvatar.alt = prisoner?.personaName ? `${prisoner.personaName} 的头像` : "囚徒头像";
  prisonerSeal.hidden = Boolean(prisoner?.avatarDataUrl);
  prisonerName.textContent = prisoner?.personaName ?? "身份尚未显形";
  prisonerNumber.textContent = prisoner?.steamId64
    ? `NO. ${prisoner.steamId64}`
    : "NO. ———————————————";
  const liveMatch = presentLiveMatch(state.status);
  matchPanel.hidden = !liveMatch;
  if (liveMatch) {
    for (const [name, element] of Object.entries(matchFields)) {
      element.textContent = liveMatch[name];
    }
  }
  renderTarget(liveMatch?.target);
  renderTacticalMap(state.status?.match, { fast: demoRunning });
  renderBattleFeed(state.status?.match, state.status?.observedAt);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  rememberSettings();
  formError.hidden = true;
  const configuration = {
    accountName: document.querySelector("#account-name").value,
    friendSteamId64: document.querySelector("#friend-steam-id").value,
    password: document.querySelector("#password").value,
    guardCode: document.querySelector("#guard-code").value,
    webApiKey: document.querySelector("#web-api-key").value,
  };
  document.querySelector("#password").value = "";
  document.querySelector("#guard-code").value = "";
  document.querySelector("#web-api-key").value = "";
  const state = await window.watcher.start(configuration);
  render(state);
});

stopButton.addEventListener("click", async () => render(await window.watcher.stop()));
demoButton.addEventListener("click", async () => render(await window.watcher.demo()));

restoreSettings();
window.watcher.onState(render);
render(await window.watcher.getState());
