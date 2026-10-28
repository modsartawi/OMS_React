import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { loyGroupRefusal } from '@/core/loy-groups/refusal'
import type { LoyGroupDetail } from '@/core/models/loy-groups'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import { groupsApi, loyGroupKey } from './api'
import { GROUP_CODE_MAX, checkGroupCode, normaliseGroupCode } from './group-form'
import RefusalLine from './RefusalLine'

/**
 * Create a loyalty group (oms ticket 630): code, English name, Arabic name. The code is upper-cased as
 * typed and checked against `[A-Z0-9_-]{1,20}` before the round trip; the server is still the authority,
 * and its refusal (bad code, duplicate, name over width) shows inside the dialog, which stays open. On
 * success the user lands on the new group's page.
 *
 * The page mounts this only on a maintain grant.
 */
export default function CreateGroupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation('loy-groups')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [touched, setTouched] = useState(false)

  const create = useMutation({
    mutationFn: () => groupsApi.create({ code, nameEn, nameAr }),
    onSuccess: (group: LoyGroupDetail) => {
      queryClient.setQueryData(loyGroupKey(group.groupId), group)
      void queryClient.invalidateQueries({ queryKey: ['loy', 'groups', 'list'] })
      navigate(`/loy/groups/${encodeURIComponent(group.groupId)}`)
    },
  })

  const reset = () => {
    setCode('')
    setNameEn('')
    setNameAr('')
    setTouched(false)
    create.reset()
  }
  // While the create is in flight the dialog cannot be dismissed (Cancel disabled, Escape and the
  // backdrop ignored): a create that lands after a cancel would still navigate to the new group.
  const close = () => {
    if (create.isPending) return
    reset()
    onClose()
  }

  const problem = checkGroupCode(code)
  const submit = () => {
    setTouched(true)
    if (problem || create.isPending) return
    create.mutate()
  }
  const refusal = create.isError ? loyGroupRefusal(create.error, i18n.language, t('create.failed')) : null

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('create.title')}
      width="30rem"
      footer={
        <>
          <Button variant="text" onClick={close} disabled={create.isPending}>
            {t('create.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={create.isPending} data-loy-group-create-submit="">
            {create.isPending ? t('create.saving') : t('create.submit')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3"
        data-loy-group-create=""
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label={t('create.code.label')} hint={t('create.code.hint', { max: GROUP_CODE_MAX })} error={touched && problem ? t(problem) : undefined}>
          <Input
            value={code}
            onChange={(e) => setCode(normaliseGroupCode(e.target.value))}
            dir="ltr"
            className="font-mono"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            data-loy-group-field="code"
          />
        </Field>
        <Field label={t('fields.nameEn')}>
          <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} lang="en" dir="auto" data-loy-group-field="nameEn" />
        </Field>
        <Field label={t('fields.nameAr')}>
          <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} lang="ar" dir="auto" data-loy-group-field="nameAr" />
        </Field>
        {refusal && (
          <ErrorBanner className="p-3" title={t('create.refused')} message={refusal.message}>
            <RefusalLine code={refusal.code} />
          </ErrorBanner>
        )}
      </form>
    </Modal>
  )
}
