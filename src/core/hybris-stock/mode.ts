import type { HybrisStockStatus } from '@/core/models/hybris-stock'
import type { Severity } from '@/core/ui/severity'

// The rail's mode banner (spec 3447 story 48; ticket 847) — pure: no React, no `t`.
//
// 🚩 It never claims **live** unless the server said exactly `live`: a mode it does not know, a
// failed Status read or one still loading all read as "unknown", so a shadow run is never mistaken
// for live and nobody believes Hybris imported what it did not.

export type ModeReading = 'off' | 'shadow' | 'live' | 'unknown'

export interface ModeBannerView {
  reading: ModeReading
  /** `mode.<reading>.title` / `mode.<reading>.body` in `hybris-stock-stores`. */
  titleKey: `mode.${ModeReading}.title`
  bodyKey: `mode.${ModeReading}.body`
  sev: Severity
}

const SEV: Record<ModeReading, Severity> = { off: 'mute', shadow: 'warn', live: 'go', unknown: 'mute' }

export function modeReading(status: Pick<HybrisStockStatus, 'mode'> | null | undefined): ModeReading {
  const mode = status?.mode
  return mode === 'off' || mode === 'shadow' || mode === 'live' ? mode : 'unknown'
}

export function modeBanner(status: Pick<HybrisStockStatus, 'mode'> | null | undefined): ModeBannerView {
  const reading = modeReading(status)
  return { reading, titleKey: `mode.${reading}.title`, bodyKey: `mode.${reading}.body`, sev: SEV[reading] }
}
