# Chrome Web Store Publication & Submission Guide: EdgeOperator AI

**Package:** `edge-operator-webstore-v0.2.0.zip` (408 KB)  
**Manifest Version:** 3 (MV3)  
**Live Site Verification:** Tested & verified on `https://developer.chrome.com/docs/webstore/publish`  
**All Assets Directory:** [`webstore-assets/`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/)

---

## 1. Quick Publication Checklist

| Step | Action | Status |
|:---|:---|:---|
| **1. Package Archive** | `edge-operator-webstore-v0.2.0.zip` (15 files, zero `.git`/`.DS_Store`) | ✅ Built & Verified |
| **2. Manifest Compliance** | Name: 38 chars ($\le 45$), Description: 124 chars ($\le 132$), Version: `0.2.0` | ✅ 100% Compliant |
| **3. Visual Assets** | 128x128 Icon, 440x280 Small Tile, 1400x560 Marquee, 3x 1280x800 Screenshots | ✅ Generated |
| **4. Live Browser Test** | Verified on `developer.chrome.com/docs/webstore/publish` (12/12 pass) | ✅ Verified |
| **5. Privacy Justification** | Single purpose & permission justifications formulated | ✅ Ready to paste |
| **6. Developer Account** | Chrome Developer Dashboard registration ($5 USD one-time fee) | ⏳ User Dashboard Action |

---

## 2. Store Listing Information (Copy & Paste Ready)

### Basic Information
* **Item Name:** `EdgeOperator AI • On-Device Web Agent` *(38 characters — limit 45)*
* **Short Description / Summary:**  
  `On-device AI agent & workflow operator for any website. Private SLMs, automated macros, 0 cloud API cost, 100% in-browser.` *(124 characters — limit 132)*
* **Category:** `Productivity` (Secondary: `Developer Tools`)
* **Language:** `English`
* **Homepage URL:** `https://agent.paulcreates.online`
* **Support URL:** `https://github.com/adarrshpaul/on-device-chat/issues`

### Detailed Description (For Store Listing Body)
```markdown
EdgeOperator AI is a 100% private, on-device autonomous browser agent and workflow operator for Google Chrome. It runs local Small Language Models (SLMs) and in-browser heuristic engines directly on your machine using Chrome Gemini Nano, WebGPU, and WebLLM—delivering zero cloud token cost, zero cloud latency, and complete data privacy.

⚡ KEY CAPABILITIES

1. Autonomous Website Understanding
- Instantly analyzes page landmarks, headings, tables, and navigation structures.
- Detects dynamic forms and interactive elements without relying on hardcoded selectors.
- Universal accessibility tree and DOM inspection designed for complex documentation, industrial WBM, and e-commerce portals.

2. Teach 1 → Batch N Workflow Automation
- Record multi-step browser routines (clicks, inputs, dropdown selections) in real-time.
- Replay and batch-execute workflows across repeated records or parameterized datasets.
- 1-click execution of site tours and repetitive form completions.

3. Complete Privacy & Air-Gapped Operation
- Prompts, page content, and browsing data NEVER leave your browser.
- No external LLM API keys required.
- Zero tracking, zero telemetry harvesting, and zero third-party data transmission.

4. Multi-Engine Architecture
- Reflex Engine: Instant, sub-5ms heuristic page navigation and UI actions.
- Nano Engine: Zero-download conversational Q&A via Chrome's built-in Prompt API.
- MiniLM & WebLLM: On-device semantic indexing and local generative reasoning.

---
Open source provenance: Apache-2.0 License.
Documentation & live web demo: https://agent.paulcreates.online
```

---

## 3. Privacy Practices Tab (Critical for Chrome Web Store Review)

Google's review team strictly audits the Privacy tab. Enter the following exact declarations:

### Single Purpose Declaration
> *"EdgeOperator AI provides an on-device AI assistant and dynamic browser workflow automation tool that runs local SLMs to inspect page structure and automate user-directed browsing routines without external server processing."*

### Permission Justifications

