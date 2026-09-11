const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "watcher",
  Object.freeze({
    getVariant: () => ipcRenderer.invoke("app:get-variant"),
    getState: () => ipcRenderer.invoke("watcher:get-state"),
    start: (configuration) => ipcRenderer.invoke("watcher:start", configuration),
    demo: () => ipcRenderer.invoke("watcher:demo"),
    stop: () => ipcRenderer.invoke("watcher:stop"),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("watcher:state", listener);
      return () => ipcRenderer.removeListener("watcher:state", listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  "assistantLibrary",
  Object.freeze({
    getCatalog: () => ipcRenderer.invoke("assistant:get-catalog"),
    listPlans: () => ipcRenderer.invoke("assistant:list-plans"),
    savePlan: (plan) => ipcRenderer.invoke("assistant:save-plan", plan),
    deletePlan: (id) => ipcRenderer.invoke("assistant:delete-plan", id),
    exportPlan: (id) => ipcRenderer.invoke("assistant:export-plan", id),
    importPlan: (raw) => ipcRenderer.invoke("assistant:import-plan", raw),
    listCaptureSources: () => ipcRenderer.invoke("assistant:list-capture-sources"),
    readClock: (sourceId) => ipcRenderer.invoke("assistant:read-clock", sourceId),
    observeDraft: (sourceId) => ipcRenderer.invoke("assistant:observe-draft", sourceId),
    openDraftOverlay: (sourceId) => ipcRenderer.invoke("draft:open", sourceId),
    getDraftProfile: () => ipcRenderer.invoke("draft:get-profile"),
    saveDraftProfile: (profile) => ipcRenderer.invoke("draft:save-profile", profile),
    adjustDraftOverlay: (adjustment) => ipcRenderer.invoke("draft:adjust", adjustment),
  }),
);
