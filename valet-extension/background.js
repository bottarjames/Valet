const BRIDGE = "http://localhost:27182";

// ── Continuous tab tracking ────────────────────────────────────────────────
// Keep the last active grouped-tab's project stored per window.
// Chrome wakes the service worker for these events, and chrome.storage.local
// persists across service worker restarts, so we never lose state.

async function updateLastGroup(tabId, windowId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.groupId && tab.groupId !== -1) {
      const group                  = await chrome.tabGroups.get(tab.groupId);
      const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
      const project                = groupMappings[group.title || ""];
      if (project) {
        const data = {};
        data[`lastGroup_${windowId}`] = { project, ts: Date.now() };
        await chrome.storage.local.set(data);
        return;
      }
    }
  } catch (_) {}
  // Tab has no mapped group — clear so stale data doesn't bleed through
  await chrome.storage.local.remove(`lastGroup_${windowId}`);
}

chrome.tabs.onActivated.addListener((info) =>
  updateLastGroup(info.tabId, info.windowId)
);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!("groupId" in changeInfo)) return;
  try {
    const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id === tabId) updateLastGroup(tabId, tab.windowId);
  } catch (_) {}
});

// ── Download routing ───────────────────────────────────────────────────────

chrome.downloads.onCreated.addListener(async (download) => {
  let projectName = null;
  let source      = "none";

  // 1. Download has a real source tab → use its group
  if (download.tabId && download.tabId !== -1) {
    try {
      const tab = await chrome.tabs.get(download.tabId);
      if (tab?.groupId && tab.groupId !== -1) {
        const group                  = await chrome.tabGroups.get(tab.groupId);
        const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
        projectName = groupMappings[group.title || ""] || null;
        if (projectName) source = `tabId:${download.tabId}`;
      }
    } catch (_) {}
  }

  // 2. No tabId — use the continuously-tracked last active group for this window
  if (!projectName) {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab  = tabs[0];
      if (tab) {
        const key    = `lastGroup_${tab.windowId}`;
        const stored = await chrome.storage.local.get(key);
        const entry  = stored[key];
        // Accept if tracked within the last 5 minutes
        if (entry && (Date.now() - entry.ts) < 300_000) {
          projectName = entry.project;
          source      = `tracked:window${tab.windowId}`;
        }
      }
    } catch (_) {}
  }

  console.log(`[Valet] onCreated dl#${download.id} tabId=${download.tabId} → project=${projectName} source=${source}`);

  if (!projectName) return;

  // Store keyed by download ID for retrieval at completion
  const key  = `dl_${download.id}`;
  const data = {};
  data[key]  = projectName;
  await chrome.storage.local.set(data);
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== "complete") return;

  const [download] = await chrome.downloads.search({ id: delta.id });
  if (!download?.filename) return;

  const key         = `dl_${delta.id}`;
  const stored      = await chrome.storage.local.get(key);
  let   projectName = stored[key] || null;

  await chrome.storage.local.remove(key);

  console.log(`[Valet] onChanged dl#${delta.id} project=${projectName} file=${download.filename}`);

  // Fall back to default project if no group was captured
  if (!projectName) {
    const { activeProject } = await chrome.storage.local.get("activeProject");
    if (activeProject) {
      projectName = activeProject;
      console.log(`[Valet] using default project: ${projectName}`);
    }
  }

  if (projectName) await moveFile(download.filename, projectName);
});

// ── Move ──────────────────────────────────────────────────────────────────

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
