# Vane desktop connection

[English](vane-desktop-connection.md) | [简体中文](vane-desktop-connection.zh-CN.md)

## Problem

A fresh HomeCode installation cannot load Vane models without the home-server
API key, and Vane settings provide no way to enter it. The default model must be
Qwen3.8-27B, including before connection setup is complete.

## Design

Keep an API-key password field and Save button in Vane settings even when the
remote catalog is unavailable. Show only whether a key is configured; never
return a saved key to the browser. Saving clears the input, reloads models, and
notifies Chat to refresh its catalog. Failed saves retain the typed key for retry.

Use a process-global HomeChat connection endpoint protected by the existing
daemon authentication and strict mutation middleware. Persist an explicitly
entered key in the private user HomeChat store and use it for the fixed desktop
HomeChat gateway. Continue using the existing key fallback until the user saves
an override. This does not change Harness authentication or Codex credentials.

Prefer the actual Qwen27B model advertised by Vane and recognize the existing
legacy Windows model identifier. Show the bundled Qwen27B preset when a fresh
desktop cannot retrieve the catalog. Preserve valid saved model choices. The
server must still validate models against the live provider catalog before
research; a visible preset does not claim that the remote service is reachable.

## Scope and validation

Change the HomeChat routes/store, Vane settings, API helper, translations, and
focused tests. No server model deployment or credentials are included in the
DMG. Verify clean installation, missing/invalid key, save and reload, private
persistence, authorization forwarding, and preservation of existing options.
Record native/browser evidence separately from mocked route/DOM tests in
`.qwen/e2e-tests/homecode-2.1.12/`. There are no open design questions.
