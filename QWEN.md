# Qwen Code Development Instructions

Qwen Code is an agent runtime and orchestration system. Optimize changes for
small and local models, which are sensitive to noisy context, ambiguous
instructions, repeated tool calls, and long autonomous loops.

## Working method

- Keep a compact state for coding tasks: `GOAL`, `ACCEPTANCE`, `FACTS`,
  `HYPOTHESES`, `UNKNOWN`, and one `NEXT` action.
- Treat only current file contents, command output, UI observations, and
  completed tool receipts as facts. Never promote a plausible hypothesis to a
  fact without evidence.
- Read targeted files and symbols. Do not preload the repository.
- Before using an unfamiliar library API, verify the installed version and its
  local types, source, or official documentation. Do not invent methods,
  signatures, files, paths, or command results.
- Separate exploration, implementation, and verification. Do not edit until
  the failing boundary, acceptance criterion, relevant instructions, API
  contract, and minimal file scope are known.
- Make one minimal, testable change at a time. Avoid unrelated cleanup,
  refactors, fallback behavior, and speculative fixes.
- After an edit, inspect the focused diff before making another edit.
- If three consecutive tool calls add no material evidence, stop, update the
  state, and change strategy. Do not repeat equivalent searches or commands.

## Skills and delegation

- Match the task against the available skill catalog before domain work. Load
  a matching skill before reading domain files or editing. If none matches,
  record `SKILL: none` and continue.
- A skill call is not compliance by itself. Apply its constraints to later
  tool calls and verification.
- When delegation is requested, keep root as coordinator. Root must not edit
  files assigned to a writer.
- Start with one foreground, read-only `Explore` agent. Give it observations
  and unknowns, not a preferred diagnosis presented as fact.
- After a completed Explore receipt, choose one experiment and, if needed, use
  exactly one foreground `general-purpose` writer with explicit files and
  acceptance criteria.
- Keep delegation depth at one and permit only one writer. A textual claim by
  a subagent is not completion; require a completed receipt, changed files,
  and verification evidence.

## Verification and reporting

- For runtime or UI bugs, reproduce the user's exact action before editing
  when the environment is available, then repeat it after the final edit.
- Track evidence levels separately: `SOURCE`, `TEST`, `TYPECHECK/LINT`,
  `BUILD`, `RUNTIME READY`, and `E2E/USER ACCEPTANCE`.
- Success at one level does not prove another. A running process, HTTP 200,
  build, or typecheck does not prove user-visible behavior.
- Say `FIXED` only after the exact acceptance criterion was observed after the
  last edit. Otherwise report `IMPLEMENTED; E2E GAP` or an evidence-backed
  `BLOCKER`.
- Do not expose hidden chain-of-thought. Report concise checkpoints, evidence,
  actions, results, and remaining gaps.

## Repository changes

- Preserve dirty worktrees and unrelated user changes.
- Prefer small changes that can be tested independently over architectural
  rewrites.
- Run tests from the package that owns the changed code. For core prompt
  changes, run the focused prompt tests and the core package typecheck.
