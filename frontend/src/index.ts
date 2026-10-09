export { default as ChatWidget } from './components/ChatWidget';
export type { ChatWidgetProps } from './components/ChatWidget';
export { default as Gemma4Agent } from './main';
export type { Gemma4Config } from './main';
export { expertJudge } from './lib/expertJudge';
export { AgentHarness } from './lib/agentHarness';
export { PlannerAgent, MetaAgent } from './lib/plannerAgent';
export type { AgentPlan, PlanTask, TaskType, TaskStatus, MetaExecutionResult, PlannerConfig } from './lib/plannerAgent';
export { VisionService } from './lib/visionService';
export type { VisionAnalysisResult, VisionOptions } from './lib/visionService';
export { LoopEngineer } from './lib/loopEngineer';
export type { LoopGoalSpec, LoopExecutionState } from './lib/loopEngineer';
export { A11yTreeEngine } from './lib/a11yTree';
export type { IA11yNode, A11yScanOptions } from './lib/a11yTree';
export { SomOverlayManager } from './lib/somOverlay';
export { ActionDispatcher } from './lib/actionDispatcher';
export { StateDeltaVerifier } from './lib/stateDeltaVerifier';
export type { IStateSnapshot, IStateDelta } from './lib/stateDeltaVerifier';
export * from './lib/types';


