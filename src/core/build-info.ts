// Build stamp (issue 435). Values are injected at build time by vite.config.ts
// `define` — a textual replace, so `__BUILD_SHA__` etc. become string literals in
// the bundle. Surfaced two ways: the user menu at the rail foot (human, ticket 386)
// and /version.json (machine, emitted by the version-asset plugin). `buildTime` is
// local wall-clock per the estate no-utc-time rule — never UTC.
export const buildInfo = {
  version: __APP_VERSION__,
  sha: __BUILD_SHA__,
  buildTime: __BUILD_TIME__,
}

/** Compact human-readable id, e.g. `v0.0.1+722acb8`. */
export const buildTag = `v${buildInfo.version}+${buildInfo.sha}`
