---
id: event_github_repository_publish_v020
entity: chat-widget
timestamp: 2026-10-11T18:06:00Z
author: agent
type: release_event
---

# Event: GitHub Repository Push & Synchronization (v0.2.0)

## Context & Execution
- **Repository URL:** `https://github.com/adarrshpaul/on-device-chat.git`
- **Branch:** `main`
- **Commit:** `7ccd01c` (`feat(release): v0.2.0 on-device browser agent, chrome extension mv3, universal css isolation, and dynamic dom automations`)
- **Published Artifacts & Codebases:**
  1. `frontend/`: Core npm library `on-device-chat@0.2.0` with updated exports, test suites, and strict CSS isolation layer.
  2. `extension/`: Chrome MV3 Developer Extension with background service worker, action popup, Alt+Shift+A hotkey, context menus, and SHA-256 bit-parity sync with the npm bundle.
  3. `README.md`: Modernized documentation with v0.2.0 features, MV3 extension guide, and benchmark passing badges.
  4. `okf/`: Bi-temporal knowledge framework events, facts, and transition log capturing the entire evolutionary timeline.
- **Verification:** `git status` clean, all 9 test suites passing (58 extension tests, 20 SOTA web agent benchmarks, cross-application consistency).
