/**
 * A keyed command's hint on its button (ticket 393, spec 380 K15; ruling 365 §9): the
 * tooltip reads "Reschedule (R)" and the button carries `aria-keyshortcuts`.
 *
 * 🚩 **Letter hints hide when the single-key switch is off** — a letter that does nothing
 * must not be advertised. A chord's hint always shows: chords never switch off.
 */
import { useTranslation } from 'react-i18next'
import { fsi } from '@/core/util/bidi'
import { ariaKeyShortcuts, isSingleKey, legendText } from './keys'
import { useSingleKeys } from './single-key-switch'

/** The key to hint, or `null`: none given, or a single key while the switch is off. */
export function hintedKeys(keys: string | null | undefined, switchOn: boolean): string | null {
  if (!keys) return null
  return switchOn || !isSingleKey(keys) ? keys : null
}

export interface KeyHint {
  /** The button's tooltip: its label, plus the key in brackets when one is hinted. */
  title: (label: string) => string
  /** For the button's `aria-keyshortcuts`; `undefined` when no key is hinted. */
  ariaKeyShortcuts: string | undefined
}

/** Pass the key the command is BOUND to (see `boundKeysOf`), never one the registry refused. */
export function useKeyHint(keys: string | null | undefined): KeyHint {
  const { t } = useTranslation()
  const hinted = hintedKeys(keys, useSingleKeys((s) => s.on))
  return {
    // The tooltip is a string-only sink: the whole chord is isolated once (bidi rule).
    title: (label) =>
      hinted === null ? label : t('common:shortcuts.withKey', { label, key: fsi(legendText(hinted, t)) }),
    ariaKeyShortcuts: hinted === null ? undefined : ariaKeyShortcuts(hinted),
  }
}
