import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import {
  DECLARED_FIELD_SCOPES,
  DECLARED_FIELD_TYPES,
  declaredFieldPath,
  type DeclaredField,
  type DeclaredFieldScope,
  type DeclaredFieldType,
} from '@/core/insurance-rules/guard-formula-guide'
import type { RegistryField } from '@/core/insurance-rules/registry'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { SHEET_BODY } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { addField, fieldsSource, pickableRegistry, registryDeclaration, removeField, type AddFieldProblem } from './fields-block'

/**
 * The Fields drawer (oms 681): the fields the experiment's formulas read, written into the document's `fields` block.
 * Pick a registry field (`GET InsuranceRules/Fields`), or declare a scratch one — key, scope, type. A duplicate key is
 * refused here. A scratch field is only a declaration in this document: nothing is ever posted to the registry.
 */
export default function FieldsDrawer({
  fields,
  registry,
  registryState,
  onChange,
  onClose,
}: {
  fields: readonly DeclaredField[]
  registry: readonly RegistryField[]
  registryState: 'pending' | 'error' | 'success'
  onChange: (fields: DeclaredField[]) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation('insurance-playground')
  const titleId = useId()
  const sources = fieldsSource(fields, registry)
  const pickable = pickableRegistry(registry, fields)
  return (
    <SideSheet onClose={onClose} width="w-[36rem]" aria-labelledby={titleId} data-fields-drawer="">
      <SideSheetHeader titleId={titleId} eyebrow={t('fields.eyebrow')} title={t('fields.title')} hint={t('fields.hint')} closeLabel={t('fields.close')} onClose={onClose} />
      <div className={SHEET_BODY}>
        <section className="flex flex-col gap-1.5" data-fields-declared="">
          <h3 className="text-xs font-semibold text-muted-foreground">{t('fields.declared')}</h3>
          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-fields-none="">
              {t('fields.none')}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {fields.map((f, i) => (
                <li key={f.key} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1" data-declared-field={f.key} data-source={sources[i]}>
                  <code className="text-sm">
                    <Ltr>{declaredFieldPath(f)}</Ltr>
                  </code>
                  <span className="text-xs text-muted-foreground">{t(`fields.typeName.${f.type}`)}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">{t(`fields.source.${sources[i]}`)}</span>
                  <IconButton
                    className="ms-auto"
                    variant="danger"
                    size="compact"
                    label={t('fields.remove', { key: fsi(f.key) })}
                    onClick={() => onChange(removeField(fields, f.key))}
                    data-remove-field={f.key}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-1.5" data-fields-registry="">
          <h3 className="text-xs font-semibold text-muted-foreground">{t('fields.registry')}</h3>
          {registryState === 'pending' ? (
            <p className="text-xs text-muted-foreground">{t('fields.registryLoading')}</p>
          ) : registryState === 'error' ? (
            <p className="text-xs text-danger-800" data-fields-registry-failed="">
              {t('fields.registryFailed')}
            </p>
          ) : pickable.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('fields.registryNone')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {pickable.map((r) => {
                const d = registryDeclaration(r)!
                return (
                  <li key={r.key} className="flex items-center gap-2 px-2 py-1" data-registry-field={r.key}>
                    <span className="flex min-w-0 flex-col">
                      <bdi className="text-sm">{saysIn(r.label, i18n.language)}</bdi>
                      <code className="text-xs text-muted-foreground">
                        <Ltr>{declaredFieldPath(d)}</Ltr>
                      </code>
                    </span>
                    <span className="text-xs text-muted-foreground">{t(`fields.typeName.${d.type}`)}</span>
                    <Button
                      variant="ghost"
                      className="ms-auto"
                      aria-label={t('fields.pick', { key: fsi(r.key) })}
                      onClick={() => {
                        const r2 = addField(fields, d)
                        if (r2.ok) onChange(r2.fields)
                      }}
                      data-pick-field={r.key}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      {t('fields.add')}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <ScratchForm fields={fields} onChange={onChange} />
      </div>
    </SideSheet>
  )
}

/** Declare a scratch field: its key, the scope it is read at and its type. */
function ScratchForm({ fields, onChange }: { fields: readonly DeclaredField[]; onChange: (fields: DeclaredField[]) => void }) {
  const { t } = useTranslation('insurance-playground')
  const id = useId()
  const [key, setKey] = useState('')
  const [scope, setScope] = useState<DeclaredFieldScope>('line')
  const [type, setType] = useState<DeclaredFieldType>('text')
  const [problem, setProblem] = useState<AddFieldProblem | null>(null)
  const add = () => {
    const r = addField(fields, { key, scope, type })
    if (!r.ok) {
      setProblem(r.problem)
      return
    }
    setProblem(null)
    setKey('')
    onChange(r.fields)
  }
  return (
    <section className="flex flex-col gap-2 border-t border-border/60 pt-3" data-fields-scratch="">
      <h3 className="text-xs font-semibold text-muted-foreground">{t('fields.scratch')}</h3>
      <p className="text-xs text-muted-foreground">{t('fields.scratchHint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field
          id={`${id}-key`}
          label={t('fields.key')}
          invalid={problem !== null}
          error={problem ? <span data-scratch-problem={problem}>{t(`fields.problem.${problem}`)}</span> : undefined}
        >
          <Input
            id={`${id}-key`}
            dir="ltr"
            spellCheck={false}
            autoComplete="off"
            className="w-48 font-mono"
            value={key}
            aria-invalid={problem !== null || undefined}
            onChange={(e) => {
              setKey(e.target.value)
              setProblem(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
            data-scratch-key=""
          />
        </Field>
        <Field id={`${id}-scope`} label={t('fields.scope')}>
          <Select id={`${id}-scope`} value={scope} onChange={(e) => setScope(e.target.value as DeclaredFieldScope)} data-scratch-scope="">
            {DECLARED_FIELD_SCOPES.map((s) => (
              <option key={s} value={s}>
                {t(`fields.scopeName.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-type`} label={t('fields.type')}>
          <Select id={`${id}-type`} value={type} onChange={(e) => setType(e.target.value as DeclaredFieldType)} data-scratch-type="">
            {DECLARED_FIELD_TYPES.map((s) => (
              <option key={s} value={s}>
                {t(`fields.typeName.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" onClick={add} data-scratch-add="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('fields.add')}
        </Button>
      </div>
    </section>
  )
}
