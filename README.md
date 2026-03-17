# Valet 🗂️

> Routes your Chrome downloads straight into the right project folder — automatically.

No more digging through Downloads. Set a default project, assign rules to tab groups, and Valet moves files the moment they finish downloading. Works on **macOS** and **Windows**.

---

## How it works

Valet has two parts that work together:

- **Bridge** — a tiny background server that runs on your Mac or PC. It reads your project list and does the actual file moving.
- **Chrome Extension** — the control panel. Set destinations, assign tab groups, handle incoming downloads.

The Chrome extension talks to the bridge over `localhost` — nothing leaves your machine.

---

## Install

### macOS

**Requirements:** macOS Ventura or later, Python 3 (included with macOS)

```bash
git clone https://github.com/bottarjames/Valet.git
cd Valet
bash valet/install.sh
```

Then load the extension in Chrome:
1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked** → select the `valet-extension` folder

### Windows

**Requirements:** Windows 10 or later (Python will be installed automatically if missing)

```powershell
git clone https://github.com/bottarjames/Valet.git
cd Valet
powershell -ExecutionPolicy Bypass -File valet\install.ps1
```

Then load the extension in Chrome — same steps as above.

---

## Usage

Click the **Valet icon** in your Chrome toolbar.

**Set a default project** — every download goes there automatically, no prompts.

**Assign tab groups** — open a tab group for a client or project, map it to a folder. Downloads in that group route there without you thinking about it.

**Ask each time** — a badge appears on the icon when a download lands. Click it and pick where to send the file.

**Manage projects** — add and remove folders directly from the extension popup. Click Browse to pick a folder instead of typing a path.

---

## Project structure

```
Valet/
├── valet/
│   ├── bridge.py          # local HTTP server (cross-platform)
│   ├── install.sh         # macOS installer
│   ├── install.ps1        # Windows installer
│   └── tray_app.py        # Windows system tray app
└── valet-extension/
    ├── manifest.json
    ├── background.js      # intercepts downloads
    ├── popup.html/js/css  # the UI
    └── icons/
```

---

## Config

Projects are stored in `~/.valet/config.json`. You never need to edit this manually — the extension handles it. But if you want to, it looks like this:

```json
{
  "projects": {
    "Fika":     "~/Documents/Fika",
    "Bellbird": "~/Library/Mobile Documents/com~apple~CloudDocs/Projects/Bellbird"
  }
}
```

---

## Uninstall

**macOS**
```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.valet.bridge.plist
rm -rf ~/.valet ~/Library/LaunchAgents/com.valet.*.plist
```

**Windows** — delete `%USERPROFILE%\.valet` and remove the Valet tasks from Task Scheduler.

Then remove the extension from `chrome://extensions`.

---

Built with Python + a Chrome extension. No Electron, no Node, no cloud.
