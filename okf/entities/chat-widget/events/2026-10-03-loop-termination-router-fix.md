---
type: event
timestamp: 2026-10-03T04:08:00Z
entity: chat-widget
---

# Event: Re-engineered Universal Agent Loop Strategy and Eliminated Feedback Loops

- **Systemic Root Cause Identified from Live User Screen**:
  - The agent loop previously fed tool observations back to `predictText` labeled as `role: "user"`.
  - When Tier 1 (MiniLM Router) was active, `predictText` treated the latest message (`Observation: Search found 0 occurrences...`) as a *new user command*.
  - MiniLM vector-matched the word "Search" to the `search` tool repeatedly, setting up an infinite recursive loop that polluted the host application search bar with nested `"found 0 occurrences of 'found 0 occurrences of ...'"` until hitting the 10-step limit.
- **Architectural Solution (Universal Strategy over Point Fixes)**:
  1. **Strict Message Role & Goal Decoupling**:
     - The root user instruction (`userGoal`) is immutable throughout the loop.
     - Observations are strictly formatted with tool identifiers and explicit completion instructions:
       `Tool Result (${decision.tool}): ... If the goal has been fulfilled, respond with {"final": "..."}.`
  2. **Tier-Appropriate Termination Strategy**:
     - **Intent Router (MiniLM)**: Operates as a single-step classifier. Once the selected tool produces an observation, the router immediately concludes with `{ final: observation }`. It never re-embeds observations as user prompts.
     - **Generative Models (Nano, SmolLM2, Gemma)**: Explicitly prompted with task completion criteria, enabling proper `final` state synthesis.
  3. **Decoupled Primitives (Zero Unwanted Side Effects)**:
     - `search` is strictly a read-only query primitive that inspects page text and returns matches without mutating inputs.
     - Form input mutations remain exclusively under `browse: { action: "type", ... }`.
- **Verification**:
  - Clean TypeScript compilation and Vite build (`npm run build` exited 0).
  - Dev server confirmed live on `http://localhost:5173/`.
