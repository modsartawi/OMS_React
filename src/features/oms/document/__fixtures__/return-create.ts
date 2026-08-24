/**
 * The two answers the create door can give that are not a plain success
 * (ticket 294) — checked in so every path is drivable before a live SIS.Api
 * exists (spec 289, *Testing Decisions*).
 *
 * ⚠ **Their SHAPES are contractual; their VALUES are not.** The envelope is
 * SIS.Api's universal one and `CreatedReturnModel` is BackOffice spec 1283 §2's;
 * the return number, the store and the refusal's sentence and code are
 * illustrative. ⚠ **The screen branches on no code at all** — 1283 §8 mints two
 * and calls their values build detail, so the code below is a sample of the
 * shape, never a value this repo may match on.
 *
 * Test-only, like `payloads.ts`. Nothing in the app imports this module.
 */
import type { GeneralErrorResponse } from '@/core/api'
import type { CreatedReturnModel } from '@/core/models/sd-document'

/** The envelope, as `core/api` reads it. */
interface Envelope<T> {
  statusCode: number
  success: boolean
  message: string
  errors: GeneralErrorResponse[]
  data: T
}

/**
 * A guardrail refusal: the `400` the door answers with when the delivery is not
 * one a return may be created against.
 *
 * `success: false` with a sentence on `message` and a machine code in
 * `errors[0].errorCode` — a **business** outcome in `core/api`'s taxonomy, not a
 * crash, and the dialog renders whichever one it is handed.
 */
export const REFUSED_NOT_ELIGIBLE: Envelope<null> = {
  statusCode: 400,
  success: false,
  message: 'This delivery is not handled by Starlinks, so a return cannot be created here.',
  errors: [
    {
      errorCode: 'RETURN_STORE_NOT_ELIGIBLE',
      internalErrorCode: '',
      errorMessage:
        'This delivery is not handled by Starlinks, so a return cannot be created here.',
    },
  ],
  data: null,
}

/**
 * The replay: a `200` carrying `replayed: true`, which means this `requestId`
 * had **already** created a return and this is the SAME one.
 *
 * It is a **success**. Showing an error about a return that was in fact created
 * is the confusing half of the problem the idempotency key solves.
 */
export const DUPLICATE_REPLAY: Envelope<CreatedReturnModel> = {
  statusCode: 200,
  success: true,
  message: '',
  errors: [],
  data: {
    documentNo: '7000000912',
    orderNo: '2000000551',
    documentReason: 'RTRF',
    storeCode: 'P001',
    replayed: true,
  },
}

/** The ordinary success: a return created for the first time under this key. */
export const CREATED_RETURN: Envelope<CreatedReturnModel> = {
  ...DUPLICATE_REPLAY,
  data: { ...DUPLICATE_REPLAY.data, replayed: false },
}
