# Chat file attachments

Chat currently sends only text, unlike the Harness composer. Add file selection,
browser drop and clipboard file ingestion to Chat, using the desktop browser drop
handling already fixed for Harness.

The daemon accepts bounded uploads scoped to a HomeChat ID. It extracts text from
text/code, PDF and supported office documents locally. Codex additionally accepts
inline images. Unsupported binary formats and excessive extracted content produce
visible errors. Chat never receives filesystem paths or local tool permissions.

Store uploaded content outside workspace runtimes in the existing HomeChat state
directory. Messages retain attachment references; Vane receives prior attachment
text as conversation context, while Codex receives new text/image inputs in its
persisted thread. Original user prompts remain unchanged. Deleting a chat removes
its attachments. A failed upload batch removes already uploaded, unsubmitted files;
the daemon also cleans up an upload whose client disconnected during parsing. File chips persist when upload fails and clear when switching
chats. Uploads, model selection and message submission cannot race.

Affected areas: HomeChat composer/API, daemon HomeChat routes/state/Codex adapter,
document parser dependency and packaged runtime. Harness behavior stays intact.

Limits: eight files per message, 8 MiB per file, 128,000 extracted characters per Vane
chat or Codex turn. Scanned PDFs without text require an image-capable model; no implicit OCR.
No outstanding product questions.
