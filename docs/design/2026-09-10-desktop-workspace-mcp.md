# Desktop workspace MCP defaults

[English](2026-09-10-desktop-workspace-mcp.md) | [简体中文](2026-09-10-desktop-workspace-mcp.zh-CN.md)

## Problem and current state

HomeCode installs five remote MCP declarations and development skills/agents
into the user profile. Remote Serena cannot see a project on the client Mac;
remote browsers interpret localhost on the server. No project defaults are
created when a trusted workspace is opened. The test-engineer tool allowlist
also excludes MCP tools.

## Proposed behavior

Before loading a trusted desktop workspace runtime, initialize missing project
MCP settings, skills and agents. Cover primary, restored, dynamically added and
trust-rebuilt workspaces. Untrusted workspaces and HomeChat do not initialize
these capabilities. Custom definitions, existing files, disabled tools and
intentional deletions remain authoritative. A user-local workspace installation receipt makes
initialization idempotent. Only exact installer-owned MCP definitions receive
automatic config approval; arbitrary existing project definitions remain gated.

Bundle local Node REPL, Serena, Playwright and Chrome DevTools runtimes, their
interpreters and one Chromium into the application. Resolve executables from
the installed application rather than the build machine. Each MCP process
starts in the selected workspace. Serena initializes that project's metadata
when needed, preserving existing configuration. Browser sessions and REPL state
remain independent across connections. Writable caches live outside the app.
An empty project can discover its first TypeScript and Python files without
restarting Serena. Installed skill files do not determine project languages.
Home AI Research remains an authenticated HTTPS service using the existing
LOCAL_QWEN_API_KEY and bundled public LAN certificate.

## Agent instructions

Qwen and Codex Harness should use available workspace MCPs for semantic code
work, JavaScript and browser verification. Qwen delegates bounded independent
development work when useful. Codex native delegation remains disabled because
child tool and approval requests do not yet have workspace-owner routing. Use the actual connected tool inventory; explain
missing dependencies or failed connections without inventing successful checks.
The test-engineer receives relevant MCP capabilities while keeping its existing
observe-and-report source editing restriction. HomeChat remains isolated.

## Scope and affected components

Desktop defaults, runtime packaging and tests; daemon workspace initialization;
Qwen/Codex Harness instructions and focused tests; bundled development agent;
desktop release versions and documentation. No model route changes, remote
service deployment, user credential export, Git commit or push.

## Validation and acceptance

Use clean profiles and two distinct temporary workspaces to verify automatic
creation, inheritance, repeat launch, custom configuration preservation,
untrusted rejection and actual MCP tool calls. Prove local file/symbol access,
independent REPL state and browser access to a client localhost site. Verify
agent availability and tool filtering. Run focused tests, build, typecheck,
bundle and review the task diff twice. Produce an Apple Silicon DMG, verify its
full ad-hoc signature, image integrity and mounted application/runtime smoke.
Preserve Chromium framework directory symlinks during application packaging;
every runtime checksum must still resolve and match inside the mounted image.
Ad-hoc signing is not Developer ID signing or notarization. Physical second-Mac
installation remains separate evidence from relocated clean-profile checks.

## Constraints and open questions

The release targets Apple Silicon and macOS 15 or newer, matching the bundled
Codex shell's deployment target; Chromium itself requires macOS 13. TypeScript/JavaScript
and Python language servers are bundled; other platform builds retain remote MCP defaults. Semantic language servers may require their
language toolchains or first-use downloads; validate TypeScript as the concrete
acceptance language and document this boundary. No unresolved product choice.
