import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Dota } from "dotakit";
import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  safeStorage,
  screen,
  Tray,
} from "electron";

import { startWatcher } from "../app.js";
import { createDemoSequence } from "../demo-sequence.js";
import { fitImageWithin } from "../image-fit.js";
import { toPublicMatch } from "../live-snapshot.js";
import { loadSteamProfile } from "../steam-profile.js";
import { createConfiguredDesktopNotifier } from "../windows-notifier.js";
import { createAssistantCatalog } from "../assistant/catalog.js";
import { normalizeItemPopularitySnapshot } from "../assistant/item-popularity-library.js";
import { normalizeMatchupSnapshot } from "../assistant/matchup-library.js";
import { createPlanStore } from "../assistant/plan-store.js";
import { createScreenClockReader } from "../assistant/screen-clock-reader.js";
import { createDraftScreenReader } from "../assistant/draft-screen-reader.js";
import { createTrainingCaptureRecorder } from "../assistant/training-capture-recorder.js";
import { createDraftRoleReader } from "../assistant/draft-role-recognition.js";
import { analyzeDraft } from "../assistant/draft-analysis.js";
import { draftTeams, positionCandidateIds } from "../assistant/draft-perspective.js";
import { adjustDraftCalibration, createDraftGrid, draftCellRects, draftTopSlotRects, normalizeDraftCalibration } from "../assistant/draft-layout.js";
import { createDraftProfileStore } from "../assistant/draft-profile-store.js";
import { BUILTIN_DRAFT_CATEGORIES, normalizeDraftSelection } from "../assistant/draft-recommendation.js";
import { createHeroReferenceLibrary } from "../assistant/hero-reference-library.js";
import { normalizeExpertSynergyLibrary } from "../assistant/expert-synergy-library.js";
import { normalizeExpertCounterLibrary } from "../assistant/expert-counter-library.js";
import { createDesktopConfig } from "./desktop-config.js";
import { createDotaWindowLocator } from "./dota-window-locator.js";
import { resolveAppVariant } from "./app-variant.js";
import { createSecureSessionStore } from "./secure-session-store.js";
import { assertTrustedIpcSender } from "./ipc-trust.js";

const DEMO_STEAM_ID64 = "76561197960265735";
const directory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.resolve(directory, "../../assets");
const packageMetadata = JSON.parse(readFileSync(path.join(app.getAppPath(), "package.json"), "utf8"));
const appVariant = resolveAppVariant(packageMetadata.appVariant);

function createDesktopCatalog() {
  const catalog = createAssistantCatalog();
  const file = path.join(assetsDirectory, "data", "opendota-pro-matchups.json");
  try {
    const itemFile = path.join(assetsDirectory, "data", "opendota-pro-items.json");
    const synergyFile = path.join(assetsDirectory, "data", "expert-synergy-rules.json");
    const counterFile = path.join(assetsDirectory, "data", "expert-counter-rules.json");
    return Object.freeze({
      ...catalog,
      matchups: normalizeMatchupSnapshot(JSON.parse(readFileSync(file, "utf8"))),
      itemPopularity: normalizeItemPopularitySnapshot(JSON.parse(readFileSync(itemFile, "utf8"))),
      expertSynergy: normalizeExpertSynergyLibrary(JSON.parse(readFileSync(synergyFile, "utf8"))),
      expertCounters: normalizeExpertCounterLibrary(JSON.parse(readFileSync(counterFile, "utf8"))),
    });
  } catch {
    return catalog;
  }
}

function createDisabledDesktopStatusServer() {
  return Object.freeze({
    listen: () => Promise.resolve(),
    close: () => Promise.resolve(),
  });
}

async function loadHeroReferenceLibrary() {
  const portraitDirectory = path.join(assetsDirectory, "hero-portraits");
  const manifest = JSON.parse(readFileSync(path.join(portraitDirectory, "manifest.json"), "utf8"));
  return createHeroReferenceLibrary({
    directory: portraitDirectory,
    manifest,
    loadImage: async (file) => {
      const image = nativeImage.createFromPath(file);
      if (image.isEmpty()) throw new RangeError(`英雄肖像无法读取：${path.basename(file)}`);
      const resized = image.resize({ width: 128, height: 72, quality: "best" });
      const { width, height } = resized.getSize();
      return Object.freeze({ width, height, data: Buffer.from(resized.getBitmap()) });
    },
  });
}

