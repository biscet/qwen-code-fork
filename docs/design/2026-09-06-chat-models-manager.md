# Chat model controls and chat manager

Chat currently auto-selects a Vane model and presents an Internet label in the composer. Its separate history supports individual deletion only.

Replace the label with a compact model popover matching Harness styling: searchable models, Thinking and supported reasoning effort, plus research depth. Model identity includes provider and key. Choices apply only to HomeChat requests and are persisted separately from Harness. Vane needs a small request-scoped extension to propagate actual reasoning settings; existing Vane requests retain their defaults.

Add a Chat manager with active, pinned and archived views, search, checkboxes, select-all, bulk delete, archive/restore and pin/unpin. The sidebar exposes the manager, archive and pinned histories. Archive and pin flags belong to the dedicated HomeChat namespace. Archive hides a chat from active and pinned lists without deleting messages. Deletion requires one in-product confirmation for the selected set and handles partial failures truthfully.

Routes are process-global HomeChat-service scoped, independent of the primary or selected workspace. Chat remains public-web-only: no files, workspace bridge, tools or Harness sessions. New model/settings fields are strictly validated against configured research models; caller-selected endpoints and system instructions remain forbidden.

Files: HomeChat frontend/API/CSS and collocated tests; HomeChat daemon route and supporting persisted state; a request-scoped Vane model option adapter if required. Existing dirty changes remain intact. No version bump, commit or push requested.

Verification covers baseline, model request payloads, isolation, archive/pin persistence, partial bulk failures, UI navigation and a rebuilt Tauri runtime. Exact available model capabilities will be taken from the live research-provider adapter.

Implemented metadata lives in `~/.qwen/homechat/state.json`, independent of browser origin and workspace. API model discovery reads `chatModels[].homechatReasoning`; currently the Vane adapter enables none/low/medium/high only for its two verified Qwen routes. Other models keep their normal request parameters. Vane changes are confined to request validation, capability discovery and the per-request OpenAI adapter. A stale Windows display name was corrected to match the verified Qwen3.8-27B endpoint.

Validation: focused route tests cover strict option types, exact model identity, unsupported reasoning rejection, namespace boundaries, flag persistence and truthful deletion results when metadata cleanup fails. Browser acceptance uses an isolated real route host and deterministic research backend for bulk actions, retry, saved parameters and model-capability rendering. The model submenu opens above its trigger on narrow screens. Live Windows-model research completed with a non-empty response and actual Thinking enabled.
