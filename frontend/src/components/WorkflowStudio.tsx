import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Zap,
  Play,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  X,
  Edit2,
  Crosshair,
  Wand2,
} from "lucide-react";
import { WebWorkflow, WorkflowStep, clickRepeatCount } from "../lib/types";
import { workflowStore } from "../lib/workflowStore";
import { workflowRunner } from "../lib/workflowRunner";
import { StepEditor } from "./WorkflowStepEditor";
import { stripLeadingEmoji } from "./tierBadges";
import {
  PageScan,
  PageFormGroup,
  scanPage,
  describeElement,
  inferActionFor,
  defaultStepTitle,
  synthesizeFormSteps,
  ACTION_TARGET_KINDS,
  TARGET_REQUIRED,
} from "../lib/pageFormExtractor";
import { startElementPicker, previewElement } from "../lib/elementPicker";

interface WorkflowStudioProps {
  onBackToChat?: () => void;
  onWorkflowExecuted?: (workflowName: string, stepCount: number) => void;
}

export const WorkflowStudio: React.FC<WorkflowStudioProps> = ({
  onBackToChat: _onBackToChat,
  onWorkflowExecuted,
}) => {
  const [workflows, setWorkflows] = useState<WebWorkflow[]>([]);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [runningSteps, setRunningSteps] = useState<WorkflowStep[]>([]);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WebWorkflow | null>(null);
  const [filterCategory, setFilterCategory] = useState<"all" | "actions" | "forms" | "tours">("all");

  // Form states for creating/editing
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formSteps, setFormSteps] = useState<WorkflowStep[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Live Page Form & Element Scanning + Element Picker
  const [pageScan, setPageScan] = useState<PageScan | null>(null);
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);
  const stopPickerRef = useRef<(() => void) | null>(null);

  const rescan = () => setPageScan(scanPage());
  const stopPicker = () => {
    stopPickerRef.current?.();
    stopPickerRef.current = null;
    setPickingIdx(null);
  };

  useEffect(() => {
    if (showEditor) rescan();
    else stopPicker();
  }, [showEditor]);

  useEffect(() => () => stopPickerRef.current?.(), []);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    const list = await workflowStore.getWorkflowsForOrigin();
    setWorkflows(list);
  };

  const handleRunWorkflow = async (workflow: WebWorkflow) => {
    setRunningWorkflowId(workflow.id);
    setRunningSteps(workflow.steps.map((s) => ({ ...s, status: "idle" })));
    setExecutionLog([`Starting workflow "${workflow.name}" (${workflow.steps.length} steps)...`]);

    const res = await workflowRunner.runWorkflow(workflow, {
      onStepUpdate: (stepIndex, updatedStep) => {
        setRunningSteps((prev) => {
          const next = [...prev];
          next[stepIndex] = updatedStep;
          return next;
        });
        if (updatedStep.output) {
          setExecutionLog((prev) => [...prev, `[Step ${stepIndex + 1}] ${updatedStep.output}`]);
        }
      },
      onComplete: (finalSteps) => {
        setRunningSteps(finalSteps);
        setExecutionLog((prev) => [...prev, `✓ Workflow "${workflow.name}" completed successfully!`]);
        onWorkflowExecuted?.(workflow.name, finalSteps.length);
        loadWorkflows();
      },
    });

    if (!res.success && res.error) {
      setExecutionLog((prev) => [...prev, `✗ ${res.error}`]);
    }

    setTimeout(() => {
      setRunningWorkflowId(null);
    }, 1200);
  };

  const handleOpenCreate = () => {
    setEditingWorkflow(null);
    setFormName("");
    setFormDesc("");
    setFormTrigger("");
    setFormSteps([]);
    setShowEditor(true);
  };

  const handleOpenEdit = (w: WebWorkflow) => {
    setEditingWorkflow(w);
    setFormName(w.name);
    setFormDesc(w.description);
    setFormTrigger(w.triggerPhrase || "");
    setFormSteps(JSON.parse(JSON.stringify(w.steps)));
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this workflow?")) {
      await workflowStore.deleteWorkflow(id);
      await loadWorkflows();
    }
  };

  const handleAddStep = () => {
    setFormSteps((prev) => [
      ...prev,
      {
        id: `step_${Date.now()}_${prev.length + 1}`,
        title: "",
        action: "click",
        target: "",
        delayMs: 300,
        status: "idle",
      },
    ]);
  };

  const handlePickTarget = (idx: number) => {
    const wasPicking = pickingIdx === idx;
    stopPicker();
    if (wasPicking) return;
    setPickingIdx(idx);
    stopPickerRef.current = startElementPicker({
      onPick: (el) => {
        const picked = describeElement(el);
        setFormSteps((prev) => {
          const next = [...prev];
          const cur = next[idx];
          if (!cur) return prev;
          const action = ACTION_TARGET_KINDS[cur.action]?.includes(picked.kind) ? cur.action : inferActionFor(picked);

          // If this is an unconfigured step and the previous step is already a click on this target, coalesce repeatCount
          if (idx > 0 && !cur.target && action === "click") {
            const prevStep = next[idx - 1];
            if (prevStep.action === "click" && prevStep.target === picked.selector) {
              const prevRepeat = clickRepeatCount(prevStep);
              const nextRepeat = prevRepeat + 1;
              const cleanTitle = (prevStep.title || defaultStepTitle("click", picked)).replace(/\s*\(×\d+\)$/, "");
              next[idx - 1] = {
                ...prevStep,
                repeatCount: nextRepeat,
                title: `${cleanTitle} (×${nextRepeat})`,
              };
              next.splice(idx, 1);
              return next;
            }
          }

          next[idx] = {
            ...cur,
            action,
            target: picked.selector,
            title: cur.title || defaultStepTitle(action, picked),
            value: action === "select" && !cur.value ? (el as HTMLSelectElement).value : cur.value,
          };
          return next;
        });
        stopPickerRef.current = null;
        setPickingIdx(null);
        rescan();
      },
      onCancel: () => {
        stopPickerRef.current = null;
        setPickingIdx(null);
      },
    });
  };

  const handleAddFromPage = () => {
    const idx = formSteps.length;
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}_${idx + 1}`,
      title: "",
      action: "click",
      target: "",
      delayMs: 300,
      status: "idle",
    };
    setFormSteps((prev) => [...prev, newStep]);
    handlePickTarget(idx);
  };

  const handleAddQuickStep = (action: "click" | "type" | "wait" | "scroll") => {
    const idx = formSteps.length;
    const defaultTitles: Record<string, string> = {
      click: "Click element",
      type: "Type into field",
      wait: "Wait 1000ms",
      scroll: "Scroll page view",
    };
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}_${idx + 1}`,
      title: defaultTitles[action] || "Action",
      action: action,
      target: action === "wait" ? "" : (action === "scroll" ? "main" : ""),
      value: action === "wait" ? "1000" : (action === "type" ? "" : undefined),
      delayMs: action === "wait" ? 1000 : 400,
      status: "idle",
    };
    setFormSteps((prev) => [...prev, newStep]);
    if (action === "click" || action === "type") {
      handlePickTarget(idx);
    }
  };

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((wf) => {
      if (filterCategory === "all") return true;
      const hasType = wf.steps.some((s) => s.action === "type" || s.action === "select");
      const hasScroll = wf.steps.some((s) => s.action === "scroll" || s.action === "teleport");
      if (filterCategory === "forms") return hasType || /form|fill|input|contact/i.test(wf.name);
      if (filterCategory === "tours") return hasScroll || /tour|scroll|inspect|explore/i.test(wf.name);
      if (filterCategory === "actions") return !hasType && !hasScroll;
      return true;
    });
  }, [workflows, filterCategory]);

  const handleFormulate = (form: PageFormGroup) => {
    setFormSteps((prev) => [...prev, ...synthesizeFormSteps(form)]);
    if (!formName.trim()) setFormName(`⚡ ${form.title}`);
    if (!formDesc.trim()) {
      setFormDesc(
        `Fills ${form.fields.length} field${form.fields.length === 1 ? "" : "s"}${
          form.submit ? ` and submits via “${form.submit.label}”` : ""
        }`
      );
    }
  };

  const invalidSteps = formSteps.filter((s) => TARGET_REQUIRED.has(s.action) && !s.target?.trim()).length;

  const handleRemoveStep = (index: number) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateStep = (index: number, updates: Partial<WorkflowStep>) => {
    setFormSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleSaveWorkflow = async () => {
    if (!formName.trim() || formSteps.length === 0 || invalidSteps > 0) return;

    const newWf: WebWorkflow = {
      id: editingWorkflow?.id || `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: formName.trim(),
      description: formDesc.trim() || "User defined automation workflow",
      triggerPhrase: formTrigger.trim() || undefined,
      siteOrigin: "*",
      steps: formSteps,
      executionCount: editingWorkflow?.executionCount || 0,
      createdAt: editingWorkflow?.createdAt || Date.now(),
      isSystemStarter: false,
    };

    await workflowStore.saveWorkflow(newWf);
    setShowEditor(false);
    await loadWorkflows();
  };

  const handleAiGenerateWorkflow = () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);

    setTimeout(() => {
      const promptLower = aiPrompt.toLowerCase();
      let generatedName = "⚡ " + aiPrompt.slice(0, 30);
      let steps: WorkflowStep[] = [];

      // Scan live DOM for elements matching user prompt keywords
      const words = promptLower.split(/\s+/).filter((w) => w.length > 2);
      let matchedTarget: HTMLElement | null = null;
      let matchedLabel = "";

      if (typeof document !== "undefined") {
        for (const word of words) {
          const el = document.querySelector(
            `#${word}, [id*='${word}' i]:not([data-g4-widget] *), section[id*='${word}' i], [class*='${word}' i]:not([data-g4-widget] *), a[href*='${word}'], button[aria-label*='${word}' i]`
          ) as HTMLElement | null;
          if (el && !el.closest("[data-g4-widget]")) {
            matchedTarget = el;
            matchedLabel = el.textContent?.trim().slice(0, 30) || el.id || word;
            break;
          }
        }
      }

      if (matchedTarget) {
        const cleanSel = matchedTarget.id ? `#${matchedTarget.id}` : (matchedTarget.tagName.toLowerCase() + (matchedTarget.className ? `.${matchedTarget.className.split(" ")[0]}` : ""));
        generatedName = `⚡ ${matchedLabel}`;
        steps = [
          { id: "s1", title: `Navigate to ${matchedLabel}`, action: "scroll", target: cleanSel, delayMs: 400, status: "idle" },
          { id: "s2", title: `Inspect ${matchedLabel}`, action: "verify", target: cleanSel, delayMs: 300, status: "idle" },
        ];
      } else {
        generatedName = `⚡ ${aiPrompt.charAt(0).toUpperCase() + aiPrompt.slice(1)}`;
        steps = [
          { id: "s1", title: `Explore: ${aiPrompt}`, action: "scroll", target: "main, section, header", delayMs: 400, status: "idle" },
          { id: "s2", title: "Observe Target Region", action: "verify", target: "body", delayMs: 300, status: "idle" },
        ];
      }

      setFormName(generatedName);
      setFormDesc(`Autonomous workflow generated from: "${aiPrompt}"`);
      setFormSteps(steps);
      setIsGeneratingAi(false);
      setAiPrompt("");
    }, 450);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--g4-bg-panel)] text-gray-200 select-none overflow-hidden">
      {/* Top Bar Banner - Tactile Neo-Brutalist Deck Header */}
      <div className="p-3 bg-black/60 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-black text-[#D4FF00] border border-[#D4FF00]/30 flex items-center justify-center font-bold shadow-[0_0_10px_rgba(212,255,0,0.2)]">
            <Zap size={14} className="fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-white tracking-wide uppercase font-mono">Automations Studio</h3>
              <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-gray-300 text-[10px] font-mono font-bold">
                {workflows.length} active
              </span>
            </div>
            <p className="text-[10.5px] text-gray-400 mt-0.5">
              Zero-token deterministic browser routines
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-3 py-1.5 rounded-xl bg-[#D4FF00] hover:bg-[#b8dd00] text-black text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all shadow-[0_0_12px_rgba(212,255,0,0.25)] active:scale-95"
        >
          <Plus size={13} strokeWidth={3} />
          <span>New Flow</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 neo-dot-grid">
        {/* Editor Modal / Drawer - Structured 3-Stage Pipeline (Inspired by Image 2) */}
        {showEditor ? (
          <div className="p-4 rounded-2xl bg-[#090d18] border-2 border-white/15 space-y-4 animate-in fade-in duration-200 text-xs shadow-2xl">
            {/* Modal Header Toolbar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-black text-[#D4FF00] border border-[#D4FF00]/40 flex items-center justify-center font-bold shadow-[0_0_10px_rgba(212,255,0,0.2)]">
                  <Wand2 size={14} className="fill-current" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white tracking-tight">
                    {editingWorkflow ? "Edit Automation Workflow" : "Create New Browser Routine"}
                  </h4>
                  <p className="text-[10.5px] text-gray-400">
                    Deterministic zero-token macro sequence
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEditor(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                title="Close editor"
              >
                <X size={15} />
              </button>
            </div>

            {/* Stage Pipeline Breadcrumbs (Image 2 Breadcrumb Visualizer) */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-black/60 border border-white/10 text-[10.5px] font-mono">
              <div className="flex items-center gap-1.5 text-[#D4FF00] font-bold">
                <span className="w-4 h-4 rounded-full bg-[#D4FF00] text-black text-[9px] font-black flex items-center justify-center">1</span>
                <span>Profile</span>
              </div>
              <span className="text-gray-600 font-bold">→</span>
              <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                <span className="w-4 h-4 rounded-full bg-cyan-400 text-black text-[9px] font-black flex items-center justify-center">2</span>
                <span>Pipeline ({formSteps.length})</span>
              </div>
              <span className="text-gray-600 font-bold">→</span>
              <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                <span className="w-4 h-4 rounded-full bg-purple-400 text-black text-[9px] font-black flex items-center justify-center">3</span>
                <span>Save</span>
              </div>
            </div>

            {/* STAGE 1: Profile & Chat Trigger */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-300 font-mono">
                  Stage 1: Identity & Trigger
                </span>
                <span className="text-[9.5px] font-mono text-gray-400">0 Tokens Cloud Cost</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-200 block mb-1">
                  Automation Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Add ANC Headphones to Cart & Verify"
                  className="w-full bg-[#0c1222] border-2 border-white/15 focus:border-[#D4FF00] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-all font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-semibold text-gray-300 block mb-1">
                    Chat Trigger Keyword (Optional)
                  </label>
                  <div className="flex items-center rounded-xl bg-[#0c1222] border-2 border-white/15 focus-within:border-[#D4FF00] px-2.5 py-1.5 transition-all">
                    <span className="text-gray-500 font-mono text-xs mr-1 font-bold">/</span>
                    <input
                      type="text"
                      value={formTrigger}
                      onChange={(e) => setFormTrigger(e.target.value)}
                      placeholder="e.g. headphones"
                      className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none font-mono font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-semibold text-gray-300 block mb-1">
                    Short Description
                  </label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="e.g. 1-click cart addition"
                    className="w-full bg-[#0c1222] border-2 border-white/15 focus:border-[#D4FF00] rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* STAGE 2: Pipeline Steps Builder */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-gray-300 font-mono">
                    Stage 2: Execution Pipeline ({formSteps.length})
                  </span>
                  {formSteps.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-gray-300 text-[9.5px] font-mono">
                      ~{formSteps.reduce((acc, s) => acc + (s.delayMs || 400), 0)}ms
                    </span>
                  )}
                </div>

                {/* Quick Step Buttons Toolbar */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAddQuickStep("click")}
                    className="px-2 py-1 rounded-lg bg-[#D4FF00]/15 hover:bg-[#D4FF00]/25 text-[#D4FF00] border border-[#D4FF00]/30 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    title="Add click action"
                  >
                    <Plus size={11} strokeWidth={3} />
                    <span>Click</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuickStep("type")}
                    className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    title="Add input typing action"
                  >
                    <Plus size={11} strokeWidth={3} />
                    <span>Type</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddQuickStep("wait")}
                    className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    title="Add wait delay"
                  >
                    <Plus size={11} strokeWidth={3} />
                    <span>Wait</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-gray-200 border border-white/15 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                    title="Add blank custom step"
                  >
                    <Plus size={11} strokeWidth={3} />
                    <span>Custom</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddFromPage}
                    className="px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-[10.5px] font-black flex items-center gap-1 cursor-pointer transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    title="Click any element on active page"
                  >
                    <Crosshair size={12} strokeWidth={2.5} />
                    <span>Pick Element</span>
                  </button>
                </div>
              </div>

              {/* Step Items or Empty State */}
              {formSteps.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-white/15 bg-black/30 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-gray-400">
                    <Crosshair size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">No execution steps yet</h5>
                    <p className="text-[10.5px] text-gray-400 mt-0.5 max-w-[280px] mx-auto">
                      Click <strong className="text-[#D4FF00]">+ Click</strong>, <strong className="text-cyan-300">+ Type</strong>, or <strong className="text-cyan-300">Pick Element</strong> to build your browser routine.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {formSteps.map((step, idx) => (
                    <div key={step.id || idx} className="space-y-1">
                      <StepEditor
                        step={step}
                        index={idx}
                        scan={pageScan}
                        picking={pickingIdx === idx}
                        onChange={(updates) => handleUpdateStep(idx, updates)}
                        onRemove={() => handleRemoveStep(idx)}
                        onPick={() => handlePickTarget(idx)}
                      />
                      {idx < formSteps.length - 1 && (
                        <div className="flex items-center justify-center py-0.5">
                          <span className="text-gray-600 text-[11px] font-black">↓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STAGE 3: Accelerators (Detected Forms & AI Prompt) */}
            <div className="space-y-2">
              {/* Detected Page Forms */}
              {pageScan && pageScan.forms.length > 0 && (
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/25 space-y-2">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                      <Wand2 size={12} className="text-purple-400" />
                      <span>Detected Live Form on Page</span>
                    </div>
                    <button
                      onClick={rescan}
                      className="text-gray-400 hover:text-white cursor-pointer flex items-center gap-1 text-[10px]"
                    >
                      <RefreshCw size={10} />
                      <span>Rescan</span>
                    </button>
                  </div>

                  {pageScan.forms.slice(0, 2).map((form) => (
                    <button
                      key={form.key}
                      onClick={() => handleFormulate(form)}
                      onMouseEnter={() => previewElement(form.container)}
                      onMouseLeave={() => previewElement(null)}
                      className="group w-full flex items-center justify-between p-2.5 rounded-lg bg-[#0c1222] border border-white/10 hover:border-purple-400/50 text-left cursor-pointer transition-all shadow-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="text-[11.5px] font-bold text-white truncate">{form.title}</div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {form.fields.map((f) => f.label).join(" · ")}
                          {form.submit ? ` → ${form.submit.label}` : ""}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] shrink-0">
                        + Auto-Build
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* AI Auto-Generate Prompt Box */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center gap-1 text-[10.5px] text-gray-300 font-semibold">
                  <Sparkles size={12} className="text-[#D4FF00]" />
                  <span>AI Prompt-to-Flow Builder</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Add headphones to cart and scroll to reviews"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="flex-1 bg-[#0c1222] border border-white/15 focus:border-[#D4FF00] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none"
                  />
                  <button
                    onClick={handleAiGenerateWorkflow}
                    disabled={isGeneratingAi || !aiPrompt.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[#D4FF00] hover:bg-[#b8dd00] text-black text-xs font-black disabled:opacity-40 cursor-pointer shadow-sm transition-all"
                  >
                    {isGeneratingAi ? "Building..." : "Build"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Action Bar (Image 2 Clean Tactile Footer) */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
              {invalidSteps > 0 ? (
                <span className="text-[10.5px] text-amber-400 flex items-center gap-1.5 font-medium">
                  <AlertCircle size={12} />
                  <span>{invalidSteps} step(s) need a target selector</span>
                </span>
              ) : (
                <span className="text-[10.5px] text-gray-400 font-mono">
                  {formSteps.length} {formSteps.length === 1 ? "step" : "steps"} configured
                </span>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveWorkflow}
                  disabled={!formName.trim() || formSteps.length === 0 || invalidSteps > 0}
                  className="px-5 py-2 rounded-xl bg-[#D4FF00] hover:bg-[#b8dd00] text-black text-xs font-black disabled:opacity-40 cursor-pointer shadow-[0_0_15px_rgba(212,255,0,0.3)] active:scale-95 transition-all"
                >
                  Save Automation ({formSteps.length})
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Live Execution Feedback Card */}
        {runningWorkflowId && (
          <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/40 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                <RefreshCw size={13} className="animate-spin text-purple-400" />
                <span>Executing Workflow...</span>
              </div>
              <span className="text-[10px] font-mono text-purple-400">Live Browser Actions</span>
            </div>

            <div className="space-y-1">
              {runningSteps.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-black/40 border border-white/5"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {s.status === "success" ? (
                      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                    ) : s.status === "running" ? (
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin shrink-0" />
                    ) : s.status === "error" ? (
                      <AlertCircle size={12} className="text-rose-400 shrink-0" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-600 shrink-0" />
                    )}
                    <span className="text-gray-200 truncate flex items-center gap-1">
                      <span>{s.title || s.action}</span>
                      {clickRepeatCount(s) > 1 && (
                        <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 font-semibold font-mono text-[9px] shrink-0">
                          ×{clickRepeatCount(s)}
                        </span>
                      )}
                    </span>
                  </div>
                  {s.output && (
                    <span className="text-[9px] font-mono text-gray-400 ml-2 truncate max-w-[120px]">
                      {s.output}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {executionLog.length > 0 && (
              <div className="mt-1.5 pt-1 border-t border-purple-500/20 text-[9px] font-mono text-purple-300/80 space-y-0.5 max-h-16 overflow-y-auto">
                {executionLog.map((log, lIdx) => (
                  <div key={lIdx} className="truncate">{log}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category Filters Toolbar (Image 2 style) */}
        {!showEditor && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setFilterCategory("all")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterCategory === "all"
                  ? "bg-[#D4FF00] text-black shadow-[0_0_10px_rgba(212,255,0,0.25)]"
                  : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
              }`}
            >
              All Flows ({workflows.length})
            </button>
            <button
              onClick={() => setFilterCategory("actions")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterCategory === "actions"
                  ? "bg-[#D4FF00] text-black shadow-[0_0_10px_rgba(212,255,0,0.25)]"
                  : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
              }`}
            >
              ⚡ Actions
            </button>
            <button
              onClick={() => setFilterCategory("forms")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterCategory === "forms"
                  ? "bg-[#D4FF00] text-black shadow-[0_0_10px_rgba(212,255,0,0.25)]"
                  : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
              }`}
            >
              📝 Form Fillers
            </button>
            <button
              onClick={() => setFilterCategory("tours")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterCategory === "tours"
                  ? "bg-[#D4FF00] text-black shadow-[0_0_10px_rgba(212,255,0,0.25)]"
                  : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
              }`}
            >
              🧭 Tours
            </button>
          </div>
        )}

        {/* Workflows List - Tactile Neo-Brutalist Deck (Image 2 Card Architecture) */}
        {!showEditor && (
          <div className="space-y-3">
            {filteredWorkflows.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-white/15 bg-black/20 text-center space-y-2">
                <p className="text-xs text-gray-400 font-medium">No automations found in this category</p>
                <button
                  onClick={() => setFilterCategory("all")}
                  className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
                >
                  View All Flows
                </button>
              </div>
            ) : (
              filteredWorkflows.map((wf, wIdx) => {
                const isCurrentlyRunning = runningWorkflowId === wf.id;
                const themeMod = wIdx % 3;
                const cardAccent = themeMod === 0 
                  ? "border-l-4 border-l-[#D4FF00] bg-[#0c111e]" 
                  : themeMod === 1 
                  ? "border-l-4 border-l-[#A855F7] bg-[#0c111e]" 
                  : "border-l-4 border-l-[#FF2E93] bg-[#0c111e]";

                const cleanTitle = stripLeadingEmoji(wf.name);
                const isFormWf = wf.steps.some((s) => s.action === "type" || s.action === "select");
                const isTourWf = wf.steps.some((s) => s.action === "scroll" || s.action === "teleport");
                const categoryTag = isFormWf ? "📝 Form Automation" : isTourWf ? "🧭 Navigation Tour" : "⚡ Direct Page Action";

                return (
                  <div
                    key={wf.id}
                    data-testid={`workflow-card-${wf.id}`}
                    className={`p-3.5 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-3 shadow-md ${cardAccent}`}
                  >
                    {/* Category Shelf (Image 2 Tag Header) */}
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                        <span className="font-semibold">{categoryTag}</span>
                        {wf.triggerPhrase && (
                          <>
                            <span className="text-gray-600">·</span>
                            <span className="text-[#D4FF00] font-bold">{"/" + wf.triggerPhrase}</span>
                          </>
                        )}
                      </div>
                      <span className="text-gray-500">0 tokens</span>
                    </div>

                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-black text-[#D4FF00] flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-sm border border-white/10">
                          <Zap size={14} className="fill-current" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-[13px] text-white tracking-tight truncate">{cleanTitle}</span>
                            {wf.isSystemStarter && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black text-[#D4FF00] font-mono border border-[#D4FF00]/30 shrink-0">
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">{wf.description}</p>
                        </div>
                      </div>

                      {/* High-Contrast Tactile Run Button */}
                      <button
                        onClick={() => handleRunWorkflow(wf)}
                        disabled={isCurrentlyRunning}
                        className="px-3.5 py-1.5 rounded-xl neo-btn-lime-hero text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                        title="Run this entire workflow now"
                      >
                        <Play size={10} className="fill-current stroke-none" />
                        <span>Run</span>
                      </button>
                    </div>

                    {/* Visual Flowchart Sequence (Image 2 Parameter Badge Style) */}
                    <div className="pt-2 border-t border-white/8 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9.5px] font-black uppercase tracking-wider text-gray-400 font-mono">
                          Pipeline Flow ({wf.steps.length} {wf.steps.length === 1 ? "step" : "steps"}):
                        </span>
                        <span className="text-[9.5px] font-mono text-gray-500">
                          ~{wf.steps.reduce((acc, s) => acc + (s.delayMs || 500), 0)}ms
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {wf.steps.map((st, sIdx) => {
                          const repeats = clickRepeatCount(st);
                          const stepAction = st.action || "step";
                          const stepLabel = st.title
                            ? stripLeadingEmoji(st.title).replace(/^(Click|Type into|Wait for|Navigate to)\s+/i, "")
                            : (st.target ? st.target.replace(/^[.#]/, "").slice(0, 16) : stepAction);

                          return (
                            <React.Fragment key={sIdx}>
                              <div
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/70 border border-white/12 text-[10.5px] font-mono text-gray-200 shadow-sm"
                              >
                                <span className="w-4 h-4 rounded-full bg-white/10 text-[9px] font-bold text-gray-300 flex items-center justify-center shrink-0">
                                  {sIdx + 1}
                                </span>
                                <span className="text-[#D4FF00] font-black uppercase text-[9.5px] tracking-wider">
                                  {stepAction}
                                </span>
                                {stepLabel && (
                                  <span className="text-gray-300 font-medium truncate max-w-[110px]" title={st.title || st.target}>
                                    {stepLabel}
                                  </span>
                                )}
                                {repeats > 1 && (
                                  <span className="px-1 py-0.2 rounded bg-purple-500/30 text-purple-200 font-bold text-[9px]">
                                    ×{repeats}
                                  </span>
                                )}
                              </div>
                              {sIdx < wf.steps.length - 1 && (
                                <span className="text-gray-600 text-xs font-bold shrink-0">→</span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          <span>Run {wf.executionCount || 0} times</span>
                        </span>
                      </div>

                      {!wf.isSystemStarter && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(wf)}
                            className="text-gray-400 hover:text-white cursor-pointer"
                            title="Edit workflow"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(wf.id)}
                            className="text-gray-400 hover:text-rose-400 cursor-pointer"
                            title="Delete workflow"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
