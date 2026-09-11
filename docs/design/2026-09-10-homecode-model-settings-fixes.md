# HomeCode model settings fixes

[English](2026-09-10-homecode-model-settings-fixes.md) | [简体中文](2026-09-10-homecode-model-settings-fixes.zh-CN.md)

## Problem and scope

HomeCode 2.1.12 can restore deleted stock models while upgrading an initialized
profile. An open Harness chat retains old model labels after settings edits,
and the welcome composer omits reasoning controls when multiple connections
share a model ID. Scope is these bugs and the HomeCode 2.1.13 installer.

## Decisions

- Seed stock models only before the initial desktop defaults receipt exists.
  Existing profiles retain their model list during later defaults migrations.
- Refresh model presentation from the selected workspace's provider catalog.
  Match connections by their exact provider and endpoint identity. Refresh
  selectors in the catalog and selected chat state when renaming changes an
  opaque selector, without switching the underlying model. Preserve runtime-only
  models and pending draft reasoning choices.
- Build reasoning previews from the exact resolved connection, including opaque
  selectors. Preserve mandatory thinking and each connection's supported effort
  levels. Validate session reasoning against that same connection so choices made
  before the first prompt are accepted. Do not infer capabilities from another
  endpoint sharing the model ID.
- Keep user and workspace settings ownership, credential handling, unrelated
  defaults and the ACP selector protocol unchanged.
- Synchronize all HomeCode version sources to 2.1.13; retain the independent
  upstream Qwen runtime version.

## Validation and acceptance

Regression tests cover deleted defaults across upgrade and restart, live and
welcome model names after rename, and reasoning previews for duplicate model
IDs with different endpoint settings. An isolated browser and mock completion
API verify the settings UI, restart persistence, and first-request reasoning.
Build, typecheck, focused unit tests and diff review precede packaging.

The Apple Silicon DMG must pass container verification, strict application
signature verification and packaged runtime smoke testing. The build uses the
existing ad-hoc signing workflow; it does not claim Developer ID notarization
or testing on the recipient's physical Mac.
