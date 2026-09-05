# HomeCode update policy and Russian settings coverage

## Goal

Keep the installed HomeCode desktop application on its current version unless
the user deliberately installs another build, remove the misleading automatic
update control from the Web Shell settings panel, and provide Russian text for
every setting currently shown by that panel.

## Design

- Do not start the Tauri updater during application setup. The existing signed
  updater bridge and release artifacts remain available for compatibility, but
  HomeCode performs no automatic startup check, download, installation, or
  restart.
- Exclude `general.enableAutoUpdate` from the Web Shell settings API and hide
  it in the client for compatibility with older daemons. That setting belongs
  to the interactive CLI updater and does not control the Tauri desktop
  updater.
- Complete the Russian Web Shell catalog for every currently visible daemon
  setting label, description, and enum option. Keep the English schema as the
  fallback for other locales.

## Verification

- A component test proves the automatic update row is absent even when the
  daemon returns it.
- Russian localization tests cover all newly completed schema-derived strings.
- Desktop release checks prove the updater bridge remains valid but no silent
  update task is wired into startup.
- A packaged release smoke check should confirm that launch makes no request
  for `desktop-latest.json` and still starts the bundled runtime normally.
