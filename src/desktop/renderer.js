import { presentStatus } from "./status-view.js";

const form = document.querySelector("#watcher-form");
const startButton = document.querySelector("#start-button");
const stopButton = document.querySelector("#stop-button");
const formError = document.querySelector("#form-error");
const runState = document.querySelector("#run-state");
const statusIndicator = document.querySelector("#status-indicator");
const statusTitle = document.querySelector("#status-title");
const statusDetail = document.querySelector("#status-detail");
const observedAt = document.querySelector("#observed-at");
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
  const presentation = presentStatus(state.status);
  runState.textContent = connecting ? "连接中" : running ? "监控中" : "未运行";
  runState.className = `run-state ${connecting ? "working" : running ? "active" : ""}`;
  statusIndicator.className = `status-indicator ${presentation.tone}`;
  statusTitle.textContent = presentation.title;
  statusDetail.textContent = presentation.detail;
  observedAt.textContent = state.status?.observedAt
    ? `最近检查：${new Date(state.status.observedAt).toLocaleString()}`
    : "";
  observedAt.dateTime = state.status?.observedAt ?? "";
  formError.hidden = !state.error;
  formError.textContent = state.error ?? "";
  startButton.disabled = connecting || running;
  startButton.textContent = connecting ? "正在连接…" : "开始监控";
  stopButton.disabled = !connecting && !running;
  for (const element of form.elements) {
    if (element !== stopButton) element.disabled = connecting || running;
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
    notifications: document.querySelector("#notifications").checked,
  };
  document.querySelector("#password").value = "";
  document.querySelector("#guard-code").value = "";
  document.querySelector("#web-api-key").value = "";
  const state = await window.watcher.start(configuration);
  render(state);
});

stopButton.addEventListener("click", async () => render(await window.watcher.stop()));

restoreSettings();
window.watcher.onState(render);
render(await window.watcher.getState());
