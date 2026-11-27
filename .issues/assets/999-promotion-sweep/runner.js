// Promotion sweep runner (ticket 999). Paste into the browser console of a signed-in call-center page
// (the dev server, so the /src modules resolve), on an OPEN TEST ORDER you are allowed to empty.
// Candidates are served from http://127.0.0.1:8765/cands.json (shape.py's output, through a small CORS
// file server); the results are POSTed back there as JSON.
//
// Per shape, up to 4 candidate offers until one reacts:
//   1. void every line, add the offer's first buy item (or its first get item when it has no buy side) x1;
//   2. read the near-miss (definition, progress, the console's own English wording);
//   3. ask OfferWhatIf, apply its adds the way the console does (guidanceAddPlan: add, or grow the line);
//   4. check the offer fired, by offerId (BackOffice 4463), and compare with the what-if;
//   5. take the last line away again: the offer must stop firing and come back as a near-miss.
const T = '<transactionId of the test order>'
window.__sweep = { done: false, log: [], results: [] }
;(async () => {
  const W = window.__sweep
  const api = (await import('/src/features/callcenter/console/api.ts')).callCenterApi
  const { guidanceAddPlan } = await import('/src/features/callcenter/console/guidance-add-plan.ts')
  const { offerHeadline } = await import('/src/features/callcenter/console/offer-headline.ts')
  const { howItWorks } = await import('/src/features/callcenter/console/offer-sheet.ts')
  const t = (await import('/src/core/i18n.ts')).default.getFixedT('en')
  const tr = (p) => (p ? t(p.key, p.params) : null)
  const rid = () => crypto.randomUUID()
  const shapes = await (await fetch('http://127.0.0.1:8765/cands.json')).json()
  const withAtp = async (send) => { const r = rid(); let s = await send(r); if (s.pendingConfirmation?.kind === 'belowAtp') s = await send(r, s.pendingConfirmation.confirmToken); return s }
  const add = (item, qty, uom) => withAtp((r, tok) => api.addItem(T, r, item, qty, tok, uom || undefined))
  const grow = (lineId, qty) => withAtp((r, tok) => api.changeQty(T, r, lineId, qty, tok))
  const voidAll = async () => { let s = await api.getState(T); for (const l of s.lines) s = await api.voidLine(T, rid(), l.lineId); return s }
  const firedOf = (s, id) => s.firedPromotions.filter((f) => f.offerId === id).map((f) => f.amount)
  const words = (nm) => { const h = offerHeadline(nm.definition, nm.description); const how = howItWorks(nm.definition, nm.progress); return { headline: h.kind === 'phrase' ? tr(h.phrase) : '(desc) ' + h.text, buy: tr(how.buy), get: tr(how.get) } }
  const lines = (s) => s.lines.map((l) => l.itemNumber + 'x' + l.qty)
  for (const sh of shapes) {
    const rec = { shape: sh.shape, count: sh.count, tries: [] }
    W.results.push(rec)
    for (const c of sh.cands.slice(0, 4)) {
      const id = c.offerId, x = { bby: c.bby, desc: c.desc }
      rec.tries.push(x); W.log.push(sh.shape + ' :: ' + c.bby)
      try {
        await voidAll()
        const seed = (c.pre.length ? c.pre[0].mats.find((m) => !m.startsWith('COUP')) : null) || c.conds[0]?.mats[0]
        x.seed = seed
        if (!seed) { x.err = 'no seed item'; continue }
        const s1 = await add(seed, 1)
        const nm = s1.nearMisses.find((n) => n.offerId === id)
        x.step1 = { fired: firedOf(s1, id), firedIds: s1.firedPromotions.map((f) => f.offerId + ':' + f.amount), lines: lines(s1),
          nm: nm && { isReady: nm.isReady, progress: nm.progress, def: nm.definition, prereq: nm.prereq, words: words(nm) } }
        if (nm) {
          const wi = await api.offerWhatIf(T, id)
          x.whatIf = { adds: wi.adds, fires: wi.fires, saving: wi.saving, before: wi.payableBefore, after: wi.payableAfter }
          let s2 = s1
          for (const a of wi.adds) {
            const plan = guidanceAddPlan(a, s2.lines)
            if (plan.kind === 'add') s2 = await add(plan.itemNumber, plan.qty, plan.uom)
            else if (plan.kind === 'grow') s2 = await grow(plan.lineId, plan.qty)
            else x.otherUnit = plan
          }
          if (wi.adds.length) {
            s2 = await api.getState(T)
            x.step2 = { fired: firedOf(s2, id), lines: lines(s2), nmStill: !!s2.nearMisses.find((n) => n.offerId === id) }
            if (x.step2.fired.length) {
              const last = s2.lines[s2.lines.length - 1]
              if (last.qty > 1 && s2.lines.length === 1) await grow(last.lineId, last.qty - 1)
              else await api.voidLine(T, rid(), last.lineId)
              const s3 = await api.getState(T)
              x.step3 = { fired: firedOf(s3, id), nmBack: !!s3.nearMisses.find((n) => n.offerId === id), lines: lines(s3) }
            }
          }
        }
        if (x.step1.fired.length || x.step1.nm) break
      } catch (e) { x.err = String(e?.message ?? e).slice(0, 160) }
    }
  }
  W.done = true
  await fetch('http://127.0.0.1:8765/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(W.results) })
})()
