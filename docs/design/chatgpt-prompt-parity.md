# ChatGPT prompt controls and attachments

HomeCode's Codex composer currently reduces its toolbar to model and workspace controls. This hides the desktop's explicit add menu, voice input, width toggle and Git context. The Codex prompt adapter also rejects text-file attachments emitted by the shared composer as embedded resources.

Keep the configured composer actions for both main and split chats, excluding only Qwen-specific approval modes, context inspection and commands, which have no Codex session route. Preserve existing workspace selection, trust checks and upload routing. Keep Codex worktree creation and Qwen workflow controls disabled because they are separate unsupported operations.

Reuse the existing SessionAttachmentStore for Codex-owned image and file uploads. POST, GET and DELETE attachment routes are live-session-owner scoped and validate the persisted workspace owner, current trust and runtime generation. Uploads use the existing 8 MiB limit. Attachment bytes persist with the Codex session, remain readable after close/reload, and are removed when the session is deleted.

Resolve stored image references to Codex image input and text files to text containing their resource URI and original content. Other uploaded files, including PDFs, are passed as paths to their durable session files for Codex file tools. Retain the original references in session history so existing SDK hydration and attachment previews continue to work. Validate references before reserving a turn; resolve bytes only after reservation to prevent concurrent prompt admission. Inline text resources are also supported; unsupported inline binary resources fail before admission.

Codex treats slash-leading prompts as literal text, so shared actions must preserve their attachments instead of applying Qwen command discard rules. HomeChat remains isolated and is outside this fix.

Bump the independent HomeCode desktop release from 2.1.2 to 2.1.3 in its npm/Tauri/Rust manifests and locks, plus the Web Shell desktop version label and its assertion. Independently versioned upstream Qwen packages and dependency versions keep their own versions.

Validation uses focused source-level component and adapter tests, TypeScript checks without emit, and diff review. The user explicitly prohibits builds and application launches, so no native, daemon or authenticated runtime validation is performed.
