import type { RuleLookupItem } from '@/core/models/rule-campaign'
import { saysIn } from './sentence'

// What the rule screens pick codes from beside HQ's lookups (`Rules/Authoring/Lookups/{lookup}`,
// BackOffice 2758). HQ has no countries or channels lookup (BO ask E, ticket 523): Settings ▸
// Audience and the simulator offer these fixed lists instead — the countries the estate sells in, and
// the channels the prototype named. A code a campaign already holds that is not listed stays shown.
// PROVISIONAL - client lists until BO ask E gives countries and channels a lookup (ticket 520)

/** The countries a campaign's audience may name. */
export const AUDIENCE_COUNTRIES: readonly string[] = ['SA', 'BH']

/** The sales channels a campaign's audience (and a dry run) may name. */
export const AUDIENCE_CHANNELS: readonly string[] = ['POS', 'CC', 'SD', 'CMRC']

/** A hit's name in the reader's language — HQ holds categories, collections and stores in English only. */
export const lookupName = (item: Pick<RuleLookupItem, 'name'>, lang = 'en'): string => saysIn(item.name, lang)
