import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import type { VerdictBanner } from './verdict'

/**
 * A finding drawn **over a full render** (ticket 298, BackOffice 1391).
 *
 * 🔑 **These are not empty states and must never look like one.** A held document
 * and a transaction whose export-version column contradicts the documents beside
 * it are findings *about* a graph that renders in full. The banner sits above the
 * documents; it never replaces them.
 *
 * 🔑 **The disagreement banner names the offending value and stops.** It does not
 * diagnose, it offers nothing to fix, and it says so in its own last line. What it
 * is really pointing at — the legacy uploader batches on null *or* `'L'`, so these
 * transactions are exported by **both** rails — is a live production defect
 * belonging to the export-version spec. This screen exists so that a possibly
 * double-posted invoice is not the one thing it makes invisible.
 *
 * ⚠️ **Attention ink, not danger ink.** `ErrorBanner` is the danger family and
 * means *something failed*; nothing here failed. The attention family is this
 * repo's "needs a human", which is exactly what a held document and a disagreeing
 * stamp are — and using the error banner would tell a consultant the lookup went
 * wrong when it went right and found something.
 */
export default function AttentionBanner({ banner }: { banner: VerdictBanner }) {
  const { t } = useTranslation('reports')

  // ⚠️ **Three sentences for the disagreement, because there are three facts.** A
  // NULL column arrives as `""` and IS a disagreement — the legacy uploader claims
  // an empty value just as it claims `'L'` — so that one says *the column is
  // empty*. `unstated` is the screen never having been told (the verdict named the
  // stamp but no attention block came with it), and it must not borrow the blank's
  // sentence: that would be inventing the very value the banner exists to report.
  const quote = banner.exportVersion
  const body =
    banner.kind === 'disagreement' && quote.kind !== 'value'
      ? t(`idocInspector.banner.disagreement.body${quote.kind === 'blank' ? 'Blank' : 'Unstated'}`)
      : t(`idocInspector.banner.${banner.kind}.body`, {
          code: banner.code,
          exportVersion: quote.kind === 'value' ? quote.value : '',
        })

  return (
    <div
      role="status"
      data-attention={banner.kind}
      data-attention-code={banner.code}
      className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{t(`idocInspector.banner.${banner.kind}.title`)}</p>
        <p>{body}</p>
        {banner.kind === 'disagreement' && (
          // 🚩 A separate line rather than a clause, because it is a statement
          // about THIS SCREEN and not about the transaction: the screen names the
          // disagreement and repairs nothing.
          <p className="mt-1 text-[0.75rem] opacity-80">
            {t('idocInspector.banner.disagreement.footer')}
          </p>
        )}
      </div>
    </div>
  )
}
