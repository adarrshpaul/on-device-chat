/**
 * Batch Automation Engine ("Teach 1 → Batch N")
 *
 * Solves Data Entry Fatigue & Bulk Entity Operations on the Live Client Browser:
 * 1. Entity Ingestion: Discovers multi-item collections (tables, cards, devices, products, landmarks) in the live DOM.
 * 2. Macro Parameterization: Converts single-demonstration action sequences into parameterized templates ({{entity_name}}, {{entity_selector}}, {{status}}).
 * 3. Human Confirmation Gate: Emits an interactive diff grid (BatchProposal) for human review before any destructive changes occur.
 * 4. Bounded Sequential Replay: Runs parameterized steps across N selected entities with 10s watchdogs, human pacing jitter, and isolated error propagation.
 */

import type { BatchEntityItem, BatchProposal, BatchExecutionResult, WorkflowStep, WebWorkflow } from "./types";
import { workflowRunner } from "./workflowRunner";
import { clearHumanNavigation } from "./domUtils";

export class EntityExtractor {
  /**
   * Scan active page DOM to discover repeated collections of entities (tables, cards, list items, sections)
   */
  static extractEntities(customContainerSelector?: string): BatchEntityItem[] {
    if (typeof document === "undefined") return [];

    const entities: BatchEntityItem[] = [];
    const seenNames = new Set<string>();

    // 1. Check Custom Container if provided
    if (customContainerSelector) {
      try {
        const container = document.querySelector(customContainerSelector);
        if (container) {
          const items = container.querySelectorAll(".item, [role='listitem'], tr, .card, li");
          items.forEach((el, idx) => {
            const item = this.parseElementToEntity(el as HTMLElement, idx + 1, "custom");
            if (item && !seenNames.has(item.name)) {
              seenNames.add(item.name);
              entities.push(item);
            }
          });
          if (entities.length > 0) return entities;
        }
      } catch (e) {
        console.warn("[EntityExtractor] Error querying custom container:", e);
      }
    }

    // 2. Strategy A: Structured Table Rows (E-commerce orders, inventory, device tables, ERP rows)
    const tableRows = document.querySelectorAll("table tbody tr, table tr");
    if (tableRows.length > 0) {
      tableRows.forEach((tr, idx) => {
        const el = tr as HTMLElement;
        if (el.querySelector("th") && !el.querySelector("td")) return; // Skip pure header row
        const text = el.textContent?.trim() || "";
        if (!text || text.length < 2) return;

        // Extract identifier / name from first link or first column
        const firstLink = el.querySelector("a, button, strong, [data-name]");
        const rawName = firstLink?.textContent?.trim() || el.children[0]?.textContent?.trim() || `Row #${idx + 1}`;
        const cleanName = rawName.replace(/\s+/g, " ").slice(0, 60);

        // Extract status badge or indicator
        const statusEl = el.querySelector(".status, [data-status], .badge, [class*='status'], [class*='tag']");
        const status = statusEl?.textContent?.trim() || this.inferStatusFromText(text);

        const id = el.id || el.getAttribute("data-id") || `row_${idx + 1}`;
        const table = el.closest("table");
        const tableId = table?.id ? `#${table.id} ` : table?.closest("main, form, [role='main']") ? `${table.closest("main, form, [role='main']")!.tagName.toLowerCase()} table ` : "";
        const hasTbody = Boolean(table?.querySelector("tbody"));
        const rowPath = hasTbody ? `tbody tr:nth-child(${idx + 1})` : `tr:nth-child(${idx + 1})`;
        const selector = el.id ? `#${el.id}` : `${tableId}${rowPath}`.trim();

        if (!seenNames.has(cleanName)) {
          seenNames.add(cleanName);
          entities.push({
            id,
            name: cleanName,
            status,
            selector,
            selected: true,
            variables: {
              entity_name: cleanName,
              entity_id: id,
              entity_selector: selector,
              status: status || "active",
            },
            executionState: "pending",
          });
        }
      });

      if (entities.length > 0) return entities.slice(0, 30);
    }

    // 3. Strategy B: Card Grids & Item Lists (Amazon, GitHub, Hacker News, Shopify, Swag Labs, BooksToScrape, etc.)
    const cardSelectors = [
      // Amazon & E-Commerce Search Portals
      "[data-component-type='s-search-result']",
      ".s-result-item[data-asin]",
      ".s-result-item",
      ".inventory_item",
      ".product_pod",
      "article.product_pod",
      ".product-card",
      ".product-item",
      ".item-card",
      // GitHub & Developer Repositories
      "article.Box-row",
      ".Box-row",
      // Hacker News & Community Story Rows
      "tr.athing",
      ".athing",
      // General item cards & semantic listitems
      ".project-card",
      ".device-card",
      "[role='listitem']",
      ".card",
      "article",
      "li[class*='project']",
      "li[class*='card']",
      "li[class*='product']",
      "li[class*='repo']",
      "li[class*='item']",
    ];

    for (const sel of cardSelectors) {
      const cards = document.querySelectorAll(sel);
      if (cards.length >= 2) {
        cards.forEach((card, idx) => {
          const el = card as HTMLElement;
          const heading = el.querySelector("h2, h3, h4, h5, .title, .titleline, [data-cy='title-recipe'], strong, [data-title], a");
          const rawName = heading?.textContent?.trim() || el.getAttribute("aria-label") || `Item #${idx + 1}`;
          const cleanName = rawName.replace(/\s+/g, " ").slice(0, 70);

          const statusEl = el.querySelector(".a-price, .score, .badge, .status, [class*='tag'], [class*='status']");
          const status = statusEl?.textContent?.trim() || "ready";

          const id = el.id || el.getAttribute("data-id") || `item_${idx + 1}`;
          const selector = el.id ? `#${el.id}` : `${sel}:nth-of-type(${idx + 1})`;

          if (!seenNames.has(cleanName) && cleanName.length > 1) {
            seenNames.add(cleanName);
            entities.push({
              id,
              name: cleanName,
              status,
              selector,
              selected: true,
              variables: {
                entity_name: cleanName,
                entity_id: id,
                entity_selector: selector,
                status,
              },
              executionState: "pending",
            });
          }
        });

        if (entities.length >= 2) return entities.slice(0, 30);
      }
    }

    // 4. Strategy C: Landmark Sections & Feature Blocks (e.g. Landmark sections, App views)
    const sections = document.querySelectorAll("main section[id], section[id], [role='region'][id], article[id]");
    if (sections.length > 0) {
      sections.forEach((sec, idx) => {
        const el = sec as HTMLElement;
        const heading = el.querySelector("h1, h2, h3, h4");
        const rawName = heading?.textContent?.trim() || el.id || `Section #${idx + 1}`;
        const cleanName = rawName.replace(/\s+/g, " ").slice(0, 60);
        const selector = el.id ? `#${el.id}` : `section:nth-of-type(${idx + 1})`;

        if (!seenNames.has(cleanName)) {
          seenNames.add(cleanName);
          entities.push({
            id: el.id || `sec_${idx + 1}`,
            name: cleanName,
            status: "ready",
            selector,
            selected: true,
            variables: {
              entity_name: cleanName,
              entity_id: el.id || `sec_${idx + 1}`,
              entity_selector: selector,
              status: "ready",
            },
            executionState: "pending",
          });
        }
      });
    }

    return entities.slice(0, 30);
  }

