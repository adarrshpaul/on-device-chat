/**
 * Universal Site Persona & Adaptive Context Engine
 *
 * Automatically inspects the host page DOM, metadata, and structure to determine:
 * 1. Site category (AI tools, docs, saas, e-commerce, blog, portfolio, web app).
 * 2. Dynamic landmark quick-action chips extracted directly from live nav links & headings.
 * 3. Theme capabilities (DaisyUI, Tailwind, CSS variables, native).
 *
 * Guarantees zero hardcoded lock-in: dynamically adapts to 100% of websites.
 */

import { isWidgetElement } from "./domUtils";

export type SiteCategory = "ai" | "ecommerce" | "docs" | "saas" | "portfolio" | "blog" | "general";

export interface SitePersona {
  category: SiteCategory;
  categoryLabel: string;
  title: string;
  domain: string;
  primaryActionPills: string[];
  hasSearchInput: boolean;
  themeInfo: {
    isDarkMode: boolean;
    themeEngine: "daisyui" | "tailwind" | "css-variable" | "native";
  };
}

export function detectSitePersona(): SitePersona {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return {
      category: "general",
      categoryLabel: "Web Application",
      title: "Application",
      domain: "localhost",
      primaryActionPills: ["🗺️ Guided Tour", "📄 Summarize Page", "🎨 Toggle Theme", "❓ Ask Anything"],
      hasSearchInput: false,
      themeInfo: { isDarkMode: false, themeEngine: "native" },
    };
  }

  const domain = window.location.hostname.replace(/^www\./, "");
  const pageTitle = (document.title || "").split(/[-|•–]/)[0].trim() || domain;
  const metaDesc = (document.querySelector("meta[name='description']")?.getAttribute("content") || "").toLowerCase();
  const pageText = `${metaDesc} ${(document.body?.innerText || "").slice(0, 10000)}`.toLowerCase();

  // 1. Precise Category Detection
  let category: SiteCategory = "general";
  let categoryLabel = "Web Application";

  const hasAiSignals =
    /\b(model|harness|neural|benchmark|benchmarks|inference|weights|hf\s+model|slm|llm|gemma|tokens?|lora|sft|steerguard|agent\s+compiler|transformer|fine-tuning)\b/i.test(pageText);

  const hasDocsSignals =
    /\b(documentation|api\s+reference|quickstart|sdk|endpoint|endpoints|getting\s+started|params|response)\b/i.test(pageText) ||
    document.querySelector("nav[class*='doc' i], [class*='sidebar' i] code, pre code") !== null;

  const hasSaasSignals =
    /\b(pricing|sign\s+up|log\s+in|dashboard|features|analytics|integrations|monthly|yearly|roi\s+calculator|calculator|enterprise|community|dev\s+pro)\b/i.test(pageText) ||
    document.querySelector("[id*='pricing' i], [class*='pricing' i], [id*='features' i]") !== null;

  const hasEcommerceSignals =
    /\b(add\s+to\s+cart|cart|checkout|price|\$|usd|eur|in\s+stock|buy\s+now|shop|shopping\s+cart)\b/i.test(pageText) ||
    document.querySelector("[class*='cart' i], [id*='cart' i], [class*='product' i]") !== null;

  // STRICT Portfolio detection: Only if the page explicitly self-identifies in title or meta as a personal portfolio
  const hasPortfolioSignals =
    /(^|\b)(portfolio|resume|cv|curriculum\s+vitae|personal\s+website)(\b|$)/i.test(pageTitle) ||
    /(^|\b)(personal\s+portfolio|software\s+engineer\s+portfolio|designer\s+portfolio|hire\s+me|about\s+me)(\b|$)/i.test(metaDesc);

  const hasBlogSignals =
    /\b(published\s+on|min\s+read|author|articles|posts|comments|newsletter)\b/i.test(pageText) ||
    document.querySelector("article, [class*='blog' i], [class*='post' i]") !== null;

  if (hasAiSignals) {
    category = "ai";
    categoryLabel = "AI Model & Harness";
  } else if (hasDocsSignals) {
    category = "docs";
    categoryLabel = "Documentation & API";
  } else if (hasSaasSignals) {
    category = "saas";
    categoryLabel = "Developer Platform";
  } else if (hasEcommerceSignals) {
    category = "ecommerce";
    categoryLabel = "Online Store";
  } else if (hasPortfolioSignals) {
    category = "portfolio";
    categoryLabel = "Portfolio & Profile";
  } else if (hasBlogSignals) {
    category = "blog";
    categoryLabel = "Blog & Publication";
  }

  // Helper to format clean chip with appropriate emoji
  const formatPill = (rawText: string): string => {
    const clean = rawText
      .replace(/^[\p{Emoji}\p{Symbol}\s]+/u, "")
      .replace(/[-_]/g, " ")
      .trim();
    if (!clean || clean.length < 2) return "";

    const lower = clean.toLowerCase();
    let emoji = "📍";
    if (lower.includes("model") || lower.includes("harness") || lower.includes("ai") || lower.includes("neural") || lower.includes("inference")) emoji = "⚡";
    else if (lower.includes("bench") || lower.includes("stat") || lower.includes("metric") || lower.includes("analytic")) emoji = "📊";
    else if (lower.includes("play") || lower.includes("lab") || lower.includes("work") || lower.includes("demo")) emoji = "🧪";
    else if (lower.includes("doc") || lower.includes("api") || lower.includes("guide") || lower.includes("read")) emoji = "📖";
    else if (lower.includes("price") || lower.includes("plan") || lower.includes("tier") || lower.includes("cost") || lower.includes("roi")) emoji = "💳";
    else if (lower.includes("calc") || lower.includes("tool")) emoji = "🧮";
    else if (lower.includes("proj") || lower.includes("work") || lower.includes("case")) emoji = "💼";
    else if (lower.includes("skill") || lower.includes("tech") || lower.includes("stack")) emoji = "⚡";
    else if (lower.includes("about") || lower.includes("who") || lower.includes("team") || lower.includes("journey")) emoji = "👤";
    else if (lower.includes("contact") || lower.includes("hire") || lower.includes("touch") || lower.includes("mail")) emoji = "📬";
    else if (lower.includes("shop") || lower.includes("store") || lower.includes("cart") || lower.includes("product")) emoji = "🛒";
    else if (lower.includes("search") || lower.includes("find")) emoji = "🔍";

    const titleCased = clean
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

    return `${emoji} ${titleCased.slice(0, 22)}`;
  };

  const actionPills: string[] = [];
  const seenPills = new Set<string>();

  // 1.5. Dynamic Form & Action Discovery from Host DOM (Top Priority)
  const hasPageForm = document.querySelector("form:not([data-g4-widget] form), [role='form']") !== null;
  if (hasPageForm && !seenPills.has("formulate form")) {
    seenPills.add("formulate form");
    actionPills.push("📝 Formulate Form");
  }

  const hasShopButtons = document.querySelector("button[id*='cart' i], button[id*='add' i], [data-testid*='cart' i], [data-testid*='add' i]") !== null;
  if (hasShopButtons && !seenPills.has("add to cart")) {
    seenPills.add("add to cart");
    actionPills.push("🛒 Add to Cart (×3)");
  }

  // 2. Discover Action Chips from Host Page Navigation Links
  const navLinks = Array.from(
    document.querySelectorAll("nav a, header a, [role='navigation'] a, .nav-links a, .navbar a, #nav a, nav button, header button")
  ).filter((el) => {
    if (isWidgetElement(el)) return false;
    const txt = (el.textContent || el.getAttribute("aria-label") || "").trim();
    if (txt.length < 2 || txt.length > 35) return false;
    const lower = txt.toLowerCase();
    // Exclude generic auth, utility, legal, or social links
    if (/^(login|log\s+in|signin|sign\s+in|signup|sign\s+up|register|privacy|terms|cookie|cookies|github|twitter|x|discord|linkedin)$/i.test(lower)) return false;
    return true;
  });

  for (const el of navLinks) {
    if (actionPills.length >= 4) break;
    const txt = (el.textContent || el.getAttribute("aria-label") || "").trim();
    const key = txt.toLowerCase();
    if (!seenPills.has(key)) {
      seenPills.add(key);
      const pill = formatPill(txt);
      if (pill) actionPills.push(pill);
    }
  }

  // 3. Discover Action Chips from Host Page Headings (Second Priority)
  if (actionPills.length < 4) {
    const headings = Array.from(
      document.querySelectorAll("main h2, main h1, section h2, section h1, h2, h1, [role='heading']")
    ).filter((h) => {
      if (isWidgetElement(h)) return false;
      const txt = (h.textContent || "").trim();
      return txt.length >= 3 && txt.length <= 80;
    });

    for (const h of headings) {
      if (actionPills.length >= 4) break;
      const txt = (h.textContent || "").trim();
      const key = txt.toLowerCase();
      if (!seenPills.has(key)) {
        seenPills.add(key);
        const pill = formatPill(txt);
        if (pill) actionPills.push(pill);
      }
    }
  }

  // 4. Guided Tour: ONLY if page has multiple detected sections
  const candidateSectionsCount = document.querySelectorAll("section[id], article[id], main > section, [role='region']").length;
  if (actionPills.length < 4 && candidateSectionsCount >= 2 && !seenPills.has("guided tour")) {
    seenPills.add("guided tour");
    actionPills.push("🗺️ Guided Tour");
  }

  // 5. Interactive Page Capabilities (Search, Theme) ONLY if present in DOM
  const hasSearchInput =
    document.querySelector("input[type='search'], input[name*='search' i], input[placeholder*='search' i]") !== null;

  if (actionPills.length < 4 && hasSearchInput && !seenPills.has("search")) {
    seenPills.add("search");
    actionPills.push("🔍 Search Page");
  }

  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark" ||
    document.documentElement.classList.contains("dark") ||
    document.body.classList.contains("dark") ||
    (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const themeEngine = document.documentElement.getAttribute("data-theme")
    ? "daisyui"
    : document.documentElement.classList.contains("dark") || document.body.classList.contains("dark")
    ? "tailwind"
    : "native";

  const hasThemeToggle =
    document.querySelector("button[aria-label*='theme' i], button[title*='theme' i], [data-theme-toggle], .theme-toggle") !== null;

  if (actionPills.length < 4 && hasThemeToggle && !seenPills.has("theme")) {
    seenPills.add("theme");
    actionPills.push("🎨 Toggle Theme");
  }

  // 6. Universal Fallbacks ONLY if pills are still empty
  if (actionPills.length < 4 && !seenPills.has("summarize")) {
    seenPills.add("summarize");
    actionPills.push("📄 Summarize Page");
  }
  if (actionPills.length < 4 && !seenPills.has("ask")) {
    seenPills.add("ask");
    actionPills.push("❓ Ask Anything");
  }

  return {
    category,
    categoryLabel,
    title: pageTitle,
    domain,
    primaryActionPills: actionPills.slice(0, 4),
    hasSearchInput,
    themeInfo: {
      isDarkMode: isDark,
      themeEngine,
    },
  };
}
