import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import type { ServingListRow } from '@/core/models/serving-list'
import Button from '@/core/ui/Button'
import AddStoresDialog from './AddStoresDialog'

export interface MembersToolbarProps {
  servingListId: string
  /** The list's row; undefined while it loads or when the id is unknown. */
  list: ServingListRow | undefined
  /** `canEditServingLists`. */
  canEdit: boolean
}

/**
 * The Members tab's toolbar, at the end of the filter bar (oms ticket 569): "Add stores", shown only to an
 * Execute 06 holder (`canEditServingLists`) and only once the list's row is known — a list missing from the
 * Lists read is the Members door's `SVL-00001`, with nothing to add to.
 */
export default function MembersToolbar({ list, canEdit }: MembersToolbarProps) {
  const { t } = useTranslation('serving-lists')
  const [open, setOpen] = useState(false)
  if (!canEdit || !list) return null
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} data-add-stores="">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t('addStores.button')}
      </Button>
      {open && <AddStoresDialog list={list} onClose={() => setOpen(false)} />}
    </>
  )
}
