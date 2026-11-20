/**
 * The phone's language: Arabic or English, stored under the phone's OWN key. The phone app shares the OMS portal's
 * origin, so sharing OMS's `oms.locale` would flip the portal to Arabic and right-to-left on the same browser. Direction
 * is a boot fact here as in OMS (`@/core/theme/direction`): `minipos/index.html` sets `<html dir>` from this key before
 * first paint, and a switch stores the choice and reloads.
 */

/** The phone's language key. `minipos/index.html`'s pre-paint script reads the same literal. */
export const PHONE_LOCALE_KEY = 'minipos.locale'

export type PhoneLanguage = 'en' | 'ar'

export function storedLanguage(): PhoneLanguage {
  try {
    return (globalThis.localStorage?.getItem(PHONE_LOCALE_KEY) ?? '').split('-')[0] === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function switchLanguage(): void {
  const next: PhoneLanguage = storedLanguage() === 'ar' ? 'en' : 'ar'
  try {
    globalThis.localStorage?.setItem(PHONE_LOCALE_KEY, next)
  } catch {
    /* the switch then lasts this page life only */
  }
  window.location.reload()
}
