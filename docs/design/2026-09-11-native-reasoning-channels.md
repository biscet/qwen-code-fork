# Native ownership of Qwen reasoning channels

[English](2026-09-11-native-reasoning-channels.md) | [简体中文](2026-09-11-native-reasoning-channels.zh-CN.md)

Status: implemented, 2026-09-11. Native `qwen2` and the matching bridge are
deployed; gateway checks and the current Mac's native GUI/history check passed.
The final DMG was rebuilt and its GUI version label `2.1.15` verified. Both
strict prepared-CLI smokes failed semantic assertions despite engine exit 0.
Another Mac has not been tested.

## Problem and confirmed baseline

The Windows Qwen route has independently interpreted reasoning markers at three
layers: llama.cpp, the Mac normalization bridge, and HomeCode's OpenAI converter.
Their interpretations disagree, causing either reasoning in visible content or
rejection of an otherwise completed answer.

Captured llama.cpp `b10809-5266f24da` streams show native `auto` extraction ending
reasoning at a quoted `</think>` inside a reasoning sentence. The visible channel
then contains the remainder of the sentence and later reasoning. The native
parser searches for the first closing marker; the reasoning-budget sampler has
an independent end matcher. Its completed state can also reactivate on a literal
`<think>` in final content.

Before this repair, the bridge requested `reasoning_format: none`, parsed text
tags, and required the root closing marker to begin a line. Budget exhaustion could
force that marker mid-line; the bridge rejected a valid answer in a recorded
reproduction. Appending a newline to `reasoning_budget_message` repaired that
case without establishing a common protocol.

Replay of the prior HomeCode source independently confirmed that a correct
structured response with final content `<think>literal</think>` could raise
`PROTOCOL_TAG_LEAK` or turn
the literal into a thought part. After conversion, ACP, SDK transcript events,
Web Shell, and history preserve the separate thought flag.

Synthetic native captures and replay cases are under
`.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/`, including
`native-parser-replay-cases.json`. These captures are reproduction evidence, not
the retained contents of the original user conversation.

## Goals and scope

- Give the native server one owner of reasoning, final content, and their phase
  transition for the selected Qwen template.
- Preserve structured channels through the bridge, Bifrost, HomeCode, tools,
  transcript replay, and the next model request.
- Preserve literal thinking-tag text in final content without reparsing it.
- Retain the model, thinking enablement, effort, reasoning/output budgets,
  context size, GPU configuration, MTP configuration, and tool permissions.
- Preserve other providers' compatibility behavior and models that support
  multiple reasoning blocks. Do not change their behavior globally.

## Native protocol and ownership

Select a single-root protocol from the actual native Qwen template profile,
independently of client deployment aliases. Propagate that profile to parsing
and sampling. Do not enable it for every tag-based reasoning model.

One request-local native state owns the transition:

```text
reasoning -> final content or tool output -> completed
```

Final content cannot reactivate reasoning. The budget, lazy tool grammar, and
response exporter observe the same transition. Cloning, resetting, speculative
acceptance, and rollback must preserve or restore this state together with the
sampler. Draft tokens that are not accepted must not advance it.

The Qwen wire grammar reserves a root ending token at the beginning of a line,
optionally preceded by spaces, tabs, or carriage returns, outside a fenced code
block. It is a line-prefix rule: no lookahead for a complete standalone line is
required. Inline quoted closing tags and tags inside a fence remain reasoning
data. Opening tags within reasoning do not introduce nested protocol phases.
Fence opening lines begin with at least three backticks or tildes after at most
three leading whitespace bytes; closing lines use the same character with at
least the opening run length and only trailing horizontal whitespace. Fence
state changes at newline. Transport chunk boundaries never define a line or a
token boundary. The template's direct tool marker can also end reasoning; its
bytes remain available to the native tool parser.

This is an explicit reserved syntax, not a claim that a parser can identify the
model's intended meaning. Adding the old bridge matcher to native code while
leaving an independent sampler matcher would not satisfy this design.

Budget exhaustion produces an explicit native forced-transition event. The
exporter follows that event rather than guessing from the generated string. The
sampler retains its configured forced tokens and records the boundary directly;
neither the server nor the bridge injects a newline to make a textual matcher
agree. The bridge no longer modifies `reasoning_budget_message` to coordinate
parsers. A forced transition remains effective inside an unfinished reasoning
fence. This does not change the configured budget or add a second model request.

Native streaming and unary serialization emit `reasoning_content`, `content`,
and `tool_calls` according to that state. The `qwen` profile preserves payload
token bytes, including whitespace; it removes structural reasoning delimiters
and generated end-of-generation tokens, which are never text. Literal token
bytes in the prompt prefill remain available when calculating offsets.
Once in final content, literal thinking markers are ordinary
content. Complete tool calls can finish without final text. If the
response ends during reasoning, a timeout, cancellation, length limit, upstream
failure, or disconnect must not become a successful final answer.

