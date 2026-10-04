/**
 * The order header, said as a sentence over a ledger (spec 380 C3–C6, ticket 408; 373's
 * variant D). It replaces the chip row and draws from the same pure model —
 * `header-sentence.ts` re-reads `header-chips.ts` — so every slot's state is still the
 * server's `submitBlockers`, and only the rendering changed.
 *
 * - **Line 1** is what the agent says to the caller, one `callcenter` key per mode with
 *   named slot tags, rendered by `<Trans components>`: the translation owns the word
 *   order, and DOM order — so Tab order — follows it.
 * - **Line 2** is the agent's bookkeeping, as labelled fields.
 * - **Under them**, said once: a shut gate's reason, a lapsed window, and the address a
 *   collection order keeps (176, moved here from the retired customer rail by 409).
 *
 * 🚩 **Every word opens today's in-flow section** (175 §9), never a popover. Words are
 * native buttons: Tab moves between them, Enter or Space opens the section, and the
 * section (`ChipSection`) takes focus in and gives it back to the word on Esc.
 *
 * The `data-cc-chip*` handles are the drives' names for these places from the chip row
 * this replaces; they are kept so 159/173/175/176/183/194's drives still find them.
 */
import type { ReactElement } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { capabilityGate, isPickup } from './fulfilment-view'
import type { HeaderSlotId } from './header-chips'
import { headerSentence, SENTENCE_KEY, wordTag, type HeaderWord, type WordLook } from './header-sentence'

/** What each word opens. A missing handler means the page will not let it open now
 *  (a closed order, a shut capability) — the word then draws as plain text. */
export type WordOpeners = Partial<Record<HeaderSlotId, () => void>>

/** The words the ledger draws in mono: codes and IDs (359), never money or free text. */
const MONO = new Set<HeaderSlotId>(['source', 'reference', 'coupon'])

const LOOK: Record<WordLook, string> = {
  settled: 'border border-border-strong bg-card font-medium text-foreground',
  blocked: 'border border-dashed border-attention-border bg-attention-050 font-medium text-attention-800',
  ghost: 'border border-transparent text-muted-foreground',
  readout: 'font-medium text-foreground',
}

const HOVER: Record<WordLook, string> = {
  settled: 'hover:border-primary',
  blocked: 'hover:border-attention-800',
  ghost: 'hover:border-input',
  readout: '',
}

export default function HeaderSentence({ state, openers }: { state: SessionState; openers: WordOpeners }) {
  const { t } = useTranslation('callcenter')
  const sentence = headerSentence(state)
  // 🚩 Each slot is a SELF-CONTAINED element: `<Trans>` drops a self-closing slot
  // component's children, so everything a word draws arrives through its props.
  const components = Object.fromEntries(
    sentence.words.map((word) => [
      wordTag(word.id),
      <SentenceWord key={word.id} word={word} onOpen={word.control ? openers[word.id] : undefined} />,
    ]),
  ) as Record<string, ReactElement>
  return (
    <div
      className="flex shrink-0 flex-col gap-1 border-b border-divider bg-card px-4 py-2"
      data-cc-chips
      data-cc-sentence-shape={sentence.shape}
    >
      {/* 🚩 `dir="auto"`: the sentence is PROSE, so it reads in its own language's
          direction — an Arabic template right-to-left, and an English one (a key the
          Arabic locale has not translated yet falls back to it) left-to-right even
          under an RTL page. On the page's RTL base an English sentence scatters: its
          leading and trailing words resolve to the base and jump to the far ends.
          The ledger below is layout, not prose, and mirrors with the page. */}
      <p dir="auto" className="text-[14px] leading-8 text-muted-foreground" data-cc-sentence>
        <Trans t={t} ns="callcenter" i18nKey={SENTENCE_KEY[sentence.shape]} components={components} />
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" data-cc-ledger>
        {sentence.ledger.map((field) => (
          <LedgerField
            key={field.id}
            field={field}
            // Source and reference are two fields of ONE section (173): a reference
            // belongs to the source it references.
            onOpen={field.control ? openers[field.id === 'reference' ? 'source' : field.id] : undefined}
          />
        ))}
      </div>
      <HeaderNotes state={state} lapsed={sentence.words.some((word) => word.lapsed)} />
    </div>
  )
}

/** A word's value: its own key, the server's text isolated whole by kind, or its empty
 *  wording. */
function WordValue({ word, mono = false }: { word: HeaderWord; mono?: boolean }) {
  const { t } = useTranslation('callcenter')
  if (word.valueKey) return <>{t(word.valueKey)}</>
  if (word.value == null) return <>{t(word.emptyKey)}</>
  if (word.isolate === 'auto') return <bdi>{word.value}</bdi>
  return <Ltr>{mono ? <span className="font-mono text-[0.92em]">{word.value}</span> : word.value}</Ltr>
}

