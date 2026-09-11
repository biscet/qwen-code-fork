# Desktop MCP portability

[English](2026-09-11-desktop-mcp-portability.md) | [简体中文](2026-09-11-desktop-mcp-portability.zh-CN.md)

## Problem

New trusted projects receive HomeCode MCP defaults, but a copied project already
containing those defaults does not have the new Mac's external ownership receipt.
Its servers stay pending. Research approval can also become stale at first start
when the key comes from settings.env: approval and child startup must resolve
exactly the same runtime environment. Shipped skill markdown copied from another
Mac can also retain absolute references to scripts on that machine.

The stock local Qwen route requires thinking. The Auto permission classifier
requests no thinking by default; without the model's existing mandatory-thinking
capability flag this produces HTTP 400 and a manual-permission fallback.
With mandatory thinking enabled, the classifier's 256-token output cap can
truncate the structured verdict, producing HTTP 422 instead.
The 10-second fast-stage timeout also aborts valid mandatory-thinking requests:
replaying real Node REPL and Serena actions completed in 21.3 and 14.5 seconds.

## Behavior

Recognize only exact shipped MCP definitions in trusted desktop projects,
including projects with an existing empty receipt. Adopt the current shipped
local definitions and migrate exact shipped remote defaults to local Node REPL,
Serena, Playwright and Chrome DevTools. Home AI Research remains at its shipped
authenticated HTTPS endpoint. Write ownership receipts only to the local user
profile; do not import another machine's approval store.

Preserve custom definitions, .mcp.json collisions, explicit exclusions and
rejections, and missing/deleted servers. Adoption does not restore deleted entries
or enable disabled servers. This extends the previous installer-only ownership
rule specifically to known app capabilities; arbitrary project commands remain
approval-gated.

Compute approval fingerprints using the same environment resolution as the
workspace child. Before approval, verify local definitions still resolve to the
current packaged Node and launcher, with the expected server argument. Project
environment overrides must not turn a stock declaration into an approved custom
executable. Verify the fixed research endpoint and credential-template boundary.

Refresh script references in installed skill/agent markdown only when its full
content matches the shipped template or that template's previous installer
rendering. Rebase references to the current profile/project path. Preserve
custom markdown, scripts, missing files and symlinks; do not overwrite them.

Declare `generationConfig.thinkingMandatory: true` for the shipped local-coder
profile. Migrate that missing capability only on the exact shipped LAN or local
loopback route, including profiles already using the native Qwen reasoning
format. Preserve explicit capability/reasoning overrides, custom routes and
formats, deleted models, and existing model-profile token budgets.

Resolve the actual side-query model, including an explicit fast-model route,
before stage-one classification. Give mandatory-thinking generators 2048 output
tokens and a default 60-second first-stage timeout; keep 256 tokens and 10 seconds
for other generators. The larger timeout allows headroom over the observed
21.3-second classification and retains the existing two-attempt limit. Preserve
valid explicit timeout settings and count model-resolution time against the
deadline. Preserve stage-two behavior and the failure policy. Do not grant
blanket tool permissions.

## Scope

Desktop defaults installation, stock model capability, skill references,
trusted-workspace bootstrap and the classifier's capability-aware output and time
budgets only. Primary, restored and dynamically added trusted runtimes share this
bootstrap. HomeChat and untrusted workspaces retain their existing defaults
bootstrap boundaries. The installer preserves custom model routes and explicit
overrides; the classifier uses the actual resolved model's capability for any
route. Tool invocation approval modes remain unchanged. No new daemon routes or
UI settings are required.

## Validation

Use isolated profiles and fresh, existing, copied and untrusted workspaces.
Verify repeat launch, an existing empty receipt, moved application paths, keys
from settings.env, custom overrides, excluded/rejected/deleted servers, and
attempted environment substitution. Exercise real local MCP calls after moving
the packaged runtime to a path with spaces. Verify workspace-local symbols,
REPL cwd, and browser access to that Mac's localhost. Run focused tests, build,
typecheck, packaging signature/checksum checks, and inspect the task diff twice.
Verify the classifier's HTTP 400 before the capability correction, then a real
Auto tool verdict afterward. An absent HTTP 400 alone is insufficient: timeout
or token-budget failures must still be reported.
Cover both mandatory and non-mandatory fast-model overrides so the main model's
capability cannot determine a different classifier model's budget. Test explicit
timeouts and elapsed model-resolution time. Confirm a
real MCP call in Auto without granting a manual permission.

## Acceptance and limits

Stock MCPs connect without per-server setup in trusted new and copied projects
when prerequisites are present. Research requires the user's valid home-server
key, trusted LAN certificate and network reachability. Model-driven use must be
demonstrated with a real tool roundtrip; connection alone does not guarantee a
model chooses MCP for every task. Report relocated clean-profile testing
separately from testing on a second physical Mac. The portable Apple Silicon
package requires macOS 15 or later and uses ad-hoc signing.
