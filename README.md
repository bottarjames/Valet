# Valet 🗂️

> Routes your Chrome downloads straight into the right project folder — automatically.

No more digging through Downloads. Assign rules to tab groups, and Valet moves files the moment they finish downloading. Works on **macOS** and **Windows**.

---

## ⬇️ Download

**[→ Download Valet v1.1 (latest)](https://github.com/bottarjames/Valet/releases/latest)**

---

## Install

### macOS — no Python required

1. Download and unzip **Valet-v1.1.zip** from the link above
2. Open the `valet-extension` folder
3. Open Terminal, drag **`install.sh`** into it, press Enter
4. In Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `valet-extension` folder

### Windows

1. Download and unzip **Valet-v1.1.zip** from the link above
2. Open the `windows` folder
3. Double-click **Install Valet.bat**
4. In Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `valet-extension` folder

---

## How it works

- **Bridge** — a tiny background process that runs on your Mac or PC. Reads your project list and moves files.
- **Chrome Extension** — the control panel. Set destinations, assign tab groups, handle downloads.

Everything runs locally over `localhost` — nothing leaves your machine.

---

## Usage

Click the **Valet icon** in your Chrome toolbar.

**Set a default project** — every download goes there automatically.

**Assign tab groups** — map a Chrome tab group to a project folder. Downloads from that group route there instantly.

**Manage projects** — add and remove folders directly from the popup.

---

## Config

Projects are stored in `~/.valet/config.json`. You never need to edit this manually — the extension handles it.

---

## Uninstall

**macOS**
```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.valet.bridge.plist
rm -rf ~/.valet ~/Library/LaunchAgents/com.valet.*.plist
```

**Windows** — delete `%USERPROFILE%\.valet` and remove the Valet shortcut from the Startup folder.

Then remove the extension from `chrome://extensions`.

---

Built with Python + a Chrome extension. No Electron, no Node, no cloud.
