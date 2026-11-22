import { targetHref } from '@/core/command-center-routes'
import FindingCard from '@/core/findings/FindingCard'
import Sentence from '@/core/findings/Sentence'
import type { CcBrief, CcLang, CcSection, CcTarget } from '@/core/models/command-center'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { briefLayout } from './brief-layout'
import type { CcT } from './lang'

type HrefOf = (target: CcTarget) => string

/**
 * The morning brief (oms 946, BackOffice spec 4165 "The morning brief"): the headline with its four figures, what changed
 * overnight, the top risks and the top opportunities always open; the four other sections folded under "More in today's
 * brief", each showing its one-line summary. Every line is drawn through the shared finding card (`@/core/findings`),
 * its sentence and SAR figure as the server sent them. A pharmacy code opens its scorecard on this page (947, `?store=`);
 * a category name opens its category profile (949). Section titles are the page's own words; everything else is the
 * server's, in the asked language.
 */
export default function Brief({ brief, lang, t }: { brief: CcBrief; lang: CcLang; t: CcT }) {
  const { open, folded } = briefLayout(brief)
  const hrefOf: HrefOf = (target) => targetHref(target, { lang, store: 'scorecard' })
  return (
    <div className="flex min-w-0 flex-col gap-3" data-cc-brief>
      {open.map((section) => (
        <section
          key={section.key}
          className="rounded-lg border border-border/60 bg-card p-4"
          data-cc-section={section.key}
          data-cc-folded="false"
        >
          <SectionHeader section={section} t={t} />
          <SectionBody section={section} hrefOf={hrefOf} t={t} />
        </section>
      ))}
      {folded.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="pt-1 text-sm font-semibold tracking-tight">{t('brief.more')}</h2>
          {folded.map((section) => (
            <details
              key={section.key}
              className="rounded-lg border border-border/60 bg-card"
              data-cc-section={section.key}
              data-cc-folded="true"
            >
              <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-1 p-3 text-sm">
                <span className="font-semibold">{t(`brief.section.${section.key}`)}</span>
                <span className="text-muted-foreground">
                  {section.state === 'not-available' ? t('brief.notAvailable') : <bdi>{section.summary}</bdi>}
                </span>
              </summary>
              <div className="px-3 pb-3">
                <SectionBody section={section} hrefOf={hrefOf} t={t} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ section, t }: { section: CcSection; t: CcT }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
      <h2 className="text-sm font-semibold tracking-tight">{t(`brief.section.${section.key}`)}</h2>
      {section.dataAsOf && <span className="text-xs text-muted-foreground">{t('brief.dataAsOf', { date: fsi(section.dataAsOf) })}</span>}
    </div>
  )
}

/** A section's content: its lines, the headline and its figures, or — not available — its last good date and no figure. */
function SectionBody({ section, hrefOf, t }: { section: CcSection; hrefOf: HrefOf; t: CcT }) {
  if (section.state === 'not-available') {
    return (
      <div className="flex flex-col gap-1 text-sm" data-cc-not-available>
        <p className="font-medium">{t('brief.notAvailable')}</p>
        {section.lastGoodDate && <p className="text-xs text-muted-foreground">{t('brief.lastGood', { date: fsi(section.lastGoodDate) })}</p>}
        {section.reason && (
          <p className="text-xs text-muted-foreground">
            <bdi>{section.reason}</bdi>
          </p>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {section.headline && (
        <>
          <p className="text-base leading-snug">
            <Sentence parts={section.headline.parts} hrefOf={hrefOf} />
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-cc-figures>
            {section.headline.figures.map((figure) => (
              <div key={figure.label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">
                  <bdi>{figure.label}</bdi>
                </dt>
                <dd className="text-lg font-semibold tabular-nums">
                  <Ltr>{figure.value}</Ltr>
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {section.lines.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {section.lines.map((line) => (
            <li key={line.findingId}>
              <FindingCard line={line} hrefOf={hrefOf} />
            </li>
          ))}
        </ol>
      ) : (
        !section.headline && (
          <p className="text-sm text-muted-foreground">
            {section.startsOn ? t('brief.startsOn', { date: fsi(section.startsOn) }) : t('brief.empty')}
          </p>
        )
      )}
    </div>
  )
}
