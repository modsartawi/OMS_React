import { useState, type FormEvent } from 'react'
import type { CcScope, CcScopeRegion } from '@/core/models/command-center'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import type { CcT } from './lang'

/** The dropdown's value for a narrowing: `chain`, `region:<key>` or `store`. */
const valueOf = (scope: CcScope | 'store'): string =>
  scope === 'store' || scope.kind === 'store' ? 'store' : scope.kind === 'region' ? `region:${scope.region}` : 'chain'

/**
 * The category profile's filter (oms 949): the chain, a region or one pharmacy. The regions are the ones the server's
 * answer offers (`CcCategoryProfile.regions`, ⚠ proposed); a pharmacy is typed by its code and applied. The page moves
 * the URL to the narrowing (`withScope`), so one request narrows every section together.
 */
export default function ScopeFilter({
  scope,
  regions,
  onChange,
  t,
}: {
  scope: CcScope
  regions: readonly CcScopeRegion[]
  onChange: (scope: CcScope) => void
  t: CcT
}) {
  const [pickingStore, setPickingStore] = useState(scope.kind === 'store')
  const [code, setCode] = useState(scope.kind === 'store' ? scope.storeCode : '')
  const choose = (value: string) => {
    if (value === 'store') return setPickingStore(true)
    setPickingStore(false)
    onChange(value.startsWith('region:') ? { kind: 'region', region: value.slice('region:'.length) } : { kind: 'chain' })
  }
  const apply = (event: FormEvent) => {
    event.preventDefault()
    const storeCode = code.trim()
    if (storeCode) onChange({ kind: 'store', storeCode })
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={apply} data-cc-scope={scope.kind}>
      <Field label={t('categoryProfile.scope.label')} className="w-56">
        <Select value={valueOf(pickingStore ? 'store' : scope)} onChange={(e) => choose(e.target.value)}>
          <option value="chain">{t('categoryProfile.scope.chain')}</option>
          {regions.map((r) => (
            <option key={r.region} value={`region:${r.region}`}>
              {fsi(r.name)}
            </option>
          ))}
          <option value="store">{t('categoryProfile.scope.store')}</option>
        </Select>
      </Field>
      {pickingStore && (
        <>
          <Field label={t('categoryProfile.scope.storeCode')} className="w-36">
            <Input value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" className="font-mono" autoComplete="off" />
          </Field>
          <Button type="submit" variant="secondary">
            {t('categoryProfile.scope.apply')}
          </Button>
        </>
      )}
    </form>
  )
}
