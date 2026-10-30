import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import SaysBoth from '@/core/rules/SaysBoth'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import { saysIn } from '@/core/rules/sentence'
import { formatPair, fsi } from '@/core/util/bidi'
import { Select } from './controls'
import { CHANNEL_ANSWERS, catalogEntryOf, factKey, groupCatalog, mayBeCatalogKey, parameterOptions, type ChannelAnswer, type ChannelRate, type FhirCatalogRow, type FhirLegacy, type ParameterOption } from './fhir-catalog'
import { fhirCatalogQuery, fhirParameterQuery } from './registry-api'

const DOT: Record<ChannelAnswer, string> = {
  answers: 'bg-success-800',
  sometimes: 'bg-attention-800',
  never: 'border border-muted-foreground',
}

/** The channel's dot, its fill saying how often it answers; the same words in `title` for those who cannot tell colours. */
function Dot({ answer, title }: { answer: ChannelAnswer; title?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[answer]}`} title={title} data-answer={answer} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title} />
}

function ChannelDots({ channels }: { channels: ChannelRate[] }) {
  const { t } = useTranslation('insurance-rules')
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {channels.map((c) => (
        <span key={c.channel} className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-channel={c.channel}>
          <Dot answer={c.answer} title={t(`catalog.answer.${c.answer}`)} />
          <Ltr>{c.channel}</Ltr>
        </span>
      ))}
    </span>
  )
}

/** A field on a retired CodeSystem (V5): it can still be picked, and the author sees that before picking. */
function LegacyNote({ legacy }: { legacy: FhirLegacy }) {
  const { t } = useTranslation('insurance-rules')
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-xs" data-legacy={legacy.removedOn}>
      <StatusBadge sev="warn">{t('catalog.legacy.badge')}</StatusBadge>
      <span className="text-muted-foreground" data-legacy-note="">
        {t('catalog.legacy.note', { date: fsi(legacy.removedOn), replacement: fsi(legacy.replacement) })}
      </span>
    </span>
  )
}

/** The parameter's whole list from the door (V2); nothing is stored until a code is chosen and used. */
function ParameterPicker({ row, current, onUse }: { row: FhirCatalogRow; current: string | null; onUse: (code: string) => void }) {
  const { t, i18n } = useTranslation('insurance-rules')
  const list = useQuery(fhirParameterQuery(row.parameter ?? ''))
  const [code, setCode] = useState(current ?? '')

  if (list.isError) return <ErrorBanner className="p-2" message={isBareDenial(list.error) ? t('catalog.parameter.denied') : apiErrorMessage(list.error, t('catalog.parameter.failed'))} />
  if (!list.data) return <p className="text-xs text-muted-foreground" role="status">{t('catalog.parameter.loading')}</p>

  const options = parameterOptions(list.data, current)
  const chosen = options.find((o) => o.code === code)
  // A native option takes only a string, so the code and its label go in as one isolate, and the count as another.
  const optionText = (o: ParameterOption) => {
    const label = saysIn(o.label, i18n.language)
    const name = fsi(label ? formatPair(o.code, label) : o.code)
    return o.seen === 'seen' ? t('catalog.parameter.option.seen', { name, payers: fsi(o.census) }) : t(`catalog.parameter.option.${o.seen}`, { name })
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-2 text-xs" data-parameter-picker={row.parameter ?? ''}>
      <Select value={code} aria-label={t('catalog.parameter.label')} data-parameter-select="" className="w-96 max-w-full" onChange={(e) => setCode(e.target.value)}>
        <option value="">{t('catalog.parameter.choose')}</option>
        {options.map((o) => (
          <option key={o.code} value={o.code} data-seen={o.seen}>
            {optionText(o)}
          </option>
        ))}
      </Select>
      {chosen && (
        <span data-parameter-census={chosen.seen}>
          {chosen.seen === 'seen' ? (
            <>
              {t('catalog.parameter.payers')} <Ltr>{chosen.census}</Ltr>
            </>
          ) : (
            t(`catalog.parameter.${chosen.seen}`)
          )}
        </span>
      )}
      <Button variant="secondary" disabled={!code} onClick={() => onUse(code)} data-parameter-use="">
        {t('catalog.parameter.use')}
      </Button>
    </div>
  )
}

function CatalogRow({ row, current, onPick }: { row: FhirCatalogRow; current: string | null; onPick?: (row: FhirCatalogRow, code?: string) => void }) {
  const { t } = useTranslation('insurance-rules')
  const [showPath, setShowPath] = useState(false)
  // A condition already on this field opens with its code in the picker.
  const [choosing, setChoosing] = useState(current !== null)
  const key = factKey(row)
  return (
    <li className="flex flex-col gap-1 border-t border-border/60 px-3 py-2 first:border-t-0" data-catalog-row={key}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-48 flex-1 text-sm">
          <SaysBoth says={row.label} />
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <span data-catalog-type={row.type}>{t(`catalog.type.${row.type}`)}</span>
            {row.unit && <Ltr>{row.unit}</Ltr>}
            {row.cardinality === 'list' && <StatusBadge sev="mute">{t('catalog.list')}</StatusBadge>}
            {row.retired && <StatusBadge sev="mute">{t('catalog.retired')}</StatusBadge>}
          </span>
          <ChannelDots channels={row.channels} />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="text" aria-expanded={showPath} onClick={() => setShowPath((s) => !s)} data-catalog-path-toggle="">
            {t(showPath ? 'catalog.hidePath' : 'catalog.showPath')}
          </Button>
          {onPick &&
            (row.parameter ? (
              // A pick opens the parameter's list: the key is stored only with a code in it.
              <Button variant="secondary" aria-expanded={choosing} onClick={() => setChoosing((s) => !s)} data-catalog-pick="">
                {t('catalog.pick')}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => onPick(row)} data-catalog-pick="">
                {t('catalog.pick')}
              </Button>
            ))}
        </div>
      </div>
      <code className="text-xs text-muted-foreground" data-catalog-key="">
        <Ltr>{key}</Ltr>
      </code>
      {row.legacy && <LegacyNote legacy={row.legacy} />}
      {onPick && row.parameter && choosing && <ParameterPicker row={row} current={current} onUse={(code) => onPick(row, code)} />}
      {showPath && (
        <div className="flex flex-col gap-0.5 rounded-md bg-muted p-2 text-xs" data-catalog-path="">
          <code className="break-all">
            <Ltr>{row.fhirPath}</Ltr>
          </code>
          {row.system && (
            <code className="break-all text-muted-foreground" data-catalog-system="">
              <Ltr>{row.system}</Ltr>
            </code>
          )}
        </div>
      )}
    </li>
  )
}

/** The catalog, by message then level. With `onPick` a field can be picked; the Fields page only reads it. */
export function FhirCatalogPanel({ value, onPick }: { value?: string; onPick?: (row: FhirCatalogRow, code?: string) => void }) {
  const { t } = useTranslation('insurance-rules')
  const catalog = useQuery(fhirCatalogQuery())

  if (catalog.isError)
    return <ErrorBanner className="p-3" message={isBareDenial(catalog.error) ? t('catalog.denied') : apiErrorMessage(catalog.error, t('catalog.failed'))} />
  if (!catalog.data)
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('catalog.loading')}
      </div>
    )
  // A retired field stays readable on the Fields page, but a new condition may not pick it.
  const groups = groupCatalog(onPick ? catalog.data.filter((r) => !r.retired) : catalog.data)
  const entry = value ? catalogEntryOf(catalog.data, value) : null
  if (groups.length === 0) return <p className="text-sm text-muted-foreground" data-catalog-empty="">{t('catalog.empty')}</p>

  return (
    <div className="flex flex-col gap-4" data-catalog="">
      <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" data-catalog-legend="">
        {CHANNEL_ANSWERS.map((a) => (
          <span key={a} className="inline-flex items-center gap-1">
            <Dot answer={a} />
            {t(`catalog.answer.${a}`)}
          </span>
        ))}
      </p>
      {groups.map((g) => (
        <section key={g.message} className="flex flex-col gap-2" data-catalog-message={g.message}>
          <h3 className="text-sm font-semibold">{t(`catalog.message.${g.message}`)}</h3>
          {g.levels.map((l) => (
            <div key={l.level} className="flex flex-col gap-1" data-catalog-level={l.level}>
              <h4 className="text-xs font-medium text-muted-foreground">{t(`catalog.level.${l.level}`)}</h4>
              <ul className="rounded-md border border-border/60">
                {l.rows.map((r) => (
                  <CatalogRow key={factKey(r)} row={r} current={entry?.row === r ? entry.code : null} onPick={onPick} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

/** A condition's way into the catalog: the button, the dialog, and the key the condition stores. */
export function FhirFactPicker({ value, onPick }: { value: string; onPick: (row: FhirCatalogRow, code?: string) => void }) {
  const { t } = useTranslation('insurance-rules')
  const [open, setOpen] = useState(false)
  // Read only for a key on a FHIR message. Failing here is silent: the condition stands, and the opened catalog says why.
  const catalog = useQuery({ ...fhirCatalogQuery(), enabled: mayBeCatalogKey(value) })
  const legacy = catalog.data ? catalogEntryOf(catalog.data, value)?.row.legacy : null
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-catalog-open="">
        {t('catalog.open')}
      </Button>
      <code className="text-xs text-muted-foreground" data-fact-key={value}>
        <Ltr>{value}</Ltr>
      </code>
      {legacy && <LegacyNote legacy={legacy} />}
      <Modal open={open} onClose={() => setOpen(false)} title={t('catalog.title')} width="56rem">
        {open && (
          <FhirCatalogPanel
            value={value}
            onPick={(row, code) => {
              setOpen(false)
              onPick(row, code)
            }}
          />
        )}
      </Modal>
    </>
  )
}
