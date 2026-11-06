import { useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { TEXTAREA_CONTROL } from '@/core/ui/field-control'
import { chipSegments, FIGURE_TOKEN } from './live-figures'

/**
 * A text block's words with their live figures as chips (spec 819 §E, ticket 829: "figures show as chips, never as
 * raw tokens"). An editable region (no hand-written control): the words are text, each `{panel:figure}` token is an
 * atomic chip (`contenteditable=false`, `data-figure-token`) the caret steps over and Backspace removes whole.
 *
 * The value is the text with its tokens (`./live-figures`' `chipSegments` / `chipsText` round-trip). The DOM is drawn
 * from the value only when the value changes from outside (an undo, a figure inserted, the language): typing keeps
 * the browser's own caret. A token typed or pasted as words becomes a chip at once. `onCaret` reports the caret's
 * offset into the value, so "Insert a live figure" lands where the author was.
 */
export interface FigureChipLabel {
  /** What the chip says: the panel and the figure, as one isolated pair. */
  label: string
  /** The figure names a panel's single value; otherwise it is refused at save, and the chip says so. */
  ok: boolean
}

const ZWSP = '​'

/** The value a node holds: its words, each chip's token, a line break as `\n`. */
function valueOf(node: Node): string {
  let out = ''
  node.childNodes.forEach((n, i) => {
    if (n.nodeType === Node.TEXT_NODE) out += (n.textContent ?? '').split(ZWSP).join('')
    else if (n instanceof HTMLElement) {
      if (n.dataset.figureToken) out += n.dataset.figureToken
      else if (n.tagName === 'BR') out += '\n'
      else out += (i > 0 && (n.tagName === 'DIV' || n.tagName === 'P') ? '\n' : '') + valueOf(n)
    }
  })
  return out
}

function draw(el: HTMLElement, text: string, chipOf: (panel: string, figure: string) => FigureChipLabel) {
  const nodes: Node[] = chipSegments(text).map((s) => {
    if (s.kind === 'text') return document.createTextNode(s.text)
    const { label, ok } = chipOf(s.panel, s.figure)
    const chip = document.createElement('span')
    chip.contentEditable = 'false'
    chip.dataset.figureToken = s.token
    chip.dataset.figureOk = ok ? 'yes' : 'no'
    chip.className = `mx-0.5 inline-flex items-center rounded px-1 text-xs font-medium ${ok ? 'bg-primary-050 text-primary-800' : 'bg-danger-050 text-danger-800'}`
    const bdi = document.createElement('bdi')
    bdi.textContent = label
    chip.append(bdi)
    return chip
  })
  // A caret after a chip at the end needs somewhere to stand.
  if (nodes.length && !(nodes.at(-1) instanceof Text)) nodes.push(document.createTextNode(ZWSP))
  el.replaceChildren(...nodes)
}

/** The caret's offset into the value, or `null` when the caret is not in `el`. */
function caretOf(el: HTMLElement): number | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const r = sel.getRangeAt(0)
  if (!el.contains(r.endContainer)) return null
  const before = document.createRange()
  before.selectNodeContents(el)
  before.setEnd(r.endContainer, r.endOffset)
  const box = document.createElement('div')
  box.append(before.cloneContents())
  return valueOf(box).length
}

/** The caret put at an offset into the value (after a chip it falls inside of). */
function placeCaret(el: HTMLElement, offset: number) {
  const sel = window.getSelection()
  if (!sel) return
  const r = document.createRange()
  let acc = 0
  for (const n of Array.from(el.childNodes)) {
    if (n instanceof Text) {
      const len = (n.textContent ?? '').split(ZWSP).join('').length
      if (offset <= acc + len) {
        r.setStart(n, Math.min(offset - acc, n.length))
        r.collapse(true)
        sel.removeAllRanges()
        sel.addRange(r)
        return
      }
      acc += len
    } else if (n instanceof HTMLElement && n.dataset.figureToken) {
      acc += n.dataset.figureToken.length
      if (offset <= acc) {
        r.setStartAfter(n)
        r.collapse(true)
        sel.removeAllRanges()
        sel.addRange(r)
        return
      }
    }
  }
  r.selectNodeContents(el)
  r.collapse(false)
  sel.removeAllRanges()
  sel.addRange(r)
}

/** Text typed into the selection by hand (a line break, a paste): the browser's own markup never gets in. */
function typeIn(text: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const r = sel.getRangeAt(0)
  r.deleteContents()
  const node = document.createTextNode(text)
  r.insertNode(node)
  r.setStartAfter(node)
  r.collapse(true)
  sel.removeAllRanges()
  sel.addRange(r)
}

export default function FigureTextField({
  value,
  onChange,
  onCaret,
  chipOf,
  chipsKey,
  dir,
  label,
  id,
  ...data
}: {
  value: string
  onChange: (text: string) => void
  onCaret: (offset: number) => void
  chipOf: (panel: string, figure: string) => FigureChipLabel
  /** Changes when the chips' words do (a panel renamed, the language): the chips are drawn again. */
  chipsKey: string
  dir: 'ltr' | 'rtl'
  label: string
  id?: string
} & Record<`data-${string}`, string>) {
  const ref = useRef<HTMLDivElement>(null)
  const drawn = useRef<{ value: string; chips: string } | null>(null)
  const chipFn = useRef(chipOf)
  chipFn.current = chipOf

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || (drawn.current?.value === value && drawn.current.chips === chipsKey)) return
    const focused = document.activeElement === el
    const caret = focused ? caretOf(el) : null
    draw(el, value, chipFn.current)
    drawn.current = { value, chips: chipsKey }
    if (focused) placeCaret(el, caret ?? value.length)
  }, [value, chipsKey])

  const report = () => {
    const el = ref.current
    if (!el) return
    const c = caretOf(el)
    if (c !== null) onCaret(c)
  }
  const changed = () => {
    const el = ref.current
    if (!el) return
    const next = valueOf(el)
    // A token typed or pasted as words is drawn as its chip at once.
    const loose = Array.from(el.childNodes).some((n) => n instanceof Text && new RegExp(FIGURE_TOKEN.source).test(n.textContent ?? ''))
    if (loose) {
      const caret = caretOf(el)
      draw(el, next, chipFn.current)
      placeCaret(el, caret ?? next.length)
    }
    drawn.current = { value: next, chips: chipsKey }
    onChange(next)
    report()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    typeIn('\n')
    changed()
  }
  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    typeIn(e.clipboardData.getData('text/plain'))
    changed()
  }

  return (
    <div
      ref={ref}
      id={id}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      dir={dir}
      className={`${TEXTAREA_CONTROL} min-h-20 w-full whitespace-pre-wrap break-words leading-7`}
      onInput={changed}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onSelect={report}
      onKeyUp={report}
      onMouseUp={report}
      onFocus={report}
      {...data}
    />
  )
}
