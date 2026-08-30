import { useTranslation } from 'react-i18next'
import { PackageSearch } from 'lucide-react'

import StatusBadge from '@/core/ui/StatusBadge'
import type { VerdictReading } from './verdict'

/**
 * The verdict, said out loud (ticket 298).
 *
 * 🔑 **Two placements, one reading.** When there is a graph the verdict is a
 * *strip* above it — a pill and one sentence, because the documents are the
 * subject and the verdict is the caption. When there is none the same reading
 * **replaces the document area**: pill, sentence, and nothing else on the page
 * that could be mistaken for an answer. A lookup that finds nothing never shows a
 * blank page, and that is the whole ticket.
 *
 * 🚩 **The raw code is always on the element**, as `data-verdict`, whether or not
 * it is on screen. The drive asserts against it, and a consultant reporting an
 * unrecognised verdict is asked for exactly that string.
 *
 * ⚠️ **Nothing here decides anything.** The reading comes from `verdict.ts`, which
 * is where the ten codes and their keys live and where they are tested. This file
 * adds the `t()` calls and the chrome.
 *
 * The download buttons (ticket 299) hang off the strip's end — one per IDoc type
 * present, which is why the strip is a row with room on its trailing edge and not
 * a paragraph.
 */
export function VerdictStrip({ reading }: { reading: VerdictReading }) {
  const { t } = useTranslation('reports')

  return (
    <div
      data-verdict={reading.code}
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-border/60 bg-card-2 px-3 py-2"
    >
      <StatusBadge sev={reading.sev}>{t(reading.nameKey, { code: reading.code })}</StatusBadge>
      {reading.known ? (
        <p className="text-[12.5px] text-muted-foreground">
          {t(reading.sentenceKey, { code: reading.code })}
        </p>
      ) : (
        // ⚠️ **The unknown verdict's sentence is the BANNER's here, not the
        // strip's.** Over a graph `banners()` raises the loud notice, and the same
        // words in the caption underneath it would be one fact told twice — the
        // symmetric mistake to the one the module avoids in the empty case, where
        // the empty state is the carrier and the banner is suppressed. What the
        // strip keeps is the part the banner cannot be: the raw code, in the place
        // a consultant already reads codes on this screen.
        <span className="font-mono text-[12.5px] font-bold tracking-wide">{reading.code}</span>
      )}
    </div>
  )
}

/**
 * The named empty result — **the document area, replaced**.
 *
 * 🔑 Deliberately NOT the landing placeholder's twin in wording, only in chrome:
 * "nothing has been asked yet" and "the rail produced nothing, and here is why"
 * are different facts, and this screen exists because the second one used to look
 * like the first. What distinguishes them is the sentence.
 *
 * ⚠️ **An unrecognised verdict lands here too, and loudly**, carrying its raw code
 * inside its own sentence. A screen that blanked on a code it did not know would
 * be the dead end this whole feature was built to remove, reintroduced by a
 * deployment mismatch.
 */
export function VerdictEmptyState({ reading }: { reading: VerdictReading }) {
  const { t } = useTranslation('reports')

  return (
    <div
      data-verdict={reading.code}
      data-verdict-known={reading.known ? 'true' : 'false'}
      className="mx-auto mt-12 flex max-w-md flex-col items-center gap-2 text-center"
    >
      <PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
      <StatusBadge sev={reading.sev}>{t(reading.nameKey, { code: reading.code })}</StatusBadge>
      <p className="text-sm text-muted-foreground">
        {t(reading.sentenceKey, { code: reading.code })}
      </p>
    </div>
  )
}
