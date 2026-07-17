/// <reference types="vite/client" />

// Build-time constants injected by vite.config.ts `define` (issue 435).
declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string

interface ImportMetaEnv {
  /** Overrides the API base. Default: dev `/api/`, prod same-origin `/` (issue 435). */
  readonly VITE_API_BASE?: string
}