  private static parseElementToEntity(el: HTMLElement, index: number, prefix: string): BatchEntityItem | null {
    const heading = el.querySelector("h1, h2, h3, h4, h5, .title, strong, a");
    const rawName = heading?.textContent?.trim() || el.textContent?.trim().slice(0, 40) || `${prefix}_${index}`;
    const cleanName = rawName.replace(/\s+/g, " ").slice(0, 60);
    if (!cleanName || cleanName.length < 2) return null;

    const id = el.id || `${prefix}_${index}`;
    const selector = el.id ? `#${el.id}` : `.${prefix}:nth-child(${index})`;

    return {
      id,
      name: cleanName,
      status: "ready",
      selector,
      selected: true,
      variables: {
        entity_name: cleanName,
        entity_id: id,
        entity_selector: selector,
        status: "ready",
      },
      executionState: "pending",
    };
  }

  private static inferStatusFromText(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("active") || lower.includes("online") || lower.includes("running")) return "active";
    if (lower.includes("pending") || lower.includes("draft") || lower.includes("queued")) return "pending";
    if (lower.includes("error") || lower.includes("failed") || lower.includes("offline")) return "error";
    if (lower.includes("complete") || lower.includes("fulfilled") || lower.includes("success")) return "completed";
    return "ready";
  }
}

