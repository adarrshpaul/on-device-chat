/**
 * useChat hook — Orchestrates:
 * 1. Progressive Model Escalation (Nano 0MB -> MiniLM 15MB -> SmolLM2 80MB -> Gemma4 600MB).
 * 2. Universal Agent Harness (5 Primitives: browse, sandbox, read/write, search, ask).
 * 3. Chrome AI Expert Judge Evaluation Loop (traces, rubric judging, accuracy, precision, recall, F1, Cohen's Kappa).
 * 4. Self-improving site recipes & golden exemplars.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { EscalationManager, TierInfo, TIER_METADATA, ModelTier, ModelProgressInfo } from "../lib/escalationManager";
import { backgroundDownloader, PreloadProgress } from "../lib/backgroundDownloader";
import { AgentHarness } from "../lib/agentHarness";
import { expertJudge, EvalMetrics, EvalTrace, AgentStepTrace } from "../lib/expertJudge";
import { recipeStore, SiteMacroRecipe } from "../lib/recipeStore";
import { pageActionInferer, PageAnalysisResult } from "../lib/pageActionInferer";
import { sessionStore, ChatSession } from "../lib/sessionStore";
import type { DecisionTrace, ActionExecutionOutput, WebWorkflow, BatchProposal, UISpec } from "../lib/types";
import { workflowRunner } from "../lib/workflowRunner";
import { workflowStore } from "../lib/workflowStore";
import { ensembleDecisionEngine } from "../lib/ensembleDecision";
import { NavPersistenceManager } from "../lib/navPersistence";
import { batchRunner, BatchProposalManager } from "../lib/batchEngine";
import { MacroRecorder } from "../lib/macroRecorder";
import { CanvasGameController, GameProgressEvent } from "../lib/canvasGameController";
import { CanvasInspector } from "../lib/canvasInspector";
import { UISpecEngine } from "../lib/uiSpecEngine";
import { globalTodoManager, PlanState } from "../lib/todoManager";
import type { Gemma4Config } from "../main";

export interface DisplayMessage {
  id?: string;
  role: "user" | "assistant" | "tool" | "system";
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
  tierInfo?: TierInfo;
  feedback?: "up" | "down" | null;
  isEscalationNotice?: boolean;
  stepTrace?: AgentStepTrace[];
  isMacro?: boolean;
  durationMs?: number;
  decision?: DecisionTrace;
  actionOutput?: ActionExecutionOutput;
  batchProposal?: BatchProposal;
  gameProgress?: GameProgressEvent & { isFinished?: boolean; summary?: string };
  ui?: UISpec[];
}

export type EngineStatus = "idle" | "loading" | "ready" | "generating" | "error";

export function useChat(config: Gemma4Config) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [sessionsList, setSessionsList] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("loading");
  const [currentTierInfo, setCurrentTierInfo] = useState<TierInfo>(TIER_METADATA[ModelTier.TIER_1_5_LAYA_DECISION]);
  const [prefetchStatus, setPrefetchStatus] = useState<PreloadProgress | null>(null);
  const [modelLoadingProgress, setModelLoadingProgress] = useState<ModelProgressInfo | null>(null);
  const [nanoSupported, setNanoSupported] = useState<boolean>(false);
  const [nanoDiagnostic, setNanoDiagnostic] = useState<string>("");

  // Agent Harness & Evals Telemetry state
  const [activeSteps, setActiveSteps] = useState<AgentStepTrace[]>([]);
  const [evalMetrics, setEvalMetrics] = useState<EvalMetrics | null>(null);
  const [recentTraces, setRecentTraces] = useState<EvalTrace[]>([]);
  const [siteMacros, setSiteMacros] = useState<SiteMacroRecipe[]>([]);
  const [isJudging, setIsJudging] = useState(false);
  const [pageAnalysis, setPageAnalysis] = useState<PageAnalysisResult | null>(null);
  const [isRecordingMacro, setIsRecordingMacro] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<PlanState | null>(null);

  useEffect(() => {
    const unsub = globalTodoManager.onPlanChange((plan) => {
      setCurrentPlan(plan);
    });
    return unsub;
  }, []);

  const approvePlan = useCallback(() => {
    globalTodoManager.approvePlan();
  }, []);

  const rejectPlan = useCallback(() => {
    globalTodoManager.rejectPlan("User cancelled plan.");
  }, []);

  const escalationManagerRef = useRef<EscalationManager | null>(null);
  const harnessRef = useRef<AgentHarness | null>(null);

  // Load stored sessions on init
  const refreshSessions = useCallback(async () => {
    try {
      const list = await sessionStore.listSessions();
      setSessionsList(list);
    } catch (e) {
      console.warn("Failed refreshing sessions:", e);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const createNewSession = useCallback(() => {
    const newId = `sess_${Date.now()}`;
    setCurrentSessionId(newId);
    setMessages([]);
    setError(null);
  }, []);

  const switchSession = useCallback(async (sessionId: string) => {
    try {
      const sess = await sessionStore.getSession(sessionId);
      if (sess) {
        setCurrentSessionId(sess.id);
        setMessages(sess.messages || []);
        setError(null);
      }
    } catch (e) {
      console.error("Failed to switch session:", e);
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await sessionStore.deleteSession(sessionId);
      await refreshSessions();
      if (sessionId === currentSessionId) {
        createNewSession();
      }
    } catch (e) {
      console.error("Failed to delete session:", e);
    }
  }, [currentSessionId, createNewSession, refreshSessions]);

  const reanalyzePage = useCallback(() => {
    return pageActionInferer.analyzePage(config.tools || []);
  }, [config.tools]);

  // Subscribe to pageActionInferer and run background discovery
  useEffect(() => {
    const unsub = pageActionInferer.subscribe((result) => {
      setPageAnalysis(result);
    });

    const runDiscovery = () => {
      if (typeof window !== "undefined") {
        if ("requestIdleCallback" in window) {
          (window as any).requestIdleCallback(() => {
            pageActionInferer.analyzePage(config.tools || []);
          });
        } else {
          setTimeout(() => {
            pageActionInferer.analyzePage(config.tools || []);
          }, 300);
        }
      }
    };

    runDiscovery();

    if (typeof window !== "undefined") {
      window.addEventListener("popstate", runDiscovery);
      window.addEventListener("hashchange", runDiscovery);
    }

    return () => {
      unsub();
      if (typeof window !== "undefined") {
        window.removeEventListener("popstate", runDiscovery);
        window.removeEventListener("hashchange", runDiscovery);
      }
    };
  }, [config.tools]);

  // Refresh evaluation metrics & learned macros
  const refreshEvalsData = useCallback(async () => {
    try {
      const metrics = await expertJudge.computeMetrics();
      setEvalMetrics(metrics);
      const traces = await expertJudge.getAllTraces();
      setRecentTraces(traces.slice(-10).reverse());

      const siteOrigin = typeof window !== "undefined" ? window.location.origin : "web";
      const macros = await recipeStore.getMacrosForOrigin(siteOrigin);
      setSiteMacros(macros);
    } catch (e) {
      console.warn("Failed refreshing evals data:", e);
    }
  }, []);

  // Initialize Escalation Manager and Agent Harness
  useEffect(() => {
    CanvasInspector.initBridge();
    const manager = new EscalationManager({
      tools: config.tools || [],
      systemPrompt: config.systemPrompt,
      onTierChange: (tier) => setCurrentTierInfo(tier),
      onProgress: (info) => setModelLoadingProgress(info),
      onEscalationNotice: (notice) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `esc_${Date.now()}`,
            role: "system",
            content: notice,
            isEscalationNotice: true,
          },
        ]);
      },
    });

    escalationManagerRef.current = manager;
    // System 1 (DOM navigation, site tour, page summary, and BM25 extractive search)
    // is instantly ready without waiting for 15MB neural weight downloads.
    setEngineStatus("ready");
    setCurrentTierInfo(manager.currentTierInfo);

    manager
      .init()
      .then(() => {
        setEngineStatus("ready");
        setCurrentTierInfo(manager.currentTierInfo);
        setNanoSupported(manager.nanoSupported);
        setNanoDiagnostic(manager.nanoDiagnostic);
      })
      .catch((err) => {
        console.warn("Background model initialization notice:", err);
        // Engine remains ready because System 1 and lexical BM25 Q&A function 100% offline
        setEngineStatus("ready");
      });

    // Build custom host tools map from config.onToolCall
    const customHostTools: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};
    if (config.tools && config.onToolCall) {
      for (const t of config.tools) {
        const toolName = t.function.name;
        customHostTools[toolName] = (args) => config.onToolCall!(toolName, args);
      }
    }

    // Initialize the Agent Harness with 5 Primitives + Custom Host Tools
    harnessRef.current = new AgentHarness({
      maxSteps: 10,
      customHostTools,
      customToolDefs: config.tools || [],
      onStepProgress: (step, tool, obs) => {
        setActiveSteps((prev) => [
          ...prev,
          {
            step,
            tool,
            args: {},
            observationSummary: obs.slice(0, 100),
            durationMs: 0,
          },
        ]);
      },
    });

    // Subscribe to background prefetch progress
    const unsubscribePrefetch = backgroundDownloader.subscribe((p) => {
      setPrefetchStatus(p);
    });

    // Initial evals telemetry load
    refreshEvalsData();

    // Check for pending in-flight task from previous page navigation
    const pendingTask = NavPersistenceManager.getPendingTask();
    if (pendingTask) {
      NavPersistenceManager.clearTask();
      const resumeNotice: DisplayMessage = {
        id: `resume_${Date.now()}`,
        role: "assistant",
        content: `📍 Navigated to **${typeof window !== "undefined" ? window.location.pathname : "page"}**. Resuming task: *"${pendingTask.userGoal}"*...`,
      };
      setMessages((prev) => [...prev, resumeNotice]);
      setTimeout(() => {
        if (harnessRef.current && escalationManagerRef.current) {
          sendMessage(pendingTask.userGoal);
        }
      }, 500);
    }

    return () => {
      unsubscribePrefetch();
      manager.destroy();
    };
  }, [config.tools, config.systemPrompt, config.onToolCall, refreshEvalsData]);

  /**
   * Execute a direct standalone action (from a button click or inline card)
   * Guaranteed to always execute and append visible output telemetry to chat.
   */
  const executeDirectAction = useCallback(
    async (actionName: string, args: Record<string, unknown> = {}) => {
      const output = await workflowRunner.executeSingleAction(actionName, args);
      const outputMsg: DisplayMessage = {
        id: `act_${Date.now()}`,
        role: "assistant",
        actionOutput: output,
        durationMs: output.durationMs,
        tierInfo: currentTierInfo,
      };
      setMessages((prev) => [...prev, outputMsg]);
      return output;
    },
    [currentTierInfo]
  );

  /**
   * Run a saved multi-step automation workflow
   */
  const runSavedWorkflow = useCallback(
    async (workflowOrId: string | WebWorkflow, fromUserQuery?: string) => {
      let wf: WebWorkflow | undefined;
      if (typeof workflowOrId === "object" && workflowOrId !== null) {
        wf = workflowOrId;
      } else if (typeof workflowOrId === "string") {
        const workflows = await workflowStore.getWorkflowsForOrigin();
        wf = workflows.find((w) => w.id === workflowOrId);
        if (!wf) {
          wf = (await workflowStore.findWorkflowByTrigger(workflowOrId)) || undefined;
        }
      }

      if (!wf) {
        console.warn("[useChat] runSavedWorkflow: workflow not found for:", workflowOrId);
        return;
      }

      setIsLoading(true);
      const wfContainerId = `wf_exec_${Date.now()}`;
      const msgsToAdd: DisplayMessage[] = [];
      if (fromUserQuery) {
        msgsToAdd.push({
          id: `user_${Date.now()}`,
          role: "user",
          content: fromUserQuery,
        });
      }

      const initialStepLines = wf.steps
        .map((s: any, i: number) => `${i === 0 ? "👁️" : "○"} **Step ${i + 1}**: ${s.title}`)
        .join("\n");

      msgsToAdd.push({
        id: wfContainerId,
        role: "assistant",
        content: `🧭 **Human Web Navigation: ${wf.name}**\n\n${initialStepLines}`,
        isMacro: true,
      });
      setMessages((prev) => [...prev, ...msgsToAdd]);

      try {
        const res = await workflowRunner.runWorkflow(wf, {
          onStepUpdate: (idx, step) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id === wfContainerId) {
                  const stepLines = wf.steps.map((s: any, i: number) => {
                    if (i < idx || (i === idx && step.status === "success")) {
                      return `✓ **Step ${i + 1}**: ${s.title} *(observed)*`;
                    } else if (i === idx && step.status === "running") {
                      return `👁️ **Step ${i + 1}**: ${s.title} *(viewing with human gaze...)*`;
                    } else if (i === idx && step.status === "error") {
                      return `✗ **Step ${i + 1}**: ${s.title} *(failed)*`;
                    } else {
                      return `○ **Step ${i + 1}**: ${s.title}`;
                    }
                  });
                  return {
                    ...m,
                    content: `🧭 **Human Web Navigation: ${wf.name}**\n\n${stepLines.join("\n")}`,
                  };
                }
                return m;
              })
            );
          },
        });

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === wfContainerId) {
              const stepLines = wf.steps
                .map((s: any, i: number) => `✓ **Step ${i + 1}**: ${s.title}`)
                .join("\n");
              return {
                ...m,
                content: res.success
                  ? `✓ **Human Web Navigation Complete: ${wf.name}**\n\n${stepLines}\n\n*All ${wf.steps.length} landmarks visited with human gaze & zero prompt tokens.*`
                  : `✗ **Navigation encountered error**: ${res.error}\n\n${stepLines}`,
              };
            }
            return m;
          })
        );
      } catch (err: any) {
        console.error("[useChat] Error running saved workflow:", err);
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === wfContainerId) {
              return {
                ...m,
                content: `⚠️ **Workflow execution ended**: ${err?.message || "Execution error"}`,
              };
            }
            return m;
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Execute batch proposal across confirmed entities with human confirmation gate
   */
  const executeBatchProposal = useCallback(
    async (proposalToRun: BatchProposal) => {
      setIsLoading(true);
      setError(null);

      // Update message state to show running status
      setMessages((prev) =>
        prev.map((m) => {
          if (m.batchProposal?.id === proposalToRun.id) {
            return {
              ...m,
              batchProposal: { ...proposalToRun, executionStatus: "running" },
            };
          }
          return m;
        })
      );

      try {
        const result = await batchRunner.executeBatch(proposalToRun, {
          onEntityProgress: (idx, entity) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.batchProposal?.id === proposalToRun.id) {
                  const updated = [...m.batchProposal.entities];
                  updated[idx] = { ...entity };
                  return {
                    ...m,
                    batchProposal: {
                      ...m.batchProposal,
                      entities: updated,
                    },
                  };
                }
                return m;
              })
            );
          },
        });

        setMessages((prev) =>
          prev.map((m) => {
            if (m.batchProposal?.id === proposalToRun.id) {
              return {
                ...m,
                content: `✓ **Batch Action Completed**\n\n${result.summary}`,
                batchProposal: {
                  ...proposalToRun,
                  entities: result.entities,
                  executionStatus: "completed",
                  succeededCount: result.succeededCount,
                  failedCount: result.failedCount,
                },
              };
            }
            return m;
          })
        );
      } catch (err: any) {
        console.error("[useChat] Batch execution error:", err);
        setError(err?.message || "Batch execution error");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const cancelBatchProposal = useCallback((proposalId: string) => {
    batchRunner.cancel();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.batchProposal?.id === proposalId) {
          return {
            ...m,
            content: `Cancelled batch proposal for ${m.batchProposal.title}.`,
            batchProposal: {
              ...m.batchProposal,
              executionStatus: "cancelled",
            },
          };
        }
        return m;
      })
    );
  }, []);

  const abortBatchExecution = useCallback(() => {
    batchRunner.cancel();
    setIsLoading(false);
  }, []);

  /**
   * Start macro recording on Item 1 ("Teach 1 → Batch N")
   */
  const startMacroRecording = useCallback((customPrompt?: string) => {
    setIsRecordingMacro(true);

    const userPrompt = customPrompt || "Record macro workflow on item 1";
    const userMsg: DisplayMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: userPrompt,
    };

    const instructMsg: DisplayMessage = {
      id: `asst_${Date.now()}`,
      role: "assistant",
      content: "🔴 **Recording Workflow on Item 1**\n\nPerform your actions directly on the first item in the page (e.g. click edit, change text/status, click save).\n\nThe agent is capturing your relative DOM actions and will generalize them across all sibling entities.\n\nWhen finished, click **Done Recording ✔** on the floating banner at the top of your screen.",
    };

    setMessages((prev) => [...prev, userMsg, instructMsg]);

    MacroRecorder.startRecording({
      onProposalReady: (proposal: BatchProposal) => {
        setIsRecordingMacro(false);
        const completionMsg: DisplayMessage = {
          id: `asst_${Date.now()}`,
          role: "assistant",
          content: `⚡ **Macro Recorded Successfully**\n\nCaptured **${proposal.templateSteps.length} interaction steps** on the demonstrated item. Discovered **${proposal.entities.length} sibling entities** on this page.\n\nReview the proposed batch updates in the confirmation gate below:`,
          batchProposal: proposal,
        };
        setMessages((prev) => [...prev, completionMsg]);
      },
    });
  }, []);

  const stopMacroRecording = useCallback(() => {
    setIsRecordingMacro(false);
    MacroRecorder.stopRecording();
  }, []);

  /**
   * Run multi-model ensemble consensus decision evaluation
   */
  const evaluateEnsembleDecision = useCallback(
    async (goal: string, candidateActions: any[]) => {
      return await ensembleDecisionEngine.evaluateEnsemble(goal, candidateActions);
    },
    []
  );

  /**
   * Execute task through Agent Harness Loop
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const cleanLower = content.toLowerCase().trim();

      // Check if user requests macro recording demonstration ("Teach 1 -> Batch N")
      if (
        /\b(record macro|record workflow|watch me|watch what i do|teach 1|teach macro|record action|start recording)\b/i.test(cleanLower) ||
        cleanLower.startsWith("/record")
      ) {
        startMacroRecording(content);
        return;
      }

      // Check if user requests batch operations across multiple entities
      if (
        /\b(batch|bulk|for all|apply to all|update all|process all|all items|all devices|all rows|all projects|all entities)\b/i.test(cleanLower) ||
        cleanLower.startsWith("/batch")
      ) {
        const userMsg: DisplayMessage = {
          id: `user_${Date.now()}`,
          role: "user",
          content,
        };
        const proposal = BatchProposalManager.createProposal({
          intent: content,
          siteOrigin: typeof window !== "undefined" ? window.location.origin : "localhost",
        });

        const assistantMsg: DisplayMessage = {
          id: `asst_${Date.now()}`,
          role: "assistant",
          content: `📦 **Batch Action Proposal Generated**\n\nI identified **${proposal.entities.length} items** in the active DOM. Review and configure the items in the **Human Confirmation Gate** below, then approve execution.`,
          batchProposal: proposal,
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        return;
      }

      // Check if user requests autonomous game playing / canvas autopilot
      if (
        /\b(play game|play basketball|start game|play the game|game autopilot|autopilot game|score more|get more score|score points|beat high score|score baskets|basketball)\b/i.test(cleanLower) ||
        cleanLower.startsWith("/play")
      ) {
        const userMsg: DisplayMessage = {
          id: `user_${Date.now()}`,
          role: "user",
          content,
        };

        const asstMsgId = `asst_${Date.now()}`;
        const initialGameMsg: DisplayMessage = {
          id: asstMsgId,
          role: "assistant",
          content: `🏀 **Autonomous Game Autopilot Initialized**\n\nI have engaged the 60Hz physics trajectory optimizer on the active canvas game. Live scoring and combo updates stream below:`,
          gameProgress: {
            elapsedSec: 0,
            score: 0,
            deltaScore: 0,
            combo: 0,
            totalJumps: 0,
            turbo: false,
            statusText: "Analyzing canvas physics & launching gameplay...",
          },
        };

        setMessages((prev) => [...prev, userMsg, initialGameMsg]);
        setIsLoading(true);
        setError(null);

        try {
          const result = await CanvasGameController.playGame({
            durationSec: 35,
            targetScore: 100,
            onProgress: (evt) => {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id === asstMsgId) {
                    return {
                      ...m,
                      gameProgress: { ...evt },
                    };
                  }
                  return m;
                })
              );
            },
          });

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === asstMsgId) {
                return {
                  ...m,
                  content: `🏆 **Game Match Complete!**\n\nAchieved **${result.finalScore} points** across **${result.totalJumps} jumps** (Max Combo: **x${result.maxCombo}**).\n\n*${result.summary}*`,
                  gameProgress: {
                    elapsedSec: result.durationSec,
                    score: result.finalScore,
                    deltaScore: 0,
                    combo: result.maxCombo,
                    totalJumps: result.totalJumps,
                    turbo: result.maxCombo >= 3,
                    statusText: "Match finished successfully.",
                    isFinished: true,
                    summary: result.summary,
                  },
                };
              }
              return m;
            })
          );
        } catch (err: any) {
          setError(`Game Autopilot error: ${err?.message || err}`);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // Only execute workflow if user explicitly types an automation command (e.g. /wf, run workflow)
      if (cleanLower.startsWith("/wf ") || cleanLower.startsWith("run workflow")) {
        const queryTerm = cleanLower.replace(/^\/(?:wf|workflow)\s+|^run\s+workflow\s+/i, "");
        const matchedWf = await workflowStore.findMatchingWorkflow("*", queryTerm);
        if (matchedWf) {
          await runSavedWorkflow(matchedWf, content);
          return;
        }
      }

      if (!escalationManagerRef.current || !harnessRef.current) {
        setError("AI Engine is initializing. Please wait a moment.");
        return;
      }

      const userMsg: DisplayMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);
      setActiveSteps([]);

      try {
        const activeTier = escalationManagerRef.current.currentTier;

        // Pass prior dialogue history to prevent amnesic execution
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content || "",
        }));

        // Run the universal harness loop wrapping the text function
        const harnessResult = await harnessRef.current.runLoop(
          content,
          async (msgs) => {
            const prompt = msgs.map((m) => `${m.role}: ${m.content}`).join("\n");
            return await escalationManagerRef.current!.predictText(prompt, msgs);
          },
          activeTier,
          conversationHistory
        );

        const decisionTrace = harnessResult.decision || escalationManagerRef.current.lastDecisionTrace || undefined;
        const managerSpecs = escalationManagerRef.current.lastUiSpecs;
        let generatedUiSpecs: UISpec[] | undefined = managerSpecs && managerSpecs.length > 0 ? UISpecEngine.bindOrDrop(managerSpecs) : undefined;

        if (decisionTrace) {
          const rawSpecs: UISpec[] = [];
          if (decisionTrace.needsClarification && decisionTrace.distribution && decisionTrace.distribution.length > 0) {
            rawSpecs.push({
              kind: "choices",
              id: `choices_${Date.now()}`,
              prompt: "Select the intended element or action:",
              options: decisionTrace.distribution.map((d, i) => ({
                id: `opt_${i}`,
                label: d.label,
                score: d.score,
                ref: d.actionPayload?.args?.selector ? { selector: d.actionPayload.args.selector as string } : undefined,
                actionPayload: d.actionPayload,
              })),
            });
          }
          if (rawSpecs.length > 0) {
            const bound = UISpecEngine.bindOrDrop(rawSpecs);
            if (bound.length > 0) {
              generatedUiSpecs = [...(generatedUiSpecs || []), ...bound];
            }
          }
        }

        const assistantMsg: DisplayMessage = {
          id: `asst_${Date.now()}`,
          role: "assistant",
          content: harnessResult.final,
          tierInfo: escalationManagerRef.current.currentTierInfo,
          stepTrace: harnessResult.trajectory,
          isMacro: harnessResult.isMacro,
          durationMs: harnessResult.totalDurationMs,
          decision: decisionTrace,
          ui: generatedUiSpecs,
        };

        const updatedMessages = [...messages, userMsg, assistantMsg];
        setMessages((prev) => [...prev, assistantMsg]);
        await refreshEvalsData();

        // Persist session to IndexedDB
        const siteOrigin = typeof window !== "undefined" ? window.location.origin : "web";
        const title = userMsg.content ? userMsg.content.slice(0, 35) : "Chat Session";
        await sessionStore.saveSession({
          id: currentSessionId,
          title,
          siteOrigin,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: updatedMessages,
        });
        await refreshSessions();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to execute request";
        console.error("[useChat] Error executing harness loop:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: `⚠️ I encountered an issue processing your request: ${msg}. Please try asking about specific sections, features, or actions on this page.`,
          },
        ]);
        setError(msg);
      } finally {
        setIsLoading(false);
        setActiveSteps([]);
      }
    },
    [currentSessionId, messages, refreshEvalsData, refreshSessions, runSavedWorkflow]
  );

  /**
   * User feedback handler (👍 / 👎 / "Escalate")
   * Directly feeds the Chrome AI Expert Judge Alignment Dataset!
   */
  const handleFeedback = useCallback(
    async (messageId: string, feedback: "up" | "down") => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback } : m))
      );

      // Record feedback in Expert Judge dataset
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

      // Find matching trace
      const traces = await expertJudge.getAllTraces();
      const matchingTrace = traces.find((t) => t.userGoal === lastUserMsg?.content);
      if (matchingTrace) {
        await expertJudge.recordHumanFeedback(matchingTrace.id, feedback);
      }

      // If user gives negative feedback, escalate to next model tier
      if (feedback === "down" && escalationManagerRef.current) {
        await escalationManagerRef.current.escalate("User gave negative feedback on this response");

        // Re-run the user's last query using the higher tier
        if (lastUserMsg?.content) {
          sendMessage(lastUserMsg.content);
        }
      }

      await refreshEvalsData();
    },
    [messages, sendMessage, refreshEvalsData]
  );

  /**
   * Explicit user-triggered escalation button
   */
  const triggerEscalation = useCallback(async () => {
    if (!escalationManagerRef.current) return;
    await escalationManagerRef.current.escalate("User explicitly requested escalation to a higher tier");
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg?.content) {
      sendMessage(lastUserMsg.content);
    }
    await refreshEvalsData();
  }, [messages, sendMessage, refreshEvalsData]);

  /**
   * Helper predictor using the current active model tier for evaluation
   */
  const predictForJudge = useCallback(
    async (prompt: string): Promise<string> => {
      if (!escalationManagerRef.current) {
        throw new Error("No engine available");
      }
      return await escalationManagerRef.current.predictText(prompt, [
        { role: "system", content: "You are an objective AI evaluation judge." },
        { role: "user", content: prompt },
      ]);
    },
    []
  );

  /**
   * Batch evaluate all unjudged traces using Chrome Built-in AI / LanguageModel
   * or the active local model with a generous 5-minute timeout.
   */
  const runBatchJudge = useCallback(async () => {
    setIsJudging(true);
    try {
      const traces = await expertJudge.getAllTraces();
      const unjudged = traces.filter((t) => !t.judgeEvaluation);
      if (unjudged.length === 0) return;

      for (const t of unjudged) {
        try {
          await expertJudge.judgeTrace(t, predictForJudge);
          // Refresh incrementally after each trace so user sees real-time progress
          await refreshEvalsData();
        } catch (traceErr) {
          console.warn(`Trace ${t.id} evaluation failed:`, traceErr);
        }
      }
    } catch (e) {
      console.error("Batch judge failed:", e);
    } finally {
      setIsJudging(false);
      await refreshEvalsData();
    }
  }, [predictForJudge, refreshEvalsData]);

  const judgeSingleTrace = useCallback(
    async (traceId: string) => {
      setIsJudging(true);
      try {
        const traces = await expertJudge.getAllTraces();
        const target = traces.find((t) => t.id === traceId);
        if (target) {
          await expertJudge.judgeTrace(target, predictForJudge);
        }
      } catch (e) {
        console.error("Single judge failed:", e);
      } finally {
        setIsJudging(false);
        await refreshEvalsData();
      }
    },
    [predictForJudge, refreshEvalsData]
  );

  const rateTrace = useCallback(async (traceId: string, feedback: "up" | "down") => {
    await expertJudge.recordHumanFeedback(traceId, feedback);
    await refreshEvalsData();
  }, [refreshEvalsData]);

  const setTier = useCallback(async (tier: ModelTier) => {
    if (!escalationManagerRef.current) return;
    await escalationManagerRef.current.setTier(tier);
    setCurrentTierInfo(escalationManagerRef.current.currentTierInfo);
  }, []);

  const stopGeneration = useCallback(() => {
    setIsLoading(false);
    setActiveSteps([]);
  }, []);

  const lastMsg = messages[messages.length - 1];
  const canEscalate = Boolean(
    error ||
    lastMsg?.feedback === "down" ||
    (lastMsg?.role === "assistant" && lastMsg?.decision?.confidence !== undefined && lastMsg.decision.confidence < 0.75)
  );

  return {
    messages,
    isLoading,
    stopGeneration,
    canEscalate,
    error,
    sendMessage,
    engineStatus,
    currentTierInfo,
    prefetchStatus,
    modelLoadingProgress,
    nanoSupported,
    nanoDiagnostic,
    activeSteps,
    evalMetrics,
    recentTraces,
    siteMacros,
    isJudging,
    pageAnalysis,
    reanalyzePage,
    setTier,
    handleFeedback,
    triggerEscalation,
    runBatchJudge,
    judgeSingleTrace,
    rateTrace,
    refreshEvalsData,
    currentSessionId,
    sessionsList,
    createNewSession,
    switchSession,
    deleteSession,
    executeDirectAction,
    runSavedWorkflow,
    evaluateEnsembleDecision,
    executeBatchProposal,
    cancelBatchProposal,
    abortBatchExecution,
    isRecordingMacro,
    startMacroRecording,
    stopMacroRecording,
    currentPlan,
    approvePlan,
    rejectPlan,
  };
}
