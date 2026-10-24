/**
 * EdgeOperator • Content Script Wrapper
 * Bridges host webpage DOM with EdgeOperator engine and extension popups/shortcuts.
 */

(function () {
  console.log("[EdgeOperator] Content script loaded on:", window.location.hostname);

  let isInitialized = false;

  // 1. Ensure Extension Stylesheet is Injected Locally (Zero CDN Dependency)
  function injectLocalStyles() {
    if (document.getElementById("edge-operator-styles") || document.getElementById("on-device-chat-styles")) return;

    const link = document.createElement("link");
    link.id = "edge-operator-styles";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content/style.css");
    (document.head || document.documentElement).appendChild(link);
  }

  // 2. Initialize Agent Widget
  function initAgent(options = {}) {
    if (isInitialized) return;

    // Check if host page ALREADY embeds a native EdgeOperator / OnDeviceChat widget
    const existingLauncher = document.querySelector(
      "#eo-floating-launcher, #g4-floating-launcher, [data-eo-launcher], .eo-launcher-button, .g4-launcher-button, button[aria-label='Toggle AI Assistant'], button[aria-label='Open On-Device AI Chat'], button[aria-label='Open EdgeOperator']"
    );
    if (existingLauncher) {
      console.log("[EdgeOperator] Native launcher already present; yielding to host page embed.");
      isInitialized = true;
      return;
    }

    injectLocalStyles();

    const agent = window.EdgeOperator || window.OnDeviceChat;
    if (typeof agent === "undefined") {
      console.warn("[EdgeOperator] window.EdgeOperator / window.OnDeviceChat not yet available.");
      return;
    }

    try {
      if (window.EdgeOperator) {
        window.EdgeOperator.init({
          containerId: "edge-operator-root",
          defaultOpen: options.defaultOpen ?? false,
        });
      } else {
        window.OnDeviceChat.init({
          containerId: "edge-operator-root",
          defaultOpen: options.defaultOpen ?? false,
        });
      }
      isInitialized = true;
      loadTrustedInputSetting();
      console.log("[EdgeOperator] EdgeOperator widget successfully mounted.");
    } catch (err) {
      console.error("[EdgeOperator] Error initializing agent:", err);
    }
  }

  // 2b. Trusted input bridge: lets the engine's ActionDispatcher send real (isTrusted) clicks and
  // typing through the background worker's Chrome DevTools Protocol session. Top frame only,
  // because CDP input coordinates are top-level viewport pixels.
  function makeTrustedInputBridge() {
    const send = (payload) => new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ target: "background", type: "CDP_INPUT", ...payload }, (res) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          if (res && !res.ok) console.warn("[EdgeOperator] Trusted input unavailable, using synthetic events:", res.error);
          resolve(Boolean(res && res.ok));
        });
      } catch (e) {
        resolve(false);
      }
    });
    return {
      click: (x, y) => send({ action: "click", x, y }),
      hover: (x, y) => send({ action: "hover", x, y }),
      insertText: (text) => send({ action: "insertText", text }),
      pressKey: (key) => send({ action: "key", key }),
    };
  }

  function applyTrustedInputSetting(enabled) {
    const agent = window.EdgeOperator || window.OnDeviceChat;
    const dispatcher = agent && agent.ActionDispatcher;
    if (!dispatcher || typeof dispatcher.setTrustedInputBridge !== "function") return;
    dispatcher.setTrustedInputBridge(enabled && window === window.top ? makeTrustedInputBridge() : null);
  }

  function applyPermissionModeSetting(mode) {
    const agent = window.EdgeOperator || window.OnDeviceChat;
    if (agent && typeof agent.setPermissionMode === "function" && mode) {
      agent.setPermissionMode(mode);
    } else if (agent && agent.SafetyGate && typeof agent.SafetyGate.setPermissionMode === "function" && mode) {
      agent.SafetyGate.setPermissionMode(mode);
    }
  }

  function loadTrustedInputSetting() {
    chrome.storage.sync.get(["trustedInput", "permissionMode"], (res) => {
      applyTrustedInputSetting(res.trustedInput === true);
      if (res.permissionMode) applyPermissionModeSetting(res.permissionMode);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.trustedInput) applyTrustedInputSetting(changes.trustedInput.newValue === true);
    if (area === "sync" && changes.permissionMode) applyPermissionModeSetting(changes.permissionMode.newValue);
  });

  // 3. Toggle Widget Open/Close
  function toggleWidget() {
    const launcher = document.querySelector(
      "#eo-floating-launcher, #g4-floating-launcher, [data-eo-launcher], .eo-launcher-button, .g4-launcher-button, button[aria-label='Toggle AI Assistant'], button[aria-label='Open On-Device AI Chat'], button[aria-label='Open EdgeOperator']"
    );
    if (launcher) {
      launcher.click();
      return true;
    }

    const agent = window.EdgeOperator || window.OnDeviceChat;
    if (agent && typeof agent.open === "function") {
      agent.open();
      return true;
    }

    // Fallback: If not yet initialized, initialize with defaultOpen: true
    if (!isInitialized) {
      initAgent({ defaultOpen: true });
      return true;
    }

    // If initialized but launcher not yet committed to DOM by React, dispatch eo:open
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("eo:open"));
      return true;
    }

    return false;
  }

  // 4. Start Dynamic Macro Recording ("Teach 1 → Batch N")
  function startMacroRecording() {
    const agent = window.EdgeOperator || window.OnDeviceChat;
    if (agent && agent.MacroRecorder) {
      agent.MacroRecorder.startRecording();
      return { success: true };
    }
    return { success: false, error: "MacroRecorder not available" };
  }

  // 5. Query Active Page Discovery & Status
  function getPageStatus() {
    let entitiesCount = 0;
    let isRecording = false;

    const agent = window.EdgeOperator || window.OnDeviceChat;
    const hasWidgetOrLauncher = Boolean(
      document.querySelector("#eo-floating-launcher, #g4-floating-launcher, [data-eo-launcher], [data-eo-widget], [data-g4-widget]")
    );

    if (agent && agent.EntityExtractor) {
      try {
        const entities = agent.EntityExtractor.extractEntities();
        entitiesCount = entities.length;
      } catch (e) {
        console.warn("[EdgeOperator] Could not count entities:", e);
      }
    }

    if (agent && agent.MacroRecorder) {
      isRecording = agent.MacroRecorder.isRecording();
    }

    return {
      isInitialized: isInitialized && hasWidgetOrLauncher,
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

      case "TRIGGER_VOICE_INPUT":
        toggleWidget();
        // If voice input button is in DOM inside widget, trigger it
        setTimeout(() => {
          const micBtn = document.querySelector(".g4-widget-container button[title*='voice'], button[title*='voice']");
          if (micBtn) (micBtn).click();
        }, 200);
        sendResponse({ success: true });
        break;

      case "TRUSTED_INPUT_CHANGED":
        applyTrustedInputSetting(Boolean(message.enabled));
        sendResponse({ success: true });
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