let mainWindow;
let tray;
let watcher;
let demoSequence;
let quitting = false;
let startRevision = 0;
let planStore;
let assistantCatalog;
let screenClockReader;
let dotaWindowLocator;
let draftScreenReader;
let draftRoleReader;
let trainingCaptureRecorder;
let draftProfileStore;
let secureSessionStore;
let draftOverlayWindow;
let draftToolbarWindow;
let draftState = Object.freeze({
  active: false,
  sourceId: "",
  selectedCategoryIds: Object.freeze([]),
  unavailableHeroIds: Object.freeze([]),
  recommendedHeroIds: Object.freeze([]),
  calibration: normalizeDraftCalibration(),
  message: "等待阵营、职责与选人信息。",
  profile: Object.freeze({ schemaVersion: 1, categories: Object.freeze([]), proficiency: Object.freeze({}) }),
  trainingCapture: Object.freeze({ running: false }),
});
let desktopState = Object.freeze({ running: false, status: null, prisoner: null, error: null });

function handleTrustedIpc(channel, listener) {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event, [mainWindow, draftOverlayWindow, draftToolbarWindow]);
    return listener(event, ...args);
  });
}

function publicStatus(status, friendSteamId64) {
  if (!status || typeof status !== "object") return null;
  return Object.freeze({
    phase: status.phase,
    observedAt: status.observedAt,
    serverSteamId: status.serverSteamId ? String(status.serverSteamId) : undefined,
    source: status.source,
    reason: status.reason,
    match: toPublicMatch(status.game, friendSteamId64),
  });
}

function publish(update) {
  desktopState = Object.freeze({ ...desktopState, ...update });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("watcher:state", desktopState);
  }
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function restrictWindowContents(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 780,
    minWidth: 720,
    minHeight: 660,
    show: false,
    backgroundColor: "#020608",
    title: appVariant.title,
    icon: path.join(assetsDirectory, "icon.png"),
    webPreferences: {
      preload: path.join(directory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  restrictWindowContents(mainWindow);
  mainWindow.loadFile(path.join(directory, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(assetsDirectory, "icon.png"));
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip(appVariant.title);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `打开${appVariant.productName}`, click: showWindow },
      { type: "separator" },
      {
        label: "退出",
        click: async () => {
          quitting = true;
          await stopMonitoring();
          app.quit();
        },
      },
    ]),
  );
  tray.on("double-click", showWindow);
}

function publishDraft(update) {
  draftState = Object.freeze({ ...draftState, ...update });
  for (const window of [draftOverlayWindow, draftToolbarWindow, mainWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send("draft:state", draftState);
  }
  return draftState;
}

async function draftDisplay(sourceId) {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: { width: 0, height: 0 },
  });
  const source = sources.find(({ id }) => id === sourceId);
  if (!source) throw new RangeError("所选 Dota 2 画面当前不可用");
  const displayId = Number(source?.display_id);
  return screen.getAllDisplays().find(({ id }) => id === displayId) ?? screen.getPrimaryDisplay();
}

function closeDraftOverlay({ restoreMain = false } = {}) {
  const overlay = draftOverlayWindow;
  const toolbar = draftToolbarWindow;
  draftOverlayWindow = undefined;
  draftToolbarWindow = undefined;
  if (overlay && !overlay.isDestroyed()) overlay.destroy();
  if (toolbar && !toolbar.isDestroyed()) toolbar.destroy();
  void trainingCaptureRecorder?.stop();
  draftScreenReader?.clear();
  const state = publishDraft({
    active: false,
    unavailableHeroIds: Object.freeze([]),
    trainingCapture: Object.freeze({ running: false }),
  });
  if (restoreMain) showWindow();
  return state;
}

