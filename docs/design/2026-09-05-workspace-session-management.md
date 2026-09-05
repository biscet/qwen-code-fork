# Workspace session management

## Goal

Make each row in the Workspaces page an expandable project row. The expanded
area shows the project's active Web Shell chats in batches of five and provides
single, selected, and all-chat archive/delete actions.

## Interaction

- Clicking a workspace row toggles its chat list. The explicit disclosure
  button provides the keyboard-accessible equivalent.
- The first five chats are visible. “Show 5 more” reveals the next batch.
- Clicking a chat opens it. Checkboxes and action buttons do not navigate.
- Each idle chat can be archived or deleted. Selection reveals compact bulk
  actions; the project header also exposes archive-all and delete-all.
- Archive and delete are confirmed. Running or attention-blocked chats remain
  protected by the same mutation rule as Session Overview.
- Mutations use the owning workspace route, refresh that workspace's catalog,
  and clear the current chat when it was among the successful results.

## Presentation

Keep HomeCode's existing dark, flat table language: coal background
(`#080808`), graphite inset (`#151515`), hairline border (`#2a2a2a`), primary
text (`#e8e8e8`), muted text (`#8a8a8a`), and destructive red (`#dc4c4c`),
implemented through the existing semantic tokens. The expanded list is a
subordinate ruled section, not a card. Its sole visual accent is the compact
selection toolbar that appears only when it is useful.

## Scope

The generic data table gains only an optional expanded-row renderer. No daemon,
SDK, session schema, or workspace routing changes are required.
