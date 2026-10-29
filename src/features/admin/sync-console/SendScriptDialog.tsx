import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import Textarea from '@/core/ui/Textarea'
import { notify } from '@/core/services/notify'
import { formatPair, fsi } from '@/core/util/bidi'
import type { ScriptTarget, SendScriptResponse } from '@/core/models/sync-console'
import { AUDIT_KEY, SCRIPTS_KEY, eligibleStoresQuery, syncConsoleApi } from './api'
import { scriptRefusalKey, scriptSqlLength, sendPreviewSentence, sendTargetBody } from './scripts-helpers'
import ReasonDialog from './ReasonDialog'
import ScriptRefusal from './ScriptRefusal'

const TARGETS: readonly ScriptTarget[] = ['all', 'chosen']

/**
 * Send a store script (ticket 664, BackOffice spec 3202 D2/D10/D11, door 3205), on the shared
 * reason dialog: a title, the SQL (monospace, counted against 8,000), and a target — every
 * eligible store (the default), or the stores chosen from `GET ActionSync/Scripts/Eligible`.
 *
 * - **Preview** posts the body with `preview: true` (it writes nothing) and lists the exact
 *   stores the door would write rows for. The dialog says, always, that the script may run more
 *   than once and must be safe to re-run.
 * - **Send** stays disabled until a preview has answered **for what is typed now**: any change to
 *   the title, the SQL or the target sets the preview aside. It then posts the same body with
 *   `preview: false` and the reason.
 * - A refusal (`SCRIPT_HAS_GO`, `NOT_ELIGIBLE`, …) shows its code and its words, and the dialog
 *   stays open. Nothing is checked here that the door checks: the door is the judge (D10).
 */
export default function SendScriptDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  // Mounted per opening, so a new one never carries the last one's draft or preview.
  return <Send onClose={onClose} />
}

function Send({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [sql, setSql] = useState('')
  const [target, setTarget] = useState<ScriptTarget>('all')
  const [codes, setCodes] = useState<string[]>([])
  const [preview, setPreview] = useState<{ draft: string; answer: SendScriptResponse } | null>(null)

  // The title is sent trimmed; the SQL exactly as typed (the door stores it byte for byte).
  const body = { title: title.trim(), sql, ...sendTargetBody(target, codes) }
  const draft = JSON.stringify(body)
  const fresh = preview !== null && preview.draft === draft ? preview.answer : null

  const eligible = useQuery({ ...eligibleStoresQuery(), enabled: target === 'chosen' })
  const options = useMemo<MultiSelectOption[]>(
    () =>
      (eligible.data?.items ?? []).map((s) => ({
        value: s.code,
        text: formatPair(s.code, s.description),
        machine: true,
        tone: s.isPaused ? 'muted' : 'default',
        note: s.isPaused ? t('scriptSend.paused') : undefined,
      })),
    [eligible.data, t],
  )

  // The draft rides in the variables: an edit made while the preview is in flight must not be
  // stamped as previewed by its answer.
  const ask = useMutation({
    mutationFn: (v: { reason: string; body: typeof body; draft: string }) => syncConsoleApi.sendScript({ ...v.body, reason: v.reason, preview: true }),
    onSuccess: (answer, v) => setPreview({ draft: v.draft, answer }),
    onError: () => setPreview(null),
  })

  const send = useMutation({
    mutationFn: (reason: string) => syncConsoleApi.sendScript({ ...body, reason, preview: false }),
    onSuccess: (data) => {
      const n = data.stores.length
      notify.success(t('scriptSend.done', { count: n, title: fsi(body.title), n: fsi(sendPreviewSentence(data).n) }))
      void qc.invalidateQueries({ queryKey: SCRIPTS_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      onClose()
    },
  })

  const close = () => {
    if (send.isPending) return
    onClose()
  }

  const length = scriptSqlLength(sql)
  const sentence = fresh ? sendPreviewSentence(fresh) : null

  return (
    <ReasonDialog
      open
      title={t('scriptSend.title')}
      note={t('scriptSend.note')}
      width="52rem"
      busy={send.isPending}
      error={send.error}
      codeLabel={scriptRefusalKey}
      confirmLabel={t('scriptSend.confirm')}
      confirmDisabled={fresh === null || ask.isPending}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={close}
      extraAction={(reason, reasonOk) => (
        <Button variant="secondary" disabled={!reasonOk || ask.isPending} onClick={() => ask.mutate({ reason, body, draft })} data-script-send-preview="">
          {ask.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {ask.isPending ? t('scriptSend.previewing') : t('scriptSend.previewButton')}
        </Button>
      )}
    >
      <Field label={t('scriptSend.titleLabel')}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={send.isPending} data-script-send-title="" />
      </Field>

      <Field
        label={t('scriptSend.sqlLabel')}
        hint={
          <span className="flex flex-wrap justify-between gap-2">
            <span>{t('scriptSend.sqlHint')}</span>
            <span className={length.over ? 'font-semibold text-danger' : ''} data-script-send-count={length.n}>
              <Ltr>{length.text}</Ltr>
            </span>
          </span>
        }
        invalid={length.over}
      >
        {/* SQL is a machine value: laid out left to right in every locale, never spell-checked. */}
        <Textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={10}
          dir="ltr"
          spellCheck={false}
          className="font-mono text-[12px]"
          disabled={send.isPending}
          data-script-send-sql=""
        />
      </Field>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t('scriptSend.targetLabel')}</span>
        <div className="flex gap-2" data-script-send-targets="">
          {TARGETS.map((m) => (
            <Chip key={m} on={target === m} onClick={() => setTarget(m)} disabled={send.isPending} data-script-send-target={m}>
              {t(`scriptSend.targets.${m}`)}
            </Chip>
          ))}
        </div>
      </div>

      {target === 'chosen' && (
        <Field label={t('scriptSend.storesLabel')} hint={eligible.isError ? t('scriptSend.eligibleFailed') : undefined}>
          <MultiSelect
            value={codes}
            onChange={setCodes}
            options={options}
            label={t('scriptSend.storesLabel')}
            loading={eligible.isPending}
            failed={eligible.isError}
            disabled={send.isPending}
            data-testid="script-send-stores"
          />
        </Field>
      )}

      <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-script-send-rerun="">
        {t('scriptSend.rerunWarning')}
      </p>

      <div className="rounded-md border border-border/60 px-3 py-2 text-xs" aria-live="polite" data-script-send-preview-box={fresh ? 'fresh' : 'none'}>
        {sentence && fresh ? (
          <>
            <p className="font-medium" data-script-send-sentence="">
              {t(sentence.key, { count: sentence.count, n: fsi(sentence.n) })}
            </p>
            {/* The exact stores, one list of machine codes isolated once. */}
            <p className="mt-1 max-h-24 overflow-auto font-mono [overflow-wrap:anywhere]" data-script-send-stores="">
              <Ltr>{fresh.stores.join(t('list.separator'))}</Ltr>
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">{t('scriptSend.previewFirst')}</p>
        )}
      </div>

      {ask.error != null && <ScriptRefusal error={ask.error} title={t('scriptSend.previewFailed')} />}
      {send.error != null && <ScriptRefusal error={send.error} title="" storesOnly />}
    </ReasonDialog>
  )
}
