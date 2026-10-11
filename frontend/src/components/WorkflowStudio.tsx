import React, { useState, useEffect, useRef } from "react";
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
  ArrowLeft,
  Crosshair,
  Wand2,
} from "lucide-react";
import { WebWorkflow, WorkflowStep } from "../lib/types";
import { workflowStore } from "../lib/workflowStore";
import { workflowRunner } from "../lib/workflowRunner";
import { StepEditor } from "./WorkflowStepEditor";
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
  onBackToChat,
  onWorkflowExecuted,
}) => {
  const [workflows, setWorkflows] = useState<WebWorkflow[]>([]);
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null);
  const [runningSteps, setRunningSteps] = useState<WorkflowStep[]>([]);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WebWorkflow | null>(null);

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
      {/* Top Bar Banner */}
      <div className="p-3 bg-black/40 border-b border-white/8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {onBackToChat && (
            <button
              onClick={onBackToChat}
              className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer mr-0.5"
              title="Back to chat"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <div className="p-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Zap size={15} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white leading-none">Automations & Workflows</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Repeat multi-step website actions with 1 click & 0 tokens
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-2.5 py-1 rounded-[6px] bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
        >
          <Plus size={12} />
          <span>New</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Editor Modal / Drawer */}
        {showEditor ? (
          <div className="p-3 rounded-[8px] bg-[#0c1222] border border-purple-500/30 space-y-3 animate-in fade-in duration-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-white/8">
              <span className="font-semibold text-white">
                {editingWorkflow ? "Edit Workflow" : "Create New Automation"}
              </span>
              <button
                onClick={() => setShowEditor(false)}
                className="text-gray-400 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* AI Auto-Generate Prompt Box */}
            <div className="p-2 rounded-[6px] bg-purple-950/20 border border-purple-500/20 space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-purple-300 font-medium">
                <Sparkles size={12} className="text-purple-400" />
                <span>AI Auto-Build Steps from Prompt</span>
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. Inspect music dsp engine and scroll to code"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-400"
                />
                <button
                  onClick={handleAiGenerateWorkflow}
                  disabled={isGeneratingAi || !aiPrompt.trim()}
                  className="px-2.5 py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-medium disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingAi ? "Generating..." : "Build"}
                </button>
              </div>
            </div>

            {/* Detected Page Forms & Inputs Strip */}
            {pageScan && (
              <div className="space-y-1.5 p-2 rounded-[6px] bg-black/30 border border-white/8">
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>
                    Detected: {pageScan.forms.length} forms · {pageScan.elements.length} interactive elements
                  </span>
                  <button
                    onClick={rescan}
                    title="Rescan active page elements"
                    className="text-gray-400 hover:text-white cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw size={10} />
                    <span>Rescan</span>
                  </button>
                </div>

                {pageScan.forms.length > 0 ? (
                  <div className="space-y-1">
                    {pageScan.forms.slice(0, 4).map((form) => (
                      <button
                        key={form.key}
                        onClick={() => handleFormulate(form)}
                        onMouseEnter={() => previewElement(form.container)}
                        onMouseLeave={() => previewElement(null)}
                        className="group w-full flex items-center gap-2 p-1.5 rounded-[6px] bg-[#111626] border border-white/8 hover:border-purple-500/40 text-left cursor-pointer transition-colors"
                      >
                        <Wand2 size={12} className="text-purple-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-medium text-gray-100 truncate">{form.title}</div>
                          <div className="text-[9px] text-gray-500 truncate">
                            {form.fields.map((f) => f.label).join(" · ")}
                            {form.submit ? ` → ${form.submit.label}` : ""}
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-purple-300 opacity-0 group-hover:opacity-100 shrink-0">
                          Build steps
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-500">
                    No multi-field forms detected. Add steps manually or pick elements from the page.
                  </p>
                )}
              </div>
            )}

            {/* Workflow Meta Fields */}
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Workflow Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Quick Portfolio Tour"
                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Scrolls to projects and verifies canvas"
                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-0.5">Trigger Keyword (Optional)</label>
                <input
                  type="text"
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value)}
                  placeholder="e.g. tour, music, contact"
                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Workflow Steps Builder */}
            <div className="space-y-2 pt-1 border-t border-white/8">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-300">
                  Execution Steps ({formSteps.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddFromPage}
                    className="text-[10px] text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer font-medium"
                    title="Click any element on the page to add a step"
                  >
                    <Crosshair size={11} />
                    <span>Pick from page</span>
                  </button>
                  <button
                    onClick={handleAddStep}
                    className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <Plus size={11} />
                    <span>Add Step</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {formSteps.length === 0 ? (
                  <div className="p-3 rounded border border-dashed border-white/10 text-center text-[10px] text-gray-500 space-y-1">
                    <p>No execution steps yet.</p>
                    <p className="text-[9px] text-gray-600">
                      Use <span className="text-cyan-400 font-medium">Pick from page</span>, click{" "}
                      <span className="text-purple-400 font-medium">Build steps</span> on a detected form, or click{" "}
                      <span className="text-purple-400 font-medium">+ Add Step</span>.
                    </p>
                  </div>
                ) : (
                  formSteps.map((step, idx) => (
                    <StepEditor
                      key={step.id || idx}
                      step={step}
                      index={idx}
                      scan={pageScan}
                      picking={pickingIdx === idx}
                      onChange={(updates) => handleUpdateStep(idx, updates)}
                      onRemove={() => handleRemoveStep(idx)}
                      onPick={() => handlePickTarget(idx)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/8">
              {invalidSteps > 0 ? (
                <span className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertCircle size={11} />
                  <span>{invalidSteps} step(s) need a target</span>
                </span>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveWorkflow}
                  disabled={!formName.trim() || formSteps.length === 0 || invalidSteps > 0}
                  className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  Save Automation
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Live Execution Feedback Card */}
        {runningWorkflowId && (
          <div className="p-3 rounded-[8px] bg-purple-950/30 border border-purple-500/40 space-y-2 animate-in fade-in duration-150">
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
                  className="flex items-center justify-between text-[11px] p-1 rounded bg-black/40 border border-white/5"
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
                    <span className="text-gray-200 truncate">{s.title || s.action}</span>
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

        {/* Workflows List */}
        <div className="space-y-2.5">
          {workflows.map((wf) => {
            const isCurrentlyRunning = runningWorkflowId === wf.id;

            return (
              <div
                key={wf.id}
                data-testid={`workflow-card-${wf.id}`}
                className="p-3 rounded-[8px] bg-[#0c101d] border border-white/8 hover:border-purple-500/30 transition-all space-y-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-white truncate">{wf.name}</span>
                      {wf.isSystemStarter && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-500/30 shrink-0">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{wf.description}</p>
                  </div>

                  {/* 1-Click Run Button */}
                  <button
                    onClick={() => handleRunWorkflow(wf)}
                    disabled={isCurrentlyRunning}
                    className="px-2.5 py-1 rounded-[6px] bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0"
                    title="Run this entire workflow now"
                  >
                    <Play size={11} className="fill-current text-emerald-400" />
                    <span>Run</span>
                  </button>
                </div>

                {/* Steps Preview Shelf */}
                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-white/5">
                  <span className="text-[9px] font-mono text-gray-500 mr-1">Steps:</span>
                  {wf.steps.map((st, sIdx) => (
                    <div
                      key={sIdx}
                      className="px-1.5 py-0.5 rounded bg-black/40 border border-white/6 text-[10px] font-mono text-gray-300 flex items-center gap-1"
                    >
                      <span className="text-purple-400">{st.action}</span>
                      {st.target && <span className="text-gray-400 truncate max-w-[80px]">({st.target})</span>}
                    </div>
                  ))}
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>Run {wf.executionCount || 0} times</span>
                    </span>
                    {wf.triggerPhrase && (
                      <span className="font-mono text-purple-400/80">"{wf.triggerPhrase}"</span>
                    )}
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
          })}
        </div>
      </div>
    </div>
  );
};
