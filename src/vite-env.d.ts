/// <reference types="vite/client" />

// Build-time constants injected by vite.config.ts `define` (issue 435).
declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  /** Overrides the API base. Default: dev `/api/`, prod same-origin `/` (issue 435). */
  readonly VITE_API_BASE?: string
  /** A board's shortest auto-refresh interval, in seconds (ticket 780; 30 unless set, provisional on 750). */
  readonly VITE_ANALYTICS_REFRESH_FLOOR_S?: string
  /** The Mini POS phone app's channel key (`x-api-key` of the mobile channel, oms 916). Unset: the app says so at sign-in. */
  readonly VITE_MINIPOS_API_KEY?: string
}
