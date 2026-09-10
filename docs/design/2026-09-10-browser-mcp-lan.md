# Browser MCP over the home LAN

[English](2026-09-10-browser-mcp-lan.md) | [简体中文](2026-09-10-browser-mcp-lan.zh-CN.md)

## Problem and scope

HomeCode currently includes three MCP connections. Add Playwright and Chrome
DevTools in `--slim` mode so another Mac on the home Wi-Fi can use browsers on
this Mac server. Include short tool-selection instructions and ship HomeCode
2.1.10 as an Apple Silicon DMG. Preserve unrelated work and existing MCPs.

## Server design

The existing authenticated HTTPS gateway exposes `/playwright/mcp` and
`/chrome-devtools/mcp`. Each MCP session owns an isolated, headless browser MCP
child connected over stdio. The gateway forwards tool discovery and calls over
Streamable HTTP using the existing bearer credential and Caddy certificate.
There are no additional externally exposed browser or debugging ports.

Session IDs are scoped to their route. DELETE, idle expiry and gateway shutdown
close the corresponding child and browser. The existing 30-minute idle limit
and 32-session cap apply. Bundle the pinned browser MCP dependencies in the
server deployment so runtime execution does not depend on the source volume.
The gateway package advances to 1.1.0.

Chrome slim returns a server-local screenshot path. The gateway additionally
returns that PNG as MCP image content, accepting only the canonical screenshot
path inside the corresponding session's temporary directory. Temporary paths
stay short enough for Chrome's macOS Unix sockets.

## Client and instructions

Desktop defaults add both HTTPS declarations with `LOCAL_QWEN_API_KEY`. A v4
installation marker adds only missing new entries to existing v1/v2/v3 profiles,
preserves custom definitions, and prevents restoring subsequent deletions.
Fresh installations receive all five MCPs and the existing public LAN CA.

The Qwen desktop system prompt and Codex Harness instructions briefly select
Playwright for UI interaction and E2E flows, and Chrome DevTools slim for quick
navigation, page JavaScript and screenshots. Guidance applies to available
tools and states that browsers, file paths and localhost are on the server.
Client-hosted development sites need a reachable LAN URL. HomeChat remains
isolated from computer tools. No project or browser-profile synchronization is
introduced.

## Affected files

Server changes live in `home-ai-platform/mcp/homecode-gateway`. Client changes
cover desktop defaults and their tests, the existing Qwen and Codex prompt
sites and tests, desktop documentation, runtime smoke inventory and all
HomeCode version metadata. Underlying Qwen and third-party version identities
retain their own release numbering.

## Validation and acceptance

Before implementation, run the global CLI inventory and verify the new routes
are absent. Test fresh install, upgrades, custom definitions, deletion and
repeat startup. Verify prompt coverage in both Harness engines and keep
HomeChat isolated. Run gateway lifecycle/authentication tests, including
cross-route session rejection and independent browser sessions.

After deployment, use the actual HTTPS hostname with CA validation and the
existing credential to discover tools and operate a local fixture through both
browsers. Verify Chrome DevTools exposes the slim tool set. Run build,
typecheck, bundle and focused tests, review the task diff, then build the DMG.
Verify its full app signature, disk image integrity, packaged startup, clean
profile inventory and absence of credentials. A server-side LAN route test is
not evidence of execution on the physical second Mac.

## Open questions

None. The DMG uses the existing ad-hoc signing flow; Apple notarization is
outside this local distribution task.
