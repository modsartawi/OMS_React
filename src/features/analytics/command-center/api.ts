/**
 * The command center home's server calls (oms 946; BO 4176, unbuilt — the shape is `@/core/models/command-center`'s
 * proposal). Through `@/core/api` (`.claude/rules/api-envelope.md`). The scorecard (947) and the profiles (948, 949)
 * keep their calls in their own `*-api.ts` files beside this one.
 */
import { api } from '@/core/api'
import type { CcLang, CommandCenterHome } from '@/core/models/command-center'

/** The feature's query keys. Every read is keyed by its language: an answer in one language never stands for the other. */
export const CC_KEYS = {
  all: ['command-center'] as const,
  home: (lang: CcLang) => ['command-center', 'home', lang] as const,
}

export const commandCenterApi = {
  /** `GET CommandCenter/Home?lang=` — the latest published brief in the asked language, the runs, the regions and the points. */
  home: (lang: CcLang): Promise<CommandCenterHome> => api.get<CommandCenterHome>('CommandCenter/Home', { lang }),
}

/** The home's query: asked in the page language, once per language. */
export const homeQuery = (lang: CcLang) => ({
  queryKey: CC_KEYS.home(lang),
  queryFn: () => commandCenterApi.home(lang),
  retry: false,
})