async function openDraftOverlay(sourceId) {
  if (typeof sourceId !== "string" || !sourceId) throw new RangeError("请先选择 Dota 2 所在画面");
  if (draftOverlayWindow && !draftOverlayWindow.isDestroyed()) {
    if (sourceId === draftState.sourceId) {
      draftToolbarWindow?.showInactive();
      return publishDraft({ active: true });
    }
    closeDraftOverlay();
  }
  const display = await draftDisplay(sourceId);
  const trainingCapture = await trainingCaptureRecorder.start(sourceId);
  draftOverlayWindow = new BrowserWindow({
    ...display.bounds,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    focusable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(directory, "draft-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  draftOverlayWindow.setIgnoreMouseEvents(true, { forward: true });
  draftOverlayWindow.setContentProtection(true);
  draftOverlayWindow.setAlwaysOnTop(true, "pop-up-menu");
  restrictWindowContents(draftOverlayWindow);
  draftOverlayWindow.loadFile(path.join(directory, "draft-overlay.html"));

  const toolbarWidth = 570;
  draftToolbarWindow = new BrowserWindow({
    x: display.workArea.x + Math.max(0, display.workArea.width - toolbarWidth - 24),
    y: display.workArea.y + 32,
    width: toolbarWidth,
    height: 150,
    minWidth: 480,
    minHeight: 130,
    show: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#071012",
    icon: path.join(assetsDirectory, "icon.png"),
    webPreferences: {
      preload: path.join(directory, "draft-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  draftToolbarWindow.setContentProtection(true);
  draftToolbarWindow.setAlwaysOnTop(true, "pop-up-menu");
  restrictWindowContents(draftToolbarWindow);
  draftToolbarWindow.loadFile(path.join(directory, "draft-toolbar.html"));
  draftToolbarWindow.on("closed", () => {
    if (draftState.active) closeDraftOverlay({ restoreMain: true });
  });
  let ready = 0;
  const reveal = () => {
    ready += 1;
    if (ready !== 2) return;
    draftOverlayWindow?.showInactive();
    draftToolbarWindow?.showInactive();
    mainWindow?.hide();
  };
  draftOverlayWindow.once("ready-to-show", reveal);
  draftToolbarWindow.once("ready-to-show", reveal);
  return publishDraft({
    active: true,
    sourceId,
    trainingCapture,
    message: "覆盖已开启；视觉训练仅记录已验证的 Dota 2 窗口。",
  });
}

function draftCells() {
  return draftCellRects(createDraftGrid(assistantCatalog.heroes), draftState.calibration);
}

function safeError(error) {
  if (error?.name === "GuardRequiredError") {
    return "守卫拒绝放行：请铭刻「守卫密令」，再度开启监视。";
  }
  if (error?.name === "SteamLoginError") {
    return "看守者身份未获承认：检查铭牌、血印与守卫密令。";
  }
  if (error instanceof Error && /required|must be|between/.test(error.message)) {
    return error.message;
  }
  return "监视之眼未能苏醒：检查暗渠网络与看守者契约后重试。";
}

async function startMonitoring(input) {
  if (watcher || desktopState.running) return desktopState;
  const revision = ++startRevision;
  publish({ running: "connecting", status: { phase: "starting" }, error: null });

  try {
    const config = createDesktopConfig(input, {
      sessionFile: path.join(app.getPath("userData"), "steam-session.json"),
    });
    publish({ prisoner: { steamId64: config.friendSteamId64 } });
    const startedWatcher = await startWatcher(config, {
      loginDota: Dota.login,
      notify: createConfiguredDesktopNotifier({
        enabled: config.windowsNotifications,
        NotificationImpl: Notification,
        onClick: showWindow,
      }),
      tokenStore: secureSessionStore,
      serverFactory: createDisabledDesktopStatusServer,
      onConnected: (bot) => {
        void loadSteamProfile({
          apiKey: config.steamWebApiKey,
          steamId64: config.friendSteamId64,
          steamUser: bot.steam.user,
        }).then((prisoner) => {
          if (revision === startRevision) publish({ prisoner });
        });
      },
      onStatus: (status) => {
        if (revision === startRevision) {
          publish({ status: publicStatus(status, config.friendSteamId64), error: null });
        }
      },
    });
    if (revision !== startRevision) {
      await startedWatcher.stop();
      return desktopState;
    }
    watcher = startedWatcher;
    publish({ running: true, status: publicStatus(watcher.getStatus(), config.friendSteamId64), error: null });
  } catch (error) {
    if (revision !== startRevision) return desktopState;
    watcher = undefined;
    publish({ running: false, status: null, error: safeError(error) });
  }
  return desktopState;
}

function startDemo() {
  if (watcher || desktopState.running) return desktopState;
  const revision = ++startRevision;
  const avatar = nativeImage.createFromPath(path.join(assetsDirectory, "demo-prisoner-bot.png"));
  const avatarDataUrl = avatar
    .resize({ ...fitImageWithin(avatar.getSize(), 256), quality: "best" })
    .toDataURL();
  const prisoner = Object.freeze({
    steamId64: "DARK-REEF-ESCAPEE-01",
    personaName: "小鱼人 · 斯拉克（演示）",
    avatarDataUrl,
    portraitShape: "hero",
  });
  publish({ running: "demo", prisoner, error: null });
  demoSequence = createDemoSequence({
    onFrame: ({ status }) => {
      if (revision !== startRevision) return;
      publish({ status: publicStatus(status, DEMO_STEAM_ID64), error: null });
    },
  });
  return desktopState;
}

async function stopMonitoring() {
  startRevision += 1;
  demoSequence?.cancel();
  demoSequence = undefined;
  const current = watcher;
  watcher = undefined;
  if (current) await current.stop();
  publish({ running: false, status: null, error: null });
  return desktopState;
}

app.setName(appVariant.productName);
app.setPath("userData", path.join(app.getPath("appData"), appVariant.userDataDirectory));
app.setAppUserModelId(appVariant.appId);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("activate", showWindow);
  app.whenReady().then(async () => {
    assistantCatalog = createDesktopCatalog();
    if (appVariant.allowsAssistant) {
      planStore = createPlanStore({
        file: path.join(app.getPath("userData"), "assistant-plans.json"),
      });
      draftProfileStore = createDraftProfileStore({
        file: path.join(app.getPath("userData"), "draft-profile.json"),
      });
      try {
        draftState = Object.freeze({ ...draftState, profile: await draftProfileStore.load() });
      } catch {
        draftState = Object.freeze({ ...draftState, message: "私人英雄池文件损坏，已使用空白英雄池；原文件未覆盖。" });
      }
      screenClockReader = createScreenClockReader({
        getSources: desktopCapturer.getSources,
        cachePath: path.join(app.getPath("userData"), "ocr-cache"),
      });
      dotaWindowLocator = createDotaWindowLocator();
      trainingCaptureRecorder = createTrainingCaptureRecorder({
        directory: path.join(app.getPath("userData"), "visual-training-captures"),
        getSources: desktopCapturer.getSources,
        locate: (sources) => dotaWindowLocator.locate(sources),
      });
      const heroReferenceLibrary = await loadHeroReferenceLibrary();
      draftRoleReader = createDraftRoleReader({
        cachePath: path.join(app.getPath("userData"), "ocr-cache", "draft-role"),
      });
      draftScreenReader = createDraftScreenReader({
        getSources: desktopCapturer.getSources,
        heroReferences: heroReferenceLibrary.references,
        roleReader: draftRoleReader,
      });
    }
    if (appVariant.allowsMonitoring) {
      const userData = app.getPath("userData");
      secureSessionStore = createSecureSessionStore({
        file: path.join(userData, "steam-session.encrypted"),
        legacyFile: path.join(userData, "steam-session.json"),
        encryption: safeStorage,
      });
    }
    handleTrustedIpc("app:get-variant", () => appVariant);
    handleTrustedIpc("watcher:get-state", () => desktopState);
    handleTrustedIpc("watcher:stop", () => stopMonitoring());
    handleTrustedIpc("assistant:get-catalog", () => assistantCatalog);
    if (appVariant.allowsDemo) handleTrustedIpc("watcher:demo", () => startDemo());
    if (appVariant.allowsMonitoring) handleTrustedIpc("watcher:start", (_event, input) => startMonitoring(input));
    if (appVariant.allowsAssistant) {
      handleTrustedIpc("assistant:list-plans", () => planStore.list());
      handleTrustedIpc("assistant:save-plan", (_event, plan) => planStore.save(plan));
      handleTrustedIpc("assistant:delete-plan", (_event, id) => planStore.delete(id));
      handleTrustedIpc("assistant:export-plan", (_event, id) => planStore.exportJson(id));
      handleTrustedIpc("assistant:import-plan", (_event, raw) => planStore.importJson(raw));
      handleTrustedIpc("assistant:list-capture-sources", async () => {
        const sources = await screenClockReader.listSources();
        return Object.freeze({ sources, binding: await dotaWindowLocator.locate(sources) });
      });
      handleTrustedIpc("assistant:read-clock", (_event, sourceId) => screenClockReader.read(sourceId));
      handleTrustedIpc("assistant:observe-draft", async (_event, sourceId) => {
        const observation = await draftScreenReader.observe(sourceId, {
          cells: draftCells(),
          slotRects: draftTopSlotRects(),
          mode: "ranked-roles",
        });
        const teams = draftTeams(observation);
        const position = observation.assignedPosition;
        let recommendedHeroIds = [];
        if (observation.localSide !== "unknown" && position?.certainty === "confirmed") {
          const analysis = analyzeDraft({
            radiantHeroIds: teams.radiantHeroIds,
            direHeroIds: teams.direHeroIds,
            catalog: assistantCatalog,
            profile: draftState.profile,
            perspective: observation.localSide,
            matchups: assistantCatalog.matchups,
            candidateHeroIds: positionCandidateIds(assistantCatalog.heroes, position.value, draftState.profile.proficiency),
          });
          const banned = new Set(observation.bannedHeroIds);
          recommendedHeroIds = analysis.recommendations.filter(({ heroId }) => !banned.has(heroId)).map(({ heroId }) => heroId);
        }
        publishDraft({
          sourceId,
          unavailableHeroIds: observation.bannedHeroIds,
          recommendedHeroIds: Object.freeze(recommendedHeroIds),
          observation,
          message: observation.localSide === "unknown"
            ? "已读取阵容；尚未可靠定位本机玩家槽位。"
            : `已定位${observation.localSide === "radiant" ? "天辉" : "夜魇"}本机槽位。`,
        });
        return observation;
      });
      handleTrustedIpc("draft:get-state", () => draftState);
      handleTrustedIpc("draft:open", (_event, sourceId) => openDraftOverlay(sourceId));
      handleTrustedIpc("draft:close", () => closeDraftOverlay({ restoreMain: true }));
      handleTrustedIpc("draft:set-categories", (_event, categoryIds) => publishDraft({
        selectedCategoryIds: normalizeDraftSelection(categoryIds, draftState.profile.categories),
      }));
      handleTrustedIpc("draft:adjust", (_event, adjustment) => publishDraft({
        calibration: adjustDraftCalibration(draftState.calibration, adjustment),
      }));
      handleTrustedIpc("draft:calibrate", async () => {
        const result = await draftScreenReader.calibrate(draftState.sourceId, draftCells());
        publishDraft({ message: `已封存 ${result.cellCount} 枚英雄格的空白阵列。` });
        return result;
      });
      handleTrustedIpc("draft:scan", async () => {
        const result = await draftScreenReader.scan(draftState.sourceId, draftCells());
        publishDraft({
          unavailableHeroIds: result.unavailableHeroIds,
          message: `识图发现 ${result.unavailableHeroIds.length} 枚视觉状态改变的英雄格；请目视复核。`,
        });
        return result;
      });
      handleTrustedIpc("draft:clear-unavailable", () => publishDraft({ unavailableHeroIds: Object.freeze([]) }));
      handleTrustedIpc("draft:get-profile", () => draftState.profile);
      handleTrustedIpc("draft:save-profile", async (_event, profile) => {
        const saved = await draftProfileStore.save(profile);
        const allowed = new Set([
          ...BUILTIN_DRAFT_CATEGORIES.map(({ id }) => id),
          ...saved.categories.map(({ id }) => id),
        ]);
        publishDraft({
          profile: saved,
          selectedCategoryIds: Object.freeze(draftState.selectedCategoryIds.filter((id) => allowed.has(id))),
          message: "私人英雄池已更新。",
        });
        return saved;
      });
    }
    createWindow();
    createTray();
  });
  app.on("window-all-closed", () => {});
  app.on("before-quit", () => {
    void trainingCaptureRecorder?.stop();
    void screenClockReader?.close();
    void draftRoleReader?.close();
  });
}
