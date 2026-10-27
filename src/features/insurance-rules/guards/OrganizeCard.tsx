import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BookmarkPlus, FolderInput } from 'lucide-react'

import { GUARD_DRAFT_KEY } from '@/core/insurance-rules/api'
import BlankLabel from '@/core/insurance-rules/BlankLabel'
import { folderPaths, folderTree } from '@/core/insurance-rules/folders'
import type { GuardRule } from '@/core/insurance-rules/model'
import { GUARD_TEMPLATES_KEY, blankCandidates, type BlankValue } from '@/core/insurance-rules/templates'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { GUARDS_KEY, GUARD_FOLDERS_KEY, guardFoldersApi, guardFoldersQuery } from './api'

/**
 * The rule page's Organize card (609): move the rule to a folder (`PUT …/Folders { rules, to }`, authoring
 * only, no approval) and save it as a team template, choosing which of its values become blanks
 * (`POST …/Templates { ruleId, name, blanks }`).
 */
export default function OrganizeCard({ rule, rules }: { rule: GuardRule; rules: readonly GuardRule[] }) {
  const { t } = useTranslation('insurance-guards')
  const queryClient = useQueryClient()
  const kept = useQuery(guardFoldersQuery()).data
  const paths = useMemo(() => folderPaths(folderTree(rules, kept ?? [])), [rules, kept])
  const [to, setTo] = useState(rule.folder)
  const [saving, setSaving] = useState(false)

  const move = useMutation({
    mutationFn: (folder: string) => guardFoldersApi.move([rule.id], folder).then(() => folder),
    onSuccess: (folder) => {
      for (const queryKey of [GUARD_DRAFT_KEY, GUARDS_KEY, GUARD_FOLDERS_KEY]) void queryClient.invalidateQueries({ queryKey })
      notify.success(folder ? t('organize.moved', { folder: fsi(folder) }) : t('organize.movedOut'))
    },
    onError: (err) => notify.apiError(t('organize.moveFailed'), err, t('organize.moveFailed')),
  })

  return (
    <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-3 text-sm" data-organize="">
      <h2 className="w-full text-xs font-semibold text-muted-foreground">{t('organize.title')}</h2>
      <Field label={t('organize.folder')}>
        <Select value={to} onChange={(e) => setTo(e.target.value)} className="min-w-56" data-input="move-to">
          <option value="">{t('organize.noFolder')}</option>
          {paths.map((p) => (
            <option key={p} value={p}>
              {fsi(p)}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="secondary" onClick={() => move.mutate(to)} disabled={to === rule.folder || move.isPending} data-move="">
        <FolderInput className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
        {t('organize.move')}
      </Button>
      <Button variant="secondary" className="ms-auto" onClick={() => setSaving(true)} data-save-template="">
        <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
        {t('organize.saveTemplate')}
      </Button>
      {saving && (
        <SaveTemplateDialog
          rule={rule}
          onClose={() => setSaving(false)}
          onSaved={() => {
            setSaving(false)
            void queryClient.invalidateQueries({ queryKey: GUARD_TEMPLATES_KEY })
          }}
        />
      )}
    </section>
  )
}

/** A value of the rule as it reads now: a number or code LTR, words in both languages. */
function CandidateValue({ value }: { value: BlankValue }) {
  if (typeof value === 'object')
    return (
      <span className="flex flex-col text-xs">
        <bdi lang="en">{value.en}</bdi>
        <bdi dir="rtl" lang="ar">
          {value.ar}
        </bdi>
      </span>
    )
  return (
    <code className="font-mono text-xs">
      <Ltr>{String(value)}</Ltr>
    </code>
  )
}

function SaveTemplateDialog({ rule, onClose, onSaved }: { rule: GuardRule; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('insurance-guards')
  const candidates = useMemo(() => blankCandidates(rule), [rule])
  const [name, setName] = useState({ en: rule.name.en, ar: rule.name.ar })
  const [blanks, setBlanks] = useState<string[]>([])
  const save = useMutation({
    mutationFn: () => guardFoldersApi.saveAsTemplate({ ruleId: rule.id, name, blanks: candidates.map((c) => c.path).filter((p) => blanks.includes(p)) }),
    onSuccess: () => {
      notify.success(t('saveTemplate.saved', { name: fsi(name.en) }))
      onSaved()
    },
    onError: (err) => notify.apiError(t('saveTemplate.failed'), err, t('saveTemplate.failed')),
  })
  const named = name.en.trim() !== '' && name.ar.trim() !== ''
  const toggle = (path: string) => setBlanks((b) => (b.includes(path) ? b.filter((x) => x !== path) : [...b, path]))

  return (
    <Modal
      open
      onClose={onClose}
      title={t('saveTemplate.title')}
      width="40rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={save.isPending} data-save-template-cancel="">
            {t('editor.cancel')}
          </Button>
          <Button variant="primary" onClick={() => save.mutate()} disabled={!named || save.isPending} data-save-template-confirm="">
            {t('saveTemplate.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-save-template-dialog="">
        <p className="text-xs text-muted-foreground">{t('saveTemplate.lede')}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <Field label={t('saveTemplate.nameEn')}>
            <Input dir="ltr" lang="en" value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} data-input="template-name.en" />
          </Field>
          <Field label={t('saveTemplate.nameAr')}>
            <Input dir="rtl" lang="ar" value={name.ar} onChange={(e) => setName({ ...name, ar: e.target.value })} data-input="template-name.ar" />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1" data-blank-candidates="">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t('saveTemplate.blanks')}</legend>
          {candidates.map((c) => (
            <label key={c.path} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted" data-candidate={c.path}>
              <input type="checkbox" className="mt-1" checked={blanks.includes(c.path)} onChange={() => toggle(c.path)} data-blank-toggle={c.path} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <BlankLabel blank={{ path: c.path }} />
                <CandidateValue value={c.value} />
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground" data-blank-count={blanks.length}>
          {t('saveTemplate.chosen', { count: blanks.length, n: fsi(String(blanks.length)) })}
        </p>
      </div>
    </Modal>
  )
}
