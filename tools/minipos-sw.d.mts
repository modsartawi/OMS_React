// Types for `tools/minipos-sw.mjs`, which `vite.config.ts` imports (the tools are plain node modules).
import type { Plugin } from 'vite'

export const MINIPOS_BASE: string
export const MINIPOS_PUBLIC_FILES: string[]
export function isMiniPosEntry(chunk: unknown): boolean
export function shellFiles(bundle: Record<string, unknown>, base?: string): string[] | null
export function serviceWorkerSource(shell: string[]): string
export function miniPosServiceWorker(): Plugin
