import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { GUARD_DRAFT_KEY, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import BlankLabel from '@/core/insurance-rules/BlankLabel'
import { folderPaths, folderTree } from '@/core/insurance-rules/folders'
import { ConditionTree } from '@/core/insurance-rules/GuardSentenceView'
import { guardEditPath, type GuardRuleset, type Says } from '@/core/insurance-rules/model'
import { guardSentence } from '@/core/insurance-rules/sentence'
import { blankKind, fillTemplate, missingBlanks, valueAt, type BlankValue, type GuardTemplate } from '@/core/insurance-rules/templates'
import { saysIn } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { templatesApi } from './api'

const CONTROL =
  'h-7 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none ' +
  'aria-[invalid=true]:border-danger-border aria-[invalid=true]:bg-danger-050'

/**
 * "Use this template" (609): the template's blanks, typed by their value (words in English and Arabic, an item
 * list of the ruleset, a number, a code), the folder the rule goes in, and the rule as it will read. Create asks
 * HQ to make the draft rule (`POST …/Templates/{id}/Create`) and opens it in the editor. The new rule is
 * independent: editing it never edits the template.
 */
export default function FillDialog({ template, draft, onClose }: { template: GuardTemplate; draft: GuardRuleset; onClose: () => void }) {
  const { t, i18n } = useTranslation('insurance-templates')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, BlankValue>>(() =>
    Object.fromEntries(template.blanks.map((b) => [b.path, structuredClone(valueAt(template.rule, b.path) as BlankValue)])),
  )
  const [folder, setFolder] = useState(template.rule.folder)
  const folders = useMemo(() => folderPaths(folderTree(draft.rules)), [draft.rules])
  const missing = missingBlanks(template, values)
  const preview = useMemo(() => guardSentence(fillTemplate(template, values, { id: '' }), draft.lists), [template, values, draft.lists])
  const set = (path: string, v: BlankValue) => setValues((x) => ({ ...x, [path]: v }))

  const create = useMutation({
    mutationFn: () => templatesApi.create(template.id, values, folder.trim()),
    onSuccess: (rule) => {
      void queryClient.invalidateQueries({ queryKey: GUARD_DRAFT_KEY })
      void queryClient.invalidateQueries({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'list'] })
      notify.success(t('fill.created', { id: fsi(rule.id) }))
      navigate(guardEditPath(rule.id))
    },
    onError: (err) => notify.apiError(t('fill.failed'), err, t('fill.failed')),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={t('fill.title', { name: fsi(saysIn(template.name, i18n.language)) })}
      width="42rem"
      footer={
        <>
          {missing.length > 0 && (
            <span className="me-auto text-xs text-attention-800" data-missing={missing.length}>
              {t('fill.missing', { count: missing.length, n: fsi(String(missing.length)) })}
            </span>
          )}
          <Button variant="text" onClick={onClose} disabled={create.isPending} data-fill-cancel="">
            {t('fill.cancel')}
          </Button>
          <Button variant="primary" onClick={() => create.mutate()} disabled={missing.length > 0 || create.isPending} data-fill-create="">
            {t('fill.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-fill-dialog={template.id}>
        <p className="text-xs text-muted-foreground">{t('fill.lede')}</p>
        {template.blanks.length === 0 && <p className="text-xs text-muted-foreground">{t('fill.noBlanks')}</p>}
        {template.blanks.map((b) => {
          const kind = blankKind(template, b.path)
          const v = values[b.path]
          const empty = missing.includes(b.path)
          return (
            <div key={b.path} className="flex flex-col gap-1 text-xs" data-blank={b.path} data-blank-kind={kind}>
              <span className="font-medium">
                <BlankLabel blank={b} />
              </span>
              {kind === 'says' ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {(['en', 'ar'] as const).map((lang) => (
                    <input
                      key={lang}
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      lang={lang}
                      placeholder={t(`fill.${lang}`)}
                      value={(v as Says)[lang]}
                      onChange={(e) => set(b.path, { ...(v as Says), [lang]: e.target.value })}
                      aria-invalid={(empty && !(v as Says)[lang].trim()) || undefined}
                      className={CONTROL}
                      data-input={`${b.path}.${lang}`}
                    />
                  ))}
                </div>
              ) : kind === 'list' ? (
                <select value={String(v ?? '')} onChange={(e) => set(b.path, e.target.value)} aria-invalid={empty || undefined} className={`${CONTROL} w-64`} data-input={b.path}>
                  <option value="">{t('fill.pickList')}</option>
                  {draft.lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {fsi(saysIn(l.name, i18n.language))}
                    </option>
                  ))}
                </select>
              ) : kind === 'number' ? (
                <input
                  type="number"
                  dir="ltr"
                  value={Number.isFinite(v as number) ? (v as number) : ''}
                  onChange={(e) => set(b.path, e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  aria-invalid={empty || undefined}
                  className={`${CONTROL} w-28 text-end`}
                  data-input={b.path}
                />
              ) : (
                <input dir="ltr" value={String(v ?? '')} onChange={(e) => set(b.path, e.target.value)} aria-invalid={empty || undefined} className={`${CONTROL} w-64 font-mono`} data-input={b.path} />
              )}
            </div>
          )
        })}
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium">{t('fill.folder')}</span>
          <input list="template-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={t('fill.noFolder')} className={`${CONTROL} w-80`} data-input="folder" />
          <datalist id="template-folders">
            {folders.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <section className="rounded-md border border-border/60 bg-muted/40 p-2 text-xs" data-fill-preview="">
          <h3 className="mb-1 font-semibold text-muted-foreground">{t('fill.readsAs')}</h3>
          <ConditionTree nodes={preview.conditions} />
        </section>
      </div>
    </Modal>
  )
}
