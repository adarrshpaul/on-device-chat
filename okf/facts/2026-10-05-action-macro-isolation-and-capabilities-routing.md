---
fact_id: 2026-10-05-action-macro-isolation-and-capabilities-routing
entity: chat-widget
valid_from: 2026-10-05T12:20:00+05:30
valid_to: null
layer: current
status: active
---

# Fact: Action Macro Isolation and Capabilities Question Routing

## Summary
Deterministic site macros (`recipeStore`) are strictly restricted to physical imperative actions. Informational and capability inquiries (`"what actions can you perform on this page?"`) are never compiled or matched as macros, guaranteeing conversational synthesis answers questions directly.

## Invariant Guarantees
1. **Strict Action Goal Partitioning (`isActionGoal`)**:
   - Queries ending with `?` or starting with question words (`what`, `how`, `why`, `where`, `can you`, `tell me`) return `false`.
   - Only imperative commands containing physical interaction verbs (`click`, `open`, `navigate`, `scroll`, `toggle`, `type`, `tour`) are eligible for macro lookup or compilation.
2. **Exact Action Trigger Matching**:
   - `findMatchingMacro` checks exact normalized action triggers (`normalizedGoal === r.triggerPhrase.toLowerCase().trim()`).
   - Loose substring containment (`normalizedGoal.includes(r.triggerPhrase)`) is prohibited, eliminating false-positive macro hijacking.
3. **Physical Mutation Compilation Filter**:
   - Multi-step trajectories are only saved to `recipeStore` if they include genuine mutating browser primitives (`click`, `type`, `scroll`, `navigate`, `tour`). Read-only exploration and QA traces are never saved as macros.
4. **First-Class Actions & Capabilities Routing**:
   - Questions asking about available page actions or features return a structured inventory of live actions (Theme Control, Guided Tour, Section Navigation, DOM Control, Associative Engram Recall, Local Math Sandbox).
