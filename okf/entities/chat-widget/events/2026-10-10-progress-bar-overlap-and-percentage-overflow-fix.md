# Event: Heavy Model Download Progress Bar Overlap & Percentage Overflow Fix

- **Date:** 2026-10-10
- **Entity:** `chat-widget`
- **Type:** bug_fix
- **Trigger:** User reported UI issue with progress bar showing >1000% (1430%, 2000%) and duplicate overlapping progress bars.

## Context & Root Causes
1. **Percentage Multiplier Discrepancy:** `layaEngine.ts` passed `onProgress` values as whole integer percentages (`5`, `20`, `60`, `95`, `100`), but `escalationManager.ts` treated them as `0.0..1.0` ratios and calculated `Math.round(prog * 100)%` and `Math.round(30 + prog * 70)`. When `prog = 20`, this produced `2000%` in the text label and `1430%` in the overall progress!
2. **Duplicate Overlapping Progress Elements:** Both `ChatHeader.tsx` (using an `absolute -bottom-[22px]` floating overlay) and `ChatWidget.tsx` (using an in-flow banner) were simultaneously rendering progress bars for the same active loading state. The floating overlay collided and directly intersected the top of the chat widget banner.

## Implementation Details
1. **Progress Ratio Normalization (`escalationManager.ts`):**
   - Normalized `progRatio = prog > 1 ? prog / 100 : prog` across all engine tiers (Embedder, Laya Q8, SmolLM2, and Gemma 4).
   - Clamped all stage percentages and overall percentages strictly between `0` and `100` (`Math.min(100, Math.max(0, ...))`).
2. **Eliminated Duplicate Overlay (`ChatHeader.tsx`):**
   - Removed the redundant, fragile `absolute -bottom-[22px]` floating progress bar from `ChatHeader.tsx`.
3. **Clean In-Flow Progress Banner (`ChatWidget.tsx`):**
   - Placed a single, high-contrast model download banner directly beneath `ChatHeader` in normal document flow (`shrink-0`).
   - Guarantees zero pixel collision, clear model name and size breakdown, smooth gradient bar, and clamped 0–100% metrics.
