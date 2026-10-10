import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { RePushResponse } from '@/core/models/sync-console'
import { AUDIT_KEY, COMMANDS_KEY, FLEET_KEY, storeCountersQuery, storeKey, syncConsoleApi } from './api'
import {
  clampRePushFrom,
  rePushDateBounds,
  rePushPreviewSentence,
  sameRePushInputs,
  type RePushInputs,
} from './command-helpers'
import { controlResultSummary } from './control-helpers'
import { notifyOutcome, resultSentence, type ControlOutcome } from './ControlDialog'
import ControlResults from './ControlResults'
import { figure } from './helpers'
import ReasonDialog from './ReasonDialog'

type Scope = 'all' | 'chosen'

/** A preview, with the inputs it answered — a Confirm is only offered while they still match. */
interface Preview {
  inputs: RePushInputs
  data: RePushResponse
}

/**
 * The re-push dialog (ticket 448), opened from one store's page or a fleet selection
 * of up to 50, on the shared reason dialog.
 *
 * - **What:** all push objects, or one. A re-push names at most one object: two or
 *   more is a 400 `BAD_REQUEST` (contract, 2540; met in ticket 450). No door lists the
 *   push objects, so the choice is the first store's own push counters (`bound: 'Out'`).
 * - **From:** limited to the 41-day window from today's LOCAL date, opening on its
 *   start (`rePushDateBounds`).
 * - **Preview** sends the inputs with `preview: true` and shows the replay count per
 *   store and in total, with the date the door ECHOED. Changing any input after it
 *   leaves Confirm disabled until a fresh preview.
 * - **Confirm** posts the previewed inputs again with `preview: false`.
 */
export default function RePushDialog({
  codes,
  onClose,
  onResult,
}: {
  /** The stores to re-push; `null` = the dialog is shut. */
  codes: readonly string[] | null
  onClose: () => void
  onResult: (outcome: ControlOutcome) => void
}) {
  if (!codes || codes.length === 0) return null
  // Keyed on the stores, so a new opening never carries the last one's inputs or preview.
  return <RePush key={codes.join(' ')} codes={codes} onClose={onClose} onResult={onResult} />
}

