const { app, BrowserWindow, WebContentsView, ipcMain } = require("electron");
const path = require("node:path");
const { SerialPort } = require("serialport");

let mainWindow;
let browserView;
let serialPort;
let currentBounds = { x: 0, y: 0, width: 0, height: 0 };

const blockedHosts = new Set([
  "google.com",
  "bing.com",
  "yahoo.com",
  "duckduckgo.com",
  "ecosia.org",
  "search.brave.com",
  "startpage.com",
  "yandex.com",
  "baidu.com",
]);
const blockedSearchHostPatterns = [
  /(^|\.)google\.[a-z]{2,}(?:\.[a-z]{2,})?$/,
  /(^|\.)bing\.[a-z]{2,}(?:\.[a-z]{2,})?$/,
  /(^|\.)yahoo\.[a-z]{2,}(?:\.[a-z]{2,})?$/,
];

function isAllowedUrl(input) {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if ([...blockedHosts].some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
      || blockedSearchHostPatterns.some((pattern) => pattern.test(host))) return false;
    return true;
  } catch {
    return false;
  }
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function updateBrowserBounds(bounds = currentBounds) {
  currentBounds = bounds;
  if (!browserView || !mainWindow) return;
  const { width, height } = mainWindow.getContentBounds();
  browserView.setBounds({
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.min(Math.round(bounds.width), width)),
    height: Math.max(0, Math.min(Math.round(bounds.height), height)),
  });
}

function attachBrowserView() {
  browserView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.contentView.addChildView(browserView);
  browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  const contents = browserView.webContents;
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      sendToRenderer("browser:navigation-blocked", { url });
    }
  });
  contents.on("will-redirect", (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      sendToRenderer("browser:navigation-blocked", { url });
    }
  });
  contents.on("did-start-loading", () => sendToRenderer("browser:loading", true));
  contents.on("did-stop-loading", () => sendToRenderer("browser:loading", false));
  contents.on("page-title-updated", (_event, title) => sendToRenderer("browser:title", title));
  contents.on("did-navigate", (_event, url) => {
    sendToRenderer("browser:state", {
      url,
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
    });
  });
  contents.on("did-navigate-in-page", (_event, url) => {
    sendToRenderer("browser:state", {
      url,
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
    });
  });
  contents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      sendToRenderer("browser:error", { message: errorDescription, url: validatedURL });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 820,
    minHeight: 600,
    backgroundColor: "#f6f7f9",
    title: "Zen Browser",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  attachBrowserView();
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("resize", () => updateBrowserBounds());
  mainWindow.on("closed", () => {
    mainWindow = null;
    browserView = null;
  });
}

ipcMain.handle("browser:open", async (_event, input) => {
  if (typeof input !== "string" || !isAllowedUrl(input)) {
    return { ok: false, error: "Enter a complete HTTP or HTTPS address. Search engines are blocked." };
  }
  try {
    await browserView.webContents.loadURL(input);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "The page could not be opened." };
  }
});

ipcMain.handle("browser:command", (_event, command) => {
  const contents = browserView && browserView.webContents;
  if (!contents) return false;
  if (command === "back" && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
  else if (command === "forward" && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
  else if (command === "reload" && contents.getURL()) contents.reload();
  else if (command === "home") contents.stop();
  return true;
});

ipcMain.on("browser:set-bounds", (_event, bounds) => {
  if (!bounds || !["x", "y", "width", "height"].every((key) => Number.isFinite(bounds[key]))) return;
  updateBrowserBounds(bounds);
});

ipcMain.handle("serial:list", async () => SerialPort.list());

ipcMain.handle("serial:connect", async (_event, options) => {
  if (serialPort?.isOpen) return { ok: false, error: "A serial connection is already open." };
  const port = typeof options?.path === "string" ? options.path : "";
  const baudRate = Number(options?.baudRate);
  const dataBits = Number(options?.dataBits);
  const stopBits = Number(options?.stopBits);
  const parity = options?.parity;
  if (!port || ![300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 230400].includes(baudRate)
    || ![5, 6, 7, 8].includes(dataBits) || ![1, 1.5, 2].includes(stopBits)
    || !["none", "even", "odd", "mark", "space"].includes(parity)) {
    return { ok: false, error: "Select a port and valid serial settings." };
  }
  try {
    serialPort = new SerialPort({ path: port, baudRate, dataBits, stopBits, parity, autoOpen: false });
    serialPort.on("data", (data) => sendToRenderer("serial:data", data.toString("utf8")));
    serialPort.on("error", (error) => sendToRenderer("serial:error", error.message));
    await new Promise((resolve, reject) => {
      serialPort.open((error) => (error ? reject(error) : resolve()));
    });
    sendToRenderer("serial:state", { connected: true, path: port });
    return { ok: true };
  } catch (error) {
    serialPort = null;
    return { ok: false, error: error.message || "Could not open the serial port." };
  }
});

ipcMain.handle("serial:disconnect", async () => {
  if (!serialPort?.isOpen) return { ok: true };
  try {
    await new Promise((resolve, reject) => {
      serialPort.close((error) => (error ? reject(error) : resolve()));
    });
    serialPort = null;
    sendToRenderer("serial:state", { connected: false, path: "" });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Could not close the serial port." };
  }
});

ipcMain.handle("serial:write", async (_event, value) => {
  if (!serialPort?.isOpen) return { ok: false, error: "Connect a serial device before sending data." };
  if (typeof value !== "string" || value.length === 0) return { ok: false, error: "Enter data to send." };
  try {
    await new Promise((resolve, reject) => {
      serialPort.write(value, (error) => {
        if (error) return reject(error);
        serialPort.drain((drainError) => (drainError ? reject(drainError) : resolve()));
      });
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Could not send serial data." };
  }
});

app.whenReady().then(createWindow);
app.on("window-all-closed", async () => {
  if (serialPort?.isOpen) {
    await new Promise((resolve) => serialPort.close(() => resolve()));
  }
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
