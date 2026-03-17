/**
 * background.js — Valet Chrome extension service worker.
 *
 * Listens for completed downloads and either:
 *   1. Auto-moves them based on the active tab's group rule, OR
 *   2. Auto-moves them based on the user's default project, OR
 *   3. Does nothing — file stays in Downloads.
 */

const BRIDGE = "http://localhost:27182";

// ── Download lifecycle ────────────────────────────────────────────────────────

// When a download STARTS, snapshot which tab group triggered it.
chrome.downloads.onCreated.addListener(async (download) => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab  = tabs[0];
    if (tab && tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      const { downloadOrigins = {} } = await chrome.storage.session.get("downloadOrigins");
      downloadOrigins[download.id]   = tab.groupId;
      await chrome.storage.session.set({ downloadOrigins });
    }
  } catch (_) {}
});

// When a download COMPLETES, decide what to do with it.
chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== "complete") return;

  const [download] = await chrome.downloads.search({ id: delta.id });
  if (!download || !download.filename) return;

  let projectName = null;

  // 1. Check tab group rules
  const { downloadOrigins = {} } = await chrome.storage.session.get("downloadOrigins");
  const groupId = downloadOrigins[delta.id];

  if (groupId != null) {
    try {
      const group                  = await chrome.tabGroups.get(groupId);
      const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
      const mapped                 = groupMappings[group.title || ""];
      if (mapped) projectName = mapped;
    } catch (_) {}

    delete downloadOrigins[delta.id];
    await chrome.storage.session.set({ downloadOrigins });
  }

  // 2. Fall back to default project
  if (!projectName) {
    const { activeProject } = await chrome.storage.local.get("activeProject");
    if (activeProject) projectName = activeProject;
  }

  // 3. Move if we have a target — otherwise leave it alone in Downloads
  if (projectName) {
    await moveFile(download.filename, projectName);
  }
});

// ── Move function ─────────────────────────────────────────────────────────────

async function moveFile(filePath, projectName) {
  try {
    const res  = await fetch(`${BRIDGE}/move`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ file: filePath, project: projectName }),
    });
    const data = await res.json();

    if (data.success) {
      chrome.notifications.create(`moved-${Date.now()}`, {
        type:    "basic",
        iconUrl: "icons/icon48.png",
        title:   `Moved to ${projectName}`,
        message: data.filename,
      });
    } else {
      const isMissing = (data.error || "").startsWith("folder_missing:");
      chrome.notifications.create(`err-${Date.now()}`, {
        type:    "basic",
        iconUrl: "icons/icon48.png",
        title:   isMissing ? `⚠️ Folder not found — ${projectName}` : "Valet — Move failed",
        message: isMissing
          ? "The project folder has moved. Click the Valet icon to relocate it."
          : (data.error || "Unknown error"),
      });
    }
  } catch (_) {}
}
