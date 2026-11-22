// oms 946 (BackOffice spec 4165): the Retail Command Center's stubbed server answers, in the shape
// `src/core/models/command-center.ts` proposes for BO 4176 (unbuilt). The drives of 946-950 share them; a later ticket
// appends its own (scorecard, profiles) below, never reshapes these.

const words = {
  en: {
    headline: 'Yesterday the chain sold above its 4-week pace; ',
    tail: ' slipped against its peers.',
    figures: ["Yesterday's sales", "Yesterday's receipts", '4-week basket', "Yesterday's orders"],
    changed: ' is newly flagged: sales growth is 9 points under its peers.',
    cat: 'Skin care moved share: ',
    category: 'Skin care',
    risks: ' holds dead stock at cost.',
    opp: ' can rebalance stock to its region.',
    slipped: '3 pharmacies slipped, 2 improved.',
    products: 'Product health needs 180 days of item sales.',
    categories: '2 categories moved share by 0.4 points or more.',
    omni: 'Delivery orders rose 6% on last week.',
    runs: ['Scorecards', 'Product health', 'Brief published'],
  },
  ar: {
    headline: 'باعت السلسلة أمس فوق وتيرتها لأربعة أسابيع؛ ',
    tail: ' تراجعت أمام نظيراتها.',
    figures: ['مبيعات الأمس', 'فواتير الأمس', 'سلة 4 أسابيع', 'طلبات الأمس'],
    changed: ' أُشّرت حديثًا: نمو المبيعات أقل من نظيراتها بـ 9 نقاط.',
    cat: 'تغيّرت حصة العناية بالبشرة: ',
    category: 'العناية بالبشرة',
    risks: ' لديها مخزون راكد بالتكلفة.',
    opp: ' يمكنها إعادة توزيع المخزون في منطقتها.',
    slipped: 'تراجعت 3 صيدليات وتحسنت 2.',
    products: 'تحتاج صحة المنتجات إلى 180 يومًا من مبيعات الأصناف.',
    categories: 'تغيرت حصة فئتين بـ 0.4 نقطة أو أكثر.',
    omni: 'ارتفعت طلبات التوصيل 6% عن الأسبوع الماضي.',
    runs: ['بطاقات الأداء', 'صحة المنتجات', 'نُشر الموجز'],
  },
}

const store = (code) => ({ text: code, target: { kind: 'store', storeCode: code } })
const section = (key, over = {}) => ({ key, folded: false, state: 'ok', dataAsOf: '2026-11-21', lastGoodDate: null, lines: [], ...over })

/** `GET CommandCenter/Home?lang=` — the home in the asked language. */
export function home(lang = 'en', over = {}) {
  const w = words[lang === 'ar' ? 'ar' : 'en']
  return {
    lang,
    night: '2026-11-21',
    isLatest: true,
    dataAsOf: '2026-11-20',
    runs: [
      { agent: 'scorecard', label: w.runs[0], state: 'done', finishedAt: '2026-11-22T02:14:00', dot: 'green' },
      { agent: 'product-health', label: w.runs[1], state: 'failed', finishedAt: '2026-11-22T03:05:00', dot: 'red' },
      { agent: 'brief', label: w.runs[2], state: 'done', finishedAt: '2026-11-22T05:40:00', dot: 'green' },
    ],
    brief: {
      modelWrote: true,
      sections: [
        section('headline', {
          headline: {
            parts: [{ text: w.headline }, store('P210'), { text: w.tail }],
            figures: [
              { label: w.figures[0], value: 'SAR 12.4 m' },
              { label: w.figures[1], value: '182,340' },
              { label: w.figures[2], value: 'SAR 68.10' },
              { label: w.figures[3], value: '9,812' },
            ],
          },
        }),
        section('changed', {
          lines: [
            { findingId: 'f-changed-1', parts: [store('P166'), { text: w.changed }], money: 'SAR 1.2 m', tone: 'red', ask: { question: 'Why is P166 flagged?', findingId: 'f-changed-1' } },
            { findingId: 'f-changed-2', parts: [{ text: w.cat }, { text: w.category, target: { kind: 'category', level: 'top', code: 'C07' } }], money: 'SAR 310 k', tone: 'amber' },
          ],
        }),
        section('risks', { lines: [{ findingId: 'f-risk-1', parts: [store('P031'), { text: w.risks }], money: 'SAR 840 k', tone: 'red' }] }),
        section('opportunities', { lines: [{ findingId: 'f-opp-1', parts: [store('P402'), { text: w.opp }], money: 'SAR 220 k', tone: 'green' }] }),
        section('slipped', { folded: true, summary: w.slipped }),
        section('products', { folded: true, state: 'not-available', dataAsOf: null, lastGoodDate: '2026-11-19', reason: w.products }),
        section('categories', { folded: true, summary: w.categories }),
        section('omni', { folded: true, summary: w.omni }),
      ],
    },
    regions: [],
    points: [],
    notOnMap: 0,
    ...over,
  }
}
