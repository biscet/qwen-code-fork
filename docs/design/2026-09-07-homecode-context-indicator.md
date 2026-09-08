# HomeCode context limit synchronization

Saving a model context limit updates its provider registry. Active sessions
apply the new generator settings before their next turn, preserving a running
request. The chat indicator previously retained the context limit loaded when
the session was attached: it ignored ACP `usage_update.size`, and model
`config_option_update` choices contained no context limit.

Include the existing `contextLimit` metadata in model configuration choices,
matching session model snapshots. Apply the selected route's metadata in the
Web Shell connection state when settings take effect. Consume live main-session
`usage_update` occupancy and size as authoritative, including zero occupancy.
Keep the existing limit when an older configuration event omits the metadata,
and ignore subagent usage because it belongs to a separate context.

No routes, settings persistence, model selection, or generator replacement
semantics change. Regression checks cover 131072 -> 98304, duplicate model
labels on different routes, legacy events, zero occupancy, and subagent usage.
Application builds and launch checks are omitted at the user's request.
