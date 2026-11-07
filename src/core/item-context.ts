import { create } from 'zustand'
import type { AnalyticsLabel } from '@/core/models/analytics'

/**
 * The item-in-context bridge, generalised from 832's report bridge for 836: the open designer (a report's) or editor
 * (a board's) and the copilot never import each other, so they meet here.
 *
 * - the open designer `publish`es its context (`{ <id>, revision, draft }`, the wire's shape) as it changes, with the
 *   item's title for the copilot panel's "Editing: …" chip (never sent), and `clear`s it when it closes;
 * - the copilot reads `context` when it asks, and sends it in the Ask body;
 * - an answer's edit is `postEdit`ed with the question it answers; the designer `takeEdit`s it ONCE and applies it as
 *   one undo step. It never saves it.
 *
 * An edit reaches only the item it names, and only while that item is open: an edit for any other item (or none open)
 * is dropped, as is one the designer closed without taking.
 */
export interface PostedEdit<E> {
  edit: E
  /** The question the edit answers: the undo step's label. */
  request: string
}

export interface ItemContextState<C, E> {
  /** The item open in its designer, or null when none is open. */
  context: C | null
  /** Its title, for the copilot panel's chip; null with no context. Never sent to the server. */
  title: AnalyticsLabel | null
  /** An edit waiting for the open designer, or null. Read it through `takeEdit`. */
  edit: PostedEdit<E> | null
  publish: (context: C, title?: AnalyticsLabel) => void
  /** The designer closed: drops the context (and any edit) only when it is still that item's. */
  clear: (id: string | null) => void
  postEdit: (edit: E, request: string) => void
  /** Hands the waiting edit to `id`'s designer once; null for any other item. */
  takeEdit: (id: string | null) => PostedEdit<E> | null
}

export function createItemContext<C, E>(idOfContext: (c: C) => string | null, idOfEdit: (e: E) => string | null) {
  return create<ItemContextState<C, E>>((set, get) => ({
    context: null,
    title: null,
    edit: null,
    publish: (context, title) =>
      set((s) => {
        const same = s.context !== null && idOfContext(s.context) === idOfContext(context)
        return same ? { context, title: title ?? s.title } : { context, title: title ?? null, edit: null }
      }),
    clear: (id) => {
      const c = get().context
      if (c !== null && idOfContext(c) === id) set({ context: null, title: null, edit: null })
    },
    postEdit: (edit, request) => {
      const c = get().context
      if (c !== null && idOfContext(c) === idOfEdit(edit)) set({ edit: { edit, request } })
    },
    takeEdit: (id) => {
      const waiting = get().edit
      if (!waiting || idOfEdit(waiting.edit) !== id) return null
      set({ edit: null })
      return waiting
    },
  }))
}
