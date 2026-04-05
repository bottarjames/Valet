# Valet

> Routes your Chrome downloads straight into the right project folder — automatically.

No more digging through Downloads. Assign rules to tab groups, and Valet moves files the moment they finish downloading. Works on **macOS** and **Windows**.

---

## Install

### macOS — one command

```bash
curl -fsSL https://raw.githubusercontent.com/bottarjames/Valet/main/install.sh | bash
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Press **Cmd+Shift+G** and paste: `~/.valet/extension`
5. Click **Select**

### Windows

1. Download **[Valet-v1.3.zip](https://github.com/bottarjames/Valet/releases/latest)** from Releases
2. Unzip → open the `windows` folder
3. Double-click **Install Valet.bat**
4. In Chrome → `chrome://extensions` → **Developer mode** → **Load unpacked** → select the `valet-extension` folder

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
