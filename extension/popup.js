/**
 * EdgeOperator • Action Popup Script
 * Coordinates popup UI with active browser tab and extension storage.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const versionEl = document.getElementById("ext-version");
  const statusBadgeEl = document.getElementById("status-badge");
  const statusTextEl = document.getElementById("status-text");
  const pageDomainEl = document.getElementById("page-domain");
  const pageTitleEl = document.getElementById("page-title");
  const entityCountEl = document.getElementById("entity-count");
  const btnToggleChat = document.getElementById("btn-toggle-chat");
  const btnRecordMacro = document.getElementById("btn-record-macro");
  const macroBtnLabel = document.getElementById("macro-btn-label");
  const macroBtnHint = document.getElementById("macro-btn-hint");
  const toggleAutoInject = document.getElementById("toggle-autoinject");
  const toggleDefaultOpen = document.getElementById("toggle-defaultopen");
  const toggleTrustedInput = document.getElementById("toggle-trustedinput");

  // 1. Display Version from Manifest
  const manifest = chrome.runtime.getManifest();
  if (manifest && manifest.version) {
    versionEl.textContent = `v${manifest.version}`;
  }

  // 2. Load Stored User Settings
  chrome.storage.sync.get(["autoInject", "defaultOpen"], (res) => {
    if (toggleAutoInject) {
      toggleAutoInject.checked = res.autoInject !== false;
    }
    if (toggleDefaultOpen) {
      toggleDefaultOpen.checked = res.defaultOpen === true;
    }
  });

  // 3. Save Settings on Change
  if (toggleAutoInject) {
    toggleAutoInject.addEventListener("change", (e) => {
      chrome.storage.sync.set({ autoInject: e.target.checked });
    });
  }

  // Trusted input needs the optional "debugger" permission, which Chrome only grants from a user gesture
  if (toggleTrustedInput) {
    chrome.storage.sync.get(["trustedInput"], async (res) => {
      const granted = await chrome.permissions.contains({ permissions: ["debugger"] });
      toggleTrustedInput.checked = granted && res.trustedInput === true;
    });
    toggleTrustedInput.addEventListener("change", async (e) => {
      let enabled = e.target.checked;
      if (enabled) {
        enabled = await chrome.permissions.request({ permissions: ["debugger"] });
        toggleTrustedInput.checked = enabled;
      } else {
        await chrome.permissions.remove({ permissions: ["debugger"] });
      }
      // background.js also mirrors the permission into storage, in case this popup closed during the prompt;
      // every tab's content script follows storage changes
      await chrome.storage.sync.set({ trustedInput: enabled });
    });
  }

  if (toggleDefaultOpen) {
    toggleDefaultOpen.addEventListener("change", (e) => {
      chrome.storage.sync.set({ defaultOpen: e.target.checked });
    });
  }

  // 4. Query Active Tab Context
  let activeTab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
  } catch (err) {
    console.error("[Popup] Could not query active tab:", err);
  }

  if (!activeTab || !activeTab.id) {
    setDisconnectedUI("No active tab found");
    return;
  }

  // Check if URL is a restricted Chrome page
  const tabUrl = activeTab.url || "";
  if (tabUrl.startsWith("chrome://") || tabUrl.startsWith("chrome-extension://") || tabUrl.startsWith("edge://")) {
    setDisconnectedUI("Restricted system page", "Browser internal pages cannot run EdgeOperator.");
    disableActions();
    return;
  }

  try {
    const urlObj = new URL(tabUrl);
    pageDomainEl.textContent = urlObj.hostname;
    pageTitleEl.textContent = activeTab.title || urlObj.hostname;
  } catch {
    pageDomainEl.textContent = "Web Page";
    pageTitleEl.textContent = activeTab.title || "Active Page";
  }

  // 5. Fetch Page Status from Content Script
  try {
    chrome.tabs.sendMessage(activeTab.id, { type: "GET_PAGE_STATUS" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might not have loaded yet or page was opened before extension was installed
        statusBadgeEl.classList.add("disconnected");
        statusTextEl.textContent = "Standby";
        entityCountEl.textContent = "Ready";
        return;
      }

      // Content script is active!
      statusBadgeEl.classList.remove("disconnected");
      statusTextEl.textContent = "Active";

      if (response.entitiesCount !== undefined) {
        entityCountEl.textContent = `${response.entitiesCount}`;
      } else {
        entityCountEl.textContent = "Ready";
      }

      if (response.domain) {
        pageDomainEl.textContent = response.domain;
      }
      if (response.title) {
        pageTitleEl.textContent = response.title;
      }

      if (response.isRecording) {
        btnRecordMacro.classList.add("recording");
        macroBtnLabel.textContent = "🔴 Recording Macro In Progress";
        macroBtnHint.textContent = "Perform actions on the page or open chat to complete";
      }
    });
  } catch (e) {
    console.warn("[Popup] Message error:", e);
  }

  // 6. Action Handlers
  btnToggleChat.addEventListener("click", () => {
    if (!activeTab || !activeTab.id) return;
    chrome.tabs.sendMessage(activeTab.id, { type: "TOGGLE_WIDGET" }, () => {
      window.close();
    });
  });

  btnRecordMacro.addEventListener("click", () => {
    if (!activeTab || !activeTab.id) return;
    chrome.tabs.sendMessage(activeTab.id, { type: "START_MACRO_RECORDING" }, (res) => {
      if (res && res.success) {
        btnRecordMacro.classList.add("recording");
        macroBtnLabel.textContent = "🔴 Recording Started";
        setTimeout(() => window.close(), 600);
      } else {
        window.close();
      }
    });
  });

  // Helper UI routines
  function setDisconnectedUI(domainText, titleText) {
    statusBadgeEl.classList.add("disconnected");
    statusTextEl.textContent = "Offline";
    pageDomainEl.textContent = domainText;
    pageTitleEl.textContent = titleText || domainText;
    entityCountEl.textContent = "0";
  }

  function disableActions() {
    btnToggleChat.disabled = true;
    btnToggleChat.style.opacity = "0.5";
    btnToggleChat.style.cursor = "not-allowed";
    btnRecordMacro.disabled = true;
    btnRecordMacro.style.opacity = "0.5";
    btnRecordMacro.style.cursor = "not-allowed";
  }
});
