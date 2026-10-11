# UI/UX & Design Review: Model Selector Button Hidden / Squished in ChatHeader

## 1. Context & User Bug Report
The user uploaded a screenshot of the EdgeOperator on-device chat widget header (`media_1791751401244_687e0aad.png`).
In the screenshot, the header row contains:
`• EdgeOperator ⚡ [ v ] ⚡ Workflows ••• ⇆ 👁 — ✕`

The model tier selector dropdown button is located between `EdgeOperator ⚡` and `⚡ Workflows`.
However, it is rendered as an unrecognizable, squished dark circle/pill `[ v ]` where:
- The model label is truncated to 0px (completely invisible).
- There is no recognizable model icon.
- A user cannot tell what model is currently active (e.g., Gemini Nano vs SmolLM2 vs Gemma 4 vs Instant Vega).
- The dropdown trigger has virtually 0 contrast or affordance.

## 2. Root Cause Analysis
In `frontend/src/components/ChatHeader.tsx`:
- The container width is ~380px (the docked or floating widget width).
- The right side has 6 buttons: `Workflows`, `...` (Overflow), `⇆` (Dock), `👁` (Ghost), `—` (Minimize), `✕` (Close) - taking ~220px.
- The left side has: Green beacon (8px), `EdgeOperator ⚡` label (~110px), and then:
```tsx
<button
  onClick={onToggleTierMenu}
  className="text-[11.5px] text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded-[6px] hover:bg-white/5 transition-colors min-w-0 truncate max-w-[110px]"
>
  <span className="truncate">{currentTierInfo.name}</span>
  <ChevronDown size={11} className="text-gray-400 shrink-0" />
</button>
```
- Furthermore, `currentTierInfo.name` is very long: `"⚡ Instant Actions & Workflows"`, `"💬 On-Device Page Q&A"`, `"🧠 Local Reasoning & Drafting"`, etc.
- In flexbox with `min-w-0`, the button gets squeezed to under 20px, completely truncating the text and leaving only a crushed chevron icon.

## 3. Available Models & Tiers
1. `ModelTier.TIER_0_GEMINI_NANO`: Built-in Chrome AI / Gemini Nano (0 MB, Chrome Native)
2. `ModelTier.TIER_1_5_LAYA_DECISION`: Vega / Laya Instant Actions (<5ms Reflex)
3. `ModelTier.TIER_1_MINILM_ROUTER`: Semantic Vector Indexing (~15 MB ONNX)
4. `ModelTier.TIER_2_SMOLLM_GENERATIVE`: SmolLM2 Local Reasoning (~80 MB Q4 ONNX WebGPU)
5. `ModelTier.TIER_3_GEMMA4_E2B`: Gemma 4 E2B Autonomous Agent (~600-800 MB WebGPU)

## 4. What We Need from You (Claude)
Please provide:
1. **Design Solution & Header Layout Optimization**:
   - How to de-clutter the header row so the model selector has guaranteed visual real estate. (Which secondary controls belong in the `•••` overflow menu vs top-level?)
   - How to format the model selector pill so it is immediately legible, distinct, and clickable.
2. **Icon & Badge System**:
   - Recommend specific Lucide icons (e.g. `Sparkles`, `Cpu`, `Zap`, `Brain`, `Bot`, etc.) and short compact display labels (e.g., `Nano`, `Reflex`, `SmolLM`, `Gemma 4`) for each tier so it never overflows.
   - Recommended color accents and active state styling.
3. **Concrete Code Recommendations**:
   - Provide the clean, modern JSX / Tailwind implementation for the model selector pill button and the de-cluttered header in `ChatHeader.tsx`.
