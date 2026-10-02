/* PROTOTYPE 368 — the list's single keys, per 365 §3 + §5. A hand-rolled stand-in
 * for the `@/core/commands` registry the keyboard-layer step builds. */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { c } from './copy'
import { openRecord } from './Grid'
import { deepLink } from './Inspector'
import { selectedRow, step, useProto } from './store'

function typing(el: Element | null): boolean {
  if (!el) return false
  const h = el as HTMLElement
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(h.tagName) || h.isContentEditable) return true
  const role = h.getAttribute('role')
  if (role && ['textbox', 'combobox', 'searchbox'].includes(role)) return true
  return !!h.closest('.ag-cell-inline-editing')
}

export function useListKeys() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A control that already handled the key (Enter-searches in a field) owns it.
      if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return
      if (document.querySelector('dialog[open]')) return
      if (typing(document.activeElement)) return
      const row = selectedRow(useProto.getState())
      switch (e.code) {
        case 'KeyJ':
          e.preventDefault()
          step(1)
          return
        case 'KeyK':
          e.preventDefault()
          step(-1)
          return
        case 'KeyR':
        case 'KeyC':
        case 'KeyN':
          if (e.repeat) return // acts never repeat
          e.preventDefault()
          deepLink(navigate, row, e.code === 'KeyR' ? 'reschedule' : e.code === 'KeyC' ? 'request-close' : 'add-note')
          return
        case 'Slash':
          e.preventDefault()
          if (e.shiftKey) {
            toast.info(c('help'))
            return
          }
          if (!useProto.getState().criteriaOpen) useProto.setState({ criteriaOpen: true })
          setTimeout(() => document.querySelector<HTMLElement>('[data-query-focus], #p368-range')?.focus())
          return
      }
      // Enter opens the current row — but never steals Enter from a button or link.
      if (e.key === 'Enter' && !(document.activeElement as HTMLElement)?.closest('button, a, [role="separator"]')) {
        if (!row) return
        e.preventDefault()
        openRecord(navigate, row)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])
}