## Bridge and HomeCode contract

The configured route explicitly opts into the native `qwen` format through
`generationConfig.extra_body.reasoning_format: "qwen"`. Request construction and
response handling share this setting. A model-name substring
or the incidental presence of one reasoning delta is not sufficient to select
this contract. The setting applies only after the native implementation has
passed acceptance on this endpoint.

The bridge requests the structured format and performs field-name compatibility
and terminal-status handling. It does not parse tags from `content` or from
structured assistant history. Bifrost may expose `reasoning_content` as
`reasoning`; that alias conversion must retain channel separation.

For this explicit contract, HomeCode converts reasoning into thought parts and
content into literal text parts. It bypasses tagged-thinking extraction,
thinking-tag leak heuristics, and buffering triggered solely by tags inside
reasoning. Native deltas are incremental, so cumulative-snapshot guessing is
also bypassed on both text channels. Tool identity and argument validation
remain active. Existing
compatibility handling remains available for other routes. Separate generic
protocol-tag guards must also respect the selected structured contract when
they would otherwise reject legitimate literal content. Literal XML in final
content cannot trigger a secondary client-side tool-call recovery.

Packaged defaults opt in the managed `local-coder` model. Existing settings are
updated before the `.desktop-defaults-v4` early return, only when that model's
explicit `baseUrl` is `https://biscet-server.local:9454/v1` or
`http://127.0.0.1:1235/v1`. Both the legacy provider array and the
`modelProviders.openai.models` wrapper are supported. Absent, `none`, `auto`, and
`deepseek` formats migrate to `qwen`; other explicit values remain unchanged.
The migration changes only that JSONC property, preserving comments and other
settings. It creates no new migration marker and does not rewrite unchanged
files or restore an absent model or settings file.

Trusted workspace initialization applies the same migration to an existing
`.qwen/settings.json`, after its symlink checks and independently of the MCP
installation receipt. Workspace `modelProviders` replaces user-level providers,
so updating global settings alone cannot opt in a workspace-owned route. This
does not grant MCP ownership, restore deleted MCP entries, or change the receipt.
Untrusted workspaces remain outside this initialization path.

ACP updates, SDK blocks, rendering, and persisted history keep their existing
typed separation. Acceptance verifies both live output and replay; no renderer
text scrubber is introduced. The next request reconstructs content and reasoning
from those fields, not by scanning a serialized mixed string.

## Limitations and decisions

Identical unescaped bytes or token IDs cannot simultaneously identify a reserved
phase delimiter and arbitrary literal data with guaranteed recovery of intent.
A literal use of the reserved boundary inside reasoning requires an escaped
representation. Token-based processing alone does not remove that ambiguity.

This design retains the trained model protocol and defines its accepted wire
grammar. It cannot guarantee that the model never writes reasoning-like prose
after a valid final transition. A guarantee covering every unescaped literal
and the model's semantic intent would require a different encoding, model
contract, or generation strategy. Those changes are outside this repair.

The deployment must therefore claim verified channel and lifecycle behavior,
not semantic certainty. Neither increasing timeouts, disabling thinking,
searching for the last tag, nor changing `auto` alone satisfies the repair.

## Validation and acceptance

1. Replay the captured quoted-close and nested-literal cases against the native
   implementation. Add natural root close, inline markers, fenced markers,
   reserved boundaries, and incomplete boundary prefixes with arbitrary chunk
   and UTF-8 splits.
2. Verify budget counting, natural completion, forced transition inside a
   sentence and inside a fence, no reactivation on final literals, lazy grammar
   activation, sampler clone/reset, and speculative rollback. Compare budget
   state with the exported channels, not just the final displayed text.
3. Verify both streaming and unary responses, reasoning-only truncation,
   cancellation, timeout, upstream error/disconnect, valid tool-only completion,
   split tool arguments, invalid arguments, and tool-result continuation.
4. Replay structured responses through HomeCode with literal opening/closing
   tags, standalone markers, and fenced XML in final content. Verify content is
   unchanged and reasoning remains separate in live ACP events, SDK blocks,
   renderer input, persisted replay, and outbound history. Verify repeated and
   prefix-overlapping incremental chunks, primary/exact/fallback route isolation,
   and merge-safe desktop migration on both allowed endpoints and provider
   shapes in global and trusted workspace settings, including comments, custom
   formats, missing models, repeat runs, and preserved workspace MCP receipts.
5. Run targeted regression tests for other provider profiles, including a
   profile that intentionally supports multiple reasoning blocks. Complete the
   required build, typecheck, and affected-package checks.
