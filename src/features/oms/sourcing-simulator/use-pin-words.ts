import { useTranslation } from 'react-i18next'
import type { AdvisePin } from '@/core/models/sourcing-run'
import { fsi } from '@/core/util/bidi'
import type { PinRefusal } from './pins-model'

const REFUSAL_CODES = new Set(['PIN_PAIR_REMOVED', 'PIN_NO_STOCK', 'PIN_NO_STOCK_ROW', 'PINS_CLASH'])

/**
 * The pins in words (ticket 963): a pin's label and a refused pin's reason, written by the screen from the code and its
 * figures (spec 4354 §11: only three sentences come from the server). Values interpolated into a sentence are isolated
 * whole (`fsi`, the bidi rule); the rule a refusal names is the server's text, shown beside as data.
 */
export function usePinWords() {
  const { t } = useTranslation('sourcing-simulator')
  const mode = (code: string) => t(`mode.${code}`, { defaultValue: code })
  return {
    t,
    label: (pin: AdvisePin): string => {
      switch (pin.kind) {
        case 'LINE_STORE':
          return t('pins.chip.LINE_STORE', { line: fsi(pin.lineNo), store: fsi(pin.store) })
        case 'LINE_MODE':
          return t('pins.chip.LINE_MODE', { line: fsi(pin.lineNo), mode: mode(pin.mode) })
        case 'NOT_STORE':
          return t('pins.chip.NOT_STORE', { store: fsi(pin.store) })
        case 'NOT_MODE':
          return t('pins.chip.NOT_MODE', { mode: mode(pin.mode) })
        case 'ONE_SHIPMENT':
          return t('pins.chip.ONE_SHIPMENT')
      }
    },
    reason: (r: PinRefusal): string =>
      REFUSAL_CODES.has(r.code)
        ? t(`pins.refused.${r.code}`, { step: fsi(r.step ?? '') })
        : t('pins.refused.unknown'),
  }
}
