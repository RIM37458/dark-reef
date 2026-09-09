import {
  isTargetMarked,
  presentLiveMatch,
  presentStatus,
  screenForState,
} from "./status-view.js";

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
const rememberedFields = ["account-name", "friend-steam-id"];

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
