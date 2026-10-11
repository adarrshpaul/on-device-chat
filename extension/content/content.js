/**
 * On-Device Browser Agent • Content Script Wrapper
 * Bridges host webpage DOM with on-device-chat engine and extension popups/shortcuts.
 */

(function () {
  console.log("[OnDeviceAgent] Content script loaded on:", window.location.hostname);

  let isInitialized = false;

  // 1. Ensure Extension Stylesheet is Injected Locally (Zero CDN Dependency)
  function injectLocalStyles() {
    if (document.getElementById("on-device-chat-styles")) return;

    const link = document.createElement("link");
    link.id = "on-device-chat-styles";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content/style.css");
    (document.head || document.documentElement).appendChild(link);
  }

  // 2. Initialize Agent Widget
  function initAgent(options = {}) {
    if (isInitialized) return;
    injectLocalStyles();

    if (typeof window.OnDeviceChat === "undefined") {
      console.warn("[OnDeviceAgent] window.OnDeviceChat not yet available.");
      return;
    }

    try {
      window.OnDeviceChat.init({
        containerId: "gemma4-widget-root",
        defaultOpen: options.defaultOpen ?? false,
      });
      isInitialized = true;
      console.log("[OnDeviceAgent] Agent widget successfully mounted.");
    } catch (err) {
      console.error("[OnDeviceAgent] Error initializing agent:", err);
    }
  }

  // 3. Toggle Widget Open/Close
  function toggleWidget() {
    const launcher = document.querySelector("#g4-floating-launcher, .g4-launcher-button, button[aria-label='Toggle AI Assistant'], button[aria-label='Open On-Device AI Chat']");
    if (launcher) {
      launcher.click();
      return true;
    }

    // Fallback: If not yet initialized, initialize with defaultOpen: true
    if (!isInitialized) {
      initAgent({ defaultOpen: true });
      return true;
    }

    return false;
  }

  // 4. Start Dynamic Macro Recording ("Teach 1 → Batch N")
  function startMacroRecording() {
    if (window.OnDeviceChat && window.OnDeviceChat.MacroRecorder) {
      window.OnDeviceChat.MacroRecorder.startRecording();
      return { success: true };
    }
    return { success: false, error: "MacroRecorder not available" };
  }

  // 5. Query Active Page Discovery & Status
  function getPageStatus() {
    let entitiesCount = 0;
    let isRecording = false;

    if (window.OnDeviceChat && window.OnDeviceChat.EntityExtractor) {
      try {
        const entities = window.OnDeviceChat.EntityExtractor.extractEntities();
        entitiesCount = entities.length;
      } catch (e) {
        console.warn("[OnDeviceAgent] Could not count entities:", e);
      }
    }

    if (window.OnDeviceChat && window.OnDeviceChat.MacroRecorder) {
      isRecording = window.OnDeviceChat.MacroRecorder.isRecording();
    }

    return {
      isInitialized,
      isRecording,
      entitiesCount,
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname,
    };
  }

  // 6. Listen for Extension Messages from Background / Popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "GET_PAGE_STATUS":
        sendResponse(getPageStatus());
        break;

      case "TOGGLE_WIDGET":
        const toggled = toggleWidget();
        sendResponse({ success: toggled });
        break;

      case "START_MACRO_RECORDING":
        const recordRes = startMacroRecording();
        sendResponse(recordRes);
        break;

      case "ASK_AGENT":
        toggleWidget();
        sendResponse({ success: true, text: message.selectionText });
        break;

      default:
        sendResponse({ unhandled: true });
    }
    return true; // Keep message channel open for async response
  });

  // 7. Auto-inject based on storage preference
  chrome.storage.sync.get(["autoInject", "defaultOpen"], (settings) => {
    const shouldInject = settings.autoInject !== false;
    if (shouldInject) {
      // Delay slightly to ensure host page has started rendering
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          setTimeout(() => initAgent({ defaultOpen: settings.defaultOpen || false }), 300);
        });
      } else {
        setTimeout(() => initAgent({ defaultOpen: settings.defaultOpen || false }), 300);
      }
    }
  });
})();
