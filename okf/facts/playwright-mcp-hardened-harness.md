---
type: fact
valid_from: 2026-10-03
learned_at: 2026-10-03T03:22:00Z
layer: current
trust: human-reviewed
---

# Fact: Hardened Playwright MCP for Enterprise Browser Automation

1. **Default Automation Engine**: Microsoft Playwright MCP (`@playwright/mcp`, Apache-2.0). Runs locally or inside a VPC as a private process talking to local/network browsers.
2. **Data Privacy & Zero Data Retention (ZDR)**:
   - Page text and DOM trees never leave the local environment unless sent to configured models.
   - Must pair with private/enterprise zero-data-retention model endpoints (Azure OpenAI, Amazon Bedrock, or private model instance). Consumer APIs that retain training data defeat local browser privacy.
3. **Six Production Hardening Guardrails**:
   - `--isolated`: In-memory ephemeral browser profile dying with each session.
   - `--secrets`: Passwords, tokens, and credentials populated directly by the host and never leaked into model context.
   - `--allowed-origins`: Domain restriction guardrail limiting navigation to authorized target apps.
   - `--caps=testing`: Limits agent tools to assertion and verification primitives (`browser_verify_element_visible`, etc.) rather than unrestricted execution.
   - **No `browser_run_code`**: Prohibits arbitrary JavaScript execution inside the target page to eliminate prompt injection RCE.
   - **Proxy & Egress Allowlist**: Positions the browser behind an enterprise forward proxy enforcing network-level destination boundaries.
4. **Azure Playwright Workspaces MCP**: Public Preview serverless browser pool authenticated via Microsoft Entra ID (`https://mcp.playwright.microsoft.com/Playwright.Mcp.Tools`). Treated as an experimental pilot, with local/VPC Playwright MCP remaining the primary production path.
