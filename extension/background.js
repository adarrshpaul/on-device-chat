/**
 * On-Device Browser Agent • Background Service Worker (Manifest V3)
 * Handles global shortcuts, context menus, and active tab messaging.
 */

// Initialize extension defaults on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("[OnDeviceAgent] Background service worker initialized.");

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
    title: "Ask On-Device AI Agent",
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

// Relay messages from popup to active tab
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "background") {
    if (message.type === "PING") {
      sendResponse({ status: "ok", timestamp: Date.now() });
    }
    return true;
  }
});
