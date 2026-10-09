/**
 * State Delta Verifier (OODA Loop Closure)
 *
 * Implements SOTA Action-Feedback loops (WebArena / OSWorld / Mind2Web):
 * Captures before & after environment snapshots to verify whether an action
 * caused an observable state transition (URL change, modal opening, focus shift, DOM expansion).
 */

export interface IStateSnapshot {
  url: string;
  pathname: string;
  hash: string;
  title: string;
  scrollY: number;
  focusedTag: string;
  focusedSelector: string;
  domElementCount: number;
  openModalsCount: number;
  timestamp: number;
}

export interface IStateDelta {
  hasStateChanged: boolean;
  urlChanged: boolean;
  modalOpened: boolean;
  modalClosed: boolean;
  focusShifted: boolean;
  scrolled: boolean;
  domMutated: boolean;
  summary: string;
}

export class StateDeltaVerifier {
  /**
   * Capture current lightweight state of the page
   */
  public static captureSnapshot(): IStateSnapshot {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return {
        url: "",
        pathname: "",
        hash: "",
        title: "",
        scrollY: 0,
        focusedTag: "",
        focusedSelector: "",
        domElementCount: 0,
        openModalsCount: 0,
        timestamp: Date.now(),
      };
    }

    const activeEl = document.activeElement;
    const focusedTag = activeEl ? activeEl.tagName.toLowerCase() : "";
    const focusedSelector = activeEl && activeEl !== document.body ? (activeEl.id ? `#${activeEl.id}` : focusedTag) : "";

    const openModals = document.querySelectorAll(
      "dialog[open], [role='dialog'], [aria-modal='true'], .modal-open, .is-active"
    ).length;

    return {
      url: window.location.href,
      pathname: window.location.pathname,
      hash: window.location.hash,
      title: document.title,
      scrollY: Math.round(window.scrollY),
      focusedTag,
      focusedSelector,
      domElementCount: document.querySelectorAll("*").length,
      openModalsCount: openModals,
      timestamp: Date.now(),
    };
  }

  /**
   * Compare two snapshots and generate an actionable delta report
   */
  public static computeDelta(before: IStateSnapshot, after: IStateSnapshot): IStateDelta {
    const urlChanged = before.url !== after.url || before.hash !== after.hash;
    const modalOpened = after.openModalsCount > before.openModalsCount;
    const modalClosed = after.openModalsCount < before.openModalsCount;
    const focusShifted = before.focusedSelector !== after.focusedSelector && after.focusedSelector !== "";
    const scrolled = Math.abs(after.scrollY - before.scrollY) > 20;
    const domMutated = Math.abs(after.domElementCount - before.domElementCount) > 2;

    const changes: string[] = [];

    if (urlChanged) {
      changes.push(`URL routed to "${after.pathname}${after.hash}"`);
    }
    if (modalOpened) {
      changes.push("Modal dialog opened");
    }
    if (modalClosed) {
      changes.push("Modal dialog dismissed");
    }
    if (focusShifted) {
      changes.push(`Focus shifted to <${after.focusedTag}>`);
    }
    if (scrolled) {
      changes.push(`Scrolled to Y=${after.scrollY}`);
    }
    if (domMutated) {
      changes.push(`DOM mutated (${after.domElementCount - before.domElementCount > 0 ? "+" : ""}${after.domElementCount - before.domElementCount} elements)`);
    }

    const hasStateChanged = changes.length > 0;
    const summary = hasStateChanged
      ? changes.join("; ")
      : "No observable state transition (page remained stagnant)";

    return {
      hasStateChanged,
      urlChanged,
      modalOpened,
      modalClosed,
      focusShifted,
      scrolled,
      domMutated,
      summary,
    };
  }
}
