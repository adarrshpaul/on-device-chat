/**
/**
 * Autonomous Guided Site Tour Engine
 *
 * Automatically explores, identifies, navigates, and highlights key landmarks
 * across any website (SPAs, e-commerce, SaaS, documentation, blogs, portfolios)
 * giving users an interactive guided tour without requiring hardcoded logic.
 */

import {
  smartQuerySelector,
  getCleanElementSelector,
  isWidgetElement,
  humanNavigateTo,
} from "./domUtils";

export interface TourStop {
  id: string;
  title: string;
  category: "hero" | "section" | "interactive" | "navigation" | "contact" | "landmark";
  description: string;
  selector: string;
  element?: HTMLElement | null;
  scrollY?: number;
}

export function planSiteTour(): TourStop[] {
  if (typeof document === "undefined") return [];

  const stops: TourStop[] = [];
  const seenSelectors = new Set<string>();

  const addStop = (stop: TourStop) => {
    if (!seenSelectors.has(stop.selector)) {
      seenSelectors.add(stop.selector);
      stops.push(stop);
    }
  };

  const siteTitle = document.title ? document.title.split(/[-|•–]/)[0].trim() : "Application";

  // 1. Dynamic Hero / Header Landmark
  const heroEl = smartQuerySelector("header, [role='banner'], .hero, [class*='hero' i], h1, main h1");
  if (heroEl) {
    const h1Text = (typeof heroEl.querySelector === "function" ? heroEl.querySelector("h1")?.textContent?.trim() : null) || heroEl.textContent?.trim().slice(0, 40) || siteTitle;
    const heroDesc = (typeof heroEl.querySelector === "function" ? heroEl.querySelector("p, [class*='subtitle' i]")?.textContent?.trim().slice(0, 140) : null) ||
      `Welcome to ${siteTitle}! Overview of layout, structure, and capabilities.`;

    addStop({
      id: "hero",
      title: h1Text ? h1Text.slice(0, 35) : "Welcome & Overview",
      category: "hero",
      description: heroDesc,
      selector: getCleanElementSelector(heroEl),
      element: heroEl,
      scrollY: 0,
    });
  }

  // 2. Discover Structural Sections & Regions Dynamically
  const candidateSections = Array.from(
    document.querySelectorAll(
      "section[id], section, article[id], article, main > section, main > div[id], [role='region'], div[id*='section' i], div[id*='playground' i], div[id*='calculator' i], div[id*='pricing' i], div[id*='benchmarks' i]"
    )
  ).filter((el) => !isWidgetElement(el)) as HTMLElement[];

  for (const sec of candidateSections.slice(0, 8)) {
    if (!sec || typeof sec.getBoundingClientRect !== "function") continue;
    const rect = sec.getBoundingClientRect();
    // Skip hidden or tiny decorative elements
    if (rect.height < 50) continue;

    const headingEl = typeof sec.querySelector === "function" ? sec.querySelector("h1, h2, h3, h4, [role='heading']") : null;
    const rawHeading = (
      headingEl?.textContent ||
      sec.getAttribute?.("aria-label") ||
      (sec.id ? sec.id.replace(/[-_]/g, " ") : "")
    ).trim();

    if (!rawHeading) continue;
    const headingText = rawHeading.slice(0, 40);

    const pText = (typeof sec.querySelector === "function" ? sec.querySelector("p")?.textContent?.trim().slice(0, 140) : null) ||
      `Explore ${headingText} and associated features on this page.`;

    const cleanSel = getCleanElementSelector(sec);
    const stopId = sec.id || `section_${stops.length + 1}`;

    addStop({
      id: stopId,
      title: headingText.slice(0, 35),
      category: "section",
      description: pText,
      selector: cleanSel,
      element: sec,
      scrollY: Math.round(window.scrollY + rect.top),
    });
  }

  // 3. Discover Interactive Canvases & Visual Engines (WebGL / 2D Canvas)
  const canvasEl = document.querySelector("canvas:not([data-g4-widget] canvas)") as HTMLElement | null;
  if (canvasEl && !isWidgetElement(canvasEl)) {
    const rect = typeof canvasEl.getBoundingClientRect === "function" ? canvasEl.getBoundingClientRect() : { width: 0, height: 0, top: 0 };
    if (rect.width > 100 && rect.height > 100) {
      const parent = canvasEl.closest ? canvasEl.closest("section, div, main") : null;
      const parentHeading = parent && typeof parent.querySelector === "function" ? parent.querySelector("h1, h2, h3")?.textContent?.trim() : undefined;
      addStop({
        id: "canvas_viewport",
        title: parentHeading ? `${parentHeading.slice(0, 25)} (Interactive)` : "Interactive Visual Canvas",
        category: "interactive",
        description: "Interactive canvas viewport, graphical simulations, and visual controls.",
        selector: getCleanElementSelector(canvasEl),
        element: canvasEl,
        scrollY: Math.round(window.scrollY + rect.top),
      });
    }
  }

  // 4. Discover Footer, Contact, or Forms
  const footerEl = smartQuerySelector("footer, [role='contentinfo'], #contact, form[action], .footer") as HTMLElement | null;
  if (footerEl && !isWidgetElement(footerEl)) {
    const rect = typeof footerEl.getBoundingClientRect === "function" ? footerEl.getBoundingClientRect() : { top: 0 };
    const heading = (typeof footerEl.querySelector === "function" ? footerEl.querySelector("h2, h3, h4")?.textContent?.trim() : null) || "Footer & Links";
    addStop({
      id: "footer",
      title: heading.slice(0, 30),
      category: "contact",
      description: "Direct links, resources, documentation, or contact points.",
      selector: getCleanElementSelector(footerEl),
      element: footerEl,
      scrollY: Math.round(window.scrollY + rect.top),
    });
  }

  // Universal Fallback if no sections were identified: extract all visible H2 headings
  if (stops.length < 2) {
    const headings = Array.from(document.querySelectorAll("h2, h3"))
      .filter((el) => !isWidgetElement(el))
      .slice(0, 4) as HTMLElement[];

    for (const h of headings) {
      const title = (h.textContent || "").trim();
      if (!title) continue;
      const rect = h.getBoundingClientRect();
      addStop({
        id: `heading_${stops.length + 1}`,
        title: title.slice(0, 35),
        category: "landmark",
        description: `Explore ${title} on this page.`,
        selector: getCleanElementSelector(h),
        element: h,
        scrollY: Math.round(window.scrollY + rect.top),
      });
    }
  }

  return stops;
}

