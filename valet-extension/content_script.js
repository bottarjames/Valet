// ── Valet Auto-Naming — Universal Prompt Detector ─────────────────────────────
// Runs on all pages. Detects AI prompt text and sends it to the background
// service worker so downloads can be auto-named.

(() => {
  "use strict";

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

    // 3. Standard form elements — textareas and inputs
    let best = null;
    let bestLen = 0;

    const formElements = document.querySelectorAll(
      'textarea, input[type="text"], [contenteditable="true"], [contenteditable=""]'
    );

    for (const el of formElements) {
      if (el.offsetParent === null && !el.closest('[role="dialog"]')) continue;
      const text = (el.value || el.textContent || "").trim();
      if (text.length > 10 && text.length < 2000 && text.length > bestLen) {
        best = text;
        bestLen = text.length;
      }
    }

    if (best) return best;

    // 4. Prompt-specific selectors — attributes and classes that AI platforms use
    const promptSelectors = [
      // Attribute-based (most reliable)
      '[data-testid*="prompt" i]',
      '[data-cy*="prompt" i]',
      '[aria-label*="prompt" i]',
      '[placeholder*="prompt" i]',
      '[name*="prompt" i]',
      // Class/id based
      '[class*="prompt" i]',
      '[id*="prompt" i]',
      // Common AI platform patterns
      '[class*="generation-text" i]',
      '[class*="image-description" i]',
      '[class*="creation-prompt" i]',
      '[class*="prompt-text" i]',
      '[class*="promptText" i]',
      '[class*="prompt_text" i]',
      '[class*="ai-prompt" i]',
    ];

    for (const selector of promptSelectors) {
      try {
        const els = document.querySelectorAll(selector);
        for (const el of els) {
          // Skip containers that are too large (nav bars, wrappers)
          if (el.children.length > 10) continue;

          const text = (el.value || el.innerText || el.textContent || "").trim();
          if (text.length > 10 && text.length < 2000 && text.length > bestLen) {
            best = text;
            bestLen = text.length;
          }
        }
      } catch (_) {}
    }

    if (best) return best;

    // 5. Proximity search — find text near download/generate buttons
    //    Look for the nearest descriptive text block to action buttons
    const buttonSelectors = [
      'button[class*="download" i]',
      'button[aria-label*="download" i]',
      'a[download]',
      'button[class*="generate" i]',
      'button[class*="create" i]',
      '[data-testid*="download" i]',
    ];

    for (const btnSel of buttonSelectors) {
      try {
        const buttons = document.querySelectorAll(btnSel);
        for (const btn of buttons) {
          // Walk up to find a container, then look for text siblings
          let container = btn.parentElement;
          for (let i = 0; i < 5 && container; i++) {
            const textEls = container.querySelectorAll('p, span, div');
            for (const te of textEls) {
              if (te.children.length > 3) continue; // skip containers
              const text = (te.innerText || te.textContent || "").trim();
              if (text.length > 20 && text.length < 2000 && text.length > bestLen) {
                best = text;
                bestLen = text.length;
              }
            }
            if (best) break;
            container = container.parentElement;
          }
          if (best) break;
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

  document.addEventListener("click", () => sendMetadata(), true);
  document.addEventListener("contextmenu", () => sendMetadata(), true);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") sendMetadata();
  }, true);
})();
