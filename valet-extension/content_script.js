// ── Valet Auto-Naming — Universal Prompt Detector ─────────────────────────────
// Runs on all pages. Detects AI prompt text and sends it to the background
// service worker so downloads can be auto-named.

(() => {
  "use strict";

  // Debounce to avoid spamming the background script
  let lastSent = 0;
  const COOLDOWN = 500;

  // ── Find prompt text on the page ──────────────────────────────────────────

  function findPromptText() {
    // 1. User has text selected — most intentional signal
    const sel = window.getSelection().toString().trim();
    if (sel.length > 10 && sel.length < 2000) return sel;

    // 2. Focused textarea/input — user is likely looking at a prompt field
    const active = document.activeElement;
    if (active) {
      const val = (active.value || active.textContent || "").trim();
      if (val.length > 10 && val.length < 2000 &&
          (active.tagName === "TEXTAREA" ||
           (active.tagName === "INPUT" && active.type === "text") ||
           active.isContentEditable)) {
        return val;
      }
    }

    // 3. Scan all visible textareas/inputs for prompt-like content
    //    Prefer the longest one — AI prompt fields tend to have the most text
    let best = null;
    let bestLen = 0;

    const candidates = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"], [contenteditable=""]'
    );

    for (const el of candidates) {
      // Skip hidden elements
      if (el.offsetParent === null && !el.closest('[role="dialog"]')) continue;

      const text = (el.value || el.textContent || "").trim();
      if (text.length > 10 && text.length < 2000 && text.length > bestLen) {
        best = text;
        bestLen = text.length;
      }
    }

    if (best) return best;

    // 4. Look for common prompt display patterns (read-only prompt shown near image)
    //    Many platforms show the prompt as plain text near the generated image
    const promptSelectors = [
      '[data-testid*="prompt"]',
      '[class*="prompt"]',
      '[aria-label*="prompt" i]',
      '[class*="generation-text"]',
      '[class*="description"]',
    ];

    for (const selector of promptSelectors) {
      try {
        const els = document.querySelectorAll(selector);
        for (const el of els) {
          const text = (el.textContent || "").trim();
          if (text.length > 10 && text.length < 2000 && text.length > bestLen) {
            best = text;
            bestLen = text.length;
          }
        }
      } catch (_) {}
    }

    return best;
  }

  // ── Send metadata to background ───────────────────────────────────────────

  function sendMetadata() {
    const now = Date.now();
    if (now - lastSent < COOLDOWN) return;
    lastSent = now;

    const prompt = findPromptText();
    if (!prompt) return;

    chrome.runtime.sendMessage({
      type: "PROMPT_METADATA",
      data: {
        prompt,
        url: window.location.href,
        hostname: window.location.hostname,
        title: document.title,
        timestamp: now,
      },
    });
  }

  // ── Trigger on interactions that typically precede a download ──────────────

  // Click anywhere — captures download button clicks
  document.addEventListener("click", () => {
    sendMetadata();
  }, true);

  // Also capture right-click → "Save image as..."
  document.addEventListener("contextmenu", () => {
    sendMetadata();
  }, true);

  // Keyboard shortcut downloads (Ctrl+S, etc.)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      sendMetadata();
    }
  }, true);
})();
