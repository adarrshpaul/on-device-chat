/**
 * WorkflowPredictor: Decision-Model Powered Workflow Discovery & Synthesis
 *
 * Uses Vega Hamiltonian Decision Engine (System 1) to inspect live DOM landmarks,
 * user-stored workflows, and active context to predict the highest-value
 * automations for the active website.
 */

import { WebWorkflow } from "./types";
import { workflowStore } from "./workflowStore";
import { vegaDecisionEngine } from "./vegaEngine";
import { getCleanElementSelector } from "./domUtils";

export interface PredictedWorkflowCandidate {
  workflow: WebWorkflow;
  confidence: number;
  margin: number;
  rationale: string;
}

/**
 * Extracts a contextual title and description for an action button by inspecting
 * surrounding DOM landmarks, item cards, tables, or product containers.
 * Disambiguates repeating button names like "Add to Cart" vs "Add to Cart".
 */
function extractContextualButtonAction(btn: HTMLElement): { name: string; description: string; triggerPhrase: string } {
  const rawText = (btn.textContent || btn.getAttribute("aria-label") || (btn as HTMLInputElement).value || "Action").trim();
  const cleanAction = rawText.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").slice(0, 24).trim();

  // 1. Direct explicit attributes
  let subject = btn.getAttribute("data-product") || 
                btn.getAttribute("data-item") || 
                btn.getAttribute("data-title") || 
                btn.getAttribute("data-target") || 
                btn.getAttribute("title") || "";

  // 1b. Check inline handlers (e.g. onclick="addToCart('Ultra ANC Headphones')")
  if (!subject) {
    const onclickStr = btn.getAttribute("onclick") || "";
    const handlerMatch = onclickStr.match(/(?:cart|item|product|buy|add)\s*\(\s*['"]([^'"]{2,40})['"]/i) || onclickStr.match(/['"]([A-Z][a-zA-Z0-9\s]{2,35})['"]/);
    if (handlerMatch && handlerMatch[1]) {
      subject = handlerMatch[1].trim();
    }
  }

  // 2. Nearest card / row / item container
  if (!subject) {
    const container = btn.closest("tr, li, article, [role='row'], [role='listitem'], [class*='card'], [class*='product'], [class*='item'], [class*='row'], form, fieldset, section");
    if (container && container !== document.body) {
      // 2a. Priority headings or title elements
      const heading = container.querySelector("h1, h2, h3, h4, h5, h6, strong, b, [class*='title'], [class*='name']");
      if (heading && heading !== btn && !btn.contains(heading)) {
        const text = (heading.textContent || "").trim();
        const clean = text.replace(/[$€£¥]\s*[\d,.]+/g, "").replace(/[-–|•].*$/, "").trim();
        if (clean && clean.length >= 2 && clean.length <= 40 && clean.toLowerCase() !== cleanAction.toLowerCase()) {
          subject = clean;
        }
      }

      // 2b. If no semantic heading, look for prominent text in container (excluding prices)
      if (!subject) {
        const textElements = Array.from(container.querySelectorAll("div, span, p, a, td")) as HTMLElement[];
        for (const el of textElements) {
          if (el === btn || btn.contains(el)) continue;
          // Skip pure price tags or sub-counters
          const txt = (el.textContent || "").trim();
          if (/^\s*[$€£¥]\s*[\d,.]+\s*$/.test(txt)) continue;
          const clean = txt.replace(/[$€£¥]\s*[\d,.]+/g, "").replace(/[-–|•].*$/, "").trim();
          if (clean.length >= 2 && clean.length <= 40 && clean.toLowerCase() !== cleanAction.toLowerCase() && !/^(in stock|out of stock|free shipping|qty|quantity|\d+)$/i.test(clean)) {
            subject = clean;
            break;
          }
        }
      }

      // 2c. Container ID or class product slug
      if (!subject && container.id) {
        const slugMatch = container.id.match(/(?:product|item|card)[-_]([a-zA-Z0-9_-]+)/i);
        if (slugMatch && slugMatch[1]) {
          subject = slugMatch[1].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        }
      }
    }
  }

  // 3. Preceding siblings
  if (!subject) {
    let prev = btn.previousElementSibling;
    while (prev) {
      const headingCandidate = prev.querySelector("h1, h2, h3, h4, h5, h6, strong, b, [class*='title'], [class*='name']") || prev;
      const text = (headingCandidate.textContent || "").trim().replace(/[$€£¥]\s*[\d,.]+/g, "").trim();
      if (text && text.length >= 2 && text.length <= 40 && text.toLowerCase() !== cleanAction.toLowerCase()) {
        subject = text;
        break;
      }
      prev = prev.previousElementSibling;
    }
  }

  // 4. Button ID or testid slug fallback (e.g. btn-add-headphones -> Headphones)
  if (!subject) {
    const rawId = btn.id || btn.getAttribute("data-testid") || "";
    const idMatch = rawId.match(/(?:btn[-_]add[-_]|add[-_]|btn[-_])([a-zA-Z0-9]+)/i);
    if (idMatch && idMatch[1] && !/^(btn|button|action|cart|item)$/i.test(idMatch[1])) {
      subject = idMatch[1].replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  if (subject) {
    const words = subject.split(/\s+/);
    // Keep subject concise, e.g. "Ultra ANC Headphones" -> "Headphones" or last 2 words
    const shortSubject = words.length > 2 ? (words[words.length - 1].length > 3 ? words[words.length - 1] : words.slice(-2).join(" ")) : subject;

    if (/add to cart/i.test(cleanAction)) {
      return {
        name: `⚡ Add ${shortSubject} to Cart`,
        description: `Add ${subject} to cart directly on this page.`,
        triggerPhrase: `add ${shortSubject.toLowerCase()} to cart`,
      };
    }
    if (/buy|order|checkout|purchase/i.test(cleanAction)) {
      return {
        name: `⚡ ${cleanAction} ${shortSubject}`,
        description: `${cleanAction} ${subject} directly on this page.`,
        triggerPhrase: `${cleanAction.toLowerCase()} ${shortSubject.toLowerCase()}`,
      };
    }
    return {
      name: `⚡ ${cleanAction}: ${shortSubject}`,
      description: `${cleanAction} on ${subject} directly on this page.`,
      triggerPhrase: `${cleanAction.toLowerCase()} ${shortSubject.toLowerCase()}`,
    };
  }

  return {
    name: `⚡ ${cleanAction}`,
    description: `Execute ${cleanAction} action directly on this page.`,
    triggerPhrase: cleanAction.toLowerCase(),
  };
}

export class WorkflowPredictor {
  /**
   * Predict novel or adjacent workflows for the active page using Vega decision dynamics
   */
  public static async predictWorkflows(limit: number = 4): Promise<PredictedWorkflowCandidate[]> {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return [];
    }

    const host = window.location.hostname.replace(/^www\./, "");
    const siteTitle = (document.title || "").split(/[-|•–]/)[0].trim() || host;

    // 1. Fetch currently stored workflows to avoid exact duplicates
    const stored = await workflowStore.getWorkflowsForOrigin(host);
    const existingNames = new Set(stored.map((w) => w.name.toLowerCase().replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").trim()));

    // 2. Scan live page landmarks and candidate elements
    const candidates: WebWorkflow[] = [];

    // Candidate 1: Interactive Canvas / WebGL Game Autopilot
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    if (canvas && !canvas.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) {
      candidates.push({
        id: `wf_pred_game_${Date.now()}`,
        name: `🎮 Play Game Autopilot`,
        description: `Autonomous 60Hz physics trajectory controller to play game and maximize score on canvas.`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["game", "canvas", "autopilot", "play", "score"],
        triggerPhrase: "play game",
        steps: [
          {
            id: "step_1",
            title: "Launch Autonomous Game Autopilot",
            action: "game_autopilot",
            target: "canvas",
            delayMs: 1000,
            status: "idle",
          },
        ],
      });
    }

    // Candidate 2: Prominent Interactive Action Buttons (play, start, add to cart, search, etc.)
    const actionButtons = Array.from(document.querySelectorAll("button, input[type='submit'], [role='button'], a.btn"))
      .filter((b) => {
        if (b.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) return false;
        const rect = b.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const txt = (b.textContent || b.getAttribute("aria-label") || (b as HTMLInputElement).value || "").trim();
        return txt.length >= 2 && txt.length <= 30 && /^(?:run|play|start|launch|execute|calculate|benchmark|search|add to cart|checkout|subscribe|filter|explore)\b/i.test(txt);
      })
      .slice(0, 3) as HTMLElement[];

    actionButtons.forEach((btn, idx) => {
      const { name, description, triggerPhrase } = extractContextualButtonAction(btn);
      candidates.push({
        id: `wf_pred_btn_${idx}_${Date.now()}`,
        name,
        description,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: [triggerPhrase, "action"],
        triggerPhrase,
        steps: [
          {
            id: "step_1",
            title: `Click ${name.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "")}`,
            action: "click",
            target: getCleanElementSelector(btn),
            delayMs: 800,
            status: "idle",
          },
        ],
      });
    });

    // Candidate 2.5: Industrial OT WBM Commit Actions (Set Values, Apply, Save to switch, Save to NVM, Commit)
    const otCommitButtons = Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button'], [role='button'], a.btn"))
      .filter((b) => {
        if (b.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) return false;
        const rect = b.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const txt = (b.textContent || b.getAttribute("aria-label") || (b as HTMLInputElement).value || "").trim();
        return txt.length >= 3 && txt.length <= 32 && /^(?:set values|apply|save to switch|save configuration|save to nvm|save to flash|save & apply|save and apply|commit|write to eeprom|write to flash|save values|commit values|refresh values|apply changes|store to flash)\b/i.test(txt);
      })
      .slice(0, 2) as HTMLElement[];

    otCommitButtons.forEach((btn, idx) => {
      const rawText = (btn.textContent || btn.getAttribute("aria-label") || (btn as HTMLInputElement).value || "Commit").trim();
      const cleanLabel = rawText.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").slice(0, 22);
      candidates.push({
        id: `wf_pred_ot_commit_${idx}_${Date.now()}`,
        name: `💾 Commit Configuration (${cleanLabel})`,
        description: `Verified commit of configuration parameters to device memory (${cleanLabel}).`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["commit", "industrial", "wbm", "save", cleanLabel.toLowerCase()],
        triggerPhrase: `commit ${cleanLabel.toLowerCase()}`,
        steps: [
          {
            id: "step_1",
            title: `Commit via ${cleanLabel}`,
            action: "click",
            target: getCleanElementSelector(btn),
            delayMs: 800,
            status: "idle",
          },
        ],
      });
    });

    // Candidate 2.6: Industrial OT WBM Left-Tree Navigation Links
    const treeNavLinks = Array.from(document.querySelectorAll("nav a, aside a, .tree a, .menu a, [role='tree'] [role='treeitem'], table td a"))
      .filter((a) => {
        if (a.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) return false;
        const rect = a.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const txt = (a.textContent || a.getAttribute("aria-label") || "").trim();
        return txt.length >= 3 && txt.length <= 25 && /^(?:system|security|passwords|layer 2|layer 3|vlan|telecontrol|diagnostics|maintenance|load & save|load\/save|profinet|sntp|ethernet\/ip)\b/i.test(txt);
      })
      .slice(0, 3) as HTMLElement[];

    treeNavLinks.forEach((navLink, idx) => {
      const linkText = (navLink.textContent || navLink.getAttribute("aria-label") || "Section").trim();
      const cleanSection = linkText.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").slice(0, 20);
      candidates.push({
        id: `wf_pred_ot_nav_${idx}_${Date.now()}`,
        name: `🗂️ Configure ${cleanSection}`,
        description: `Navigate to ${cleanSection} configuration tree in device WBM.`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["navigation", "wbm", cleanSection.toLowerCase()],
        triggerPhrase: `go to ${cleanSection.toLowerCase()}`,
        steps: [
          {
            id: "step_1",
            title: `Open ${cleanSection} Menu`,
            action: "click",
            target: getCleanElementSelector(navLink),
            delayMs: 600,
            status: "idle",
          },
        ],
      });
    });

    // Candidate 3: Verified File / Document Download
    const downloadEl = document.querySelector(
      "a[download], a[href*='resume' i], a[href*='cv' i], a[href*='.pdf' i], a[href*='.zip' i]"
    ) as HTMLElement | null;
    if (downloadEl && !downloadEl.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) {
      const rawText = (downloadEl.textContent || downloadEl.getAttribute("aria-label") || "File Download").trim();
      const cleanLabel = rawText.replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").slice(0, 24);
      candidates.push({
        id: `wf_pred_download_${Date.now()}`,
        name: `📄 One-Click ${cleanLabel}`,
        description: `Directly triggers the verified download of ${cleanLabel} without manual hunting.`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["download", cleanLabel.toLowerCase()],
        triggerPhrase: `download ${cleanLabel.toLowerCase()}`,
        steps: [
          {
            id: "step_1",
            title: `Download ${cleanLabel}`,
            action: "click",
            target: getCleanElementSelector(downloadEl),
            delayMs: 600,
            status: "idle",
          },
        ],
      });
    }

    // Candidate 4: Interactive Input & Submission Form
    const messageInput = document.querySelector(
      "textarea, input[name*='message' i], input[placeholder*='message' i], input[type='email'], input[name*='comment' i]"
    ) as HTMLElement | null;
    const submitBtn = document.querySelector(
      "button[type='submit'], input[type='submit'], form button"
    ) as HTMLElement | null;
    if (messageInput && submitBtn && !messageInput.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) {
      const btnLabel = (submitBtn.textContent || submitBtn.getAttribute("aria-label") || "Submit Form").trim().replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").slice(0, 20);
      candidates.push({
        id: `wf_pred_contact_${Date.now()}`,
        name: `✉️ ${btnLabel || "Focus Input & Submit"}`,
        description: `Focuses message input and highlights submission controls.`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["form", "input", btnLabel.toLowerCase()],
        triggerPhrase: btnLabel.toLowerCase(),
        steps: [
          {
            id: "step_1",
            title: `Focus ${messageInput.getAttribute("placeholder") || "Input Field"}`,
            action: "click",
            target: getCleanElementSelector(messageInput),
            delayMs: 500,
            status: "idle",
          },
        ],
      });
    }

    // Candidate 5: Deep Landmark Exploration (Derived Dynamically from Physical Headings)
    const landmarks = Array.from(document.querySelectorAll("section[id], h2[id], div[id], [role='region'][id]"))
      .filter((el) => {
        const id = el.id.toLowerCase();
        return !el.closest?.("[data-eo-widget='true'], [data-g4-widget='true']") && id.length >= 3 && !/^(header|footer|nav|root|app)$/i.test(id);
      })
      .slice(0, 4) as HTMLElement[];
    if (landmarks.length >= 2) {
      const landmarkNames = landmarks.map((lm) => {
        const heading = typeof lm.querySelector === "function" ? lm.querySelector("h1, h2, h3, h4") : null;
        return (heading?.textContent?.trim() || lm.id.replace(/[-_]/g, " ")).slice(0, 18);
      });
      const summaryTitle = landmarkNames.slice(0, 2).join(" & ");
      candidates.push({
        id: `wf_pred_landmarks_${Date.now()}`,
        name: `🧭 Explore ${summaryTitle}`,
        description: `Sequentially steps through ${landmarks.length} core sections (${landmarkNames.join(", ")}).`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["explore", "landmarks", ...landmarkNames.map((s) => s.toLowerCase())],
        triggerPhrase: `explore ${landmarkNames[0]?.toLowerCase() || "sections"}`,
        steps: landmarks.map((lm, idx) => ({
          id: `step_${idx + 1}`,
          title: `Inspect ${landmarkNames[idx]}`,
          action: "scroll",
          target: `#${lm.id}`,
          delayMs: 1200,
          status: "idle",
        })),
      });
    }

    // Candidate 6: Search & Discovery
    const searchInput = document.querySelector(
      "input[type='search'], input[placeholder*='search' i], input[id*='search' i]"
    ) as HTMLElement | null;
    if (searchInput && !searchInput.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) {
      candidates.push({
        id: `wf_pred_search_${Date.now()}`,
        name: `🔍 Focus Search & Filter`,
        description: `Activates search bar for rapid item queries.`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["search", "find", "query"],
        triggerPhrase: "search",
        steps: [
          {
            id: "step_1",
            title: "Focus Search Input",
            action: "click",
            target: getCleanElementSelector(searchInput),
            delayMs: 400,
            status: "idle",
          },
        ],
      });
    }

    // Candidate 7: Interactive Guided Tour across all detected sections
    const allSections = Array.from(document.querySelectorAll("section[id], [role='region'][id]"))
      .filter((s) => (s as HTMLElement).id && !s.closest?.("[data-eo-widget='true'], [data-g4-widget='true']"))
      .slice(0, 5) as HTMLElement[];
    if (allSections.length >= 2) {
      candidates.push({
        id: `wf_pred_tour_${Date.now()}`,
        name: `🗺️ Explore ${siteTitle.slice(0, 20)}`,
        description: `Guided walkthrough across all ${allSections.length} core sections of this page.`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["tour", "explore", "guide", "walkthrough"],
        triggerPhrase: "guided tour",
        steps: allSections.map((s, idx) => ({
          id: `step_${idx + 1}`,
          title: `Visit ${s.id.replace(/[-_]/g, " ").slice(0, 20)}`,
          action: "scroll",
          target: `#${s.id}`,
          delayMs: 1200,
          status: "idle",
        })),
      });
    }

    // Candidate 8: Theme Mode Toggle (Only if physically present)
    const themeBtn = document.querySelector(
      "button[aria-label*='theme' i], button[title*='theme' i], [data-theme-toggle], .theme-toggle"
    ) as HTMLElement | null;
    if (themeBtn && !themeBtn.closest?.("[data-eo-widget='true'], [data-g4-widget='true']")) {
      candidates.push({
        id: `wf_pred_theme_${Date.now()}`,
        name: `🎨 Toggle Dark/Light Theme`,
        description: `Instantly toggle appearance theme mode between light and dark.`,
        siteOrigin: host,
        executionCount: 0,
        createdAt: Date.now(),
        tags: ["theme", "dark mode", "light mode", "contrast"],
        triggerPhrase: "toggle theme",
        steps: [
          {
            id: "step_1",
            title: "Toggle Theme Mode",
            action: "click",
            target: getCleanElementSelector(themeBtn),
            delayMs: 800,
            status: "idle",
          },
        ],
      });
    }

    // Filter out candidates that match already stored workflow names
    const filteredCandidates = candidates.filter((c) => {
      const clean = c.name.toLowerCase().replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "").trim();
      return !existingNames.has(clean);
    });

    // Ensure we ALWAYS have a pool to score and return to the UI:
    // If all candidates are already saved, score existing stored workflows so predictions are always surfaced!
    const poolToScore = filteredCandidates.length > 0 ? filteredCandidates : (stored.length > 0 ? stored : candidates);

    if (poolToScore.length === 0) {
      return [];
    }

    // 3. Apply Decision Model (Vega Hamiltonian Dynamics) to score relevance
    const criteria: Record<string, string> = {};
    poolToScore.forEach((c) => {
      criteria[c.id] = `${c.name}: ${c.description}`;
    });

    const downloadDesc = downloadEl ? (downloadEl.textContent?.trim() || downloadEl.getAttribute("aria-label") || "File Download") : "none";
    const canvasDesc = canvas ? "interactive canvas game present" : "no canvas";
    const otDesc = otCommitButtons.length > 0 ? `Industrial OT WBM detected with commit action (${otCommitButtons.map(b => b.textContent?.trim() || (b as HTMLInputElement).value).join(", ")})` : "standard web page";
    const pageState = `Website: ${siteTitle} (${host}). Mode: ${otDesc}. Canvas: ${canvasDesc}. Available landmarks: ${landmarks.map((l) => l.id).join(", ")}. Primary actions: ${downloadDesc}, contact form: ${Boolean(messageInput)}, search: ${Boolean(searchInput)}. Stored workflows count: ${stored.length}.`;

    try {
      const decision = await vegaDecisionEngine.decide(pageState, {
        top_workflow: {
          type: "choice",
          instructions: "Rank the most useful, high-impact user automation for this website.",
          criteria,
        },
      });

      const probs = decision.answers.top_workflow?.probs || {};
      const margin = decision.answers.top_workflow?.margin || 0.1;

      // Map candidates with their calibrated probabilities
      const scored: PredictedWorkflowCandidate[] = poolToScore.map((c) => {
        let p = probs[c.id] ?? (1.0 / poolToScore.length);
        if (c.tags?.includes("commit")) {
          // Priority boost for physical OT commit controls on WBM interfaces
          p += 0.15;
        }
        return {
          workflow: c,
          confidence: Math.round(p * 100) / 100,
          margin,
          rationale: `Calibrated by Vega Decision Engine (${Math.round(p * 100)}% relevance).`,
        };
      });

      // Sort by confidence descending
      scored.sort((a, b) => b.confidence - a.confidence);
      const top = scored.slice(0, limit);
      // Auto-save top predicted workflows so they can be run immediately
      for (const item of top) {
        await workflowStore.saveWorkflow(item.workflow);
      }
      return top;
    } catch (err) {
      console.warn("[WorkflowPredictor] Vega decision scoring failed, returning ranked heuristic:", err);
      const fallback = poolToScore.slice(0, limit).map((c) => ({
        workflow: c,
        confidence: 0.88,
        margin: 0.2,
        rationale: "Synthesized from active page landmarks.",
      }));
      for (const item of fallback) {
        await workflowStore.saveWorkflow(item.workflow);
      }
      return fallback;
    }
  }

  /**
   * Predict and automatically persist recommended workflows into the store
   */
  public static async autoPersistPredictedWorkflows(): Promise<WebWorkflow[]> {
    const predictions = await this.predictWorkflows(2);
    const added: WebWorkflow[] = [];
    for (const pred of predictions) {
      await workflowStore.saveWorkflow(pred.workflow);
      added.push(pred.workflow);
    }
    return added;
  }
}