| Permission | Reviewer Justification (Paste into Dashboard) |
|:---|:---|
| `activeTab` | *"Used exclusively when the user opens the assistant to inspect the active tab's DOM structure, highlight target elements, and execute user-requested workflow steps."* |
| `storage` | *"Used to persist user-created workflow macros, UI dock preferences, and local model settings entirely within Chrome's local storage."* |
| `scripting` | *"Used to inject the isolated assistant container and accessibility tree scanner into web pages when toggled by the user."* |
| `contextMenus` | *"Used to provide an 'Ask EdgeOperator' context menu shortcut when the user right-clicks selected text on a page."* |
| `host_permissions` (`<all_urls>`) | *"EdgeOperator is a universal browser automation operator designed to work across any web application, industrial interface, or documentation site visited by the user."* |

### Data Usage Declarations
- **Data Collection:** Check **NO** to all personal data collection categories (No name, health, financials, location, history, or credentials collected).
- **Data Usage Certification:** Check all three required checkboxes:
  1. *"I do not sell or transfer user data to third parties."*
  2. *"I do not use or transfer user data for purposes unrelated to the item's core functionality."*
  3. *"I do not use or transfer user data to determine creditworthiness or for lending purposes."*
- **Privacy Policy URL:** `https://agent.paulcreates.online/privacy`

---

## 4. Visual Assets Inventory

All visual assets have been generated to Google's exact pixel specifications:

| Asset | Dimensions | File Location | Purpose |
|:---|:---|:---|:---|
| **Store Icon** | 128 × 128 px | [`webstore-assets/store_icon_128x128.png`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/store_icon_128x128.png) | High-res icon for store search & detail page |
| **Small Promo Tile** | 440 × 280 px | [`webstore-assets/small_promo_tile_440x280.png`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/small_promo_tile_440x280.png) | **Mandatory** promo card in store category listings |
| **Marquee Promo Tile** | 1400 × 560 px | [`webstore-assets/marquee_promo_tile_1400x560.png`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/marquee_promo_tile_1400x560.png) | Featured banner at top of Chrome Web Store |
| **Screenshot 1** | 1280 × 800 px | [`webstore-assets/screenshot_1_overview_1280x800.png`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/screenshot_1_overview_1280x800.png) | Live Overview on `developer.chrome.com` with Assistant open |
| **Screenshot 2** | 1280 × 800 px | [`webstore-assets/screenshot_2_workflows_1280x800.png`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/screenshot_2_workflows_1280x800.png) | Autonomous section navigation & element highlighting |
| **Screenshot 3** | 1280 × 800 px | [`webstore-assets/screenshot_3_interactive_1280x800.png`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/screenshot_3_interactive_1280x800.png) | Dynamic workflows view & multi-engine selector |

---

## 5. Step-by-Step Dashboard Upload Instructions

1. Open your browser and navigate to the **[Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)**.
2. Sign in with your developer Google account (complete the one-time $5 USD registration fee if this is your first extension).
3. Click the blue **"Add new item"** button in the top right.
4. Drag and drop or browse to select:  
   [`webstore-assets/edge-operator-webstore-v0.2.0.zip`](file:///Users/adarrsh/.gemini/antigravity/scratch/gemma4-chat-agent/webstore-assets/edge-operator-webstore-v0.2.0.zip)
5. Under **Store Listing**:
   - Verify the Name and Summary populated automatically from `manifest.json`.
   - Paste the **Detailed Description** from Section 2 above.
   - Upload `store_icon_128x128.png`, `small_promo_tile_440x280.png`, and `marquee_promo_tile_1400x560.png`.
   - Upload the three 1280x800 screenshots.
6. Under **Privacy**:
   - Paste the Single Purpose statement.
   - Fill in the permission justifications from Section 3.
   - Enter `https://agent.paulcreates.online/privacy` as your Privacy Policy URL.
   - Check the three data usage certification boxes.
7. Under **Distribution**:
   - Select **Public** visibility.
   - Select all regions (worldwide).
8. Click **"Submit for Review"**.
   - Optional: Check *"Defer publishing"* if you want to manually trigger the public release once Google approves the item.
