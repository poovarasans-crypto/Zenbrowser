import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Cable,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Globe2,
  House,
  LoaderCircle,
  LockKeyhole,
  Plug,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import "./styles.css";

function isAllowedUrl(input) {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const blockedHosts = [
      "google.com", "bing.com", "yahoo.com", "duckduckgo.com", "ecosia.org",
      "search.brave.com", "startpage.com", "yandex.com", "baidu.com",
    ];
    const blockedSearchHostPatterns = [
      /(^|\.)google\.[a-z]{2,}(?:\.[a-z]{2,})?$/i,
      /(^|\.)bing\.[a-z]{2,}(?:\.[a-z]{2,})?$/i,
      /(^|\.)yahoo\.[a-z]{2,}(?:\.[a-z]{2,})?$/i,
    ];
    return !blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
      && !blockedSearchHostPatterns.some((pattern) => pattern.test(host));
  } catch {
    return false;
  }
}

function App() {
  const [address, setAddress] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [notice, setNotice] = useState("");
  const [serialOpen, setSerialOpen] = useState(false);
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("");
  const [baudRate, setBaudRate] = useState("9600");
  const [dataBits, setDataBits] = useState("8");
  const [parity, setParity] = useState("none");
  const [stopBits, setStopBits] = useState("1");
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialPath, setSerialPath] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [serialLog, setSerialLog] = useState([]);
  const addressRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const unsubs = [
      window.zen.on("browser:loading", setLoading),
      window.zen.on("browser:title", setPageTitle),
      window.zen.on("browser:state", (state) => {
        setCurrentUrl(state.url);
        setAddress(state.url);
        setCanGoBack(state.canGoBack);
        setCanGoForward(state.canGoForward);
      }),
      window.zen.on("browser:error", ({ message }) => {
        setLoading(false);
        setNotice(`Couldn't load the page: ${message}`);
      }),
      window.zen.on("browser:navigation-blocked", () => {
        setNotice("That destination is blocked. Search engines and non-web addresses aren't available.");
      }),
      window.zen.on("serial:data", (value) => {
        setSerialLog((log) => [...log.slice(-99), { direction: "in", value }]);
      }),
      window.zen.on("serial:error", (message) => setNotice(`Serial connection error: ${message}`)),
      window.zen.on("serial:state", (state) => {
        setSerialConnected(state.connected);
        setSerialPath(state.path);
      }),
    ];
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        addressRef.current?.focus();
        addressRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  useEffect(() => {
    if (!contentRef.current) return undefined;
    const updateBounds = () => {
      const rect = contentRef.current?.getBoundingClientRect();
      if (!rect) return;
      window.zen.setBrowserBounds({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: currentUrl ? rect.height : 0,
      });
    };
    const observer = new ResizeObserver(updateBounds);
    observer.observe(contentRef.current);
    window.addEventListener("resize", updateBounds);
    updateBounds();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [currentUrl, serialOpen]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function openAddress(event) {
    event?.preventDefault();
    const value = address.trim();
    if (!isAllowedUrl(value)) {
      setNotice("Enter a complete HTTP or HTTPS URL. Search engine websites are blocked.");
      return;
    }
    setNotice("");
    setAddress(value);
    setLoading(true);
    const result = await window.zen.openUrl(value);
    if (!result.ok) {
      setLoading(false);
      setNotice(result.error);
    } else {
      setCurrentUrl(value);
    }
  }

  async function command(name) {
    setNotice("");
    await window.zen.browserCommand(name);
    if (name === "home") {
      setCurrentUrl("");
      setAddress("");
      setPageTitle("");
      setLoading(false);
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }

  async function refreshPorts() {
    try {
      const found = await window.zen.listSerialPorts();
      setPorts(found);
      if (!selectedPort && found[0]) setSelectedPort(found[0].path);
    } catch (error) {
      setNotice(`Could not list serial ports: ${error.message}`);
    }
  }

  async function toggleSerial() {
    if (serialConnected) {
      const result = await window.zen.disconnectSerial();
      if (!result.ok) setNotice(result.error);
      return;
    }
    const result = await window.zen.connectSerial({
      path: selectedPort,
      baudRate,
      dataBits,
      parity,
      stopBits,
    });
    if (!result.ok) setNotice(result.error);
  }

  async function sendSerial(event) {
    event.preventDefault();
    const result = await window.zen.writeSerial(serialInput);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setSerialLog((log) => [...log.slice(-99), { direction: "out", value: serialInput }]);
    setSerialInput("");
  }

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="brand">
          <div className="brand-mark"><Globe2 size={18} strokeWidth={2.2} /></div>
          <span>zen<span className="brand-light">browser</span></span>
        </div>
        <div className="nav-actions">
          <button className="icon-button" aria-label="Go back" title="Back" disabled={!canGoBack} onClick={() => command("back")}><ArrowLeft size={17} /></button>
          <button className="icon-button" aria-label="Go forward" title="Forward" disabled={!canGoForward} onClick={() => command("forward")}><ArrowRight size={17} /></button>
          <button className="icon-button" aria-label="Home" title="Home" onClick={() => command("home")}><House size={16} /></button>
          <button className={`icon-button ${loading ? "is-loading" : ""}`} aria-label="Refresh page" title="Refresh" disabled={!currentUrl} onClick={() => command("reload")}>
            {loading ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
          </button>
        </div>
        <form className="address-form" onSubmit={openAddress}>
          <LockKeyhole className="address-lock" size={15} />
          <input
            ref={addressRef}
            aria-label="Website URL"
            autoComplete="url"
            spellCheck="false"
            placeholder="Enter a website URL (https://example.com)"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
          {address && <button className="clear-address" type="button" aria-label="Clear URL" onClick={() => { setAddress(""); addressRef.current?.focus(); }}><X size={15} /></button>}
          <button className="open-button" type="submit">Open <ArrowRight size={15} /></button>
        </form>
        <button className={`hardware-button ${serialConnected ? "connected" : ""}`} onClick={() => { setSerialOpen((open) => !open); if (!serialOpen) refreshPorts(); }}>
          {serialConnected ? <PlugZap size={17} /> : <Cable size={17} />}
          <span>{serialConnected ? "Device connected" : "Hardware"}</span>
          <ChevronDown size={14} className={serialOpen ? "chevron-open" : ""} />
        </button>
      </header>

      <div className="trust-strip">
        <div className="trust-message">
          <ShieldCheck size={14} />
          <span>Restricted browsing</span>
          <span className="trust-separator">·</span>
          <span>Direct URLs only</span>
        </div>
        {currentUrl && (
          <div className="page-title" title={pageTitle || currentUrl}>
            {pageTitle || currentUrl}
          </div>
        )}
        {loading && <span className="loading-label"><span className="loading-dot" />Loading page</span>}
      </div>

      {serialOpen && (
        <section className="serial-panel" aria-label="Serial hardware settings">
          <div className="serial-heading">
            <div className="serial-title-wrap">
              <div className="serial-icon"><Cable size={17} /></div>
              <div><h2>Serial connection</h2><p>Configure a USB-to-serial device</p></div>
            </div>
            <button className="icon-button panel-close" aria-label="Close hardware settings" onClick={() => setSerialOpen(false)}><X size={17} /></button>
          </div>
          <div className="serial-settings">
            <label className="setting-field port-field">
              <span>PORT</span>
              <div className="select-wrap">
                <select value={selectedPort} disabled={serialConnected} onChange={(event) => setSelectedPort(event.target.value)}>
                  <option value="">Select a serial port</option>
                  {ports.map((port) => <option value={port.path} key={port.path}>{port.path}{port.manufacturer ? ` — ${port.manufacturer}` : ""}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="setting-field">
              <span>BAUD RATE</span>
              <div className="select-wrap">
                <select value={baudRate} disabled={serialConnected} onChange={(event) => setBaudRate(event.target.value)}>
                  {[300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 230400].map((rate) => <option key={rate}>{rate}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="setting-field">
              <span>DATA BITS</span>
              <div className="select-wrap">
                <select value={dataBits} disabled={serialConnected} onChange={(event) => setDataBits(event.target.value)}>
                  {[5, 6, 7, 8].map((value) => <option key={value}>{value}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="setting-field">
              <span>PARITY</span>
              <div className="select-wrap">
                <select value={parity} disabled={serialConnected} onChange={(event) => setParity(event.target.value)}>
                  {["none", "even", "odd", "mark", "space"].map((value) => <option key={value}>{value}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <label className="setting-field">
              <span>STOP BITS</span>
              <div className="select-wrap">
                <select value={stopBits} disabled={serialConnected} onChange={(event) => setStopBits(event.target.value)}>
                  {["1", "1.5", "2"].map((value) => <option key={value}>{value}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <button className={`connect-button ${serialConnected ? "disconnect-button" : ""}`} onClick={toggleSerial}>
              {serialConnected ? <><Plug size={15} /> Disconnect</> : <><PlugZap size={15} /> Connect</>}
            </button>
            {!serialConnected && <button className="refresh-ports" title="Refresh ports" aria-label="Refresh serial port list" onClick={refreshPorts}><RefreshCw size={15} /></button>}
          </div>
          {serialConnected && (
            <div className="serial-console">
              <div className="console-head">
                <span className="connection-indicator" />
                <span>Connected to <strong>{serialPath}</strong></span>
                <span className="console-live">LIVE</span>
              </div>
              <div className="console-log" aria-live="polite">
                {serialLog.length === 0 ? <span className="console-empty">Incoming and outgoing data will appear here.</span> : serialLog.map((item, index) => (
                  <div className="console-line" key={`${index}-${item.direction}`}><span className={item.direction === "in" ? "rx-label" : "tx-label"}>{item.direction === "in" ? "RX" : "TX"}</span><code>{item.value}</code></div>
                ))}
              </div>
              <form className="serial-send" onSubmit={sendSerial}>
                <input value={serialInput} onChange={(event) => setSerialInput(event.target.value)} placeholder="Send data to device…" aria-label="Serial data to send" />
                <button type="submit" disabled={!serialInput}><ArrowDownToLine size={15} /> Send</button>
              </form>
            </div>
          )}
        </section>
      )}

      <main className="browser-content" ref={contentRef}>
        {!currentUrl && (
          <div className="welcome-panel">
            <div className="welcome-badge"><ShieldCheck size={15} /> A focused browsing space</div>
            <div className="welcome-mark"><Globe2 size={33} strokeWidth={1.7} /></div>
            <h1>Where would you like to go?</h1>
            <p>Enter a full website address above to get started.<br />Search engines and search terms are not supported.</p>
            <button className="welcome-action" onClick={() => addressRef.current?.focus()}>Enter a URL <ArrowRight size={15} /></button>
            <div className="shortcut-hint"><Command size={13} /><span>+</span><kbd>L</kbd><span>to focus the address bar</span></div>
          </div>
        )}
      </main>

      <footer className="status-bar">
        <div className="status-left">
          {serialConnected ? <><span className="connection-indicator" /> Serial connected <span className="status-dot">·</span>{serialPath}</> : <><span className="status-dot status-dot-green" /> Browser ready</>}
        </div>
        <div className="status-right"><CircleHelp size={13} /><span>Only HTTP and HTTPS addresses are allowed</span><span className="footer-divider" /><Check size={13} /><span>Search engines blocked</span></div>
      </footer>
      {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={14} /></button></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
