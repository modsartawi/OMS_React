/**
 * The Mini POS pharmacies screen's server calls (oms 915, BackOffice 4043): SIS.Api's `MiniPosAdmin/Stores`. The list
 * behind `MiniPosAdmin:03`; enable, disable, trial role, the printed code and a reprint behind `MiniPosAdmin:06` (a print
 * unlocks the pharmacy, so even reading the code is a manage door).
 *
 * Through `@/core/api` (`api-envelope`). The store key never leaves the server; the printed code is the signed string the
 * page draws as a QR.
 */
import { api } from '@/core/api'
import type { MiniPosPrintedCode, MiniPosStore, MiniPosTrialRole } from '@/core/models/mini-pos'

const store = (code: string) => `MiniPosAdmin/Stores/${encodeURIComponent(code)}`

export const miniPosStoresApi = {
  /** `GET MiniPosAdmin/Stores` → every Mini POS store row. */
  async list(): Promise<MiniPosStore[]> {
    return (await api.get<MiniPosStore[] | null>('MiniPosAdmin/Stores')) ?? []
  },

  /** `POST …/Enable` → the row. Refused `MINIPOS_STORE_KEY_UNAVAILABLE` when SIS.Api holds no key secret. */
  enable(storeCode: string): Promise<MiniPosStore> {
    return api.post<MiniPosStore>(`${store(storeCode)}/Enable`, {})
  },

  /** `POST …/Disable` → the row. */
  disable(storeCode: string): Promise<MiniPosStore> {
    return api.post<MiniPosStore>(`${store(storeCode)}/Disable`, {})
  },

  /** `POST …/TrialRole` `{ trialRole }` → the row. A store with no row gets a disabled one. */
  setTrialRole(storeCode: string, trialRole: MiniPosTrialRole): Promise<MiniPosStore> {
    return api.post<MiniPosStore>(`${store(storeCode)}/TrialRole`, { trialRole })
  },

  /** `GET …/PrintedCode` → the current signed code to draw. */
  printedCode(storeCode: string): Promise<MiniPosPrintedCode> {
    return api.get<MiniPosPrintedCode>(`${store(storeCode)}/PrintedCode`)
  },

  /** `POST …/Reprint` → a new version; every older print is refused from now on. */
  reprint(storeCode: string): Promise<MiniPosPrintedCode> {
    return api.post<MiniPosPrintedCode>(`${store(storeCode)}/Reprint`, {})
  },
}
