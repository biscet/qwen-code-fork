# Russian localization for HomeCode Desktop

## Goal

Make Russian a first-class HomeCode Desktop language alongside English and
Simplified Chinese. A user can select it in Settings or with
`/language ui ru`, and a Russian system locale selects it automatically.

## Scope

- Add a complete Russian Web Shell message catalog with the same keys as the
  existing English catalog plus the Web Shell-only tool and settings labels.
- Recognize `ru`, `ru-RU`, `ru_RU`, `russian`, and `русский` as Russian.
- Include Russian in the in-app language picker, slash-command help, and
  language completions.
- Localize the root error fallback and reasoning translation target.
- Keep the existing daemon command as the persistence boundary. The daemon
  already supports `ru` and owns the CLI/server-side Russian locale.

## Non-goals

- Rename protocol, package, storage, or command identifiers.
- Change output-language policy independently of the existing language command.
- Modify session, workspace, approval, or model behavior.

## Acceptance

- Every bundled English Web Shell message key resolves to a Russian entry.
- Russian aliases normalize to `ru`; unrelated locales continue to fall back to
  English.
- Settings and `/language ui ru` switch the current UI and persist through the
  existing daemon path.
- Focused localization, completion, settings, and root-fallback tests pass.
- Web Shell typecheck/build passes and a freshly restarted Tauri dev process
  serves the updated Russian UI.
