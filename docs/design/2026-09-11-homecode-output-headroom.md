# HomeCode output headroom for Windows Qwen

[English](2026-09-11-homecode-output-headroom.md) | [简体中文](2026-09-11-homecode-output-headroom.zh-CN.md)

Status: implemented for HomeCode 2.1.17; source, CLI and gateway verification passed.

## Confirmed problem

The parent agent resumed after a background Explore task, read a file, and then
received `final_answer_not_formed / max_tokens`. Windows task `7232` ended at
2026-09-11 15:05:29 UTC after generating exactly 8192 tokens. Its retained slot
parameters show `max_tokens=8192`, `n_predict=8192`, and `reasoning_format=qwen`.
The active native process has a reasoning budget of 8192 and a default total
output budget of 16384. The request's smaller total budget overrode that default.
The reasoning sampler reached its budget, but generation stopped before the
forced closing sequence and final answer could be emitted.

Bifrost request `7b6975dd-0896-4029-a2ee-167ba5b26653` records the same terminal
error after 322932 ms. The adapter preserved the request limit. No timeout,
queue overflow, GPU failure, or parser rejection caused this failure.

HomeCode's packaged Windows Qwen configuration still specified a total ceiling
of 8192. The client correctly treats configured ceilings as explicit, so it
neither substitutes the server default nor increases the ceiling during retry.
An SSE HTTP 200 is not evidence of successful completion.

## Change and scope

Set the packaged Windows Qwen total output budget to 16384. Migrate the obsolete
8192 setting in existing global and trusted workspace configurations for the
known home Windows Qwen routes, including their Bifrost deployment alias.
Support both existing OpenAI provider representations and retain JSONC comments.
Apply migration before installation receipts can skip existing settings.

Migration is one-time for each settings location. Subsequent intentional changes
must remain intact. Preserve missing settings/models, other limits, custom
routes/protocols, alternative explicit output limits, and explicit smaller
reasoning budgets. Keep existing workspace trust and symlink checks. Do not
restore deleted defaults or expand the separate native-reasoning migration.

Retain reasoning enablement, the 8192 native reasoning budget, selected effort,
sampling, context size, model, GPU settings, and tool execution rules. This is a
configuration repair; it does not change generic retry or response parsing.
The new total budget reserves room for the forced transition and final output;
it does not guarantee success for every possible model response.

## Validation and acceptance

Reproduce the error with a global CLI and an isolated fixture before applying
source changes. Verify outgoing limits, real fixture tool execution and final
completion using the rebuilt CLI. Test existing global/workspace migrations,
custom-setting preservation, comments, receipts and idempotence. Use bounded
synthetic native and gateway requests to verify exhausted versus sufficient
budgets; do not replay the user's editing request.

Run the build, typecheck, focused tests and desktop release checks. Synchronize
all HomeCode versions, then verify the complete app signature, DMG, packaged
runtime checksums, startup and version. An Apple Silicon package tested on the
build Mac does not establish compatibility on a second physical Mac. Ad-hoc
signing is distinct from Developer ID signing and notarization.
