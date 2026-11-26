/**
 * The reading tabs' figures (ticket 972): the one value the orders door is asked for each, and the drawer's title.
 *
 * PROVISIONAL (spec 4354: not specified) — the encoding: `breakdown:<BY>:<key>`, `stockShort:<CLASS>:<MODE>`,
 * `channelSplit:<PART>`, `storePassedOver`, `madeBy:<MAKER>`, `noCheckoutRun:<REASON>`,
 * `pairsCut:<city|ALL>[:LINE_NOT_AVAILABLE]`, `outsideRules:<REASON>`, `distanceBand:<BAND>`,
 * `stockCheck:<COVERED|NOT_COVERED>[:NO_STOCK]`, `laterSlot[:<hour>]`, `notRun:<REASON>`.
 */
import type { TFunction } from 'i18next'
import type { ResultsReadingFigure } from '@/core/models/sourcing-results'
import { fsi } from '@/core/util/bidi'

export function encodeReadingFigure(f: ResultsReadingFigure): string {
  switch (f.kind) {
    case 'breakdown':
      return `breakdown:${f.by}:${f.key}`
    case 'stockShort':
      return `stockShort:${f.stockClass}:${f.mode}`
    case 'channelSplit':
      return `channelSplit:${f.part}`
    case 'storePassedOver':
      return f.kind
    case 'madeBy':
      return `madeBy:${f.madeBy}`
    case 'noCheckoutRun':
      return `noCheckoutRun:${f.reason}`
    case 'pairsCut':
      return `pairsCut:${f.city ?? 'ALL'}${f.lineNotAvailable ? ':LINE_NOT_AVAILABLE' : ''}`
    case 'outsideRules':
      return `outsideRules:${f.reason}`
    case 'distanceBand':
      return `distanceBand:${f.band}`
    case 'stockCheck':
      return `stockCheck:${f.covered ? 'COVERED' : 'NOT_COVERED'}${f.noStock ? ':NO_STOCK' : ''}`
    case 'laterSlot':
      return f.hour == null ? 'laterSlot' : `laterSlot:${f.hour}`
    case 'notRunReason':
      return `notRun:${f.reason}`
  }
}

/** A reason code in the page's words, or the code itself (isolated) when the page has no words for it. */
const reasonWords = (t: TFunction<'sourcing-results'>, key: string, code: string) => t(`${key}.${code}`, { defaultValue: fsi(code) })

/** The drawer's title for a reading tab's figure: a string sink, so data values take `fsi`. */
export function readingFigureTitle(t: TFunction<'sourcing-results'>, f: ResultsReadingFigure): string {
  switch (f.kind) {
    case 'breakdown': {
      const row =
        f.by === 'MODE'
          ? t(`breakdowns.modeRows.${f.key}`, { defaultValue: fsi(f.key) })
          : f.by === 'CHANNEL'
            ? t(`channels.${f.key}`, { defaultValue: fsi(f.key) })
            : f.by === 'CITY' && f.key === 'OTHER'
              ? t('breakdowns.otherCities')
              : fsi(f.key)
      return t('breakdowns.figure', { by: t(`breakdowns.by.${f.by}`), row })
    }
    case 'stockShort':
      return t('breakdowns.stockShortFigure', { row: t('breakdowns.stockShortRow', { cls: t(`stockClasses.${f.stockClass}`), mode: t(`modes.${f.mode}`) }) })
    case 'channelSplit':
      return t('breakdowns.channelSplitFigure', { part: t(`breakdowns.splitParts.${f.part}`) })
    case 'storePassedOver':
      return t('breakdowns.storePassedOver.figure')
    case 'madeBy':
      return t('breakdowns.madeBy.figure', { maker: t(`breakdowns.madeBy.makers.${f.madeBy}`) })
    case 'noCheckoutRun':
      return t('breakdowns.madeBy.noCheckoutFigure', { reason: t(`breakdowns.madeBy.noCheckout.${f.reason}`) })
    case 'pairsCut': {
      const where = f.city == null ? t('breakdowns.pairsCut.everyCity') : fsi(f.city)
      return t(f.lineNotAvailable ? 'breakdowns.pairsCut.figureLine' : 'breakdowns.pairsCut.figure', { where })
    }
    case 'outsideRules':
      return t('outsideRules.figure', { reason: reasonWords(t, 'outsideRules.reasons', f.reason) })
    case 'distanceBand':
      return t('checks.distance.figure', { band: t(`checks.distance.bands.${f.band}`) })
    case 'stockCheck':
      return t(f.noStock ? 'checks.stock.figureNoStock' : 'checks.stock.figure', { read: t(f.covered ? 'checks.stock.covered' : 'checks.stock.notCovered') })
    case 'laterSlot':
      return f.hour == null ? t('laterSlots.figure') : t('laterSlots.figureHour', { hour: fsi(`${String(f.hour).padStart(2, '0')}:00`) })
    case 'notRunReason':
      return t('notRun.figure', { reason: reasonWords(t, 'notRun.reasons', f.reason) })
  }
}
