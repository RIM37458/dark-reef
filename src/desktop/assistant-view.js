import {
  cooldownObservation,
  formatGameTime,
  presentCooldown,
} from "../assistant/game-clock.js";
import { acceptClockSample } from "../assistant/clock-recognition.js";
import { analyzeDraft } from "../assistant/draft-analysis.js";
import { assignedRoleLabel, draftTeams, positionCandidateIds } from "../assistant/draft-perspective.js";
import { presentCaptureSources } from "./capture-source-selection.js";

const SLOT_COUNT = 5;

function option(value, label) {
  const element = document.createElement("option");
  element.value = String(value);
  element.textContent = label;
  return element;
}

function errorMessage(error) {
  return error instanceof Error && error.message ? error.message : "战术台未能完成这次操作。";
}

export function createAssistantView({ api, onBack, now = () => performance.now() }) {
  const slotsElement = document.querySelector("#enemy-slots");
  const clockElement = document.querySelector("#assistant-clock");
  const captureSource = document.querySelector("#capture-source");
  const overlayButton = document.querySelector("#assistant-overlay");
  const message = document.querySelector("#assistant-message");
  const radiantSlots = document.querySelector("#assistant-radiant-slots");
  const direSlots = document.querySelector("#assistant-dire-slots");
  const draftStatus = document.querySelector("#assistant-draft-status");
  const positionStatus = document.querySelector("#assistant-position");
  const draftRecommendations = document.querySelector("#assistant-draft-recommendations");
  let catalog;
  let draftProfile;
  let heroesById = new Map();
  let slots = Array.from({ length: SLOT_COUNT }, () => null);
  let observations = new Map();
  let anchorTime = 0;
  let anchorTick = now();
  let running = true;
  let initialized = false;
  let previousOcr;
  let draftTimer;
  let clockTimer;
  let clockBusy = false;
  let draftBusy = false;

  function gameTime() {
    return anchorTime + (running ? Math.floor((now() - anchorTick) / 1_000) : 0);
  }

  function setMessage(text, tone = "") {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function refreshTimers() {
    const current = gameTime();
    clockElement.textContent = formatGameTime(current);
    for (const element of slotsElement.querySelectorAll("[data-timer-key]")) {
      const presentation = presentCooldown(observations.get(element.dataset.timerKey), current);
      element.textContent = presentation.label;
      element.dataset.state = presentation.state;
    }
  }

  function abilityRow(ability, slotIndex) {
    const row = document.createElement("div");
    row.className = "ability-row";
    const image = document.createElement("img");
    image.src = ability.imageUrl ?? "";
    image.alt = "";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = ability.name;
    const values = document.createElement("small");
    values.textContent = `基础冷却 ${ability.cooldowns.join(" / ")}秒`;
    copy.append(name, values);
    const level = document.createElement("select");
    level.setAttribute("aria-label", `${ability.name} 技能等级`);
    level.append(option("", "等级未知"));
    ability.cooldowns.forEach((_cooldown, index) => level.append(option(index + 1, `Lv.${index + 1}`)));
    const savedLevel = slots[slotIndex]?.abilityLevels?.[ability.key];
    level.value = savedLevel ? String(savedLevel) : "";
    level.addEventListener("change", () => {
      const slot = slots[slotIndex];
      if (!slot) return;
      const abilityLevels = { ...slot.abilityLevels };
      if (level.value) abilityLevels[ability.key] = Number(level.value);
      else delete abilityLevels[ability.key];
      slots[slotIndex] = { ...slot, abilityLevels };
    });
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "ability-trigger";
    trigger.textContent = "目击施放";
    const timerKey = `${slotIndex}:${ability.key}`;
    trigger.addEventListener("click", () => {
      observations.set(timerKey, cooldownObservation({
        observedAt: gameTime(),
        cooldowns: ability.cooldowns,
        ...(level.value ? { level: Number(level.value) } : {}),
      }));
      refreshTimers();
    });
    const timer = document.createElement("span");
    timer.className = "ability-timer";
    timer.dataset.timerKey = timerKey;
    row.append(image, copy, level, trigger, timer);
    return row;
  }

  function renderSlots() {
    const cards = slots.map((slot, slotIndex) => {
      const card = document.createElement("article");
      card.className = "enemy-slot";
      const heading = document.createElement("div");
      heading.className = "enemy-slot-heading";
      const number = document.createElement("span");
      number.textContent = `敌方 ${slotIndex + 1}`;
      const recognition = document.createElement("strong");
      recognition.textContent = slot ? "识图已锁定" : "等待识图";
      heading.append(number, recognition);
      card.append(heading);
      const hero = slot ? heroesById.get(slot.heroId) : undefined;
      if (hero) {
        const identity = document.createElement("div");
        identity.className = "enemy-identity";
        const portrait = document.createElement("img");
        portrait.src = hero.imageUrl ?? "";
        portrait.alt = `${hero.name} 肖像`;
        const heroName = document.createElement("strong");
        heroName.textContent = hero.name;
        identity.append(portrait, heroName);
        card.append(identity);
        const abilities = document.createElement("div");
        abilities.className = "ability-list";
        abilities.append(...hero.abilities.map((ability) => abilityRow(ability, slotIndex)));
        card.append(abilities);
        const notes = document.createElement("textarea");
        notes.rows = 2;
        notes.maxLength = 500;
        notes.placeholder = "该英雄的人工判断与提醒";
        notes.value = slot.notes ?? "";
        notes.addEventListener("input", () => {
          slots[slotIndex] = { ...slots[slotIndex], notes: notes.value };
        });
        card.append(notes);
      } else {
        const empty = document.createElement("p");
        empty.className = "empty-slot";
        empty.textContent = "尚未识别到英雄。";
        card.append(empty);
      }
      return card;
    });
    slotsElement.replaceChildren(...cards);
    refreshTimers();
  }

  function draftHeroSlot(slot) {
    const element = document.createElement("div");
    const hero = slot.status === "recognized" ? heroesById.get(slot.heroId) : undefined;
    element.className = `assistant-draft-slot${hero ? "" : " empty"}`;
    if (hero) {
      const image = document.createElement("img");
      image.src = hero.imageUrl ?? "";
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      const label = document.createElement("span");
      label.textContent = hero.name;
      element.append(image, label);
    }
    return element;
  }

  function recommendationCard(entry) {
    const hero = heroesById.get(entry.heroId);
    const item = document.createElement("li");
    const image = document.createElement("img");
    image.src = hero?.imageUrl ?? "";
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = hero?.name ?? `英雄 #${entry.heroId}`;
    const reason = document.createElement("small");
    reason.textContent = entry.reasons[0] ?? "符合当前分路职责与队伍需要";
    copy.append(name, reason);
    item.append(image, copy);
    return item;
  }

  function syncRecognizedEnemies(enemyHeroIds) {
    const next = Array.from({ length: SLOT_COUNT }, (_, index) => {
      const heroId = enemyHeroIds[index];
      if (!heroId) return null;
      return slots[index]?.heroId === heroId ? slots[index] : { heroId, notes: "", abilityLevels: {} };
    });
    for (let index = 0; index < SLOT_COUNT; index += 1) {
      if (slots[index]?.heroId === next[index]?.heroId) continue;
      for (const key of observations.keys()) if (key.startsWith(`${index}:`)) observations.delete(key);
    }
    slots = next;
    renderSlots();
  }

  function renderDraftObservation(observation) {
    radiantSlots.replaceChildren(...observation.slots.slice(0, 5).map(draftHeroSlot));
    direSlots.replaceChildren(...observation.slots.slice(5, 10).map(draftHeroSlot));
    const teams = draftTeams(observation);
    syncRecognizedEnemies(teams.enemyHeroIds);
    if (observation.localSide === "unknown") {
      positionStatus.textContent = "本机槽位未确认";
      draftStatus.textContent = "已读取顶部十格，但尚未可靠识别本机高亮槽位；敌我与个人推荐保持锁定。";
      draftRecommendations.replaceChildren();
      return;
    }
    const position = observation.assignedPosition;
    if (!position || position.certainty !== "confirmed") {
      positionStatus.textContent = `${observation.localSide === "radiant" ? "天辉" : "夜魇"} · 职责未确认`;
      draftStatus.textContent = `已区分敌我并识别 ${teams.enemyHeroIds.length} 名敌方英雄；等待 Ranked Roles 职责标记后生成个人候选。`;
      draftRecommendations.replaceChildren();
      return;
    }
    positionStatus.textContent = `${observation.localSide === "radiant" ? "天辉" : "夜魇"} · ${assignedRoleLabel(position.value)}`;
    const candidateHeroIds = positionCandidateIds(catalog.heroes, position.value, draftProfile.proficiency);
    const analysis = analyzeDraft({
      radiantHeroIds: teams.radiantHeroIds,
      direHeroIds: teams.direHeroIds,
      catalog,
      profile: draftProfile,
      perspective: observation.localSide,
      matchups: catalog.matchups,
      candidateHeroIds,
    });
    draftStatus.textContent = `${analysis.warnings.join(" · ") || "基础职责齐备"} · 已排除 ${observation.bannedHeroIds.length} 名禁用英雄`;
    const banned = new Set(observation.bannedHeroIds);
    draftRecommendations.replaceChildren(...analysis.recommendations.filter(({ heroId }) => !banned.has(heroId)).slice(0, 4).map(recommendationCard));
  }

  async function observeDraft() {
    if (!captureSource.value || draftBusy) return;
    draftBusy = true;
    try {
      renderDraftObservation(await api.observeDraft(captureSource.value));
    } catch (error) {
      draftStatus.textContent = errorMessage(error);
    } finally {
      draftBusy = false;
    }
  }

  function startDraftObservation() {
    clearInterval(draftTimer);
    if (!captureSource.value) return;
    void observeDraft();
    draftTimer = setInterval(observeDraft, 1_200);
  }

  function stopDraftObservation() {
    clearInterval(draftTimer);
    draftTimer = undefined;
  }

  async function initialize() {
    try {
      [catalog, draftProfile] = await Promise.all([api.getCatalog(), api.getDraftProfile()]);
      heroesById = new Map(catalog.heroes.map((hero) => [hero.id, hero]));
      document.querySelector("#catalog-version").textContent = `DOTA ${catalog.patch} · 本地资料`;
      renderSlots();
      setInterval(refreshTimers, 250);
      initialized = true;
    } catch (error) {
      setMessage(errorMessage(error), "error");
    }
  }

  async function loadCaptureSources() {
    try {
      const presentation = presentCaptureSources(await api.listCaptureSources());
      captureSource.replaceChildren(option("", "选择 Dota 2 所在画面"), ...presentation.sources.map((source) => option(source.id, source.name)));
      captureSource.value = presentation.selectedId;
      overlayButton.disabled = !captureSource.value;
      setMessage(presentation.message, presentation.tone);
      startReadingScreen();
    } catch (error) {
      setMessage(errorMessage(error), "error");
    }
  }

  async function syncClockAutomatically() {
    if (!captureSource.value || clockBusy) return;
    clockBusy = true;
    try {
      const result = await api.readClock(captureSource.value);
      const recognizedAt = now();
      if (previousOcr && !acceptClockSample({
        previous: previousOcr.gameTime,
        sample: result.gameTime,
        elapsedSeconds: (recognizedAt - previousOcr.tick) / 1_000,
      })) return;
      previousOcr = { gameTime: result.gameTime, tick: recognizedAt };
      anchorTime = result.gameTime;
      anchorTick = recognizedAt;
      running = true;
      refreshTimers();
    } catch {
      // Draft screens often do not contain the in-match clock; the next sample retries silently.
    } finally {
      clockBusy = false;
    }
  }

  function startReadingScreen() {
    startDraftObservation();
    clearInterval(clockTimer);
    previousOcr = undefined;
    if (!captureSource.value) return;
    void syncClockAutomatically();
    clockTimer = setInterval(syncClockAutomatically, 5_000);
  }

  document.querySelector("#capture-refresh").addEventListener("click", loadCaptureSources);
  captureSource.addEventListener("focus", () => {
    if (captureSource.options.length === 1) void loadCaptureSources();
  });
  captureSource.addEventListener("change", () => {
    overlayButton.disabled = !captureSource.value;
    startReadingScreen();
  });
  overlayButton.addEventListener("click", async () => {
    try {
      if (!captureSource.value) throw new RangeError("尚未找到 Dota 2 画面");
      await api.openDraftOverlay(captureSource.value);
      setMessage("已覆盖到游戏画面。", "success");
    } catch (error) {
      setMessage(errorMessage(error), "error");
    }
  });
  document.querySelector("#assistant-back").addEventListener("click", () => {
    close();
    onBack();
  });

  function close() {
    stopDraftObservation();
    clearInterval(clockTimer);
    clockTimer = undefined;
  }

  return Object.freeze({
    async open() {
      if (!initialized) await initialize();
      else draftProfile = await api.getDraftProfile();
      await loadCaptureSources();
      overlayButton.focus();
    },
    close,
  });
}
