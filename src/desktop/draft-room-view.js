import { createDraftDemoFrames } from "../demo-draft.js";
import { createDraftGrid } from "../assistant/draft-layout.js";
import { presentCaptureSources } from "./capture-source-selection.js";
import { presentDraftRoomMode } from "./draft-room-mode.js";

function option(value, label) {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = label;
  return element;
}

function setMessage(element, text, tone = "") {
  element.textContent = text;
  element.dataset.tone = tone;
}

export function createDraftRoomView({ api, onBack, onBattleDemo }) {
  const message = document.querySelector("#draft-room-message");
  const nextButton = document.querySelector("#draft-next");
  const autoButton = document.querySelector("#draft-auto");
  const battleButton = document.querySelector("#draft-battle-demo");
  const sourceSelect = document.querySelector("#draft-capture-source");
  let catalog;
  let heroesById;
  let frames;
  let frameIndex = 0;
  let autoTimer;

  function heroSlot(heroId) {
    const slot = document.createElement("div");
    slot.className = `draft-slot${heroId ? "" : " empty"}`;
    const hero = heroesById.get(heroId);
    if (hero) {
      const image = document.createElement("img");
      image.src = hero.imageUrl ?? "";
      image.alt = "";
      image.referrerPolicy = "no-referrer";
      const name = document.createElement("span");
      name.textContent = hero.name;
      slot.append(image, name);
    }
    return slot;
  }

  function renderTeam(element, ids) {
    const padded = [...ids, ...Array.from({ length: Math.max(0, 5 - ids.length) }, () => undefined)];
    element.replaceChildren(...padded.slice(0, 5).map(heroSlot));
  }

  function recommendationRow(entry) {
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
    reason.textContent = entry.reasons[0] ?? "按当前阵容的职责缺口排序";
    const score = document.createElement("b");
    score.textContent = entry.score.toFixed(1);
    copy.append(name, reason);
    item.append(image, copy, score);
    return item;
  }

  function renderHeroBoard(picked = new Set(), recommended = new Set()) {
    const groups = createDraftGrid(catalog.heroes).map((group) => {
      const section = document.createElement("section");
      section.className = `draft-grid-group attribute-${group.id}`;
      const heading = document.createElement("h4");
      heading.textContent = group.name;
      const heroGrid = document.createElement("div");
      heroGrid.className = "draft-grid-group-heroes";
      heroGrid.style.setProperty("--hero-columns", group.columns);
      heroGrid.append(...group.cells.map(({ heroId, row, column }) => {
        const hero = heroesById.get(heroId);
        const card = document.createElement("div");
        card.className = "draft-grid-hero";
        card.dataset.row = String(row);
        card.dataset.column = String(column);
        card.title = `${hero.name} · ${group.name} ${row}行 ${column}列`;
        card.classList.toggle("recommended", recommended.has(hero.id));
        card.classList.toggle("picked", picked.has(hero.id));
        const image = document.createElement("img");
        image.src = hero.imageUrl ?? "";
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        const name = document.createElement("span");
        name.textContent = hero.name;
        card.append(image, name);
        return card;
      }));
      section.append(heading, heroGrid);
      return section;
    });
    document.querySelector("#draft-hero-grid").replaceChildren(...groups);
  }

  function renderFrame() {
    const frame = frames[frameIndex];
    const picked = new Set([...frame.radiantHeroIds, ...frame.direHeroIds]);
    const recommended = new Set(frame.analysis.recommendations.slice(0, 8).map(({ heroId }) => heroId));
    renderTeam(document.querySelector("#draft-radiant-slots"), frame.radiantHeroIds);
    renderTeam(document.querySelector("#draft-dire-slots"), frame.direHeroIds);
    document.querySelector("#draft-step").textContent = `${frame.step} / 10`;
    document.querySelector("#draft-stage-note").textContent = frame.complete
      ? "十枚战印已锁定"
      : `下一手 · ${frame.currentPick?.team === "radiant" ? "天辉" : "夜魇"}`;
    const warnings = frame.analysis.warnings.length ? frame.analysis.warnings.join(" · ") : "基础职责齐备";
    const itemText = frame.analysis.items[0] ? ` · 装备提示：${frame.analysis.items[0].name}` : "";
    document.querySelector("#draft-analysis-warning").textContent = `${warnings}${itemText}`;
    document.querySelector("#draft-recommendations").replaceChildren(
      ...frame.analysis.recommendations.slice(0, 4).map(recommendationRow),
    );
    renderHeroBoard(picked, recommended);
    nextButton.disabled = frame.complete;
    battleButton.disabled = !frame.complete;
  }

  function stopAuto() {
    clearInterval(autoTimer);
    autoTimer = undefined;
    autoButton.textContent = "自动推演";
  }

  function applyMode(mode) {
    const presentation = presentDraftRoomMode(mode);
    document.querySelector("#draft-room-index").textContent = presentation.eyebrow;
    document.querySelector("#draft-room-title").textContent = presentation.title;
    document.querySelector("#draft-mode-stamp").textContent = presentation.badge;
    document.querySelector("#draft-hero-board-title").textContent = presentation.boardTitle;
    document.querySelector("#draft-live-brief").hidden = presentation.showDemo;
    document.querySelector("#draft-demo-stage").hidden = !presentation.showDemo;
    document.querySelector("#draft-demo-analysis").hidden = !presentation.showDemo;
    document.querySelector("#draft-demo-controls").hidden = !presentation.showDemo;
    document.querySelector("#draft-live-controls").hidden = !presentation.showCapture;
    setMessage(message, presentation.message, mode === "demo" ? "success" : "");
  }

  function advance() {
    if (frameIndex >= frames.length - 1) return stopAuto();
    frameIndex += 1;
    renderFrame();
    if (frameIndex >= frames.length - 1) stopAuto();
  }

  async function loadCaptureSources() {
    try {
      const presentation = presentCaptureSources(await api.listCaptureSources());
      sourceSelect.replaceChildren(option("", "选择 Dota 2 所在画面"), ...presentation.sources.map((source) => option(source.id, source.name)));
      sourceSelect.value = presentation.selectedId;
      setMessage(message, presentation.message, presentation.tone);
    } catch (error) {
      setMessage(message, error instanceof Error ? error.message : "画面读取失败", "error");
    }
  }

  async function initialize() {
    catalog = await api.getCatalog();
    heroesById = new Map(catalog.heroes.map((hero) => [hero.id, hero]));
    const source = catalog.matchups;
    document.querySelector("#draft-data-stamp").textContent = source
      ? `${source.provider} · 职业赛 · ≥${source.minimumSample}局 · ${source.fetchedAt.slice(0, 10)}`
      : "客观样本库暂不可用";
  }

  nextButton.addEventListener("click", advance);
  autoButton.addEventListener("click", () => {
    if (autoTimer) return stopAuto();
    autoButton.textContent = "暂停推演";
    autoTimer = setInterval(advance, 850);
  });
  battleButton.addEventListener("click", () => {
    stopAuto();
    onBattleDemo();
  });
  document.querySelector("#draft-room-back").addEventListener("click", () => {
    stopAuto();
    onBack();
  });
  document.querySelector("#draft-source-refresh").addEventListener("click", async () => {
    await loadCaptureSources();
  });
  sourceSelect.addEventListener("focus", () => {
    if (sourceSelect.options.length === 1) void loadCaptureSources();
  });
  document.querySelector("#draft-deploy").addEventListener("click", async () => {
    try {
      if (!sourceSelect.value) throw new RangeError("请先选择 Dota 2 所在画面");
      await api.openDraftOverlay(sourceSelect.value);
      setMessage(message, "选人投影已部署。", "success");
    } catch (error) {
      setMessage(message, error instanceof Error ? error.message : "投影部署失败", "error");
    }
  });

  return Object.freeze({
    async openDemo() {
      if (!catalog) await initialize();
      stopAuto();
      applyMode("demo");
      frames = createDraftDemoFrames(catalog);
      frameIndex = 0;
      renderFrame();
    },
    async open() {
      if (!catalog) await initialize();
      stopAuto();
      applyMode("live");
      frames = undefined;
      renderHeroBoard();
      await loadCaptureSources();
    },
  });
}