export class MacroParameterizer {
  /**
   * Convert concrete workflow steps into template steps with variables {{entity_name}}, {{entity_selector}}, etc.
   */
  static parameterizeSteps(steps: WorkflowStep[], sampleEntity?: BatchEntityItem): WorkflowStep[] {
    return steps.map((step) => {
      let templatedTitle = step.title;
      let templatedTarget = step.target || "";
      const templatedValue = step.value || "";

      if (sampleEntity) {
        if (sampleEntity.name && templatedTitle.includes(sampleEntity.name)) {
          templatedTitle = templatedTitle.replace(sampleEntity.name, "{{entity_name}}");
        }
        if (sampleEntity.selector && templatedTarget === sampleEntity.selector) {
          templatedTarget = "{{entity_selector}}";
        }
        if (sampleEntity.id && templatedTarget.includes(sampleEntity.id)) {
          templatedTarget = templatedTarget.replace(sampleEntity.id, "{{entity_id}}");
        }
      }

      // If the target is a direct element ID or selector that matches a specific item, generalize it
      if (templatedTarget && !templatedTarget.includes("{{")) {
        templatedTarget = "{{entity_selector}}";
      }

      return {
        ...step,
        id: `tpl_${step.id}`,
        title: templatedTitle.includes("{{") ? templatedTitle : `${step.title} [{{entity_name}}]`,
        target: templatedTarget || "{{entity_selector}}",
        value: templatedValue,
      };
    });
  }

  /**
   * Instantiate concrete steps for a specific entity by replacing {{variable}} placeholders
   */
  static instantiateSteps(templateSteps: WorkflowStep[], entity: BatchEntityItem): WorkflowStep[] {
    return templateSteps.map((tpl, idx) => {
      let concreteTitle = tpl.title;
      let concreteTarget = tpl.target || entity.selector || "";
      let concreteValue = tpl.value || "";

      const vars = {
        entity_name: entity.name,
        entity_id: entity.id,
        entity_selector: entity.selector || "",
        status: entity.status || "",
        ...entity.variables,
      };

      for (const [k, v] of Object.entries(vars)) {
        const regex = new RegExp(`{{${k}}}`, "g");
        concreteTitle = concreteTitle.replace(regex, v);
        concreteTarget = concreteTarget.replace(regex, v);
        concreteValue = concreteValue.replace(regex, v);
      }

      // Fallback: if target still contains un-substituted template braces, use entity selector
      if (concreteTarget.includes("{{") || !concreteTarget) {
        concreteTarget = entity.selector || "body";
      }

      return {
        ...tpl,
        id: `step_${entity.id}_${idx + 1}`,
        title: concreteTitle,
        target: concreteTarget,
        value: concreteValue,
        status: "idle",
      };
    });
  }
}

export class BatchProposalManager {
  /**
   * Create an interactive batch execution proposal for user confirmation
   */
  static createProposal(params: {
    title?: string;
    intent: string;
    siteOrigin?: string;
    templateSteps?: WorkflowStep[];
    customEntities?: BatchEntityItem[];
    macroId?: string;
  }): BatchProposal {
    const origin = params.siteOrigin || (typeof window !== "undefined" ? window.location.origin : "localhost");
    const detectedEntities = params.customEntities && params.customEntities.length > 0
      ? params.customEntities
      : EntityExtractor.extractEntities();

    // If template steps are not provided, synthesize a standard inspect & verify batch macro
    const templateSteps: WorkflowStep[] = params.templateSteps && params.templateSteps.length > 0
      ? params.templateSteps
      : [
          {
            id: "step_scroll_entity",
            title: "Focus and spotlight {{entity_name}}",
            action: "scroll" as const,
            target: "{{entity_selector}}",
            delayMs: 400,
          },
          {
            id: "step_verify_entity",
            title: "Verify zero-hallucination state of {{entity_name}}",
            action: "verify" as const,
            target: "{{entity_selector}}",
            delayMs: 300,
          },
        ];

    const total = detectedEntities.length;
    const estDuration = Math.max(total * 750, 1500);

    const proposal: BatchProposal = {
      id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: params.title || `Batch Action: ${params.intent.slice(0, 45)}`,
      macroId: params.macroId,
      siteOrigin: origin,
      templateSteps,
      entities: detectedEntities,
      summary: `Found ${total} target items in active view. Review and confirm items below before batch replay.`,
      createdAt: Date.now(),
      totalItems: total,
      estimatedDurationMs: estDuration,
      executionStatus: "proposed",
      succeededCount: 0,
      failedCount: 0,
    };

    return proposal;
  }
}

