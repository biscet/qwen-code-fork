# HomeCode agent settings and Qwen 0.23.2

[简体中文](./homecode-agent-settings.zh-CN.md)

HomeCode 2.1.8 hides Qwen's existing output language and parallel agent settings. Its bundled Qwen engine is 0.22.3. This release exposes the two native settings, defaults model replies to Russian, updates the engine to the official 0.23.2 source tag, and produces HomeCode 2.1.9 for macOS Apple Silicon.

The settings page uses the existing scoped settings API and shared controls. `agents.maxParallelAgents` accepts positive integers and limits simultaneous background agents within a Qwen session; excess agents use Qwen's existing queue. It applies after restarting the runtime. The existing default of ten remains until the user chooses a value. No scheduler redesign or new per-model controls are introduced.

`general.outputLanguage` is exposed with a language selector. The existing native output-language instruction must be written in the selected settings scope, so persisted changes actually affect subsequent sessions. Main agents and subagents already inherit that instruction. Desktop defaults initialize Russian and migrate prior desktop installations while preserving explicit language choices. Codex Harness receives the same effective language instruction; its existing disabled subagent policy is retained.

Routes retain their current ownership: `/workspace/settings` is legacy-primary with user or primary workspace writes; `/workspaces/:workspace/settings` resolves a trusted selected runtime and only writes its workspace. Language instruction paths must match this scope. No selected-runtime failure may fall back to the primary workspace.

The upstream source merge preserves HomeCode branding, custom UI, model settings, HomeChat and Codex integrations. Merge resolutions are limited to compatibility with the new engine. Desktop manifests, lock metadata, Rust package metadata, and visible client version advance together. No commit, push, service deployment, or user-profile mutation is part of this task.

Validation covers settings API visibility, scoped persistence and invalid limits; UI controls; the existing queue/cap tests; native Russian instructions and desktop migration; focused merge regressions; build and typecheck; runtime and mounted DMG startup; macOS resource seal and disk-image integrity. Physical acceptance on the second Mac remains the user's check.