function RePush({
  codes,
  onClose,
  onResult,
}: {
  codes: readonly string[]
  onClose: () => void
  onResult: (outcome: ControlOutcome) => void
}) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  // Read on every render, so a dialog left open past midnight moves its window with the calendar.
  const bound = rePushDateBounds(new Date())
  const [scope, setScope] = useState<Scope>('all')
  const [chosen, setChosen] = useState<string[]>([])
  const [from, setFrom] = useState(bound.initial)
  const [draft, setDraft] = useState(bound.initial)
  const [preview, setPreview] = useState<Preview | null>(null)

  const counters = useQuery({ ...storeCountersQuery(codes[0]), enabled: scope === 'chosen' })
  const objects = useMemo(
    () => [...new Set((counters.data?.items ?? []).filter((c) => c.bound === 'Out').map((c) => c.objectId))],
    [counters.data],
  )

  const inputs: RePushInputs = { codes, objectIds: scope === 'all' ? null : chosen, fromDate: from }
  const inputsValid = scope === 'all' || chosen.length > 0
  const fresh = preview !== null && sameRePushInputs(preview.inputs, inputs)
  const anyReplays = fresh && preview.data.perStore.some((s) => s.ok)

  const body = (i: RePushInputs, reason: string, isPreview: boolean) => ({
    codes: [...i.codes],
    objectIds: i.objectIds === null ? null : [...i.objectIds],
    fromDate: i.fromDate,
    reason,
    preview: isPreview,
  })

  const ask = useMutation({
    mutationFn: ({ i, reason }: { i: RePushInputs; reason: string }) => syncConsoleApi.rePush(body(i, reason, true)),
    onSuccess: (data, { i }) => setPreview({ inputs: i, data }),
  })

  const send = useMutation({
    mutationFn: ({ i, reason }: { i: RePushInputs; reason: string }) => syncConsoleApi.rePush(body(i, reason, false)),
    onSuccess: (data, { i }) => {
      const summary = controlResultSummary(data.perStore)
      const sentence = resultSentence(t, t('auditActions.RePush'), summary, 'commandResults')
      const queued = data.batchId ? t('rePush.queued', { batch: fsi(data.batchId) }) : undefined
      notifyOutcome(summary, sentence, queued)
      onResult({ action: 'RePush', summary })
      void qc.invalidateQueries({ queryKey: COMMANDS_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      for (const code of i.codes) void qc.invalidateQueries({ queryKey: storeKey(code) })
      onClose()
    },
  })

  const close = () => {
    if (send.isPending) return
    onClose()
  }

  const askFrom = (value: string) => {
    const next = clampRePushFrom(value, new Date())
    setDraft(next)
    setFrom(next)
  }

  const choose = (objectId: string) => setChosen([objectId])

  const title =
    codes.length === 1
      ? t('rePush.titleOne', { code: fsi(codes[0]) })
      : t('rePush.titleMany', { count: codes.length, n: fsi(figure(codes.length)) })

  const sentence = fresh ? rePushPreviewSentence(preview.data, t('list.separator')) : null
  const refused = fresh ? controlResultSummary(preview.data.perStore) : null

  return (
    <ReasonDialog
      open
      title={title}
      codes={codes}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('rePush.confirm')}
      confirmDisabled={!anyReplays || ask.isPending}
      onConfirm={(reason) => preview && send.mutate({ i: preview.inputs, reason })}
      onClose={close}
      extraAction={(reason, reasonOk) => (
        <Button
          variant="secondary"
          disabled={!reasonOk || !inputsValid || ask.isPending}
          onClick={() => ask.mutate({ i: inputs, reason })}
          data-repush-preview-button=""
        >
          {ask.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {ask.isPending ? t('rePush.previewing') : t('rePush.previewButton')}
        </Button>
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="flex flex-col gap-1 text-xs font-medium" data-repush-scope={scope}>
          <legend className="mb-1">{t('rePush.scope')}</legend>
          {(['all', 'chosen'] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 font-normal">
              <input
                type="radio"
                name="repush-scope"
                checked={scope === s}
                onChange={() => setScope(s)}
                disabled={send.isPending}
                data-repush-scope-option={s}
              />
              {t(s === 'all' ? 'rePush.allObjects' : 'rePush.chosenObjects')}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('rePush.from')}
          <input
            type="date"
            value={draft}
            min={bound.min}
            max={bound.max}
            // As on the Passes tab: a date inside the window is taken at once; one outside it is
            // held until the box is left, so a year typed digit by digit is not snapped under the keys.
            onChange={(e) => {
              const typed = e.target.value
              if (typed !== '' && clampRePushFrom(typed, new Date()) === typed) askFrom(typed)
              else setDraft(typed)
            }}
            onBlur={() => askFrom(draft)}
            disabled={send.isPending}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal text-foreground outline-none focus:border-primary/60"
            data-repush-from=""
          />
        </label>
      </div>

      {scope === 'chosen' && (
        <div className="flex flex-col gap-1 text-xs" data-repush-objects="">
          <span className="text-muted-foreground">
            <Trans t={t} i18nKey="rePush.objectsOf" values={{ code: codes[0] }} components={{ code: <Ltr /> }} />
          </span>
          {counters.isPending ? (
            <span className="text-muted-foreground">{t('rePush.objectsLoading')}</span>
          ) : counters.isError ? (
            <span className="text-danger-800">{t('rePush.objectsFailed')}</span>
          ) : objects.length === 0 ? (
            <span className="text-muted-foreground">{t('rePush.objectsEmpty')}</span>
          ) : (
            <div className="flex max-h-32 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">
              {objects.map((o) => (
                <label key={o} className="flex items-center gap-1.5 font-mono">
                  <input
                    type="radio"
                    name="repush-object"
                    checked={chosen.includes(o)}
                    onChange={() => choose(o)}
                    disabled={send.isPending}
                    data-repush-object={o}
                  />
                  <Ltr>{o}</Ltr>
                </label>
              ))}
            </div>
          )}
          {objects.length > 0 && chosen.length === 0 && (
            <span className="text-muted-foreground">{t('rePush.pickObject')}</span>
          )}
        </div>
      )}

      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-repush-window={bound.min}>
        <Trans t={t} i18nKey="rePush.windowNote" values={{ min: bound.min }} components={{ min: <Ltr /> }} />
      </p>

      <div className="rounded-md border border-border/60 px-3 py-2 text-xs" aria-live="polite" data-repush-preview={fresh ? 'fresh' : preview ? 'stale' : 'none'}>
        {sentence ? (
          <p className="font-medium" data-repush-sentence="">
            {t(sentence.key, {
              count: sentence.values.count,
              total: fsi(sentence.values.total),
              stores: fsi(sentence.values.stores),
              from: fsi(sentence.values.from),
              code: fsi(sentence.values.code),
              perStore: fsi(sentence.values.perStore),
            })}
          </p>
        ) : (
          <p className="text-muted-foreground">{t(preview ? 'rePush.previewStale' : 'rePush.previewFirst')}</p>
        )}
      </div>
      {/* A failed preview is told apart from a failed confirm (which shows under the reason). */}
      {ask.error != null && (
        <div data-repush-preview-error={apiErrorCode(ask.error) ?? ''}>
          <ErrorBanner className="p-2" message={apiErrorMessage(ask.error, t('rePush.previewFailed'))}>
            {apiErrorCode(ask.error) && (
              <span className="font-mono text-xs">
                <Ltr>{apiErrorCode(ask.error)}</Ltr>
              </span>
            )}
          </ErrorBanner>
        </div>
      )}
      {refused && refused.failures.length > 0 && (
        <div data-repush-refused="">
          <ControlResults outcome={{ action: 'RePush', summary: refused }} />
        </div>
      )}
    </ReasonDialog>
  )
}
