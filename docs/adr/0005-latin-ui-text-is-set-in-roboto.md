# English UI text is set in Roboto, not Plex Sans

English UI and grid text moves from **Plex Sans** to **Roboto**. This replaces that part of
[ADR 0003](0003-the-ops-console-sets-type-in-ibm-plex.md). Decided by the owner, 2026-11-02.

## What stays

- **Plex Mono stays for identifiers and codes.** The owner named English text, and 0003's rule that
  mono means "a key" still needs a mono face, which Roboto is not. Overrulable: Roboto Mono is the
  like-for-like swap.
- **Self-hosted, as 0003 requires.** One Latin variable woff2 under `src/assets/fonts/`, taken from
  `@fontsource-variable/roboto` 5.3.0 (OFL-1.1), with no Google Fonts call at runtime.
- **Money and quantities stay out of mono.** Roboto's figures all share one width, so columns still
  align without `tabular-nums`.

## Consequences

- **Avenir Arabic's 105% was not retuned.** It was set against Plex, and Roboto's x-height is within
  2% of Plex's.
- **Figures are narrower.** Roboto's are 0.562em against Plex's 0.6em, so number columns gain a little
  room.
