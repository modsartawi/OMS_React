import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'

import { apiErrorCode, apiErrorData, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { FORM_FIELD, FORM_INPUT } from '@/core/insurance-rules/parts'
import { IDF_KEY, idfMasterFormApi, storeListsQuery } from './api'
import {
  clashingMasterId,
  formFromMaster,
  masterBody,
  masterFormProblems,
  newMasterForm,
  type IdfMasterForm,
  type IdfMasterFormProblem,
  withKind,
} from './master-form'
import { IDF_TIERS, type IdfTier } from './lookup'
import { IDF_MASTER_KINDS, masterName, type IdfMaster } from './masters'

/**
 * Create or edit an IDF master (BackOffice spec 3157, doors 3161/3162; oms ticket 621). Kind is picked on create
 * and fixed after. An insurer master names a payer and may be scoped to a store list (620's lists); a store master
 * picks a store list. Both names are required; the thresholds default to 4 and 1 and a reminder above the hard one
 * is refused before sending. The help lists the fixed resolution order and marks where this master sits.
 *
 * A refusal stays in the dialog with the input kept: an overlapping scope shows the server's message, its code and
 * the clashing master (from the refusal's `data.clashingMasterId`, named from the list). A bare 403 says "no
 * access" (🚩 UNGATED until 628).
 */
export default function MasterFormDialog({ master, masters, onClose }: { master: IdfMaster | null; masters: IdfMaster[]; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const qc = useQueryClient()
  const lists = useQuery(storeListsQuery())
  const [form, setForm] = useState<IdfMasterForm>(master ? formFromMaster(master) : newMasterForm())
  const [tried, setTried] = useState(false)
  const problems = useMemo(() => masterFormProblems(form), [form])
  const set = <K extends keyof IdfMasterForm>(key: K, value: IdfMasterForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const save = useMutation({
    mutationFn: () => (master ? idfMasterFormApi.edit(master.masterId, masterBody(form)) : idfMasterFormApi.create(masterBody(form))),
    onSuccess: () => {
      notify.success(t(master ? 'masterForm.saved' : 'masterForm.created'), fsi(form.nameEn.trim()))
      void qc.invalidateQueries({ queryKey: IDF_KEY })
      onClose()
    },
  })
  const tier: IdfTier = form.kind === 'store' ? 'operationPharmacy' : form.storeListId ? 'insurerStoreList' : 'insurer'

  return (
    <Modal
      open
      onClose={onClose}
      width="36rem"
      title={t(master ? 'masterForm.editTitle' : 'masterForm.createTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('masterForm.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={save.isPending}
            data-master-save=""
            onClick={() => {
              setTried(true)
              if (Object.keys(problems).length === 0) save.mutate()
            }}
          >
            {t('masterForm.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-master-dialog={master?.masterId ?? 'new'}>
        {save.isError && <Refusal err={save.error} masters={masters} />}
        <fieldset className={FORM_FIELD} disabled={!!master}>
          <legend className="mb-1">{t('masterForm.kind')}</legend>
          <div className="flex flex-wrap gap-3" role="radiogroup">
            {IDF_MASTER_KINDS.map((k) => (
              <label key={k} className="inline-flex items-center gap-1.5 text-sm text-foreground">
                <input type="radio" name="kind" value={k} checked={form.kind === k} onChange={() => setForm((f) => withKind(f, k))} data-kind-option={k} />
                {t(`masters.kind.${k}`)}
              </label>
            ))}
          </div>
          {master && (
            <span className="text-xs font-normal" data-kind-fixed="">
              {t('masterForm.kindFixed')}
            </span>
          )}
        </fieldset>
        {form.kind === 'insurer' && (
          <label className={FORM_FIELD}>
            {t('masterForm.payer')}
            <input
              className={FORM_INPUT}
              dir="ltr"
              value={form.payerCode}
              placeholder={t('masterForm.payerPlaceholder')}
              onChange={(e) => set('payerCode', e.target.value)}
              data-field="payerCode"
            />
            {tried && <Problem problem={problems.payerCode} />}
          </label>
        )}
        <label className={FORM_FIELD}>
          {t('masterForm.storeList')}
          <select className={FORM_INPUT} value={form.storeListId} onChange={(e) => set('storeListId', e.target.value)} data-field="storeListId">
            <option value="">{t(form.kind === 'insurer' ? 'masterForm.storeListOptional' : 'masterForm.pickStoreList')}</option>
            {(lists.data ?? []).map((l) => (
              <option key={l.storeListId} value={l.storeListId}>
                {fsi(l.name)}
              </option>
            ))}
            {/* A list the read did not return (or has not returned yet) still shows as picked. */}
            {form.storeListId && !lists.data?.some((l) => l.storeListId === form.storeListId) && <option value={form.storeListId}>{fsi(form.storeListId)}</option>}
          </select>
          {lists.isError && <span className="text-xs text-danger-800">{t('masterForm.storeListsFailed')}</span>}
          {tried && <Problem problem={problems.storeListId} />}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={FORM_FIELD}>
            {t('masterForm.nameEn')}
            <input className={FORM_INPUT} dir="ltr" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} data-field="nameEn" />
            {tried && <Problem problem={problems.nameEn} />}
          </label>
          <label className={FORM_FIELD}>
            {t('masterForm.nameAr')}
            <input className={FORM_INPUT} dir="rtl" lang="ar" value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} data-field="nameAr" />
            {tried && <Problem problem={problems.nameAr} />}
          </label>
          <label className={FORM_FIELD}>
            {t('masterForm.hard')}
            <input className={FORM_INPUT} dir="ltr" inputMode="numeric" value={form.hard} onChange={(e) => set('hard', e.target.value)} data-field="hard" />
            {tried && <Problem problem={problems.hard} />}
          </label>
          <label className={FORM_FIELD}>
            {t('masterForm.reminder')}
            <input className={FORM_INPUT} dir="ltr" inputMode="numeric" value={form.reminder} onChange={(e) => set('reminder', e.target.value)} data-field="reminder" />
            {tried && <Problem problem={problems.reminder} />}
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t('masterForm.thresholdsHint')}</p>
        <section className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs" data-idf-master-order="">
          <h3 className="font-semibold text-foreground">{t('masterForm.orderTitle')}</h3>
          <p className="mt-1 text-muted-foreground">{t('masterForm.orderHint')}</p>
          <ol className="mt-1 list-decimal ps-5">
            {IDF_TIERS.map((o) => (
              <li key={o} data-tier={o} data-this-one={o === tier ? '' : undefined} className={o === tier ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                {t(`lookup.tier.${o}`)}
                {o === tier && <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-primary">{t('masterForm.thisOne')}</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Modal>
  )
}

function Problem({ problem }: { problem: IdfMasterFormProblem | undefined }) {
  const { t } = useTranslation('insurance-idf')
  if (!problem) return null
  return (
    <span className="text-xs text-danger-800" role="alert" data-problem={problem}>
      {t(`masterForm.problem.${problem}`)}
    </span>
  )
}

/** The save's refusal, kept in the dialog: message, code, and the clashing master when the refusal names one. */
function Refusal({ err, masters }: { err: unknown; masters: IdfMaster[] }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const code = apiErrorCode(err)
  const clashId = clashingMasterId(apiErrorData(err))
  const clash = clashId ? masters.find((m) => m.masterId === clashId) : undefined
  return (
    <div data-idf-master-refusal={code ?? ''}>
      <ErrorBanner className="p-3" title={t('masterForm.refused')} message={isBareDenial(err) ? t('masterForm.denied') : apiErrorMessage(err, t('masterForm.refusedFallback'))}>
        {clashId && (
          <div className="mt-1 text-xs" data-clashing-master={clashId}>
            <Trans t={t} i18nKey="masterForm.clashesWith" values={{ name: clash ? masterName(clash, i18n.language) : clashId, id: clashId }} components={{ n: <bdi />, v: <Ltr /> }} />
          </div>
        )}
        {code && (
          <div className="mt-1 text-xs" data-refusal-code="">
            <Trans t={t} i18nKey="masterForm.refusalCode" values={{ code }} components={{ v: <Ltr /> }} />
          </div>
        )}
      </ErrorBanner>
    </div>
  )
}
