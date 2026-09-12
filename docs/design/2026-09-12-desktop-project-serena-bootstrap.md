# Serena configuration when adding a desktop project

[English](2026-09-12-desktop-project-serena-bootstrap.md) | [简体中文](2026-09-12-desktop-project-serena-bootstrap.zh-CN.md)

## Problem and evidence

In an isolated HomeCode 2.1.18 daemon, adding trusted empty, TypeScript and Git
projects creates `.qwen/settings.json` immediately, but `.serena/project.yml`
appears only after runtime activation. Project registration and MCP startup are
separate, so an added project can appear incompletely configured.

The supplied HomeCode 2.1.17 log confirms an Apple Silicon client, but contains
no MCP discovery results or model request bodies. A separate live local-model
probe captured the first request with desktop MCP guidance but only built-in
tool schemas and no deferred MCP catalog, despite the workspace reporting
connected servers. ACP sends directly through the chat and bypasses the regular
client path that flushes late MCP discovery reminders.

## Behavior

Initialize the bundled Serena project configuration during trusted desktop
workspace bootstrap, before project registration completes. Use an initialization
mode in the bundled launcher and Serena's own configuration generation; do not
start a persistent MCP server or a language server just to create configuration.
Keep normal MCP startup and on-demand tool discovery intact.

Apply this only to the verified, approved bundled Serena definition. Respect
custom definitions, disabled/excluded/rejected servers, untrusted workspaces and
existing project configuration. Retain the installer ownership and environment
validation that prevent project configuration from substituting an executable.
Initialization errors must be bounded and visible without preventing use of the
rest of the project. Existing projects can initialize on their next bootstrap.

Before an ACP session sends a model request, wait for that session's MCP
discovery to settle, respecting cancellation, then flush the existing MCP tool
and server-instruction reminders. Reuse the same reminder mechanism as the
regular client so later additions and removals remain visible without duplicate
notifications. Session creation remains nonblocking. Preserve deferred tool
schemas and `tool_search`; no change to system prompt wording is required.

## Validation and release

Repeat actual daemon project registration with isolated profiles and empty,
source-only, Git and untrusted directories. Assert configuration exists before
runtime activation, then invoke Serena against a project-local symbol. Verify
existing configuration survives repeat bootstrap. Exercise the real local model
with MCP tool discovery and a successful tool result. Inspect the initial model
request for the MCP catalog, test cancellation during discovery and late tool
changes, and report this separately from connection inventory.

Run focused regressions, build, typecheck and two review passes. Package HomeCode
2.1.19 for Apple Silicon/macOS 15+, verify runtime checksums, complete-app ad-hoc
signature, DMG integrity and mounted runtime startup. This is local installation
simulation; physical acceptance on the other Mac remains a separate check.
