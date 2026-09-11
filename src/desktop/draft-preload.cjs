const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "draftOverlay",
  Object.freeze({
    getCatalog: () => ipcRenderer.invoke("assistant:get-catalog"),
    getState: () => ipcRenderer.invoke("draft:get-state"),
    close: () => ipcRenderer.invoke("draft:close"),
    setCategories: (categoryIds) => ipcRenderer.invoke("draft:set-categories", categoryIds),
    calibrate: () => ipcRenderer.invoke("draft:calibrate"),
    scan: () => ipcRenderer.invoke("draft:scan"),
    clearUnavailable: () => ipcRenderer.invoke("draft:clear-unavailable"),
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("draft:state", listener);
      return () => ipcRenderer.removeListener("draft:state", listener);
    },
  }),
);
