---
id: intention_openui_generative_answers_20261022
entity: on_device_chat
property: generative_ui_answers
layer: intention
status: proposed (user goal 2026-10-22; nothing built)
valid_from: 2026-10-22T12:00:00Z
valid_to: null
author: claude-code
trust: verified-metadata (GitHub API + README, 2026-10-22)
sources:
  - https://github.com/thesysdev/open-intelligent-ui (MIT, ~757 stars, pushed 2026-10-17)
  - https://github.com/thesysdev/openui (MIT, ~12.9k stars)
---

# Goal: use OpenUI / Open Intelligent UI to make on-device-chat answers interactive UI instead of text

## What it is
The model streams "OpenUI Lang 1.0" (a small DSL). A renderer turns it into live components (Card, Table, Chart, Form,
Button, Slider…) with `$variables` state and 59 `@functions`. Packages: `@openuidev/lang-core` (parser/evaluator),
`@openuidev/react-lang`, `@openuidev/react-ui`. The demo app is Next 16 / React 19.

## Fit check against on-device-chat (Apache-2.0, React 18, WebLLM / transformers.js / Gemini Nano tiers)
| Item | Finding | Consequence |
|---|---|---|
| Licence | MIT → Apache-2.0 project | OK; keep MIT notices in THIRD_PARTY_NOTICES |
| Model size | The full prompt is ~8k tokens; the default local model is qwen3.8:27b (~18 GB); "locally, output is rendered as written, larger models give better results" | Our tiers (Nano, small WebLLM) will often emit invalid DSL with the full library. **Biggest risk.** |
| Output correction | Cloud Gateway validates and corrects; the local path does not | We must add our own validation |
| Data egress | `SearchImage`, `/api/wiki`, `/api/image-search`, OSRM routes, MapLibre tiles call servers | Breaks the "zero prompt data egress" claim: exclude these components |
| React version | OpenUI demo = React 19; on-device-chat frontend = React 18 | Spike first: use `lang-core` alone, or upgrade React |
| Secrets | The demo uses `.env` + THESYS_API_KEY | Not needed for the local path; if testing cloud, inject from Keychain (global mandate §4) |

## Recommended approach (advisor)
1. **Small library:** ~10 components (Card, List, Table, Button, Badge, Form, Input, Select, Chart, Text) → generated prompt ≤2k tokens.
2. **Constrained decoding:** WebLLM's grammar / JSON-schema mode, so only valid OpenUI Lang can be emitted. This replaces Gateway correction.
3. **Validate → honest fallback:** parse with `lang-core`; if it fails, show plain markdown labelled "text answer". No fake UI (Rule 7).
4. **Best first use = the approval gate:** render the "Teach 1 → Batch N" plan and workflow steps as interactive approval cards.
   Every Button target must come from live-DOM-verified selectors (Rule 9): the model arranges the UI, it never invents selectors.
5. **Measure before claiming:** a fixed set of 30 prompts × each model tier → valid-parse rate, time to first component, and a human usefulness score.
   Report the real numbers; ship only for tiers that pass.

## Open decisions
- [x] Spike approved by user 2026-10-22, queued as TASK-107
- [ ] Choose the minimum model tier allowed to emit UI (expect: WebLLM ≥3–4B; Gemini Nano is text-only fallback)
