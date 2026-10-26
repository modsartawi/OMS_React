/**
 * What a serving-list write's failure reads as in its dialog (oms ticket 570, BackOffice spec 3042): the shared
 * `./refusal` skeleton with the writes' words by code. The door's message is ONE `"English / Arabic"` string;
 * the screen shows its own words by code and keeps that text as the fallback. Pure.
 */
import { SERVING_LIST_ERRORS as E } from '@/core/models/serving-list'
import { refusalOf, type Refusal, type RefusalMap } from './refusal'

const MAP: RefusalMap = {
  labels: {
    [E.UnknownList]: 'writes.refusal.unknownList',
    [E.NotMember]: 'writes.refusal.notMember',
    [E.NameRequired]: 'writes.refusal.nameRequired',
    [E.NameTooLong]: 'writes.refusal.nameTooLong',
    [E.AlreadyInState]: 'writes.refusal.alreadyInState',
  },
  /** The refusals that mean the screen is behind the server: the dialog refetches Lists / Members / Changes. */
  stale: new Set<string>([E.UnknownList, E.NotMember, E.AlreadyInState]),
}

export type WriteRefusal = Refusal

export const writeRefusal = (err: unknown): WriteRefusal => refusalOf(err, MAP)

/** The label keys the map can produce — for the i18n test. */
export const WRITE_REFUSAL_KEYS: readonly string[] = Object.values(MAP.labels)
