import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  decodeExperiment,
  encodeExperiment,
  EXPERIMENT_NAME_MAX,
  experimentFileName,
  experimentFromBody,
  type ExperimentRefusal,
  type PlaygroundExperiment,
} from '@/core/insurance-rules/experiment'
import type { PlaygroundEvaluateBody } from '@/core/insurance-rules/playground'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { saveBlob } from '@/core/util/download-file'
import { experimentStore, type SaidKey, type StoreResult } from './experiment-store'

/** A status line: its key under `experiments.said`, and the experiment (or file) it names. */
type Said = { tone: 'ok' | 'warn'; key: SaidKey; name?: string }

/**
 * The playground's experiment toolbar (BackOffice spec 3243 stories 49, 50; oms ticket 687): name the experiment and
 * **save** it in browser storage, **open**, **rename** or **delete** a saved one by name, **export** the current one as
 * `<name>.json` and **import** one. What is saved and exported is what the page would send (`body`); an experiment
 * whose JSON does not parse cannot be. A file that does not decode is refused in words and nothing is loaded.
 *
 * Storage off (private window, blocked site data) leaves the page whole: the save controls say so and export and
 * import still work.
 */
export default function ExperimentBar({ body, onLoad }: { body: PlaygroundEvaluateBody | null; onLoad: (e: PlaygroundExperiment) => void }) {
  const { t } = useTranslation('insurance-playground')
  const store = useMemo(() => experimentStore(), [])
  const [on] = useState(() => store.isOn())
  const [names, setNames] = useState(() => store.list())
  const [name, setName] = useState('')
  const [picked, setPicked] = useState(() => names[0] ?? '')
  const [said, setSaid] = useState<Said | null>(null)
  const [refused, setRefused] = useState<ExperimentRefusal | 'fileFailed' | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const trimmed = name.trim()
  const reason = !body ? t('experiments.said.notReady') : !trimmed ? t('experiments.said.noName') : null
  const storeReason = !on ? t('experiments.said.off') : null

  const say = (s: Said | null) => {
    setSaid(s)
    setRefused(null)
  }
  const refresh = (pick?: string) => {
    const list = store.list()
    setNames(list)
    setPicked(pick !== undefined && list.includes(pick) ? pick : (list[0] ?? ''))
  }
  const failed = (r: StoreResult, n: string): Said | null =>
    r.ok ? null : { tone: 'warn', key: r.reason, name: n }
  const load = (e: PlaygroundExperiment) => {
    setName(e.name)
    onLoad(e)
  }

  const save = () => {
    if (reason || storeReason || !body) return say({ tone: 'warn', key: reason ? (body ? 'noName' : 'notReady') : 'off' })
    const r = store.save(experimentFromBody(trimmed, body))
    refresh(trimmed)
    say(failed(r, trimmed) ?? { tone: 'ok', key: 'saved', name: trimmed })
  }
  const open = () => {
    const e = picked ? store.open(picked) : null
    if (!e) return say({ tone: 'warn', key: 'missing', name: picked })
    load(e)
    say({ tone: 'ok', key: 'opened', name: e.name })
  }
  const rename = () => {
    const r = store.rename(picked, trimmed)
    if (r.ok) refresh(trimmed)
    say(failed(r, trimmed) ?? { tone: 'ok', key: 'renamed', name: trimmed })
  }
  const remove = () => {
    const r = store.remove(picked)
    if (r.ok) refresh()
    say(failed(r, picked) ?? { tone: 'ok', key: 'deleted', name: picked })
  }
  const exportFile = () => {
    if (reason || !body) return say({ tone: 'warn', key: body ? 'noName' : 'notReady' })
    const e = experimentFromBody(trimmed, body)
    saveBlob(experimentFileName(e.name), new Blob([encodeExperiment(e)], { type: 'application/json;charset=utf-8' }))
    say({ tone: 'ok', key: 'exported', name: experimentFileName(e.name) })
  }
  const importFile = (f: File) => {
    f.text().then(
      (text) => {
        const r = decodeExperiment(text)
        if (!r.ok) {
          setSaid(null)
          setRefused(r.code)
          return
        }
        load(r.experiment)
        say({ tone: 'ok', key: 'imported', name: r.experiment.name })
      },
      () => {
        setSaid(null)
        setRefused('fileFailed')
      },
    )
  }

  const noPick = !on || !picked
  const pickReason = storeReason ?? (!picked ? t('experiments.nonePicked') : null)

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-experiment-bar="" data-storage={on ? 'on' : 'off'}>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('experiments.name')} className="w-64">
          <Input value={name} maxLength={EXPERIMENT_NAME_MAX} onChange={(e) => setName(e.target.value)} data-experiment-name="" />
        </Field>
        <Button variant="primary" onClick={save} aria-disabled={!!(reason || storeReason) || undefined} title={reason ?? storeReason ?? undefined} data-experiment-save="">
          {t('experiments.save')}
        </Button>

        <Field label={t('experiments.saved')} className="w-64">
          <Select value={picked} onChange={(e) => setPicked(e.target.value)} disabled={!on || names.length === 0} data-experiment-saved="">
            {names.length === 0 && <option value="">{t('experiments.none')}</option>}
            {names.map((n) => (
              <option key={n} value={n}>
                {fsi(n)}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" onClick={open} aria-disabled={noPick || undefined} title={pickReason ?? undefined} data-experiment-open="">
          {t('experiments.open')}
        </Button>
        <Button
          variant="secondary"
          onClick={rename}
          aria-disabled={noPick || !trimmed || undefined}
          title={pickReason ?? (!trimmed ? t('experiments.said.noName') : t('experiments.renameHint'))}
          data-experiment-rename=""
        >
          {t('experiments.rename')}
        </Button>
        <Button variant="secondary" onClick={remove} aria-disabled={noPick || undefined} title={pickReason ?? undefined} data-experiment-delete="">
          {t('experiments.delete')}
        </Button>

        <span className="ms-auto flex gap-2">
          <Button variant="secondary" onClick={exportFile} aria-disabled={!!reason || undefined} title={reason ?? undefined} data-experiment-export="">
            {t('experiments.export')}
          </Button>
          <Button variant="secondary" onClick={() => file.current?.click()} data-experiment-import="">
            {t('experiments.import')}
          </Button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label={t('experiments.import')}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) importFile(f)
            }}
            data-experiment-file=""
          />
        </span>
      </div>

      {!on && (
        <p className="text-xs text-muted-foreground" data-storage-off="">
          {t('experiments.said.off')}
        </p>
      )}
      {said && (
        <p className={`text-xs ${said.tone === 'ok' ? 'text-muted-foreground' : 'text-danger-800'}`} role="status" data-experiment-said={said.key}>
          {t(`experiments.said.${said.key}`, { name: fsi(said.name ?? '') })}
        </p>
      )}
      {refused && (
        <ErrorBanner className="px-3 py-2" title={t('experiments.refused.title')} message={t(`experiments.refused.${refused}`)}>
          <span data-import-refused={refused} />
        </ErrorBanner>
      )}
    </section>
  )
}
