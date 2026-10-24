/**
 * EdgeOperator • Background Service Worker (Manifest V3)
 * Handles global shortcuts, context menus, and active tab messaging.
 */

// Initialize extension defaults on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[EdgeOperator] Background service worker initialized.");

  // Set default settings
  chrome.storage.sync.get(["autoInject", "defaultOpen"], (res) => {
    if (res.autoInject === undefined) {
      chrome.storage.sync.set({ autoInject: true });
    }
    if (res.defaultOpen === undefined) {
      chrome.storage.sync.set({ defaultOpen: false });
    }
  });

  // Setup right-click Context Menus
  chrome.contextMenus.create({
    id: "g4_ask_agent",
    title: "Ask EdgeOperator",
    contexts: ["page", "selection", "link"]
  });

  chrome.contextMenus.create({
    id: "g4_teach_macro",
    title: "⚡ Teach 1 → Batch N Macro",
    contexts: ["all"]
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === "g4_ask_agent") {
    chrome.tabs.sendMessage(tab.id, {
      type: "ASK_AGENT",
      selectionText: info.selectionText || ""
    }).catch(err => {
      console.warn("[OnDeviceAgent] Could not send message to tab:", err);
    });
  } else if (info.menuItemId === "g4_teach_macro") {
    chrome.tabs.sendMessage(tab.id, {
      type: "START_MACRO_RECORDING"
    }).catch(err => {
      console.warn("[OnDeviceAgent] Could not send message to tab:", err);
    });
  }
});

// Handle keyboard shortcuts (Alt+Shift+A, Alt+Shift+R)
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab || !activeTab.id) return;

    if (command === "toggle_agent") {
      chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_WIDGET" }).catch(() => {});
    } else if (command === "record_macro") {
      chrome.tabs.sendMessage(activeTab.id, { type: "START_MACRO_RECORDING" }).catch(() => {});
    }
  });
});

// =============================================================================
// Trusted input via the Chrome DevTools Protocol (optional "debugger" permission)
// Events delivered this way have isTrusted === true. Chrome shows its
// "started debugging this browser" bar while attached; we detach after a short idle.
// =============================================================================
const CDP_VERSION = "1.3";
const CDP_IDLE_DETACH_MS = 15000;
const attachedTabs = new Set();
const detachTimers = new Map();

const KEY_DEFS = {
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
  Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
  Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
};

async function trustedInputAllowed() {
  const [{ trustedInput }, granted] = await Promise.all([
    chrome.storage.sync.get(["trustedInput"]),
    chrome.permissions.contains({ permissions: ["debugger"] }),
  ]);
  return granted && trustedInput === true;
}

let detachListenerAdded = false;

async function ensureAttached(tabId) {
  // chrome.debugger only exists once the optional permission is granted, possibly after startup
  if (!detachListenerAdded) {
    // The user can cancel the debugging bar at any time; forget the attachment when they do
    chrome.debugger.onDetach.addListener(({ tabId: detachedId }) => {
      attachedTabs.delete(detachedId);
      clearTimeout(detachTimers.get(detachedId));
    });
    detachListenerAdded = true;
  }
  if (!attachedTabs.has(tabId)) {
    await chrome.debugger.attach({ tabId }, CDP_VERSION);
    attachedTabs.add(tabId);
  }
  clearTimeout(detachTimers.get(tabId));
  detachTimers.set(tabId, setTimeout(() => {
    attachedTabs.delete(tabId);
    chrome.debugger.detach({ tabId }).catch(() => {});
  }, CDP_IDLE_DETACH_MS));
}

// The popup may close while Chrome's permission prompt is open, so the setting follows the
// permission itself rather than code that runs after the popup's await
chrome.permissions.onAdded.addListener(({ permissions }) => {
  if (permissions && permissions.includes("debugger")) chrome.storage.sync.set({ trustedInput: true });
});
chrome.permissions.onRemoved.addListener(({ permissions }) => {
  if (!permissions || !permissions.includes("debugger")) return;
  chrome.storage.sync.set({ trustedInput: false });
  attachedTabs.clear();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
  clearTimeout(detachTimers.get(tabId));
});

async function dispatchTrustedInput(tabId, msg) {
  await ensureAttached(tabId);
  const send = (method, params) => chrome.debugger.sendCommand({ tabId }, method, params);
  const x = Number(msg.x);
  const y = Number(msg.y);

  switch (msg.action) {
    case "click":
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
      return;
    case "hover":
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      return;
    case "insertText":
      await send("Input.insertText", { text: String(msg.text || "") });
      return;
    case "key": {
      const def = KEY_DEFS[msg.key];
      if (!def) throw new Error(`Unsupported key: ${msg.key}`);
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...def });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...def, text: undefined });
      return;
    }
    default:
      throw new Error(`Unsupported trusted input action: ${msg.action}`);
  }
}

// Relay messages from popup to active tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "background") {
    if (message.type === "PING") {
      sendResponse({ status: "ok", timestamp: Date.now() });
    } else if (message.type === "CDP_INPUT") {
      const tabId = sender.tab && sender.tab.id;
      // Coordinates are top-frame viewport pixels, so only the top frame may request input
      if (!tabId || sender.frameId !== 0) {
        sendResponse({ ok: false, error: "Trusted input is only available to the top frame of a tab" });
        return true;
      }
      trustedInputAllowed()
        .then((allowed) => {
          if (!allowed) throw new Error("Trusted input is disabled or the debugger permission was not granted");
          return dispatchTrustedInput(tabId, message);
        })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    }
    return true;
  }
});
