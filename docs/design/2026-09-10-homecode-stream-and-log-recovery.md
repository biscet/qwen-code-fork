# HomeCode stream validation and log export

[English](2026-09-10-homecode-stream-and-log-recovery.md) | [简体中文](2026-09-10-homecode-stream-and-log-recovery.zh-CN.md)

## Problem and scope

HomeCode can display a failed empty command after an incomplete model response.
The OpenAI stream converter repairs incomplete tool arguments or replaces invalid
arguments with an empty object. Desktop ACP executes tools directly, bypassing the
core scheduler's truncation guard. Separately, Tauri rejects the log export command
from the daemon WebView because its remote capability does not grant that command.

## Decisions

Validate streamed tool identities and JSON before publishing executable calls.
Reject the whole response attempt if any call is malformed or a tool-bearing
response reaches the output limit. Preserve legitimate no-argument tools on completed responses.
Use the existing bounded stream retry mechanism; distinguish output truncation so
existing output-limit escalation remains available. Respect explicit output caps.
Do not change model routing, reasoning effort, or workspace ownership.

Carry the existing ACP `preparationDiscarded` marker through the UI event adapter.
Remove a discarded pending preparation instead of rendering a failed empty tool.
A stale discard must preserve a tool that has already started or completed, and a
replayed discard without an earlier preparation must not create a new block.

Grant the log export command to the runtime WebView through a narrow application
permission. Keep existing bootstrap commands available only to bootstrap, and
retain the native check against the currently running daemon's exact origin.
Export still uses the native Save dialog and existing credential redaction.

For configured provider aliases without a known model manifest, expose the same
generic reasoning choices on the welcome composer as in a live ACP session. A
minimal configuration for `windows-lmstudio/windows-qwen35-9b` must work without
machine-specific `chat_template_kwargs`. Use the selected connection's resolved
configuration and preserve explicit capability restrictions, runtime exclusions,
and unknown Qwen models that do not support the existing reasoning selector.
Do not infer the actual model family from the display label or legacy alias.

## Validation and acceptance

Regression tests must fail before the fix for malformed JSON, non-object values,
truncated arguments, and token-limit termination after a tool opener. Valid tools,
including empty and whitespace-only no-argument calls, remain functional. Verify
bounded retries and output escalation without raising explicit user limits. An
isolated fake-provider run must retry a broken response, execute one complete
harmless command, and return a non-empty final response.

Verify discarded preparation cleanup for live and replayed events while retaining
real failures and already-started calls.

Test the exact Windows alias with minimal persisted settings and an `xhigh`
selection, as well as existing explicit capabilities and excluded models.

Compile the actual Tauri capabilities and verify remote export access, local
bootstrap access, and rejection of unrelated remote commands. Build, typecheck,
focused tests, native export verification and review precede packaging. The other
Mac's exact failing response cannot be inferred from a screenshot alone.
