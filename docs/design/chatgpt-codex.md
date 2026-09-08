# ChatGPT account and Codex engine in HomeCode

## Problem and baseline

HomeCode currently runs Harness through Qwen ACP and HomeChat through Vane.
There is no Codex account, model catalog, engine owner, or Codex session store.
The globally installed Qwen 0.22.2 returns authenticated 404 for `/codex/*`;
the existing authentication rejects unauthenticated requests with 401.

Codex 0.153.4 was verified on 2026-09-07 against the installed CLI, npm latest,
and https://learn.chatgpt.com/docs/changelog. The integration uses the official
stdio App Server (https://learn.chatgpt.com/docs/app-server), with protocol
shapes checked against that version's generated experimental TypeScript schema.

## Design

| Layer            | Change and ownership                                                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distribution     | Exact npm Codex dependency; package its native runtime and supporting files with desktop, independently of ChatGPT.app and PATH.                                                                                                                                                                        |
| Account          | One daemon-owned service, private HomeCode CODEX_HOME and neutral working directory. Codex owns file-backed credentials and refresh. Only account metadata, login URL, catalog and usage leave the service.                                                                                             |
| Transport        | JSON-RPC over stdio, initialize handshake, ordered notifications, request correlation, explicit disconnect failures. Never retry accepted or uncertain model turns.                                                                                                                                     |
| Daemon API / SDK | Authenticated process-global `/codex/*` account/login/logout/models/limits routes and typed SDK methods. No primary-workspace dependency.                                                                                                                                                               |
| Harness          | Separate Codex session manager and durable HomeCode-ID to thread-ID mapping with workspace owner, model and history projection. Explicit engine discriminator defaults legacy records to Qwen. Existing session routes intercept only records owned by Codex; unknown ownership never falls back.       |
| Tools            | Workspace-resolved scheduler Config initialized in toolsOnly mode without Qwen LLM or session recording. Only active MCP and report_findings, record_artifact, display_image become dynamicTools. Built-in Codex file/terminal operations remain Codex-owned. Qwen orchestration tools remain excluded. |
| HomeChat         | Separate durable Codex conversation store exposed through the existing HomeChat API and UI. Same account, explicitly separate thread profile. Vane sources remain available.                                                                                                                            |
| UI               | Existing HomeCode card/button/tokens for account, dynamic model/reasoning catalog and nullable usage. Background refresh retains current content; login does not change selected models.                                                                                                                |

## Isolation and lifecycle decisions

Use a new HomeCode-owned CODEX_HOME; do not copy credentials, configs, plugins,
skills or history from another client. Strip inherited Codex/OpenAI credential
and configuration environment variables from the child. Use file credential
storage so account logout cannot affect another client's keychain credential.

HomeChat explicitly sends empty environments, runtime workspace roots, selected
capability roots and dynamic tools. It uses a neutral service cwd, its own
base/developer instructions, disabled environment context and project docs,
disabled shell/image/local execution, Apps/plugins/hooks/skills/memory, and
public hosted web search. Reject all unexpected server-side tool/approval
requests. Inspect an actual outgoing model request before accepting isolation.

Persist both accepted user input and projected response lifecycle atomically.
On process loss, retain history and indicate an interrupted/uncertain turn;
reconnect through thread resume/read without resubmitting input. Model changes
within Codex apply to subsequent turns. Engine changes create a new session.
Account logout interrupts active requests, clears HomeCode auth through Codex,
and retains saved histories. No engine fallback on authentication/quota/errors.

Codex account and session calls explicitly use authenticated REST even when the
workspace client normally uses ACP. Restoring an unknown session first resolves
its engine through daemon status. Only an unknown session's 404 may use legacy
Qwen restore because Qwen status covers live sessions only; authentication and
availability errors, and known Codex ownership, never fall back.
Workspace generation closure cancels active Codex work. Deletion removes the
native thread before local metadata; a native deletion error preserves history.

The pinned protocol fixes dynamic tool declarations at thread creation. Refresh
the workspace scheduler before each turn so revoked tools cannot execute. If
new tools appear, require a new Codex chat to expose them to the model.

MCP declarations use an injective `homecode_` prefix because the pinned runtime
reserves native `mcp__` names. The scheduler and UI keep the original tool name.
Scheduler callbacks retain their originating prompt and abort controller; a
late result or permission request cannot affect a later turn.

The account card follows existing model-card sizing, typography, buttons and
quota colors, after the configured models and fallback services. Both product
sidebars place Models below Daemon Status and open this settings section.

Configured models and each returned Codex model offer the existing current-model
action. Harness keeps engine-prefixed selection and creates a new session when
changing engines. HomeChat settings resolve the chosen model against its own
fresh catalog and save only HomeChat options; they never change Harness state.

Reset redemption uses the official `account/rateLimitResetCredit/consume`
method behind authenticated process-global POST `/codex/limits/reset`.
The card confirms spending one existing reset credit. A per-account attempt
UUID survives card navigation and ambiguous failures; retries reuse that UUID.
The daemon coalesces an in-flight duplicate and waits for it before logout.
All four official outcomes remain distinct and trigger a fresh usage read.
Successful redemption is retained even when that read fails. Verification of
a retained attempt remains available when the last reset was already consumed.
Real credits are not spent by development tests.

## Validation and scope

The E2E plan lives in `.qwen/e2e-tests/chatgpt-codex.md`. Validate account
lifecycle, runtime independence, real catalog/quotas, Harness scheduler/MCP,
workspace ownership, persistence/reconnect/stop, and HomeChat outgoing-request
isolation separately. Protocol fixtures are not live provider evidence.
Build, typecheck, focused tests, self-audit and a native desktop check precede
completion. Real OAuth and successful Harness/HomeChat requests are mandatory.

No migration of ChatGPT chats, external authentication, default model changes,
Qwen core refactor, commits, push or publishing are part of this request.

## Effective HomeChat boundary

Recording a provider request from the official runtime revealed that
`project_doc_max_bytes=0` still permits root CODEX_HOME/AGENTS.md instructions.
HomeChat therefore requires an empty `instructionSources` array from thread
start/resume before submitting a turn; missing or nonempty provenance fails
closed and keeps saved history available. A seeded root AGENTS probe sent zero
model requests. A clean-root probe excluded seeded project, skill and memory
content from the outgoing request.

The Astra model family exposes sealed code-mode wrappers around hosted web
tools. These wrappers have no Node, filesystem, host execution or arbitrary
network access; their presence is distinct from local command execution.
Actual ordinary HomeChat, hosted web search, negative local-access checks and
Harness HomeCode/MCP calls passed with HomeCode's own real ChatGPT login.
Detailed evidence and remaining acceptance status live in the E2E report.
