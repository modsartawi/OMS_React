import { HYBRIS_STOCK_ERRORS } from '@/core/models/hybris-stock'
import { fieldRefusal } from '@/core/reason/reason'

// The reason every Hybris stock write carries (spec 3447 stories 7, 21, 38; ticket 847): mark and
// unmark (847), material add / enable / disable / upload commit (848), push now (850). The rule is the
// shared one (`@/core/reason/reason`); this module binds the Hybris stock refusal code, HYS-00001.

export { REASON_MAX, fieldRefusal, reasonField } from '@/core/reason/reason'

/** The server's own sentence when a write was refused for its reason (HYS-00001), else `null`. */
export function reasonRefusal(err: unknown, fallback: string): string | null {
  return fieldRefusal(err, [HYBRIS_STOCK_ERRORS.reasonInvalid], fallback)?.message ?? null
}
