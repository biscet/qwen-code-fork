# Chat context panels

## Goal

Keep the existing HomeCode visual language while making the chat-side context controls behave like compact Codex surfaces.

## Behavior

- Environment information is open by default for chat integrations that expose the environment header action.
- Subagents render in their own card below Environment. The card appears expanded when agents exist, remains available independently of the Environment toggle, and scrolls after five rows.
- The composer context ring loads context usage into a popover above the composer. It does not append a local command or status message to the transcript. Outside interaction dismisses the popover.
- Context and Git popovers share the same compact neutral surface, list density, selection treatment, and responsive width. Context uses a graphical usage bar; Git reveals branch input or confirmation only after the related mode is selected.
- Status colors communicate warnings and validation only. Selected Git modes use the shared HomeCode focus blue instead of separate decorative palettes, and implementation commands stay out of the user-facing menu.
- Explicitly typing `/context` keeps the existing transcript behavior.

## Scope

Reuse the existing Environment panel, Radix popover primitive, context-usage renderer, and HomeCode tokens. No new visual system or daemon protocol is introduced.
