import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { AnalyticsModel } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Chip from '@/core/ui/Chip'
import { FIELD_LABEL } from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { pickerSubjects } from './editor'
import { measureOf } from './wire'

/** A subject area's name: its `boards:editor.area.<key>` words, else the key made readable. */
export function useAreaName() {
  const { t } = useTranslation('boards')
  return (area: string) => t(`editor.area.${area}`, { defaultValue: area.replace(/_/g, ' ') })
}

/**
 * The builder's measures, by subject (CTO demo builder pass): the chosen ones as removable chips, a search, and every
 * measure grouped under its subject area with its one-line definition. A view asks ONE subject, so once a measure is
 * chosen its subject comes first and the other subjects' measures are greyed with the reason. A subject that is not
 * available yet says why.
 */
export default function MeasurePicker({
  model,
  lang,
  value,
  onChange,
  invalid,
}: {
  model: AnalyticsModel
  lang: string
  value: string[]
  onChange: (next: string[]) => void
  invalid: boolean
}) {
  const { t } = useTranslation('boards')
  const areaName = useAreaName()
  const [search, setSearch] = useState('')
  const subjects = pickerSubjects(model, value, search, lang)
  const chosenArea = value.map((k) => measureOf(model, k)?.area).find(Boolean) ?? null
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
  const nameOf = (k: string) => saysIn(measureOf(model, k)?.label, lang) || k

  return (
    <fieldset className="flex flex-col gap-2" data-analytics-measure-picker aria-invalid={invalid || undefined}>
      <legend className={`${FIELD_LABEL} mb-1`}>{t('editor.measures')}</legend>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-analytics-chosen-measures>
          {value.map((k) => (
            <Chip key={k} on onClick={() => toggle(k)} aria-label={t('editor.removeMeasure', { measure: fsi(nameOf(k)) })}>
              <bdi>{nameOf(k)}</bdi>
              <X className="size-3" aria-hidden />
            </Chip>
          ))}
        </div>
      )}
      <Input
        type="search"
        value={search}
        placeholder={t('editor.searchMeasures')}
        aria-label={t('editor.searchMeasures')}
        onChange={(e) => setSearch(e.target.value)}
        wrapperClassName="w-full"
        data-editor-measure-search
      />
      <div className="max-h-80 overflow-y-auto rounded-md border border-border/60" data-analytics-subjects>
        {subjects.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">{t('editor.noMeasureMatch')}</p>}
        {subjects.map((g) => (
          <section key={g.area} data-analytics-subject={g.area} aria-label={areaName(g.area)}>
            <h3 className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-muted px-3 py-1.5 text-xs font-semibold">
              <span>{areaName(g.area)}</span>
              <span className="font-normal text-muted-foreground">
                <Ltr>{g.measures.length}</Ltr>
              </span>
            </h3>
            {!g.available && (
              <p className="px-3 py-1.5 text-xs text-muted-foreground" data-analytics-unavailable-area={g.area}>
                {t('editor.subjectUnavailable')} <bdi>{g.unavailableReason ?? ''}</bdi>
              </p>
            )}
            <ul>
              {g.measures.map((m) => {
                const off = !g.available || (!!m.blocked && !m.chosen)
                const why = !g.available
                  ? t('editor.subjectUnavailable')
                  : off
                    ? t('editor.otherSubject', { subject: fsi(areaName(chosenArea ?? '')) })
                    : undefined
                return (
                  <li key={m.key}>
                    <label
                      className={`flex items-start gap-2 px-3 py-1.5 ${off ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:bg-muted/60'} ${m.chosen ? 'bg-primary/5' : ''}`}
                      title={why}
                      data-analytics-measure={m.key}
                      data-blocked={off ? 'yes' : 'no'}
                    >
                      <input type="checkbox" className="mt-1 accent-[var(--primary)]" checked={m.chosen} disabled={off} onChange={() => toggle(m.key)} />
                      <span className="min-w-0">
                        <span className="text-sm">
                          <bdi>{m.label}</bdi>
                          {m.shape !== 'additive' && (
                            <span className="ms-1.5 rounded bg-muted px-1 py-px text-[10px] font-medium uppercase text-muted-foreground">
                              {t(`editor.shape.${m.shape}`)}
                            </span>
                          )}
                        </span>
                        {m.description && (
                          <span className="block text-xs leading-4 text-muted-foreground">
                            <bdi>{m.description}</bdi>
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {chosenArea && (
        <p className="text-xs text-muted-foreground" data-analytics-one-subject>
          {t('editor.oneSubject', { subject: fsi(areaName(chosenArea)) })}
        </p>
      )}
    </fieldset>
  )
}
