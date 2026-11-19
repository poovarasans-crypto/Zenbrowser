const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("zen", {
  openUrl: (url) => ipcRenderer.invoke("browser:open", url),
  browserCommand: (command) => ipcRenderer.invoke("browser:command", command),
  setBrowserBounds: (bounds) => ipcRenderer.send("browser:set-bounds", bounds),
  listSerialPorts: () => ipcRenderer.invoke("serial:list"),
  connectSerial: (options) => ipcRenderer.invoke("serial:connect", options),
  disconnectSerial: () => ipcRenderer.invoke("serial:disconnect"),
  writeSerial: (value) => ipcRenderer.invoke("serial:write", value),
  on: (channel, callback) => {
    const allowed = new Set([
      "browser:loading",
      "browser:title",
      "browser:state",
      "browser:error",
      "browser:navigation-blocked",
      "serial:data",
      "serial:error",
      "serial:state",
    ]);
    if (!allowed.has(channel)) return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
