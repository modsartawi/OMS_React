/**
 * Test-only (oms 947): one pharmacy's scorecard, in the shape `src/core/models/command-center.ts` proposes for the
 * scorecard route (BO, unbuilt). P166 is an established, flagged pharmacy; `newStoreScorecard` a pharmacy with no
 * comparable weeks last year, whose growth measures read "new".
 */
import type { CcLang, CcMeasure, CcScorecard } from '@/core/models/command-center'

const labels = {
  en: ['Sales growth', 'Receipts growth', 'Average basket (incl. VAT)', 'Dead-stock share', 'Loyalty capture', 'Delivery'],
  ar: ['نمو المبيعات', 'نمو الفواتير', 'متوسط السلة (شامل الضريبة)', 'حصة المخزون الراكد', 'التقاط الولاء', 'التوصيل'],
} as const

const m = (i: number, lang: CcLang, over: Omit<CcMeasure, 'key' | 'label'>): CcMeasure => ({
  key: (['salesGrowth', 'receiptsGrowth', 'basket', 'deadStock', 'loyalty', 'delivery'] as const)[i],
  label: labels[lang][i],
  ...over,
})

export function scorecardFixture(lang: CcLang = 'en', storeCode = 'P166'): CcScorecard {
  return {
    lang,
    night: '2026-11-21',
    dataAsOf: '2026-11-20',
    storeCode,
    title: lang === 'ar' ? `${storeCode} · الرياض` : `${storeCode} · Riyadh`,
    peerGroup: lang === 'ar' ? 'الفئة ب · الوسطى' : 'Size B · Center',
    flagged: true,
    isNew: false,
    measures: [
      m(0, lang, { state: 'scored', colour: 'red', own: '-9.1 pts', peer: '0.0 pts', plain: '-4.2%' }),
      m(1, lang, { state: 'scored', colour: 'red', own: '-6.3 pts', peer: '0.0 pts', plain: '-2.0%' }),
      m(2, lang, { state: 'scored', colour: 'amber', own: 'SAR 61.40', peer: 'SAR 68.10' }),
      m(3, lang, { state: 'scored', colour: 'green', own: '7%', peer: '11%' }),
      m(4, lang, { state: 'scored', colour: 'red', own: '38%', peer: '52%' }),
      m(5, lang, { state: 'scored', colour: 'green', own: '96% · 41 min', peer: '93% · 48 min' }),
    ],
    context: [
      { label: lang === 'ar' ? 'حصة التأمين' : 'Insurance share', value: '31%' },
      { label: lang === 'ar' ? 'أيام التغطية' : 'Days of cover', value: '46' },
    ],
    ask: { question: 'Why is P166 flagged?', findingId: 'f-status-P166' },
  }
}

export function newStoreScorecard(lang: CcLang = 'en'): CcScorecard {
  const card = scorecardFixture(lang, 'P977')
  return {
    ...card,
    flagged: false,
    isNew: true,
    measures: card.measures.map((measure) =>
      measure.key === 'salesGrowth' || measure.key === 'receiptsGrowth'
        ? { ...measure, state: 'new', colour: null, own: '', peer: '', plain: undefined }
        : measure.key === 'delivery'
          ? { ...measure, state: 'not-scored', colour: null, own: '', peer: '' }
          : measure,
    ),
  }
}
