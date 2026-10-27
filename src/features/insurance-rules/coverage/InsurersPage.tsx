import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Loader2, Plus, X } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { saysIn } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import IconButton from '@/core/ui/IconButton'
import LeaveGuard from '@/core/ui/LeaveGuard'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { fsi } from '@/core/util/bidi'
import { insurersApi, INSURERS_KEY, settingsKey, settingsLogKey } from './api'
import { BENEFIT_MEANINGS, settingsProblems, type InsurerSettings, type SettingsIssue } from './settings'
import { DeniedCard, Loading } from '@/core/insurance-rules/parts'
import { CodeInput, NumberInput, Select } from '@/core/insurance-rules/controls'

/**
 * Insurance rules ▸ Insurers (oms ticket 617; BackOffice 3144). Each insurer's settings — contract discount,
 * receivable customer, member-id length and format, the benefit-category mapping, days-supply bounds, direct
 * dispense, payer pins per document type — edited as one form and saved whole (`PUT …/Insurers/{payer}/Settings`).
 * Not versioned and not approved: every save is a line in the change log beneath (`GET …/Settings/Log`).
 * `?payer=` is the insurer open. A problem is refused in words before the PUT; HQ refuses again.
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 is "You do not have access".
 */
export default function InsurersPage() {
  const { t, i18n } = useTranslation('insurance-coverage')
  const [params, setParams] = useSearchParams()
  const insurers = useQuery({ queryKey: INSURERS_KEY, queryFn: () => insurersApi.list(), retry: false })
  const payer = params.get('payer') ?? insurers.data?.[0]?.payer ?? null

  let body: ReactNode
  if (insurers.isError && isBareDenial(insurers.error)) body = <DeniedCard ns="insurance-coverage" hook="insurers-denied" />
  else if (insurers.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(insurers.error, t('insurers.failed'))} />
  else if (!insurers.data) body = <Loading text={t('loading')} />
  else
    body = (
      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label={t('insurers.pick')} className="flex flex-col gap-1" data-insurer-list="">
          {insurers.data.map((ins) => (
            <button
              key={ins.payer}
              type="button"
              aria-current={ins.payer === payer || undefined}
              onClick={() => setParams({ payer: ins.payer }, { replace: true })}
              className={`flex flex-col items-start rounded-md border px-3 py-2 text-start text-sm ${ins.payer === payer ? 'border-primary bg-primary-050' : 'border-border bg-card hover:bg-accent'}`}
              data-insurer={ins.payer}
            >
              <bdi className="font-medium">{saysIn(ins.name, i18n.language)}</bdi>
              <code className="font-mono text-xs text-muted-foreground">
                <Ltr>{ins.payer}</Ltr>
              </code>
            </button>
          ))}
        </nav>
        {payer ? <Settings key={payer} payer={payer} /> : <p className="text-sm text-muted-foreground">{t('insurers.none')}</p>}
      </div>
    )

  return (
    <section className="flex w-full max-w-6xl flex-col gap-4" data-insurers-page="">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t('insurers.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('insurers.hint')}</p>
      </header>
      {body}
    </section>
  )
}

function Settings({ payer }: { payer: string }) {
  const { t } = useTranslation('insurance-coverage')
  const settings = useQuery({ queryKey: settingsKey(payer), queryFn: () => insurersApi.settings(payer), retry: false })
  if (settings.isError && isBareDenial(settings.error)) return <DeniedCard ns="insurance-coverage" hook="settings-denied" />
  if (settings.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(settings.error, t('insurers.failed'))} />
  if (!settings.data) return <Loading text={t('loading')} />
  return <SettingsForm saved={settings.data} />
}

function SettingsForm({ saved }: { saved: InsurerSettings }) {
  const { t } = useTranslation('insurance-coverage')
  const queryClient = useQueryClient()
  const [s, setS] = useState(saved)
  useEffect(() => setS(saved), [saved])
  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  const problems = settingsProblems(s)
  const save = useMutation({
    mutationFn: (x: InsurerSettings) => insurersApi.save(x),
    onSuccess: (next) => {
      queryClient.setQueryData(settingsKey(next.payer), next)
      void queryClient.invalidateQueries({ queryKey: settingsLogKey(next.payer) })
      notify.success(t('settings.saved'))
    },
    onError: (err) => notify.apiError(t('settings.saveFailed'), err, t('settings.saveFailed')),
  })
  const has = (p: SettingsIssue['problem'], at?: number) => problems.some((x) => x.problem === p && (at === undefined || x.at === at))
  const busy = save.isPending

  return (
    <div className="flex flex-col gap-4" data-settings={saved.payer}>
      <LeaveGuard dirty={dirty} words={{ title: t('leave.title'), body: t('leave.settingsBody'), stay: t('leave.stay'), go: t('leave.go') }} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t('settings.contract')}>
          <Row label={t('settings.discount')} unit={t('unit.percent')}>
            <NumberInput value={s.fixedDiscountPct} nullable invalid={has('discountRange')} data-input="fixedDiscountPct" onValue={(n) => setS({ ...s, fixedDiscountPct: n })} />
          </Row>
          <Row label={t('settings.receivable')}>
            <CodeInput value={s.receivableCustomer ?? ''} data-input="receivableCustomer" onValue={(v) => setS({ ...s, receivableCustomer: v.trim() ? v : null })} />
          </Row>
        </Card>
        <Card title={t('settings.memberId')}>
          <Row label={t('settings.memberIdLength')} unit={t('unit.characters')}>
            <NumberInput value={s.memberId.length} nullable invalid={has('memberIdLength')} data-input="memberIdLength" onValue={(n) => setS({ ...s, memberId: { ...s.memberId, length: n } })} />
          </Row>
          <Row label={t('settings.memberIdFormat')}>
            <CodeInput
              value={s.memberId.format ?? ''}
              invalid={has('memberIdFormat')}
              className="w-48"
              title={t('settings.memberIdFormatHint')}
              data-input="memberIdFormat"
              onValue={(v) => setS({ ...s, memberId: { ...s.memberId, format: v ? v : null } })}
            />
          </Row>
        </Card>
        <Card title={t('settings.daysSupply')}>
          <Row label={t('settings.daysMin')} unit={t('unit.days')}>
            <NumberInput value={s.daysSupply.min} nullable invalid={has('daysSupplyRange')} data-input="daysMin" onValue={(n) => setS({ ...s, daysSupply: { ...s.daysSupply, min: n } })} />
          </Row>
          <Row label={t('settings.daysMax')} unit={t('unit.days')}>
            <NumberInput value={s.daysSupply.max} nullable invalid={has('daysSupplyRange')} data-input="daysMax" onValue={(n) => setS({ ...s, daysSupply: { ...s.daysSupply, max: n } })} />
          </Row>
        </Card>
        <Card title={t('settings.directDispense')}>
          <label className="inline-flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={s.directDispense.allowed}
              data-input="directDispense"
              onChange={(e) => setS({ ...s, directDispense: { ...s.directDispense, allowed: e.target.checked } })}
            />
            {t('settings.directDispenseAllowed')}
          </label>
          <Row label={t('settings.defaultDayBenefit')} unit={t('unit.sar')}>
            <NumberInput
              value={s.directDispense.defaultDayBenefit}
              nullable
              invalid={has('dayBenefitNegative')}
              data-input="defaultDayBenefit"
              onValue={(n) => setS({ ...s, directDispense: { ...s.directDispense, defaultDayBenefit: n } })}
            />
          </Row>
        </Card>
      </div>

      <Card title={t('settings.benefits')} hint={t('settings.benefitsHint')}>
        <table className="w-full text-sm" data-benefit-table="">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-medium">{t('settings.benefitCode')}</th>
              <th className="py-1 text-start font-medium">{t('settings.benefitMeaning')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.benefitCategories.map((b, i) => (
              <tr key={i} data-benefit-row={i}>
                <td className="py-1 pe-2">
                  <CodeInput
                    value={b.code}
                    invalid={has('benefitCodeMissing', i) || has('benefitCodeTwice', i)}
                    className="w-24"
                    aria-label={t('settings.benefitCode')}
                    data-input="benefitCode"
                    onValue={(v) => setS({ ...s, benefitCategories: s.benefitCategories.map((x, j) => (j === i ? { ...x, code: v } : x)) })}
                  />
                </td>
                <td className="py-1 pe-2">
                  <Select
                    value={b.meaning}
                    aria-label={t('settings.benefitMeaning')}
                    data-input="benefitMeaning"
                    onChange={(e) => setS({ ...s, benefitCategories: s.benefitCategories.map((x, j) => (j === i ? { ...x, meaning: e.target.value } : x)) })}
                  >
                    {!(BENEFIT_MEANINGS as readonly string[]).includes(b.meaning) && <option value={b.meaning}>{fsi(b.meaning)}</option>}
                    {BENEFIT_MEANINGS.map((m) => (
                      <option key={m} value={m}>
                        {t(`meaning.${m}`)}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="py-1 text-end">
                  <RemoveRow label={t('settings.removeRow')} hook={`benefit-${i}`} onClick={() => setS({ ...s, benefitCategories: s.benefitCategories.filter((_, j) => j !== i) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button variant="text" className="w-fit" onClick={() => setS({ ...s, benefitCategories: [...s.benefitCategories, { code: '', meaning: 'genericCopay' }] })} data-add-benefit="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('settings.addBenefit')}
        </Button>
      </Card>

      <Card title={t('settings.pins')} hint={t('settings.pinsHint')}>
        <table className="w-full text-sm" data-pin-table="">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-medium">{t('settings.documentType')}</th>
              <th className="py-1 text-start font-medium">{t('settings.pinPayer')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.payerPins.map((p, i) => (
              <tr key={i} data-pin-row={i}>
                <td className="py-1 pe-2">
                  <CodeInput
                    value={p.documentType}
                    invalid={has('pinDocumentTypeMissing', i) || has('pinDocumentTypeTwice', i)}
                    className="w-28"
                    aria-label={t('settings.documentType')}
                    data-input="documentType"
                    onValue={(v) => setS({ ...s, payerPins: s.payerPins.map((x, j) => (j === i ? { ...x, documentType: v } : x)) })}
                  />
                </td>
                <td className="py-1 pe-2">
                  <CodeInput
                    value={p.payer}
                    invalid={has('pinPayerMissing', i)}
                    className="w-28"
                    aria-label={t('settings.pinPayer')}
                    data-input="pinPayer"
                    onValue={(v) => setS({ ...s, payerPins: s.payerPins.map((x, j) => (j === i ? { ...x, payer: v } : x)) })}
                  />
                </td>
                <td className="py-1 text-end">
                  <RemoveRow label={t('settings.removeRow')} hook={`pin-${i}`} onClick={() => setS({ ...s, payerPins: s.payerPins.filter((_, j) => j !== i) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button variant="text" className="w-fit" onClick={() => setS({ ...s, payerPins: [...s.payerPins, { documentType: '', payer: '' }] })} data-add-pin="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('settings.addPin')}
        </Button>
      </Card>

      {problems.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-danger-800" data-settings-problems="" role="alert">
          {problems.map((p, i) => (
            <li key={i} data-problem={p.problem}>
              {p.at === undefined ? t(`problem.${p.problem}`) : t('problem.onRow', { problem: t(`problem.${p.problem}`), row: fsi(String(p.at + 1)) })}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <Button variant="text" onClick={() => setS(saved)} disabled={!dirty || busy} data-settings-cancel="">
          {t('settings.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => !problems.length && save.mutate(s)}
          disabled={!dirty || busy}
          aria-disabled={problems.length > 0 || undefined}
          title={problems.length ? t('settings.fixFirst') : undefined}
          data-settings-save=""
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t('settings.save')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('settings.notVersioned')}</span>
      </div>

      <SettingsLog payer={saved.payer} />
    </div>
  )
}

function SettingsLog({ payer }: { payer: string }) {
  const { t } = useTranslation('insurance-coverage')
  const log = useQuery({ queryKey: settingsLogKey(payer), queryFn: () => insurersApi.log(payer), retry: false })
  return (
    <Card title={t('log.title')}>
      {log.isError ? (
        isBareDenial(log.error) ? (
          <p className="text-sm text-muted-foreground">{t('access.deniedTitle')}</p>
        ) : (
          <ErrorBanner className="p-2" message={apiErrorMessage(log.error, t('log.failed'))} />
        )
      ) : !log.data ? (
        <Loading text={t('loading')} />
      ) : log.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-log-empty="">
          {t('log.empty')}
        </p>
      ) : (
        <table className="w-full text-sm" data-settings-log="">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-medium">{t('log.at')}</th>
              <th className="py-1 text-start font-medium">{t('log.by')}</th>
              <th className="py-1 text-start font-medium">{t('log.changes')}</th>
            </tr>
          </thead>
          <tbody>
            {log.data.map((row, i) => (
              <tr key={i} className="border-t border-border/60 align-top" data-log-row={i}>
                <td className="py-1 pe-3 whitespace-nowrap" data-log-at="">
                  <Ltr>{formatDateTime(row.at)}</Ltr>
                </td>
                <td className="py-1 pe-3" data-log-by="">
                  <Ltr>{row.by}</Ltr>
                </td>
                <td className="py-1">
                  <ul className="flex flex-col gap-0.5">
                    {row.changes.map((c, j) => (
                      <li key={j} data-log-change={c.field}>
                        <code className="font-mono text-xs">
                          <Ltr>{c.field}</Ltr>
                        </code>{' '}
                        <span className="text-muted-foreground">{t('log.from')}</span> <LogValue v={c.from} /> <span className="text-muted-foreground">{t('log.to')}</span>{' '}
                        <LogValue v={c.to} />
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

function LogValue({ v }: { v: string | null }) {
  const { t } = useTranslation('insurance-coverage')
  return v === null ? <span className="text-muted-foreground">{t('log.none')}</span> : <Ltr>{v}</Ltr>
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

function Row({ label, unit, children }: { label: string; unit?: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="w-48 text-muted-foreground">{label}</span>
      {children}
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </label>
  )
}

function RemoveRow({ label, hook, onClick }: { label: string; hook: string; onClick: () => void }) {
  return (
    <IconButton label={label} variant="danger" size="compact" onClick={onClick} data-remove-row={hook}>
      <X className="h-3.5 w-3.5" aria-hidden />
    </IconButton>
  )
}
