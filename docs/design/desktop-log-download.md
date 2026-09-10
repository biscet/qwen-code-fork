# Desktop log download

[English](desktop-log-download.md) | [简体中文](desktop-log-download.zh-CN.md)

## Problem and current state

Diagnosing a failed turn on another Mac requires the installed application's
logs. The desktop recovery page can open `desktop-runtime.log`, but the regular
Web Shell has no download action. The desktop currently clears this log at every
application launch, losing the failure evidence after a restart. The file captures
daemon stdout and stderr, including daemon errors and forwarded ACP diagnostics.

## Proposed changes

Add a compact outline **Download logs** button with a download icon to the daemon
status toolbar. Use existing Web Shell button styles and English, Chinese, and
Russian labels. Keep the action available when status data cannot load or render.
Show saving, success, and failure states; cancelling the native dialog is silent.
The action appears only in the desktop shell.

A native `download_logs` command opens the operating system Save dialog and writes
a UTF-8 text file. The caller supplies neither source nor destination paths.
Only the main window at the bootstrap origin or currently active daemon origin
can invoke it. This is a process-global desktop operation; it does not resolve or
change a workspace runtime or add a daemon HTTP route.

Before clearing the current log at launch, retain its latest 8 MiB as
`desktop-runtime.previous.log`. Preserve an existing previous log when the current
one is empty. An unsuccessful preservation must not erase the current log. Export
the latest 8 MiB of each file with section labels, explicit truncation notices,
desktop version, OS/architecture, and export time. Read bounded tails, not whole
files. Normal capture during a running application stays unchanged.

Mask recognizable authorization headers, bearer tokens, credential fields,
common API key prefixes, and URL credentials in the exported copy. ACP diagnostics
already redact credentials upstream; this extra pass covers raw stderr. This is
not a guarantee that arbitrary user-generated log content contains no secrets.
Local original logs remain unchanged and workspace paths remain useful for diagnosis.

## Files and scope

Desktop native command/log helpers and their tests, daemon status UI and tests,
the small native bridge helper, translations, desktop README, and the packaged
smoke test's stale log-retention comment change. No dependency on conversation
databases, no conversation/config export, no automatic upload, and no model or
provider behavior changes. `regex` is already present in the Rust dependency graph
and becomes a direct dependency for the exported-copy redaction.

## Validation and acceptance

The test-engineer records the global CLI baseline and desktop baseline separately
in `.qwen/e2e-tests/homecode-2.1.12/`. The CLI has no native Save dialog equivalent.
Focused Rust tests cover retention, bounded UTF-8 tails, missing logs, redaction,
and origin rejection. Focused DOM tests cover desktop-only visibility, native
command invocation without file arguments, pending/success/cancel/error states,
and status-unavailable rendering. Build/typecheck and packaged application checks
verify integration. A native Save dialog check must be reported separately from
mocked browser or DOM checks.

## Open questions

None. Full conversation export and broader log retention are outside this change.
