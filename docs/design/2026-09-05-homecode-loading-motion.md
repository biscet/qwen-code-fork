# HomeCode loading and motion

## Goal

Make asynchronous content keep its shape while it loads and make navigation changes read as deliberate transitions. The settings sidebar must also show the number of visible configured models, just as it shows counts for its other categories.

## Direction

HomeCode remains a compact developer tool: flat rows, neutral surfaces, the existing system typefaces, and the existing monochrome palette. Loading placeholders use a restrained left-to-right scan over the same muted surface token as the final rows. Motion communicates hierarchy rather than decorating it:

- shell panels enter horizontally because they replace the chat pane;
- full pages rise a few pixels because they cover the current workspace;
- tabs cross-fade with a short vertical offset;
- detail and editor states use a tighter fade/scale transition;
- loading placeholders preserve the expected list, form, table, or detail geometry.

All motion is removed when `prefers-reduced-motion: reduce` is active. Background refreshes keep the last settled content and use the existing inline busy indicators; skeletons are reserved for initial loads where there is no useful content yet.

## Implementation

Use the shared Skeleton primitive for the scan effect and a small ContentSkeleton composition for common content shapes. Apply it to the initial loading states of settings and model settings, management catalogs, MCP, channels, session pickers, Git surfaces, usage, the sidebar, and artifact/task details. Shared tabs and shell-level panel/page containers provide the navigation transitions so individual pages do not duplicate animation state.

The Models count is derived from provider models after applying the same hidden OAuth-alias filter used by the model UI. This keeps the badge aligned with what the user can actually see.
