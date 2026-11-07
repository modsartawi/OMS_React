import { useTranslation } from 'react-i18next'
import type { Param } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { DeclarationProblem } from './editor-refusal'
import { paramLabel } from './params'

/**
 * A save refused for its declarations (spec 819 §C, `ANALYTICS-411`; ticket 824): every problem the save
 * found — the editor's own `validate`, or the server's list — each one a button that takes the author to
 * its field (`onGo`). A problem naming a parameter the item no longer holds is shown without one. Nothing
 * was dropped: the author fixes them and saves again. 828/829's designer reuses it.
 */
export default function DeclarationProblems({
  problems,
  params,
  panelTitle,
  lang,
  onGo,
  onClose,
}: {
  problems: readonly DeclarationProblem[]
  params: readonly Param[]
  panelTitle: (id: string) => string
  lang: string
  onGo: (problem: DeclarationProblem) => void
  onClose: () => void
}) {
  const { t } = useTranslation('boards')
  const paramOf = (name: string) => params.find((p) => p.name === name)
  const nameOf = (name: string) => {
    const p = paramOf(name)
    return p ? paramLabel(p, lang, t) : name
  }
  /** A problem with a field to go to: its parameter (still on the item), or (829) its text block or the report panel of a series. */
  const goable = (p: DeclarationProblem) =>
    p.what === 'figure' || (p.what === 'series' ? !!p.panel : p.what !== 'summary' && !!paramOf(p.param))
  const words = (p: DeclarationProblem): string => {
    switch (p.what) {
      case 'name':
        return t(`params.problems.name.${p.why}`, { param: fsi(p.param) })
      case 'binding':
        return t('params.problems.binding', { param: fsi(nameOf(p.param)), panel: fsi(panelTitle(p.panel)), reason: t(`params.reason.${p.reason}`) })
      case 'default':
        return t('params.problems.default', { param: fsi(nameOf(p.param)) })
      case 'series':
        return p.why === 'tooMany'
          ? t('params.problems.series.tooMany')
          : p.why === 'duplicate'
            ? t('params.problems.series.duplicate', { series: fsi(p.series) })
            : t('params.problems.series.foreignDimension', { series: fsi(p.series), dimension: fsi(p.dimension) })
      case 'figure':
        return p.why === 'missingPanel'
          ? t('params.problems.figure.missingPanel', { panel: fsi(p.panel) })
          : t('params.problems.figure.notSingle', { panel: fsi(panelTitle(p.panel)) })
      case 'summary':
        return t('params.problems.summary')
    }
  }
  return (
    <div role="alert" className="rounded-lg border border-danger-border bg-danger-050 p-3 text-sm text-danger-800" data-declaration-problems={problems.length}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {t('params.problems.title')} <Ltr>ANALYTICS-411</Ltr>
        </p>
        <Button variant="text" onClick={onClose} data-declaration-problems-close>
          {t('params.problems.close')}
        </Button>
      </div>
      <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-5">
        {problems.map((p, i) => (
          <li key={i} data-declaration-problem={p.what}>
            {goable(p) ? (
              <Button variant="link" onClick={() => onGo(p)} className="text-start" data-declaration-problem-go={i}>
                {words(p)}
              </Button>
            ) : (
              words(p)
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">{t('params.problems.kept')}</p>
    </div>
  )
}
