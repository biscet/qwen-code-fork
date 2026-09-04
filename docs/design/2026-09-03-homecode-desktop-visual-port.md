# HomeCode visual language in Qwen Code Desktop

## Goal

Make the existing Qwen Code Desktop surfaces read as part of the HomeCode
family without changing daemon, session, workspace, or approval behavior.

## Source of truth

The port is based on the current HomeCode checkout:

- `packages/ui/src/styles/theme.css`
- `packages/ui/src/v2/styles/colors.css`
- `packages/ui/src/v2/styles/theme.css`
- `packages/ui/src/components/logo.tsx`
- `packages/ui/src/components/spinner.tsx`
- `packages/desktop/icons/homecode-source.png`

## Visual system

- Color: neutral graphite layers (`#080808`, `#161616`, `#242424`) with
  restrained blue focus (`#7698fd`) and HomeCode status colors.
- Type: the HomeCode system sans and monospace stacks at the existing Qwen
  layout sizes.
- Shape: 4/6/8/10px radii, fine low-alpha borders, compact controls, and
  shallow elevation.
- Signature: the interlocking pixel brackets and the 4x4 pixel activity
  spinner replace the purple Qwen mark and circular loaders.
- Icons: product marks and application icons use HomeCode artwork. Functional
  SVG icons adopt HomeCode's square line caps, joins, and lighter stroke.

## Surfaces

1. Web Shell semantic theme and shadcn token bridge.
2. Shared Web UI fallback tokens.
3. A large `homecode` empty-state wordmark and a text-only `homecode`
   sidebar brand, both built from the same two-tone modular SVG lettering.
4. Shared, streaming, queued, and bootstrap loading states.
5. Browser favicon and Tauri application icon set.
6. Bootstrap startup, recovery, and update screen.

7. A Codex-like prompt surface: a compact 128px container in HomeCode's native
   `#161616` dark layer, 22px radius, prompt above the toolbar, HomeCode context
   controls on the left, and model, voice, and circular send/stop actions on
   the right.
8. Project and current branch share one neutral context control when both are
   available. Its two click targets preserve workspace and git behavior while
   the shared border makes them read as one unit.
9. Project navigation precedes Recents. Both use the same compact disclosure
   header, a quiet token-based divider separates them, and workspace management
   joins the Project header's icon actions.

## Non-goals

- Change session semantics, composer actions, or daemon behavior.
- Replace specialized functional icons that have no HomeCode equivalent.
- Add gradients, glass effects, ornamental motion, or other generated-looking
  decoration.

## Acceptance

- Web Shell typecheck, focused component tests, Web UI typecheck/tests, and
  desktop release tests pass.
- A rebuilt runtime is used by a freshly restarted Tauri development process.
- The live window and user-facing product copy say `HomeCode`; internal Qwen
  package, protocol, and migration identifiers remain unchanged.
- The live empty state shows the two-tone modular `homecode` wordmark,
  matching text-only sidebar brand, and filled rounded composer while retaining
  all existing composer actions. Project and branch appear in one shared
  context control. Project and Recents remain independently collapsible, with
  workspace management available from the Project header.
