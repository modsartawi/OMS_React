/**
 * The pattern screens' words for what the server sends as codes (oms 922): a status, a signal, a severity, a span or a
 * distance. Each figure interpolated into a sentence is isolated (`fsi`, `.claude/rules/bidi.md`): the words carry the
 * order ("1 h 40 min", "1 س 40 د"), each number keeps its own.
 */
import type { TFunction } from 'i18next'
import type { PatternStatus } from '@/core/models/insurance-patterns'
import type { Severity } from '@/core/ui/severity'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { SEVERITIES, SIGNALS, STATUSES } from './filter'
import { durationWords, kmFigure, speedFigure } from './units'

const STATUS_SEV: Record<PatternStatus, Severity> = { open: 'go', watching: 'warn', cleared: 'ok', confirmed: 'bad', closed: 'mute' }

/** A status's badge: open in motion, watching needs a human, cleared went well, confirmed ended badly, closed neutral. */
export const statusSev = (status: string): Severity => STATUS_SEV[status as PatternStatus] ?? 'mute'

/** A severity's badge: `action` needs a human. */
export const severitySev = (severity: string): Severity => (severity === 'action' ? 'warn' : 'mute')

const known = (values: readonly string[], v: string) => values.includes(v)

/** A status in words; one the screen does not know reads "Unknown status". */
export const statusText = (t: TFunction, status: string) => (known(STATUSES, status) ? t(`status.${status}`) : t('status.unknown'))

/** A signal in words; one the screen does not know (or none) reads "Unknown signal". */
export const signalText = (t: TFunction, signal: string) => (known(SIGNALS, signal) ? t(`signal.${signal}`) : t('signal.unknown'))

/** A severity in words; one the screen does not know (or none) reads "Unknown severity". */
export const severityText = (t: TFunction, severity: string) => (known(SEVERITIES, severity) ? t(`severity.${severity}`) : t('severity.unknown'))

/** A count for a plural sentence: `count` picks the form, `n` is the figure shown, grouped (`1,234`) and isolated. */
export const counted = (count: number) => ({ count, n: fsi(formatFigure(count)) })

/** Spans and distances in the screen's words. */
export function unitWords(t: TFunction) {
  return {
    duration(minutes: number): string {
      const w = durationWords(minutes)
      const values = Object.fromEntries(Object.entries(w).filter(([k]) => k !== 'key').map(([k, v]) => [k, fsi(v as number)]))
      return t(`duration.${w.key}`, values)
    },
    km: (km: number): string => t('units.km', { km: fsi(kmFigure(km)) }),
    speed: (kmPerHour: number): string => t('units.kmPerHour', { speed: fsi(speedFigure(kmPerHour)) }),
  }
}
