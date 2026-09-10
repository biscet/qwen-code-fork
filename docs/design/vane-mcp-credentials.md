# Vane credentials for desktop research MCP

[English](vane-mcp-credentials.md) | [简体中文](vane-mcp-credentials.zh-CN.md)

## Problem

Vane saves its API key in the private user HomeChat store. The bundled
`home-ai-research` MCP server instead resolves `${LOCAL_QWEN_API_KEY}` from
the Harness environment. Saving a working Vane key therefore leaves research
MCP disconnected. Plugins report authentication required, and project hover
summaries correctly count only four connected servers out of five.

## Design

Keep the private HomeChat store as the source of the explicit Vane key. In
desktop mode, apply that key to the effective merged `home-ai-research`
configuration only when its endpoint is exactly
`https://biscet-server.local:9454/research/mcp` and its original authorization
header is `Bearer ${LOCAL_QWEN_API_KEY}`. Preserve scope precedence and use the
original winning definition to recognize the managed template.

Apply the override only to the merged settings view. Preserve original settings
and serialized configuration, and do not alter `LOCAL_QWEN_API_KEY`, model
credentials, Codex credentials, or other MCP definitions. With no saved Vane key,
retain the existing environment fallback. Custom endpoints and explicitly
configured authorization headers keep their own behavior. Reopening the desktop
reads the same private key without a migration.

After the process-global `PUT /homechat/connection` route persists a valid key,
notify managed trusted runtimes with open generations through their MCP
coordinators. Reconciliation uses each runtime's existing bridge and reload
queue. Dormant runtimes remain dormant and read current settings on startup;
unknown, untrusted, removed, or closed generations are not redirected to the
primary runtime.

An authorization header changes the MCP configuration approval hash. Before
scheduling reconciliation, sequentially refresh the exact installed desktop
defaults for eligible runtimes in the daemon. The existing initializer updates
the daemon's approval cache and persisted records, recognizes only unchanged
installer-owned definitions, and preserves explicit rejections. This also keeps
the daemon's Codex tool inventory current. During ACP MCP reload, read
the updated approvals from disk before recomputing admission. Children only
refresh their own caches; they do not write competing approval snapshots. Reuse
the existing approval checks without weakening them.

## Status and consumers

Keep status derived from actual MCP discovery. A successful authenticated
connection already clears the previous authentication requirement; plugin
status and project hover counts consume that result. Saving a key alone must
not claim that a server is connected. The merged configuration also supplies
new Qwen sessions and the Codex tool inventory, which refreshes for each prompt.

## Validation and acceptance

- Reproduce the disconnected configuration with a synthetic saved Vane key and
  a different or missing Harness key before applying the fix.
- Verify the managed research header uses the saved key after save and reopen,
  while settings files retain their template and other credentials stay intact.
- Verify custom endpoints, custom headers, non-desktop operation, and missing
  saved credentials retain existing behavior.
- Verify key save schedules reconciliation only after successful persistence
  and only for eligible runtimes. Refresh approval hashes without approving
  rejected or modified definitions, including in a live ACP process.
- Verify runtime discovery remains the authority for authentication and counts;
  record source tests separately from native, browser, or remote-service proof.

This change does not rebuild, package, restart, or deploy the desktop application:
the user requested source changes, focused checks, commit, and push only. Do not
use real credentials in fixtures or test output. No open design questions remain.