6. Test the actual Windows native build, the installed bridge, Bifrost, and the
   packaged HomeCode runtime separately. Source tests do not substitute for
   authenticated runtime or LAN evidence. Record the native build fingerprint
   and effective settings with the results.

Acceptance requires a single observed phase transition shared by sampling and
serialization, literal final content preserved end to end, valid tools still
executed through their existing validation path, and incomplete reasoning never
reported as a successful final answer.

## Deployment and rollback

Stage and verify the native binary, bridge changes, route settings, and HomeCode
artifact before switching production. Keep the previous binaries and settings
as a matched rollback set. Wait for the affected route to be idle before
restarting it. Windows llama.cpp is managed only through Scheduled Task
`Codex-Windows-GPU-LLM`; do not kill its child server process independently.

After restart, verify native health and fingerprint, then bridge health, then
the configured Bifrost/LAN route and HomeCode. Avoid exposing a transition in
which one component expects the new contract and another still provides the
old one. If acceptance fails, restore the matched native/bridge/client settings
and artifacts, using the same managed restart procedure. Do not roll back only
one side of the channel contract.

## Implementation and verification record

The private `qwen` format is implemented for supported Qwen templates with
canonical token delimiters. The deployed `qwen2` build shares native sampling
and serialization state, including forced events and generated-EOG exclusion.
The Windows watchdog selects both the new executable and default
`--reasoning-format qwen`; model, budgets, thinking, GPU and MTP settings remain
unchanged. The bridge and explicitly opted HomeCode routes preserve typed output.

- Source: build and typecheck passed; the client tests passed 717/717 and
  defaults/workspace tests passed 33/33. The actual prepared installer and
  bundled Node passed 32/32 checks, with source/bundle hashes and migration-helper
  equivalence verified. See the [client report](../../.qwen/investigations/qwen-native-reasoning-2026-09-11/client-verification.md),
  [defaults report](../../.qwen/investigations/qwen-native-reasoning-2026-09-11/desktop-defaults-verification.md),
  and [prepared-runtime report](../../.qwen/investigations/qwen-native-reasoning-2026-09-11/packaged-defaults-acceptance/report.md).
- Native runtime: 11 named cases passed across the [first four checks](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/live-native-20260911T051558876852Z/results.json),
  [five tool/grammar/truncation checks](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/live-native-20260911T051642751778Z/results.json),
  and [two natural literal/quoted-marker checks](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/live-native-20260911T052338794597Z/results.json).
  Those two passes verify byte-identical channel separation against raw model
  generation, not exact transcription compliance: the nested-literal raw
  baseline already omits the outermost tags.
  The first recording also contains a separate generic literal prompt that hit
  the length limit, so that recording is not an all-pass suite.
- Gateway: 14/14 protocol checks passed across direct bridge and authenticated
  LAN, plus one native Responses check using the default format. SSE status
  correlated by completion ID; unary status correlated only by request ID.
  The forced-budget probe also confirmed the semantic limit above: after a valid
  forced transition, the model wrote a calculation in final content. See the
  [gateway report](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/live-gateway-acceptance-report.md).
- Current Mac GUI: the actual native app displayed final `493`, separate
  expandable `Подумал` reasoning, and retained this separation after reopening
  history. The [transcript and UI evidence](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/packaged215-gui-transcript-evidence.json)
  distinguishes those observations from a plain isolated direct-launch smoke
  that failed resource discovery without the required runtime path. That harness
  failure does not negate the normal LaunchServices/native GUI success.
  A separate final `2.1.15` isolated GUI [wire capture](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/gui-literal-wire-20260911054236809-01.json)
  retained the full literal input and explicit `qwen` settings, but the gateway
  already returned `outer inner` with separate reasoning and `stop`; the GUI
  displayed that same content and reasoning. The transcription mismatch thus
  precedes HomeCode conversion/rendering. This is not exact transcription
  success or a raw native capture of that complete roughly 35K-context request.
- Release and remaining limits: the final DMG and GUI version label `2.1.15`
  were verified; DMG SHA-256 is
  `7ec905fc9a02fab88f437fdf0904a1862f4f6538ae6655152d5a5f56c732388c`.
  The [first prepared-CLI smoke](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/prepared-runtime215-gateway-smoke-first-attempt.json)
  returned `493` but made an extra valid `get_goal` tool turn. The
  [second smoke](../../.qwen/e2e-tests/qwen-native-reasoning-2026-09-11/prepared-runtime215-gateway-smoke-results.json)
  with `tool_choice: none` returned literal tool/protocol prose instead of `493`.
  Both failed their semantic assertions despite engine exit 0; neither is a
  passing smoke. The original stopped conversation and another Mac's actual UI
  have not been replayed or verified.
