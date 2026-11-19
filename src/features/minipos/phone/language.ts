/**
 * The phone's language: Arabic or English, the stored `oms.locale` the OMS app keeps too (same origin). Direction is a
 * boot fact here as in OMS (`@/core/theme/direction`): `minipos/index.html` sets `<html dir>` before first paint, and a
 * switch stores the choice and reloads.
 */

const LOCALE_KEY = 'oms.locale'

export type PhoneLanguage = 'en' | 'ar'

export function storedLanguage(): PhoneLanguage {
  try {
    return (globalThis.localStorage?.getItem(LOCALE_KEY) ?? '').split('-')[0] === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function switchLanguage(): void {
  const next: PhoneLanguage = storedLanguage() === 'ar' ? 'en' : 'ar'
  try {
    globalThis.localStorage?.setItem(LOCALE_KEY, next)
  } catch {
    /* the switch then lasts this page life only */
  }
  window.location.reload()
}
