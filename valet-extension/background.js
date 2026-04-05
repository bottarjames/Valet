const BRIDGE = "http://localhost:27182";

// ── Auto-naming: prompt metadata from content scripts ─────────────────────
// Stores the most recent prompt text per tab so we can rename downloads.

const tabMetadata = new Map();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== "PROMPT_METADATA" || !sender.tab?.id) return;
  tabMetadata.set(sender.tab.id, msg.data);
  // Expire after 30s — if no download happens, the metadata is stale
  setTimeout(() => tabMetadata.delete(sender.tab.id), 30_000);
});

// Intercept filename before Chrome saves it
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  chrome.storage.local.get("autoNaming").then(({ autoNaming = true }) => {
    if (!autoNaming) {
      suggest();
      return;
    }

    // Find metadata: try download's own tab, then the active tab
    let meta = null;
    if (item.tabId && item.tabId !== -1) {
      meta = tabMetadata.get(item.tabId);
    }
    if (!meta) {
      // Check all stored metadata, use most recent
      let newest = 0;
      for (const [, m] of tabMetadata) {
        if (m.timestamp > newest) { newest = m.timestamp; meta = m; }
      }
    }

    if (!meta?.prompt) {
      suggest();
      return;
    }

    // Only auto-name image/video files
    const ext = (item.filename.match(/\.(\w+)$/) || [])[1]?.toLowerCase();
    const mediaExts = new Set([
      "png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "avif",
      "mp4", "webm", "mov", "avi",
    ]);
    if (!ext || !mediaExts.has(ext)) {
      suggest();
      return;
    }

    const slug = promptToSlug(meta.prompt);
    const platform = hostnameToPlatform(meta.hostname);
    const newName = [slug, platform].filter(Boolean).join("-") + "." + ext;

    // Keep any subdirectory from the original filename
    const dir = item.filename.includes("/")
      ? item.filename.substring(0, item.filename.lastIndexOf("/") + 1)
      : "";

    suggest({ filename: dir + newName });

    // Clean up used metadata
    if (item.tabId && item.tabId !== -1) tabMetadata.delete(item.tabId);
  });

  return true; // async suggest
});

function promptToSlug(prompt) {
  // Strip common prompt prefixes/noise
  let text = prompt
    .replace(/^(imagine|create|generate|make|draw|design)\s+/i, "")
    .replace(/--\w+\s+\S+/g, "")  // remove MJ parameters like --ar 16:9
    .replace(/\s+/g, " ")
    .trim();

  // Take first 8 meaningful words
  const words = text
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 8)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);

  return words.join("-").substring(0, 80) || "untitled";
}

function hostnameToPlatform(hostname) {
  if (!hostname) return "";
  const map = {
    "midjourney.com": "mj",
    "discord.com": "mj",
    "leonardo.ai": "leo",
    "freepik.com": "freepik",
    "openai.com": "dalle",
    "chatgpt.com": "chatgpt",
    "runwayml.com": "runway",
    "app.runwayml.com": "runway",
    "klingai.com": "kling",
    "pika.art": "pika",
    "ideogram.ai": "ideogram",
    "playground.com": "playground",
    "stability.ai": "stability",
    "civitai.com": "civitai",
  };
  for (const [domain, label] of Object.entries(map)) {
    if (hostname.includes(domain)) return label;
  }
  return "";
}

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

  // 2. No tabId — check active tab's group directly, then fall back to tracked history
  if (!projectName) {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab  = tabs[0];
      if (tab) {
        // 2a. Active tab is itself in a mapped group right now
        if (tab.groupId && tab.groupId !== -1) {
          const group                  = await chrome.tabGroups.get(tab.groupId);
          const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
          const mapped                 = groupMappings[group.title || ""] || null;
          if (mapped) { projectName = mapped; source = `activeTab:${tab.id}`; }
        }

        // 2b. Active tab has no mapped group — use last tracked group for this window
        if (!projectName) {
          const key    = `lastGroup_${tab.windowId}`;
          const stored = await chrome.storage.local.get(key);
          const entry  = stored[key];
          if (entry && (Date.now() - entry.ts) < 300_000) {
            projectName = entry.project;
            source      = `tracked:window${tab.windowId}`;
          }
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
  let   source      = stored[key] ? "stored" : "none";

  await chrome.storage.local.remove(key);

  // onCreated may have missed this download (service worker was waking up).
  // Do a live detection now as rescue fallback.
  if (!projectName) {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab  = tabs[0];
      if (tab) {
        if (tab.groupId && tab.groupId !== -1) {
          const group                  = await chrome.tabGroups.get(tab.groupId);
          const { groupMappings = {} } = await chrome.storage.local.get("groupMappings");
          const mapped                 = groupMappings[group.title || ""] || null;
          if (mapped) { projectName = mapped; source = `liveTab:${tab.id}`; }
        }
        if (!projectName) {
          const key2    = `lastGroup_${tab.windowId}`;
          const stored2 = await chrome.storage.local.get(key2);
          const entry   = stored2[key2];
          if (entry && (Date.now() - entry.ts) < 300_000) {
            projectName = entry.project;
            source      = `liveTracked:window${tab.windowId}`;
          }
        }
      }
    } catch (_) {}
  }

  console.log(`[Valet] onChanged dl#${delta.id} project=${projectName} source=${source} file=${download.filename}`);

  // Last resort: default project
  if (!projectName) {
    const { activeProject } = await chrome.storage.local.get("activeProject");
    if (activeProject) { projectName = activeProject; }
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
