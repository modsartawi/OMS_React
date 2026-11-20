import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import { createWedge, keyedEntry } from './scanner'
import type { EntryMode } from './api'

export interface KeyedCode {
  value: string
  entryMode: Extract<EntryMode, 'typed' | 'wedge'>
  reader: 'wedge' | null
  msToRead: number | null
}

/**
 * A code typed by hand when the camera cannot read a damaged label (spec 4063 story 14), or typed by a hardware
 * scanner (the keyboard wedge): the same field, told apart by how fast it was keyed. Enter or Add sends it.
 */
export default function KeyedCodeField({
  label,
  action,
  disabled,
  onCode,
}: {
  label: string
  action: string
  disabled?: boolean
  onCode: (code: KeyedCode) => void
}) {
  const { t } = useTranslation('mini-pos-phone')
  const [value, setValue] = useState('')
  const wedge = useRef(createWedge())

  const send = (code: KeyedCode) => {
    setValue('')
    onCode(code)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const read = wedge.current.key(e.key, value)
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (read && !disabled) send({ value: read.value, ...keyedEntry(read) })
  }

  const add = () => {
    wedge.current.key('Enter', '') // a click is always typed: forget any half-timed keying
    const trimmed = value.trim()
    if (trimmed) send({ value: trimmed, entryMode: 'typed', reader: null, msToRead: null })
  }

  return (
    <div className="flex items-end gap-2">
      <Field label={label} className="flex-1">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          inputMode="text"
          autoComplete="off"
          enterKeyHint="go"
          dir="ltr"
          className="h-11 font-mono"
        />
      </Field>
      <Button variant="secondary" className="h-11" disabled={disabled || !value.trim()} onClick={add}>
        {action || t('basket.add')}
      </Button>
    </div>
  )
}
