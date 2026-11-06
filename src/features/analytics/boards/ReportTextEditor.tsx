import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import type { AnalyticsLabel, AnalyticsModel, AnalyticsReportDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { formatPair, fsi } from '@/core/util/bidi'
import FigureTextField, { type FigureChipLabel } from './FigureTextField'
import { chipSegments, figuresOf, figureToken, insertToken, type PanelFigure } from './live-figures'
import { reportPanels } from './report'
import { seriesName } from './series'
import { generatedTitle } from './title'

/**
 * The report designer's text editor (spec 819 §E, ticket 829; the 798 prototype's `TextEditor`): the words in
 * English and in Arabic, each a field whose live figures are chips (`./FigureTextField`); "Insert a live figure"
 * — a panel of this report and one of its single values (`figuresOf`: a KPI figure, a total or a named series),
 * placed where the caret was in the chosen language; and the preview as the page reads it. A figure that names a
 * panel no longer on the report, or a value that is not single, is a red chip here and refused at save (411).
 */

type TextBlock = { id: string; kind: 'text'; text: AnalyticsLabel }

/** What each chip says (the panel and its figure, as one pair) and whether it names a single value. */
export function useFigureNames(def: AnalyticsReportDefinition, model: AnalyticsModel, lang: string) {
  const { t } = useTranslation('boards')
  return useMemo(() => {
    const panels = reportPanels(def).map((p) => {
      const title = saysIn(p.title, lang) || generatedTitle(p.definition, model, lang, t) || t('designer.block.untitledPanel')
      return { id: p.id, title, figures: figuresOf(p.definition, model) }
    })
    const figureName = (f: PanelFigure) => (f.series ? seriesName(f.series, lang) : t('designer.text.total'))
    const chipOf = (panel: string, figure: string): FigureChipLabel => {
      const p = panels.find((x) => x.id === panel)
      if (!p)
        return {
          label: t('designer.text.missingPanel', { panel: fsi(panel) }),
          ok: false,
        }
      const f = p.figures.find((x) => x.figure === figure)
      return f
        ? { label: formatPair(p.title, figureName(f)), ok: true }
        : {
            label: t('designer.text.notSingle', { panel: fsi(p.title) }),
            ok: false,
          }
    }
    // The chips are drawn again when any of their words change.
    const key = JSON.stringify([lang, panels.map((p) => [p.id, p.title, p.figures.map((f) => [f.figure, f.series && figureName(f)])])])
    return { panels, figureName, chipOf, key }
  }, [def, model, lang, t])
}

/** A text block's words with their figures as chips, as the designer's page and the editor's preview show them. */
export function FigureChips({ text, chipOf, empty }: { text: string; chipOf: (panel: string, figure: string) => FigureChipLabel; empty: string }) {
  if (!text.trim()) return <p className="text-sm italic text-muted-foreground">{empty}</p>
  return (
    <p className="whitespace-pre-line text-sm leading-7">
      <bdi>
        {chipSegments(text).map((s, i) => {
          if (s.kind === 'text') return s.text
          const c = chipOf(s.panel, s.figure)
          return (
            <span
              key={i}
              className={`mx-0.5 inline-flex items-center rounded px-1 text-xs font-medium ${c.ok ? 'bg-primary-050 text-primary-800' : 'bg-danger-050 text-danger-800'}`}
              data-designer-figure-chip={s.token}
              data-figure-ok={c.ok ? 'yes' : 'no'}
            >
              <bdi>{c.label}</bdi>
            </span>
          )
        })}
      </bdi>
    </p>
  )
}

/** A text block on the designer's page: its words in the screen's language, its figures as chips. */
export function DesignerText({ block, def, model, lang }: { block: TextBlock; def: AnalyticsReportDefinition; model: AnalyticsModel; lang: string }) {
  const { t } = useTranslation('boards')
  const { chipOf } = useFigureNames(def, model, lang)
  return (
    <div data-report-text={block.id} data-designer-text={block.id}>
      <FigureChips text={saysIn(block.text, lang)} chipOf={chipOf} empty={t('designer.text.empty')} />
    </div>
  )
}

export default function ReportTextEditor({
  block,
  def,
  model,
  lang,
  onText,
}: {
  block: TextBlock
  def: AnalyticsReportDefinition
  model: AnalyticsModel
  lang: string
  /** New words; `key` makes typing in one field one step (an insert is its own). */
  onText: (text: AnalyticsLabel, key: string | null) => void
}) {
  const { t } = useTranslation('boards')
  const names = useFigureNames(def, model, lang)
  const [into, setInto] = useState<'en' | 'ar'>(lang.startsWith('ar') ? 'ar' : 'en')
  const caret = useRef<Record<'en' | 'ar', number | null>>({
    en: null,
    ar: null,
  })
  const offered = names.panels.filter((p) => p.figures.length > 0)
  const [panel, setPanel] = useState('')
  const [figure, setFigure] = useState('')
  const chosen = offered.find((p) => p.id === panel) ?? offered[0]
  const fig = chosen?.figures.find((f) => f.figure === figure) ?? chosen?.figures[0]

  const type = useCallback(
    (which: 'en' | 'ar') => (next: string) => onText({ ...block.text, [which]: next }, `block:${block.id}:text:${which}`),
    [block, onText],
  )
  const insert = () => {
    if (!chosen || !fig) return
    const at = insertToken(block.text[into], figureToken(chosen.id, fig.figure), caret.current[into] ?? undefined)
    caret.current[into] = at.caret
    onText({ ...block.text, [into]: at.text }, null)
  }

  return (
    <div className="flex flex-col gap-3" data-designer-text-editor={block.id}>
      {(['en', 'ar'] as const).map((which) => (
        <Field key={which} label={t(which === 'en' ? 'designer.text.wordsEn' : 'designer.text.wordsAr')}>
          <FigureTextField
            value={block.text[which]}
            onChange={type(which)}
            onCaret={(c) => {
              caret.current[which] = c
              setInto(which)
            }}
            chipOf={names.chipOf}
            chipsKey={names.key}
            dir={which === 'en' ? 'ltr' : 'rtl'}
            label={t(which === 'en' ? 'designer.text.wordsEn' : 'designer.text.wordsAr')}
            data-designer-text-field={which}
          />
        </Field>
      ))}

      <fieldset className="flex flex-col gap-2 rounded-md border border-border/60 p-3" data-designer-insert-figure>
        <legend className="px-1 text-xs font-medium text-muted-foreground">{t('designer.text.insert')}</legend>
        {offered.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-designer-no-figures>
            {t('designer.text.noFigures')}
          </p>
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label={t('designer.text.panel')}>
                <Select
                  value={chosen?.id ?? ''}
                  onChange={(e) => {
                    setPanel(e.target.value)
                    setFigure('')
                  }}
                  data-designer-figure-panel
                >
                  {offered.map((p) => (
                    <option key={p.id} value={p.id}>
                      {fsi(p.title)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('designer.text.figure')}>
                <Select value={fig?.figure ?? ''} onChange={(e) => setFigure(e.target.value)} data-designer-figure-value>
                  {(chosen?.figures ?? []).map((f) => (
                    <option key={f.figure} value={f.figure}>
                      {fsi(names.figureName(f))}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('designer.text.into')}</span>
              <Chip on={into === 'en'} onClick={() => setInto('en')} data-designer-figure-into="en">
                {t('designer.text.intoEn')}
              </Chip>
              <Chip on={into === 'ar'} onClick={() => setInto('ar')} data-designer-figure-into="ar">
                {t('designer.text.intoAr')}
              </Chip>
              <Button variant="secondary" className="ms-auto" onClick={insert} data-designer-figure-insert>
                <Plus className="size-3.5" aria-hidden />
                {t('designer.text.insertButton')}
              </Button>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">{t('designer.text.hint')}</p>
      </fieldset>

      <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3" data-designer-text-preview>
        <p className="text-[11px] font-medium text-muted-foreground">{t('designer.text.preview')}</p>
        {(['en', 'ar'] as const).map((which) => (
          <div key={which} dir={which === 'en' ? 'ltr' : 'rtl'} data-designer-text-preview-lang={which}>
            <FigureChips text={block.text[which]} chipOf={names.chipOf} empty={t('designer.text.empty')} />
          </div>
        ))}
      </div>
    </div>
  )
}
