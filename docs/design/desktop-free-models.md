# Free models on another Mac

Desktop 2.1.3 bundles only local-coder. Codestral and GPT-OSS exist in the development machine's private settings, so installing the DMG elsewhere omits them. Add their existing anonymous LLM7 routes to the desktop defaults. A v2 installation marker adds only missing free models to profiles already initialized by v1; preserve existing model definitions, current selection, deleted MCPs and user skill/agent files. Subsequent starts must preserve intentional deletions.

LLM7 entries use the supported envKey mechanism with a public `unused` placeholder in HOMECODE_LLM7_API_KEY. Do not copy the development machine's generated credential variable or any personal key. Preserve an existing value of the bundled variable.

Chat obtains its own catalog from Vane, independently of Harness. Its loopback backend points at the wrong computer on another Mac. Desktop Chat will use the existing HTTPS HomeCode gateway with LOCAL_QWEN_API_KEY. Add a restricted Vane proxy to the gateway source at home-ai-platform/mcp/homecode-gateway/server.mjs for catalog, chat streaming and history operations. Other CLI launches retain the loopback backend. Do not route Chat through Harness, workspace providers or local tools. Codex remains independent; a failed Vane request must not fall back to another engine or endpoint.

The process-global server resolves the current server credential from user-scoped settings on each remote request, falling back to the existing process environment. Workspace settings are excluded. The gateway removes this credential before forwarding to Vane; the desktop rejects redirects. Catalog and history filtering retain the existing HomeChat behavior.

Harness uses the installed provider catalog for workspace and standalone sessions, including its Qwen split panes. Existing Codex split panes retain their engine-specific catalog; changing that session lifecycle is outside this packaging fix.

Update the five desktop version sources to 2.1.4. Add regression cases for clean installation, v1 upgrade, wrapped providers, custom entries and repeat startup, plus authenticated remote Chat requests and gateway route restrictions. By explicit user instruction, do not build, run tests, start applications, restart services or deploy. Verification in this change is source review only; both the desktop and gateway sources need a later build and rollout.
