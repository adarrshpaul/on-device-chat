/**
 * useChat hook — Orchestrates:
 * 1. Progressive Model Escalation (Nano 0MB -> MiniLM 15MB -> SmolLM2 80MB -> Gemma4 600MB).
 * 2. Universal Agent Harness (5 Primitives: browse, sandbox, read/write, search, ask).
 * 3. Chrome AI Expert Judge Evaluation Loop (traces, rubric judging, accuracy, precision, recall, F1, Cohen's Kappa).
 * 4. Self-improving site recipes & golden exemplars.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { EscalationManager, TierInfo, TIER_METADATA, ModelTier } from "../lib/escalationManager";
import { backgroundDownloader, PreloadProgress } from "../lib/backgroundDownloader";
import { AgentHarness } from "../lib/agentHarness";
import { expertJudge, EvalMetrics, EvalTrace, AgentStepTrace } from "../lib/expertJudge";
import { recipeStore, SiteMacroRecipe } from "../lib/recipeStore";
import { pageActionInferer, PageAnalysisResult } from "../lib/pageActionInferer";
import { sessionStore, ChatSession } from "../lib/sessionStore";
import type { DecisionTrace } from "../lib/types";
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
}

export type EngineStatus = "idle" | "loading" | "ready" | "generating" | "error";

export function useChat(config: Gemma4Config) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${Date.now()}`);
  const [sessionsList, setSessionsList] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("loading");
  const [currentTierInfo, setCurrentTierInfo] = useState<TierInfo>(TIER_METADATA[ModelTier.TIER_0_GEMINI_NANO]);
  const [prefetchStatus, setPrefetchStatus] = useState<PreloadProgress | null>(null);
  const [nanoSupported, setNanoSupported] = useState<boolean>(false);
  const [nanoDiagnostic, setNanoDiagnostic] = useState<string>("");

  // Agent Harness & Evals Telemetry state
  const [activeSteps, setActiveSteps] = useState<AgentStepTrace[]>([]);
  const [evalMetrics, setEvalMetrics] = useState<EvalMetrics | null>(null);
  const [recentTraces, setRecentTraces] = useState<EvalTrace[]>([]);
  const [siteMacros, setSiteMacros] = useState<SiteMacroRecipe[]>([]);
  const [isJudging, setIsJudging] = useState(false);
  const [pageAnalysis, setPageAnalysis] = useState<PageAnalysisResult | null>(null);

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
    const manager = new EscalationManager({
      tools: config.tools || [],
      systemPrompt: config.systemPrompt,
      onTierChange: (tier) => setCurrentTierInfo(tier),
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
    setEngineStatus("loading");

    manager
      .init()
      .then(() => {
        setEngineStatus("ready");
        setCurrentTierInfo(manager.currentTierInfo);
        setNanoSupported(manager.nanoSupported);
        setNanoDiagnostic(manager.nanoDiagnostic);
      })
      .catch((err) => {
        console.error("EscalationManager init error:", err);
        setError(err instanceof Error ? err.message : "Engine initialization error");
        setEngineStatus("error");
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

    return () => {
      unsubscribePrefetch();
      manager.destroy();
    };
  }, [config.tools, config.systemPrompt, config.onToolCall, refreshEvalsData]);

  /**
   * Execute task through Agent Harness Loop
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;
      if (!escalationManagerRef.current || !harnessRef.current || engineStatus !== "ready") {
        setError("AI Engine is still loading. Please wait a moment.");
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

        // Run the universal harness loop wrapping the text function
        const harnessResult = await harnessRef.current.runLoop(
          content,
          async (msgs) => {
            const prompt = msgs.map((m) => `${m.role}: ${m.content}`).join("\n");
            return await escalationManagerRef.current!.predictText(prompt, msgs);
          },
          activeTier
        );

        const assistantMsg: DisplayMessage = {
          id: `asst_${Date.now()}`,
          role: "assistant",
          content: harnessResult.final,
          tierInfo: escalationManagerRef.current.currentTierInfo,
          stepTrace: harnessResult.trajectory,
          isMacro: harnessResult.isMacro,
          durationMs: harnessResult.totalDurationMs,
          decision: harnessResult.decision || escalationManagerRef.current.lastDecisionTrace || undefined,
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
        const msg = err instanceof Error ? err.message : "Failed to execute harness loop";
        setError(msg);
      } finally {
        setIsLoading(false);
        setActiveSteps([]);
      }
    },
    [currentSessionId, engineStatus, messages, refreshEvalsData, refreshSessions]
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
  };
}