/**
 * Executes an autonomous, smooth animated site tour.
 * Scrolls to the primary showcase section and returns a rich markdown guide.
 */
export async function executeSiteTour(): Promise<{
  guideMarkdown: string;
  stops: TourStop[];
  focusedStop: TourStop | null;
}> {
  const stops = planSiteTour();

  if (stops.length === 0) {
    return {
      guideMarkdown: "🗺️ **Site Tour**: No landmark sections could be identified on the current view.",
      stops: [],
      focusedStop: null,
    };
  }

  // Pick primary destination (prefer 2nd section or 1st)
  const targetStop = stops[1] || stops[0];

  if (targetStop.element) {
    await humanNavigateTo(targetStop.element, `Tour: ${targetStop.title}`, 2000);
  }

  // Format rich tour response
  let md = `🗺️ **Interactive Guided Site Tour**\n\n`;
  md += `I've mapped the core landmarks of this website and navigated you to **${targetStop.title}**:\n\n`;

  stops.forEach((stop, idx) => {
    const icon =
      stop.category === "hero"
        ? "🏛️"
        : stop.category === "interactive"
        ? "🎮"
        : stop.category === "contact"
        ? "📬"
        : "📍";

    const isCurrent = stop.id === targetStop.id;
    const badge = isCurrent ? " *(Currently Focused)*" : "";

    md += `• **${idx + 1}. ${icon} ${stop.title}**${badge}\n`;
    md += `  ${stop.description}\n`;
    md += `  \`${stop.selector}\`\n\n`;
  });

  md += `---\n`;
  md += `📍 **Navigation Active**: Page scrolled and highlighted \`${targetStop.selector}\`.\n`;

  const sampleTargets = stops.slice(0, 2).map((s) => `*"go to ${s.title}"*`).join(" or ");
  md += `💡 *To jump to any specific section, just say ${sampleTargets || "the section name"}!*`;

  return {
    guideMarkdown: md,
    stops,
    focusedStop: targetStop,
  };
}
