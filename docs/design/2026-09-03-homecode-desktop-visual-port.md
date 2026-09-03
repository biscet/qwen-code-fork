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
3. Welcome and sidebar branding.
4. Shared, streaming, queued, and bootstrap loading states.
5. Browser favicon and Tauri application icon set.
6. Bootstrap startup, recovery, and update screen.

## Non-goals

- Rename Qwen Code or change its product strings.
- Change layout structure, session semantics, or daemon behavior.
- Replace specialized functional icons that have no HomeCode equivalent.

## Acceptance

- Web Shell typecheck, focused component tests, Web UI typecheck/tests, and
  desktop release tests pass.
- A rebuilt runtime is used by a freshly restarted Tauri development process.
- The live window shows the HomeCode mark, graphite palette, compact borders,
  and pixel loader while retaining Qwen Code functionality.
