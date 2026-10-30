import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { FHIR_LEVELS, FHIR_MESSAGES, type FhirFactType } from '@/core/insurance-rules/fhir-catalog'
import { TD, TH, NUM } from '@/core/insurance-rules/parts'
import { fhirCatalogQuery } from '@/core/insurance-rules/registry-api'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { FIELD_PROPOSALS_KEY, fieldsApi } from './api'
import {
  COMPILE_DELAY_MS,
  RAW_PATH_REFUSALS,
  answerLoop,
  compileInput,
  currentAnswer,
  inputKey,
  isZeroMatches,
  proposalBody,
  proposeBlockers,
  rawPathForm,
  type Answer,
  type CompileInput,
  type CompileVerdict,
  type PathRefusal,
  type PathWarning,
  type ProbeReply,
  type RawPathValues,
} from './raw-path'

const FACT_TYPES: FhirFactType[] = ['text', 'number', 'date', 'flag', 'code', 'money', 'quantity']
const KNOWN_REFUSALS: readonly string[] = RAW_PATH_REFUSALS

function failureWords(err: unknown, denied: string, fallback: string): string {
  return isBareDenial(err) ? denied : apiErrorMessage(err, fallback)
}

function Refusals({ refusals }: { refusals: PathRefusal[] }) {
  const { t } = useTranslation('insurance-fields')
  return (
    <ul className="flex flex-col gap-1 rounded-md border border-danger-border bg-danger-050 p-2 text-xs text-danger-800" role="alert" data-raw-refusals="">
      {refusals.map((r) => (
        <li key={`${r.code}:${r.detail ?? ''}`} data-raw-refusal={r.code}>
          <span className="font-semibold">{KNOWN_REFUSALS.includes(r.code) ? t(`rawPath.refusal.${r.code}`) : t('rawPath.refusalOther')}</span>{' '}
          {r.detail && (
            <code className="break-all">
              <Ltr>{r.detail}</Ltr>
            </code>
          )}{' '}
          <bdi>{r.message}</bdi>
        </li>
      ))}
    </ul>
  )
}

function Warnings({ warnings }: { warnings: PathWarning[] }) {
  const { t } = useTranslation('insurance-fields')
  if (warnings.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 rounded-md border border-border/60 bg-attention-050 p-2 text-xs text-attention-800" data-raw-warnings="">
      {warnings.map((w) => (
        <li key={`${w.code}:${w.literal ?? ''}`} data-raw-warning={w.code}>
          {w.code === 'caseOnlyCode' && w.literal && w.known ? (
            <span className="font-semibold">{t('rawPath.caseOnlyCode', { literal: fsi(w.literal), known: fsi(w.known) })}</span>
          ) : null}{' '}
          <bdi>{w.message}</bdi>
        </li>
      ))}
    </ul>
  )
}

