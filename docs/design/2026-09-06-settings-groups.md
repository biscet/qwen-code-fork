# Settings groups and Vane preferences

The settings navigation currently mixes Harness categories and model management.
Chat opens the same administration surface, but its Vane preferences are only
available from the composer.

Group the existing navigation into Harness, Chat, and Models, using the current
compact buttons, muted captions, and borders. Keep all existing categories except
Model in Harness; put a Vane category in Chat and Model in its own group. Retain
category deep links and the horizontal navigation on narrow screens.

Add a Vane preferences card using existing HomeChat APIs and shared UI primitives.
Expose the existing model, thinking, effort, and research depth options. Persist
through `/homechat/options`, preserve model identity, and disable thinking for
models that do not support it. These preferences are user-wide; workspace scope
must not imply a workspace override. Hide the scope switch while Vane is selected.
Show loading, unavailable, saving, and failure states without displaying stale
success. Reload Chat options after returning from administration so the next
prompt uses the saved values and the unsent draft is preserved.
Successful option writes also invalidate the mounted Chat catalog, covering a
save that finishes after settings close and ignoring older catalog responses.

Changes are confined to Web Shell settings, its translations, and HomeChat option
refresh, with focused DOM tests. No daemon routes, provider definitions, or
workspace access are added. Existing uncommitted work is preserved. Build and
typecheck, verify the compiled interface and persistence, then refresh and restart
the current HomeCode Tauri runtime.