function SentenceWord({ word, onOpen }: { word: HeaderWord; onOpen?: () => void }) {
  const { t } = useTranslation('callcenter')
  const body = (
    <>
      <span data-cc-chip-value>
        <WordValue word={word} />
      </span>
      {/* The window is still the order's — the word stays settled and only says it
          has lapsed (§7's soft gate). */}
      {word.lapsed && (
        <span className="ms-1 text-[11px] font-medium text-attention-800" data-cc-chip-lapsed>
          ({t('chips.lapsed')})
        </span>
      )}
    </>
  )
  const handles = { 'data-cc-chip': word.id, 'data-cc-chip-state': word.state, 'data-cc-word-look': word.look }

  if (!onOpen) {
    // 🚩 A readout is a plain word. The delivery store says why, in its title: it
    // follows the address, so the way to move it is the address word.
    const shape = word.look === 'readout' ? '' : 'rounded-md px-1.5 py-px leading-6'
    return (
      <span
        {...handles}
        {...(word.follows ? { 'data-cc-store-derived': '', title: t('sentence.storeFollows') } : {})}
        className={`${LOOK[word.look]} ${shape} ${
          word.follows ? 'cursor-help underline decoration-dotted underline-offset-4' : ''
        }`}
      >
        {body}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      {...handles}
      data-cc-chip-open={word.id}
      title={t(`chips.change.${word.id}`)}
      className={`rounded-md px-1.5 py-px leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring ${LOOK[word.look]} ${HOVER[word.look]}`}
    >
      {body}
    </button>
  )
}

/** One ledger field: its label, then its value or its empty wording. */
function LedgerField({ field, onOpen }: { field: HeaderWord; onOpen?: () => void }) {
  const { t } = useTranslation('callcenter')
  const tone =
    field.look === 'blocked'
      ? 'border-b border-dashed border-attention-border text-attention-800'
      : field.look === 'settled'
        ? 'font-medium text-foreground'
        : 'text-muted-foreground'
  const value =
    field.id === 'note' && field.value != null ? (
      // The quotes are the template's, OUTSIDE the isolate: inside it they mirror under RTL.
      <Trans t={t} ns="callcenter" i18nKey="ledger.quoted" components={{ note: <NoteText text={field.value} /> }} />
    ) : (
      <WordValue word={field} mono={MONO.has(field.id)} />
    )
  const body = (
    <>
      <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-muted-foreground">
        {t(`ledger.${field.id}`)}
      </span>
      {/* Clamped: the note is `NVARCHAR(MAX)`, and no value may push the row off the
          column. The text is whole in the DOM — a rendering limit, never a truncation. */}
      <span className={`min-w-0 truncate ${tone}`} data-cc-chip-value>
        {value}
      </span>
    </>
  )
  const handles = { 'data-cc-chip': field.id, 'data-cc-chip-state': field.state, 'data-cc-word-look': field.look }
  const shape = 'flex max-w-[22rem] items-baseline gap-1.5 rounded-md px-1 py-0.5'

  if (!onOpen)
    return (
      <span {...handles} className={shape}>
        {body}
      </span>
    )
  return (
    <button
      type="button"
      onClick={onOpen}
      {...handles}
      data-cc-chip-open={field.id}
      title={t(`chips.change.${field.id}`)}
      className={`${shape} outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {body}
    </button>
  )
}

/** The note, clamped on its OWN isolate: a `<bdi>` takes its text's direction, so the
 *  ellipsis lands at the note's end in either script — clamped from outside, an English
 *  note under RTL would lose its first words instead. */
function NoteText({ text }: { text: string }) {
  return <bdi className="inline-block max-w-[16rem] truncate align-bottom">{text}</bdi>
}

/** What the chip row and the rail said under themselves, said once under the sentence. */
function HeaderNotes({ state, lapsed }: { state: SessionState; lapsed: boolean }) {
  const { t } = useTranslation('callcenter')
  const gate = capabilityGate(state.capabilities, 'canChangeFulfilment')
  const payGate = capabilityGate(state.capabilities, 'canChangePaymentType')
  /**
   * 🚩 **The retained address is the SERVER'S to say** (176, contract v1.8). Under
   * `PickInStore` the address leaves the projection, but the sidecar keeps it and a
   * flip back re-derives the store from it — so without this line, *switch back and
   * the store may move* arrives as a surprise. A client memory of the last address
   * was built and rejected (owner, 2026-07-29): it is absent after a refresh, in a
   * second tab and on a resumed order. The label alone, never the address: the agent
   * cannot act on it and must not read it out.
   */
  const retained = isPickup(state.header) ? (state.header.retainedAddressLabel ?? null) : null
  return (
    <>
      {/* Drawn only where there IS one — a sentence promising a kept address that does
          not exist is worse than silence. The label is free text, isolated whole. */}
      {retained && (
        <p className="text-[11px] text-muted-foreground" data-cc-address-retained>
          <Trans
            t={t}
            ns="callcenter"
            i18nKey="sentence.addressRetained"
            values={{ label: retained }}
            components={{ label: <bdi /> }}
          />
        </p>
      )}
      {/* 🚩 The soft gate, said out loud (US19): the window has lapsed, and the order can
          still be placed. A warning in the flow — never a blocker. */}
      {lapsed && (
        <p className="text-[11px] text-attention-800" data-cc-slot-lapsed>
          {t('slot.lapsedWarning')}
        </p>
      )}
      {/* 🚩 A shut gate made the mode word a readout; this is why, in words the agent can
          repeat. The reason is the server's typed code; an unknown one falls back to the
          general phrase rather than to silence. */}
      {!gate.open && (
        <p className="text-[11px] text-muted-foreground" data-cc-fulfilment-locked={gate.reason ?? ''}>
          {t(gate.reason ? `fulfilment.locked.${gate.reason}` : 'fulfilment.locked.unknown', {
            defaultValue: t('fulfilment.locked.unknown'),
          })}
        </p>
      )}
      {/* ⚠ Unreachable in phase 1 and implemented anyway (§2.4). */}
      {!payGate.open && (
        <p className="text-[11px] text-muted-foreground" data-cc-payment-locked={payGate.reason ?? ''}>
          {t(payGate.reason ? `payment.locked.${payGate.reason}` : 'payment.locked.unknown', {
            defaultValue: t('payment.locked.unknown'),
          })}
        </p>
      )}
    </>
  )
}
