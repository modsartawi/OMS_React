import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Loader2, Plus, X } from 'lucide-react'

import { apiErrorCode, apiErrorDetails, apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import UiField from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import LeaveGuard from '@/core/ui/LeaveGuard'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { INSURER_SETTINGS_NOT_FOUND, insurersApi, INSURERS_KEY, settingsKey, settingsLogKey } from './api'
import {
  BENEFIT_MEANINGS,
  BENEFIT_SOURCES,
  ESTATE_DEFAULT,
  blankSettings,
  settingsChanges,
  settingsProblems,
  type BenefitSource,
  type InsurerSettings,
  type SettingsIssue,
} from './settings'
import { DeniedCard, Loading } from '@/core/insurance-rules/parts'
import { CodeInput, NumberInput, Select } from '@/core/insurance-rules/controls'

/**
 * Insurance rules ▸ Insurers (oms ticket 617; BackOffice 3144 as built). Every insurer's settings row
 * (`GET InsuranceRules/Insurers`, the estate default `*` first) — contract discount, receivable customer, insurance
 * coupon, member-id lengths and pattern, days-supply bounds and default, dispensing switches, the benefit-category
 * mapping, payer pins — edited as one form and saved whole with a note (`PUT …/Insurers/{payer}/Settings`, which also
 * creates a new insurer's row). Not versioned and not approved: every save is a line in the change log beneath.
 * An insurer's 0 or empty value inherits the `*` row. `?payer=` is the insurer open (its SAP customer id).
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 is "You do not have access".
 */
export default function InsurersPage() {
  const { t } = useTranslation('insurance-coverage')
  const [params, setParams] = useSearchParams()
  const insurers = useQuery({ queryKey: INSURERS_KEY, queryFn: () => insurersApi.list(), retry: false })
  const rows = [...(insurers.data ?? [])].sort((a, b) => (a.payer === ESTATE_DEFAULT ? -1 : b.payer === ESTATE_DEFAULT ? 1 : a.payer.localeCompare(b.payer)))
  const payer = params.get('payer') ?? rows[0]?.payer ?? null
  const [typed, setTyped] = useState('')
  const openPayer = (p: string) => setParams({ payer: p }, { replace: true })

  let body: ReactNode
  if (insurers.isError && isBareDenial(insurers.error)) body = <DeniedCard ns="insurance-coverage" hook="insurers-denied" />
  else if (insurers.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(insurers.error, t('insurers.failed'))} />
  else if (!insurers.data) body = <Loading text={t('loading')} />
  else
    body = (
      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <nav aria-label={t('insurers.pick')} className="flex flex-col gap-1" data-insurer-list="">
            {rows.map((ins) => (
              <button
                key={ins.payer}
                type="button"
                aria-current={ins.payer === payer || undefined}
                onClick={() => openPayer(ins.payer)}
                className={`flex flex-col items-start rounded-md border px-3 py-2 text-start text-sm ${ins.payer === payer ? 'border-primary bg-primary-050' : 'border-border bg-card hover:bg-accent'}`}
                data-insurer={ins.payer}
              >
                {ins.payer === ESTATE_DEFAULT ? (
                  <span className="font-medium">{t('insurers.estateDefault')}</span>
                ) : (
                  <code className="font-mono font-medium">
                    <Ltr>{ins.payer}</Ltr>
                  </code>
                )}
                {ins.payer !== ESTATE_DEFAULT && ins.hasFixedDiscount && (
                  <span className="text-xs text-muted-foreground">
                    {t('insurers.discount')} <Ltr>{formatNumber(ins.fixedDiscountPct)}</Ltr>
                    {t('unit.percent')}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <form
            className="flex items-end gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (typed.trim()) openPayer(typed.trim())
              setTyped('')
            }}
            data-open-insurer=""
          >
            <UiField label={t('insurers.openOther')}>
              <Input dir="ltr" className="w-full font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('insurers.customerId')} data-input="openPayer" />
            </UiField>
            <Button type="submit" variant="secondary" disabled={!typed.trim()} data-open-insurer-go="">
              {t('insurers.open')}
            </Button>
          </form>
        </div>
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
  if (settings.isError && apiErrorCode(settings.error) === INSURER_SETTINGS_NOT_FOUND) return <SettingsForm saved={blankSettings(payer)} isNew />
  if (settings.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(settings.error, t('insurers.failed'))} />
  if (!settings.data) return <Loading text={t('loading')} />
  return <SettingsForm saved={settings.data} isNew={false} />
}

/** The settings as the form compares them: the stamp and the note are not edits. */
const comparable = (s: InsurerSettings) => JSON.stringify({ ...s, note: undefined, updatedBy: undefined, updatedAt: undefined })

function SettingsForm({ saved, isNew }: { saved: InsurerSettings; isNew: boolean }) {
  const { t } = useTranslation('insurance-coverage')
  const queryClient = useQueryClient()
  const [s, setS] = useState(saved)
  const [note, setNote] = useState('')
  useEffect(() => setS(saved), [saved])
  const dirty = isNew || comparable(s) !== comparable(saved)
  const problems = settingsProblems(s)
  const save = useMutation({
    mutationFn: (x: InsurerSettings) => insurersApi.save(x),
    onSuccess: (next) => {
      setNote('')
      queryClient.setQueryData(settingsKey(next.payer), next)
      void queryClient.invalidateQueries({ queryKey: settingsLogKey(next.payer) })
      void queryClient.invalidateQueries({ queryKey: INSURERS_KEY, exact: true })
      notify.success(t('settings.saved'))
    },
  })
  const has = (p: SettingsIssue['problem'], at?: number) => problems.some((x) => x.problem === p && (at === undefined || x.at === at))
  const busy = save.isPending
  const estate = saved.payer === ESTATE_DEFAULT
  const set = (patch: Partial<InsurerSettings>) => setS({ ...s, ...patch })

  return (
    <div className="flex flex-col gap-4" data-settings={saved.payer}>
      <LeaveGuard dirty={dirty && !isNew} words={{ title: t('leave.title'), body: t('leave.settingsBody'), stay: t('leave.stay'), go: t('leave.go') }} />
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-base font-semibold">{estate ? t('insurers.estateDefault') : <Ltr>{saved.payer}</Ltr>}</h2>
        {saved.updatedBy && (
          <span className="text-xs text-muted-foreground" data-settings-stamp="">
            {t('settings.updated')} <ByAt by={saved.updatedBy} at={saved.updatedAt} />
          </span>
        )}
      </div>
      {isNew && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground" data-settings-new="">
          {t('settings.isNew')}
        </p>
      )}
      <p className="text-xs text-muted-foreground" data-inherit-hint="">
        {t(estate ? 'settings.estateHint' : 'settings.inheritHint')}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={t('settings.contract')}>
          <Check label={t('settings.hasFixedDiscount')} checked={s.hasFixedDiscount} hook="hasFixedDiscount" onChange={(v) => set({ hasFixedDiscount: v })} />
          <Row label={t('settings.discount')} unit={t('unit.percent')}>
            <NumberInput value={s.fixedDiscountPct} invalid={has('discountRange')} data-input="fixedDiscountPct" onValue={(n) => set({ fixedDiscountPct: n })} />
          </Row>
          <Row label={t('settings.receivable')}>
            <CodeInput value={s.receivableCustomer ?? ''} data-input="receivableCustomer" onValue={(v) => set({ receivableCustomer: v.trim() ? v : null })} />
          </Row>
          <Check label={t('settings.createsInsuranceCoupon')} checked={s.createsInsuranceCoupon} hook="createsInsuranceCoupon" onChange={(v) => set({ createsInsuranceCoupon: v })} />
        </Card>
        <Card title={t('settings.memberId')}>
          <Row label={t('settings.minLength')} unit={t('unit.characters')}>
            <NumberInput value={s.memberId.minLength} invalid={has('memberIdLength')} data-input="minLength" onValue={(n) => set({ memberId: { ...s.memberId, minLength: n } })} />
          </Row>
          <Row label={t('settings.maxLength')} unit={t('unit.characters')}>
            <NumberInput value={s.memberId.maxLength} invalid={has('memberIdLength')} data-input="maxLength" onValue={(n) => set({ memberId: { ...s.memberId, maxLength: n } })} />
          </Row>
          <Row label={t('settings.pattern')}>
            <CodeInput
              value={s.memberId.pattern ?? ''}
              invalid={has('memberIdPattern')}
              className="w-48"
              title={t('settings.patternHint')}
              data-input="pattern"
              onValue={(v) => set({ memberId: { ...s.memberId, pattern: v ? v : null } })}
            />
          </Row>
        </Card>
        <Card title={t('settings.daysSupply')}>
          <Row label={t('settings.daysMin')} unit={t('unit.days')}>
            <NumberInput value={s.daysSupply.min} invalid={has('daysSupplyRange')} data-input="daysMin" onValue={(n) => set({ daysSupply: { ...s.daysSupply, min: n } })} />
          </Row>
          <Row label={t('settings.daysMax')} unit={t('unit.days')}>
            <NumberInput value={s.daysSupply.max} invalid={has('daysSupplyRange')} data-input="daysMax" onValue={(n) => set({ daysSupply: { ...s.daysSupply, max: n } })} />
          </Row>
          <Row label={t('settings.daysDefault')} unit={t('unit.days')}>
            <NumberInput value={s.daysSupply.default} invalid={has('daysSupplyDefault')} data-input="daysDefault" onValue={(n) => set({ daysSupply: { ...s.daysSupply, default: n } })} />
          </Row>
        </Card>
        <Card title={t('settings.dispensing')}>
          <Check label={t('settings.directDispense')} checked={s.directDispense} hook="directDispense" onChange={(v) => set({ directDispense: v })} />
          <Check label={t('settings.fullQuantityReturnsOnly')} checked={s.fullQuantityReturnsOnly} hook="fullQuantityReturnsOnly" onChange={(v) => set({ fullQuantityReturnsOnly: v })} />
          <Check label={t('settings.brandMaxWhenZero')} checked={s.brandMaxWhenZero} hook="brandMaxWhenZero" onChange={(v) => set({ brandMaxWhenZero: v })} />
        </Card>
      </div>

      <Card title={t('settings.benefits')} hint={t('settings.benefitsHint')}>
        <table className="w-full text-sm" data-benefit-table="">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-start font-medium">{t('settings.benefitSource')}</th>
              <th className="py-1 text-start font-medium">{t('settings.benefitCode')}</th>
              <th className="py-1 text-start font-medium">{t('settings.benefitMeaning')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.benefitCategories.map((b, i) => {
              const put = (patch: Partial<InsurerSettings['benefitCategories'][number]>) => set({ benefitCategories: s.benefitCategories.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
              return (
                <tr key={i} data-benefit-row={i}>
                  <td className="py-1 pe-2">
                    <Select value={b.source} aria-label={t('settings.benefitSource')} data-input="benefitSource" onChange={(e) => put({ source: e.target.value as BenefitSource })}>
                      {BENEFIT_SOURCES.map((src) => (
                        <option key={src} value={src}>
                          {t(`source.${src}`)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-1 pe-2">
                    <CodeInput
                      value={b.code}
                      invalid={has('benefitCodeMissing', i) || has('benefitCodeTwice', i)}
                      className="w-28"
                      aria-label={t('settings.benefitCode')}
                      data-input="benefitCode"
                      onValue={(v) => put({ code: v })}
                    />
                  </td>
                  <td className="py-1 pe-2">
                    <Select value={b.meaning} aria-label={t('settings.benefitMeaning')} data-input="benefitMeaning" onChange={(e) => put({ meaning: e.target.value })}>
                      {!(BENEFIT_MEANINGS as readonly string[]).includes(b.meaning) && <option value={b.meaning}>{fsi(b.meaning)}</option>}
                      {BENEFIT_MEANINGS.map((m) => (
                        <option key={m} value={m}>
                          {t(`meaning.${m}`)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-1 text-end">
                    <RemoveRow label={t('settings.removeRow')} hook={`benefit-${i}`} onClick={() => set({ benefitCategories: s.benefitCategories.filter((_, j) => j !== i) })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <Button variant="text" className="w-fit" onClick={() => set({ benefitCategories: [...s.benefitCategories, { source: 'benefit', code: '', meaning: 'genericCopay' }] })} data-add-benefit="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('settings.addBenefit')}
        </Button>
      </Card>

      <Card title={t('settings.pins')} hint={t('settings.pinsHint')}>
        <ul className="flex flex-col gap-1" data-pin-table="">
          {s.payerPins.map((p, i) => (
            <li key={i} className="flex items-center gap-2" data-pin-row={i}>
              <Input
                dir="auto"
                value={p}
                aria-invalid={has('pinMissing', i) || has('pinTwice', i) || undefined}
                className="w-56"
                aria-label={t('settings.pin')}
                data-input="pin"
                onChange={(e) => set({ payerPins: s.payerPins.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <RemoveRow label={t('settings.removeRow')} hook={`pin-${i}`} onClick={() => set({ payerPins: s.payerPins.filter((_, j) => j !== i) })} />
            </li>
          ))}
        </ul>
        <Button variant="text" className="w-fit" onClick={() => set({ payerPins: [...s.payerPins, ''] })} data-add-pin="">
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
      {save.isError && (
        <div data-settings-refused="">
          <ErrorBanner message={apiErrorMessage(save.error, t('settings.saveFailed'))}>
            {apiErrorDetails(save.error).length > 0 && (
              <ul className="mt-1 list-disc ps-5 text-sm">
                {apiErrorDetails(save.error).map((d, i) => (
                  <li key={i}>
                    <bdi>{d}</bdi>
                  </li>
                ))}
              </ul>
            )}
          </ErrorBanner>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <UiField label={t('settings.note')}>
          <Input dir="auto" className="w-72" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('settings.notePlaceholder')} data-input="note" />
        </UiField>
        <Button variant="text" onClick={() => setS(saved)} disabled={!dirty || busy || isNew} data-settings-cancel="">
          {t('settings.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => !problems.length && save.mutate({ ...s, note: note.trim() || null })}
          disabled={!dirty || busy}
          aria-disabled={problems.length > 0 || undefined}
          title={problems.length ? t('settings.fixFirst') : undefined}
          data-settings-save=""
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t(isNew ? 'settings.create' : 'settings.save')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('settings.notVersioned')}</span>
      </div>

      {!isNew && <SettingsLog payer={saved.payer} />}
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
              <th className="py-1 text-start font-medium">{t('log.byAt')}</th>
              <th className="py-1 text-start font-medium">{t('log.note')}</th>
              <th className="py-1 text-start font-medium">{t('log.changes')}</th>
            </tr>
          </thead>
          <tbody>
            {log.data.map((row, i) => (
              <tr key={row.changeId} className="border-t border-border/60 align-top" data-log-row={i} data-change-id={row.changeId}>
                <td className="py-1 pe-3 whitespace-nowrap" data-log-by="">
                  <ByAt by={row.changedBy} at={row.changedAt} />
                </td>
                <td className="py-1 pe-3" data-log-note="">
                  {row.note ? <bdi>{row.note}</bdi> : <span className="text-muted-foreground">{t('log.noNote')}</span>}
                </td>
                <td className="py-1">
                  {row.before === null && (
                    <p className="text-xs text-muted-foreground" data-log-created="">
                      {t('log.created')}
                    </p>
                  )}
                  <ul className="flex flex-col gap-0.5">
                    {settingsChanges(row.before, row.after).map((c) => (
                      <li key={c.field} data-log-change={c.field}>
                        <code className="font-mono text-xs">
                          <Ltr>{c.field}</Ltr>
                        </code>{' '}
                        <span className="text-muted-foreground">{t('log.from')}</span> <LogValue v={c.from} /> <span className="text-muted-foreground">{t('log.to')}</span> <LogValue v={c.to} />
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

function Check({ label, checked, hook, onChange }: { label: string; checked: boolean; hook: string; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input type="checkbox" checked={checked} data-input={hook} onChange={(e) => onChange(e.target.checked)} />
      {label}
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
