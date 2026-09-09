import path from "node:path";
import { fileURLToPath } from "node:url";

import { Dota } from "dotakit";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from "electron";

import { startWatcher } from "../app.js";
import { loadSteamProfile } from "../steam-profile.js";
import { createDesktopNotifier } from "../windows-notifier.js";
import { createDesktopConfig } from "./desktop-config.js";

const APP_ID = "com.codex.dota-friend-watcher";
const directory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.resolve(directory, "../../assets");

let mainWindow;
let tray;
let watcher;
let quitting = false;
let startRevision = 0;
let desktopState = Object.freeze({ running: false, status: null, prisoner: null, error: null });

function publicStatus(status) {
  if (!status || typeof status !== "object") return null;
  return Object.freeze({
    phase: status.phase,
    observedAt: status.observedAt,
    serverSteamId: status.serverSteamId ? String(status.serverSteamId) : undefined,
    source: status.source,
    reason: status.reason,
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 780,
    minWidth: 720,
    minHeight: 660,
    show: false,
    backgroundColor: "#020608",
    title: "暗黑之礁 · 监控室",
    icon: path.join(assetsDirectory, "icon.png"),
    webPreferences: {
      preload: path.join(directory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => event.preventDefault());
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
  tray.setToolTip("暗黑之礁 · 监控室");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打开暗黑之礁监控室", click: showWindow },
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
  if (watcher || desktopState.running === "connecting") return desktopState;
  const revision = ++startRevision;
  publish({ running: "connecting", status: { phase: "starting" }, error: null });

  try {
    const config = createDesktopConfig(input, {
      sessionFile: path.join(app.getPath("userData"), "steam-session.json"),
    });
    publish({ prisoner: { steamId64: config.friendSteamId64 } });
    const notify = config.windowsNotifications
      ? createDesktopNotifier({ NotificationImpl: Notification, onClick: showWindow })
      : () => false;
    const startedWatcher = await startWatcher(config, {
      loginDota: Dota.login,
      notify,
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
          publish({ status: publicStatus(status), error: null });
        }
      },
    });
    if (revision !== startRevision) {
      await startedWatcher.stop();
      return desktopState;
    }
    watcher = startedWatcher;
    publish({ running: true, status: publicStatus(watcher.getStatus()), error: null });
  } catch (error) {
    if (revision !== startRevision) return desktopState;
    watcher = undefined;
    publish({ running: false, status: null, error: safeError(error) });
  }
  return desktopState;
}

async function stopMonitoring() {
  startRevision += 1;
  const current = watcher;
  watcher = undefined;
  if (current) await current.stop();
  publish({ running: false, status: null, error: null });
  return desktopState;
}

app.setAppUserModelId(APP_ID);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("activate", showWindow);
  app.whenReady().then(() => {
    ipcMain.handle("watcher:get-state", () => desktopState);
    ipcMain.handle("watcher:start", (_event, input) => startMonitoring(input));
    ipcMain.handle("watcher:stop", () => stopMonitoring());
    createWindow();
    createTray();
  });
  app.on("window-all-closed", () => {});
}
