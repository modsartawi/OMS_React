import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from '@/locales/en/common.json'
import commonAr from '@/locales/ar/common.json'
import miniPosPhone from '@/locales/en/mini-pos-phone.json'
import miniPosPhoneAr from '@/locales/ar/mini-pos-phone.json'

/**
 * The Mini POS phone app's i18n init (BackOffice spec 4063, oms 916): the same i18next instance and call-site contract
 * (`t('ns:key')`) as OMS's `@/core/i18n`, but holding only the namespaces the phone renders, so the phone bundle does
 * not carry every OMS locale. `common` is the shared layer's (the API client's error sentences, the confirm dialog);
 * `mini-pos-phone` is the app's own. A namespace the phone starts to render is added here and in `PHONE_NAMESPACES`
 * (`minipos-i18n.test.ts` fails until it is). OMS's own init is untouched; the two entries never load together.
 */
export const PHONE_NAMESPACES = ['common', 'mini-pos-phone'] as const

void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [...PHONE_NAMESPACES],
  resources: {
    en: { common, 'mini-pos-phone': miniPosPhone },
    ar: { common: commonAr, 'mini-pos-phone': miniPosPhoneAr },
  },
  interpolation: { escapeValue: false },
})

export default i18n
