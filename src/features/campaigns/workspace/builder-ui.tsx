import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'

// Small pieces the builder's card, palette and panel share (ticket 505).

/** Whether a key exists in the namespace, for the pure label helpers of `./panel-keys`. */
export function useHas() {
  const { i18n } = useTranslation('campaign-workspace')
  return (key: string) => i18n.exists(key, { ns: 'campaign-workspace' })
}

/**
 * A label's words — or, for a block, group or field HQ added that this bundle has no words for
 * yet, its code, isolated as a machine value: never the raw locale key.
 */
export function labelText(t: (key: string) => string, key: string, code: string, has: (key: string) => boolean): ReactNode {
  return has(key) ? t(key) : <Ltr>{code}</Ltr>
}
