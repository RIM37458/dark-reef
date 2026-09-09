const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "watcher",
  Object.freeze({
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
