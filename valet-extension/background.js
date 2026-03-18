const BRIDGE = "http://localhost:27182";

// When a download starts, snapshot the active tab's group immediately.
// This is more reliable than querying at completion time, because:
//   - The user is almost certainly on the relevant tab right now
//   - Some sites (Freepik, etc.) trigger downloads via new tabs/windows,
//     making download.tabId useless at completion time
chrome.downloads.onCreated.addListener(async (download) => {
  let groupId = null;

  // 1. If the download has a real source tab, use it directly
  if (download.tabId && download.tabId !== -1) {
    try {
      const tab = await chrome.tabs.get(download.tabId);
      if (tab && tab.groupId && tab.groupId !== -1) groupId = tab.groupId;
    } catch (_) {}
  }

  // 2. Fallback: snapshot whatever tab is active RIGHT NOW (download just started)
  if (groupId == null) {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab  = tabs[0];
      if (tab && tab.groupId && tab.groupId !== -1) groupId = tab.groupId;
    } catch (_) {}
  }

  if (groupId == null) return; // no group — nothing to store

  // 3. Resolve group → project name right now while we have it
  try {
    const group                  = await chrome.tabGroups.get(groupId);
    const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
    const projectName            = groupMappings[group.title || ""];
    if (projectName) {
      // Store keyed by download ID so onChanged can look it up
      const key  = `dl_${download.id}`;
      const data = {};
      data[key]  = projectName;
      await chrome.storage.local.set(data);
    }
  } catch (_) {}
});

chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.state || delta.state.current !== "complete") return;

  const [download] = await chrome.downloads.search({ id: delta.id });
  if (!download || !download.filename) return;

  const key              = `dl_${delta.id}`;
  const stored           = await chrome.storage.local.get(key);
  let   projectName      = stored[key] || null;

  // Clean up the stored entry
  await chrome.storage.local.remove(key);

  // If no group was captured at creation, fall back to default project
  if (!projectName) {
    const { activeProject } = await chrome.storage.local.get("activeProject");
    if (activeProject) projectName = activeProject;
  }

  if (projectName) await moveFile(download.filename, projectName);
});

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
