# Zen Browser

A desktop browser built with Electron, React, and Vite. Web pages are rendered with Electron's `WebContentsView`; the React UI is not used as an iframe browser.

## Run locally

```sh
npm install
npm run dev
```

Create a production frontend build and start Electron with `npm start`. The install step rebuilds SerialPort's native binding for Electron. On Windows, that native rebuild requires Python 3 and Visual Studio C++ Build Tools.

## URL restrictions

Only complete `http://` and `https://` URLs are accepted. Search terms, other protocols, and known search-engine domains are rejected by both the UI and Electron navigation handler. Links and redirects to those blocked destinations are rejected as well.

## Serial hardware

Open **Hardware** to select a detected serial port and configure baud rate, data bits, parity, and stop bits. Connect to view received text data and send text to the device. Serial drivers and permission to access the device are provided by the host operating system.