export class BatchRunner {
  private activeAbortController: AbortController | null = null;

  cancel(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
    clearHumanNavigation();
  }

  /**
   * Execute batch steps sequentially across all approved entities with bounded watchdog and error isolation
   */
  async executeBatch(
    proposal: BatchProposal,
    options?: {
      onEntityProgress?: (index: number, entity: BatchEntityItem, progressPercent: number) => void;
      onStepUpdate?: (entityIndex: number, stepIndex: number, step: WorkflowStep) => void;
      signal?: AbortSignal;
    }
  ): Promise<BatchExecutionResult> {
    const startTime = performance.now();
    this.cancel();
    this.activeAbortController = new AbortController();
    const abortSignal = options?.signal || this.activeAbortController.signal;

    proposal.executionStatus = "running";
    const selectedEntities = proposal.entities.filter((e) => e.selected);
    let succeededCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < proposal.entities.length; i++) {
      const entity = proposal.entities[i];

      if (abortSignal.aborted) {
        entity.executionState = "skipped";
        entity.error = "Batch execution aborted by user";
        skippedCount++;
        continue;
      }

      if (!entity.selected) {
        entity.executionState = "skipped";
        skippedCount++;
        options?.onEntityProgress?.(i, entity, Math.round(((i + 1) / proposal.entities.length) * 100));
        continue;
      }

      entity.executionState = "running";
      const percent = Math.round(((i + 1) / proposal.entities.length) * 100);
      options?.onEntityProgress?.(i, entity, percent);

      const entityStartTime = performance.now();
      const concreteSteps = MacroParameterizer.instantiateSteps(proposal.templateSteps, entity);

      // Create transient single-entity workflow for execution
      const entityWorkflow: WebWorkflow = {
        id: `transient_${proposal.id}_${entity.id}`,
        name: `Batch: ${entity.name}`,
        description: `Batch step on ${entity.name}`,
        siteOrigin: proposal.siteOrigin,
        steps: concreteSteps,
        executionCount: 1,
        createdAt: Date.now(),
      };

      try {
        // Execute with step-level bounded watchdog
        const runResult = await workflowRunner.runWorkflow(entityWorkflow, {
          onStepUpdate: (stepIdx, stp) => {
            options?.onStepUpdate?.(i, stepIdx, stp);
          },
        });

        if (runResult.success) {
          entity.executionState = "success";
          entity.durationMs = Math.round(performance.now() - entityStartTime);
          entity.resultSummary = `Processed in ${entity.durationMs}ms (0 tokens)`;
          succeededCount++;
        } else {
          // Isolated failure: do NOT abort subsequent entities
          entity.executionState = "failed";
          entity.durationMs = Math.round(performance.now() - entityStartTime);
          entity.error = runResult.error || "Step failed";
          failedCount++;
          console.warn(`[BatchRunner] Entity "${entity.name}" failed: ${entity.error}`);
        }
      } catch (err: any) {
        // Isolated exception
        entity.executionState = "failed";
        entity.durationMs = Math.round(performance.now() - entityStartTime);
        entity.error = err?.message || "Execution exception";
        failedCount++;
        console.warn(`[BatchRunner] Entity "${entity.name}" threw error:`, err);
      }

      options?.onEntityProgress?.(i, entity, percent);

      // Human breathing buffer between entities (250ms) to allow DOM rendering to stabilize
      if (i < proposal.entities.length - 1 && !abortSignal.aborted) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    clearHumanNavigation();
    proposal.executionStatus = "completed";
    proposal.succeededCount = succeededCount;
    proposal.failedCount = failedCount;

    const totalDurationMs = Math.round(performance.now() - startTime);

    return {
      proposalId: proposal.id,
      totalEntities: proposal.entities.length,
      executedCount: selectedEntities.length,
      succeededCount,
      failedCount,
      skippedCount,
      durationMs: totalDurationMs,
      entities: proposal.entities,
      summary: `Batch complete: ${succeededCount} succeeded, ${failedCount} failed, ${skippedCount} skipped across ${proposal.entities.length} items in ${totalDurationMs}ms (0 tokens spent).`,
    };
  }
}

export const batchRunner = new BatchRunner();
