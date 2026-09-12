# HomeCode empty-answer recovery

[English](homecode-empty-answer-recovery.md) | [简体中文](homecode-empty-answer-recovery.zh-CN.md)

## Problem

HomeCode 2.1.17 can terminate after successful tool reads when the provider emits an SSE error with `type=final_answer_not_formed` and `code=empty_answer`. This is a semantic failure even when HTTP transport succeeded and output headroom remains. ACP can discard the structured fields, and history replay omits the persisted `turn_result` error.

## Decisions

Recognize only that exact structured pair, including SDK error wrappers. Retry the current model request once when only reasoning has been emitted and cancellation has not occurred. Retain the request history and completed tool results. Do not restart the session prompt, repeat completed tools, infer success from reasoning, or route this failure through the generic invalid-stream retry loop. A second failure remains explicit. New tool calls produced by successful recovery are normal task continuation.

Carry a bounded `errorKind=final_answer_not_formed` and `code=empty_answer` through ACP and `turn_result.error`. Replay error terminals at their original record position using the existing session-update metadata extension. Normalize them to the same UI error shape as live `turn_error`; deduplicate by prompt identity so refresh cannot append a second copy after newer content. Successful and cancelled terminals do not become errors. Existing background task lifetimes remain unchanged.

The React provider retains terminal errors by their normalized `source=turn_error`, including replay carried by a raw `session_update`. Checking only the raw event type would discard the restored error before rendering the transcript.

The separately deployed private native Qwen parser must recognize dedicated closing tokens regardless of Markdown position, preserve one root reasoning span, and recover a sampled premature EOG before accepting it into sampler/KV state. Ordinary final EOS remains valid. Keep typed reasoning/content at the bridge boundary and retain the existing output headroom.

## Validation and release

Reproduce the client failure with controlled OpenAI SSE through the installed CLI/runtime, then verify the built CLI against the same fixture. Cover one successful recovery, repeated failure, cancellation, partial output/tool calls, retained tool results, typed ACP error propagation, cold history restoration and duplicate delivery. Native tests cover inline/fenced closing, ordinary token lookalikes, premature EOG, final EOS and sampler clone/rollback.

Build and typecheck affected packages; run focused regression tests and review the complete diff. Package HomeCode 2.1.18 with the production runtime, verify runtime hashes, strict complete-app signature, DMG integrity and mounted runtime startup. Report architecture, actual minimum OS and ad-hoc signing separately from notarization and physical acceptance on another Mac. Stage the native runtime first and switch it through the existing Windows Scheduled Task only when the model slot is idle.
