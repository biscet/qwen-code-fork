# Desktop composer file transfer

## Problem and decision

The Harness composer already accepts dropped and pasted browser files. The
Tauri window leaves its native drag handler enabled, which consumes Finder
drops before WebKit can dispatch the HTML drag/drop events used by the composer.
Disable that handler on the main window so the existing attachment and workspace
upload flows receive the original browser File objects. No native filesystem
IPC or new attachment storage is needed.

Keep the existing drop intent dialog, attachment size limits, and ordinary text
paste. Verify mixed-file clipboard paste and item-only clipboard payloads as
well as native Finder interaction. The separate internet-only Chat product has
its own composer and transport; its follow-up is documented in
[Chat file attachments](homechat-file-attachments.md).

## File support

The attachment input accepts all extensions. Text/code, Markdown, JSON, CSV and
other text files are embedded as text. Supported images use image input; other
files are stored unchanged. The current limit is 8 MiB per attachment.

- Codex receives images as image input, text files as embedded content, and
  binary files (including PDF and Office documents) as durable local paths for
  its tools. Acceptance does not mean every binary format has a native decoder.
- Qwen uses the configured model modalities. The desktop local-coder route
  explicitly disables image input. Do not enable vision just because the base
  model family can support it: the deployed server must have a working vision
  projector. Text files work without vision.
- The configured LLM7 Codestral and GPT-OSS routes are text models. Their file
  access through the Harness tools is separate from native image/audio/video
  input. Qwen's read_file can extract PDF text; unsupported binary formats need
  a suitable tool. The existing Upload to workspace action provides a real path
  for that workflow.

Sources checked September 9, 2026:

- https://qwenlm.github.io/qwen-code-docs/en/developers/tools/file-system/
- https://learn.chatgpt.com/docs/image-inputs
- https://llm7.io/models/
- Installed Tauri 2.11.5 / tauri-runtime-wry 2.11.4 / Wry 0.55.1 sources.

## Validation

Run composer file-transfer regressions, desktop release checks, build and
typecheck, then rebuild the prepared desktop runtime and Rust shell. Compare
native Finder drop and clipboard paste before/after and leave HomeCode 2.1.7
running for user acceptance. Browser/DOM results are recorded separately from
native desktop evidence.
