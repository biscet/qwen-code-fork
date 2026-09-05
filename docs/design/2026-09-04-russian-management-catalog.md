# OpenCode-style management catalog

## Goal

Make extensions, MCP servers, skills, and agents easy to scan in HomeCode Desktop with a compact, restrained interface similar to OpenCode's settings surfaces.

The Tetris workspace contributed one agent and two skills. They are moved to global user resources so they are available in every workspace, and their project copies are removed so the global catalog is authoritative.

## Interface

- Keep the existing navigation, filters, breadcrumbs, and actions, but replace catalog card grids with compact single-column rows and thin separators.
- Use line tabs and flat detail sections instead of showcase cards, oversized icon tiles, decorative color bars, or explanatory hero blocks.
- Keep extensions, MCP servers, and skills neutral. Reserve green and red for connection/error state.
- Treat agent color as functional metadata: honor an explicit configured color and assign a stable fallback when none is configured. Show the resolved color in both the list and detail view.
- Use the existing typography, spacing, and semantic tokens. Technical identifiers stay monospace and secondary to human-readable labels.

## Localization and data

- Install Russian global copies of the Tetris agent and skills under `~/.qwen`, then remove their project-local copies from Tetris.
- Keep command names, code, API names, and file identifiers unchanged where translation would break execution.
- Give known Serena MCP tools Russian display names and descriptions while keeping their executable identifiers visible and unchanged.
- Load a selected skill's Markdown body on demand from the exact server-resolved skill identity. Do not include bodies in the frequently-polled skills catalog.
- Render that body as safe Markdown in the skill detail view.
- Do not add color fields to extension, MCP, or skill schemas.

## Verification

- Unit-test MCP presentation localization, stable agent color resolution, and exact skill identity/body loading.
- Run the focused Web Shell tests, typecheck, and build.
- Build the desktop runtime, restart Tauri against the Tetris workspace, and verify all four management sections in the live app.