function ProbeTable({ reply }: { reply: ProbeReply }) {
  const { t } = useTranslation('insurance-fields')
  return (
    <div className="flex flex-col gap-2" data-raw-probe="">
      {reply.refusals.length > 0 && <Refusals refusals={reply.refusals} />}
      {isZeroMatches(reply) && reply.refusals.length === 0 && (
        <p className="rounded-md border border-border/60 bg-attention-050 p-2 text-xs text-attention-800" data-raw-probe-zero="">
          {t('rawPath.probe.zero')}
        </p>
      )}
      {reply.payers.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className={TH}>{t('rawPath.probe.payer')}</th>
                <th className={TH}>{t('rawPath.probe.match')}</th>
                <th className={TH}>{t('rawPath.probe.noMatch')}</th>
                <th className={TH}>{t('rawPath.probe.unknown')}</th>
              </tr>
            </thead>
            <tbody>
              {reply.payers.map((p) => (
                <tr key={p.payer} className="border-t border-border/60" data-probe-payer={p.payer}>
                  <td className={TD}>
                    <Ltr>{p.payer}</Ltr>
                  </td>
                  <td className={NUM} data-probe-match="">
                    <Ltr>{p.match}</Ltr>
                  </td>
                  <td className={NUM} data-probe-no-match="">
                    <Ltr>{p.noMatch}</Ltr>
                  </td>
                  <td className={NUM} data-probe-unknown="">
                    <Ltr>{p.unknown}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DialogBody({ initial, onClose }: { initial?: Partial<RawPathValues>; onClose: () => void }) {
  const { t } = useTranslation('insurance-fields')
  const qc = useQueryClient()
  const [start] = useState(() => rawPathForm(initial))
  const [form, setForm] = useState(start)
  const set = (patch: Partial<RawPathValues>) => setForm((f) => ({ ...f, ...patch }))
  const [tried, setTried] = useState(false)
  const [checked, setChecked] = useState<Answer<CompileVerdict> | null>(null)
  const [probed, setProbed] = useState<Answer<ProbeReply> | null>(null)
  const [probing, setProbing] = useState<string | null>(null)
  const catalog = useQuery(fhirCatalogQuery())

  const input = compileInput(form)
  const key = input && inputKey(input)

  const compiler = useRef<ReturnType<typeof answerLoop<CompileVerdict>> | null>(null)
  const prober = useRef<ReturnType<typeof answerLoop<ProbeReply>> | null>(null)
  useEffect(() => {
    const c = answerLoop(COMPILE_DELAY_MS, (b: CompileInput) => fieldsApi.compile(b), setChecked)
    const p = answerLoop(
      0,
      (b: CompileInput) => fieldsApi.probe(b),
      (a) => {
        setProbing(null)
        setProbed(a)
      },
    )
    compiler.current = c
    prober.current = p
    return () => {
      c.dispose()
      p.dispose()
    }
  }, [])
  // Compile is asked for the form's question and nothing else: `key` holds every part of `input`.
  useEffect(() => {
    compiler.current?.edit(input)
  }, [key])

  const check = currentAnswer(checked, key)
  const verdict = check?.value
  const probe = currentAnswer(probed, key)
  const blockers = proposeBlockers(form, checked, probed, catalog.data ?? [])
  const refused = !!verdict && verdict.refusals.length > 0
  const canProbe = !!verdict && !refused && probing !== key

  const propose = useMutation({
    mutationFn: () => fieldsApi.propose(proposalBody(form)),
    onSuccess: () => {
      notify.success(t('rawPath.proposed'), fsi(form.key.trim()))
      onClose()
      return qc.invalidateQueries({ queryKey: FIELD_PROPOSALS_KEY })
    },
  })

  // A filled form is not lost to a stray click on the backdrop.
  const dismiss = async () => {
    const dirty = JSON.stringify(form) !== JSON.stringify(start)
    if (!dirty || (await confirmAction(t('rawPath.discard.message'), t('rawPath.discard.title')))) onClose()
  }

  return (
    <Modal
      open
      onClose={dismiss}
      title={t('rawPath.title')}
      width="56rem"
      footer={
        <>
          <Button variant="secondary" onClick={dismiss} data-raw-cancel="">
            {t('rawPath.cancel')}
          </Button>
          <Button
            variant="primary"
            aria-disabled={blockers.length > 0 || propose.isPending}
            onClick={() => {
              setTried(true)
              if (blockers.length === 0 && !propose.isPending) propose.mutate()
            }}
            data-raw-propose=""
          >
            {propose.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('rawPath.propose')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-raw-path-form="">
        <p className="text-xs text-muted-foreground">{t('rawPath.lede')}</p>
        <Field label={t('rawPath.path')} hint={t('rawPath.pathHint')}>
          <Textarea dir="ltr" rows={3} spellCheck={false} className="w-full font-mono text-xs" value={form.path} onChange={(e) => set({ path: e.target.value })} data-raw-path="" />
        </Field>

        <div aria-live="polite" className="flex flex-col gap-2" data-raw-verdict={!input ? 'idle' : check ? (verdict ? (refused ? 'refused' : 'clean') : 'failed') : 'checking'}>
          {input && !check && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('rawPath.checking')}
            </p>
          )}
          {check && !verdict && <ErrorBanner className="p-2" message={failureWords(check.error, t('rawPath.denied'), t('rawPath.checkFailed'))} />}
          {refused && <Refusals refusals={verdict.refusals} />}
          {verdict && !refused && (
            <p className="text-xs text-success-800" data-raw-clean="">
              {t('rawPath.clean')}
            </p>
          )}
          {verdict && <Warnings warnings={verdict.warnings} />}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t('rawPath.message')}>
            <Select value={form.moment} onChange={(e) => set({ moment: e.target.value as RawPathValues['moment'] })} data-raw-moment="">
              {FHIR_MESSAGES.map((m) => (
                <option key={m} value={m}>
                  {t(`insurance-rules:catalog.message.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('rawPath.level')}>
            <Select value={form.level} onChange={(e) => set({ level: e.target.value as RawPathValues['level'] })} data-raw-level="">
              {FHIR_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`insurance-rules:catalog.level.${l}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('rawPath.type')}>
              <Select value={form.type} onChange={(e) => set({ type: e.target.value as FhirFactType })} data-raw-type="">
                {FACT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`insurance-rules:catalog.type.${ty}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('rawPath.cardinality')}>
              <Select value={form.cardinality} onChange={(e) => set({ cardinality: e.target.value as RawPathValues['cardinality'] })} data-raw-cardinality="">
                <option value="single">{t('rawPath.single')}</option>
                <option value="list">{t('rawPath.list')}</option>
              </Select>
            </Field>
          </div>
          <Field label={t('rawPath.system')} className="md:col-span-2">
            <Input dir="ltr" value={form.system} onChange={(e) => set({ system: e.target.value })} data-raw-system="" />
          </Field>
          <Field label={t('rawPath.key')}>
            <Input dir="ltr" value={form.key} onChange={(e) => set({ key: e.target.value })} data-raw-key="" />
          </Field>
          <Field label={t('rawPath.labelEn')}>
            <Input lang="en" dir="ltr" value={form.labelEn} onChange={(e) => set({ labelEn: e.target.value })} data-raw-label-en="" />
          </Field>
          <Field label={t('rawPath.labelAr')}>
            <Input lang="ar" dir="rtl" value={form.labelAr} onChange={(e) => set({ labelAr: e.target.value })} data-raw-label-ar="" />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="w-fit"
              aria-disabled={!canProbe}
              onClick={() => {
                if (!canProbe || !input) return
                setProbing(key)
                prober.current?.edit(input)
              }}
              data-raw-probe-run=""
            >
              {probing === key && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {t('rawPath.probe.run')}
            </Button>
            <span className="text-xs text-muted-foreground">{t('rawPath.probe.hint')}</span>
          </div>
          {probe && !probe.value && <ErrorBanner className="p-2" message={failureWords(probe.error, t('rawPath.denied'), t('rawPath.probe.failed'))} />}
          {probe?.value && <ProbeTable reply={probe.value} />}
        </div>

        {tried && blockers.length > 0 && (
          <ul className="text-xs text-danger-800" role="alert" data-raw-blockers="">
            {blockers.map((b) => (
              <li key={b} data-raw-blocker={b}>
                {t(`rawPath.blocker.${b}`)}
              </li>
            ))}
          </ul>
        )}
        {propose.isError && <ErrorBanner className="p-2" message={failureWords(propose.error, t('rawPath.denied'), t('rawPath.proposeFailed'))} />}
      </div>
    </Modal>
  )
}

/**
 * Raw-FHIRPath mode (oms 695; BackOffice spec 3271, 3262 V4, doors 3282 + 3296). A trained author writes a path with its
 * message, level, type, cardinality, system, key and labels. Compile answers as they type, Probe says who answers it,
 * and Propose sends the row to the proposals inbox; a raw path is never written into a rule.
 *
 * `initial` fills any part of the form when it opens, so whatever finds a path (697's tree) reuses these same checks.
 * The form's state lives only while it is open, so the next opening starts from its own `initial`.
 */
export default function RawPathDialog({ open, initial, onClose }: { open: boolean; initial?: Partial<RawPathValues>; onClose: () => void }) {
  return open ? <DialogBody initial={initial} onClose={onClose} /> : null
}
