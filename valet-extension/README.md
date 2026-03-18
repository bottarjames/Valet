# Valet — Chrome Extension

Route Chrome downloads straight to project folders on your Mac — no more hunting through your Downloads pile.

## How it works

A tiny background server (`bridge.py`) runs silently on your Mac. The Chrome extension talks to it whenever you download something, and it moves the file to wherever you tell it.

---

## Install (2 minutes)

**Step 1 — Run the installer**

Open Terminal and run:
```
bash /path/to/valet-extension/install.sh
```
Or double-click `install.sh` in Finder (right-click → Open).

**Step 2 — Load the extension in Chrome**

1. Open Chrome → go to `chrome://extensions`
2. Turn on **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `valet-extension` folder
5. Click the 🧩 puzzle-piece icon in your Chrome toolbar → pin **📁 Valet**

That's it. The bridge starts automatically at login from now on.

---

## Using it

**Click the 📁 icon** in your Chrome toolbar to open the control panel.

### Add a project
Go to the **Projects** section at the bottom of the popup → click **+ Add project** → enter a name and the full folder path (e.g. `~/Documents/Work` or `/Users/you/Dropbox/ClientA`).

### Set a default destination
Under **Send downloads to**, pick a project. Every download will move there automatically — you'll get a macOS notification when it lands.

Choose **Ask each time** and a badge number will appear on the icon when a download finishes — click the icon and pick where it goes.

### Tab group rules *(the clever bit)*
If you use Chrome's tab groups (right-click a tab → Add to group), you can assign a download destination per group:
- "Work" group → Client Project folder
- "Personal" group → ask each time

Downloads that start in a group move automatically to that group's folder. No clicks needed.

---

## Requirements

- macOS Ventura or later
- Python 3 (comes with macOS — no extras needed)
- Google Chrome

---

## Uninstall

```bash
launchctl unload ~/Library/LaunchAgents/com.valet.bridge.plist
rm ~/Library/LaunchAgents/com.valet.bridge.plist
rm -rf ~/.valet
```
Then remove the extension from `chrome://extensions`.
