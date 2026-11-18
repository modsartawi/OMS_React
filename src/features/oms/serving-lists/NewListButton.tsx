import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { canEditServingLists } from '@/core/serving-list/access'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import NameDialog from './NameDialog'

/**
 * "New list" on the lists page (oms ticket 570, BackOffice spec 3042 story 29) — only for an Execute holder
 * (`canEditServingLists`, the same cached probe the page's gate reads). The created list opens.
 */
export default function NewListButton() {
  const { t } = useTranslation('serving-lists')
  const permissions = usePermissions()
  const [open, setOpen] = useState(false)
  if (!canEditServingLists(permissions)) return null
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} data-action="create">
        <Plus className="h-3 w-3" aria-hidden />
        {t('writes.create.button')}
      </Button>
      {open && <NameDialog onClose={() => setOpen(false)} />}
    </>
  )
}
