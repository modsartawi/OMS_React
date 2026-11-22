/**
 * The "New to Analytics? Start here" card on Analytics Home (oms 952, BackOffice spec 4182 §D, story 9): each user may
 * dismiss it, remembered in this browser's local storage under their user id. Storage is a convenience: when it throws
 * (a private window, blocked site data) or is missing, the card simply shows again, and dismissing it hides it for the
 * moment only.
 */
type CardStorage = Pick<Storage, 'getItem' | 'setItem'>

const key = (userId: string | null): string => `oms.help.startCard.dismissed:${userId ?? ''}`

/** The browser's local storage, or undefined where reading it throws. */
export function browserStorage(): CardStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** Whether `userId` sees the card: until they dismiss it, and whenever storage cannot say. */
export function startCardShown(userId: string | null, storage: CardStorage | undefined): boolean {
  try {
    return storage?.getItem(key(userId)) !== '1'
  } catch {
    return true
  }
}

/** Remembers that `userId` dismissed the card; a storage failure is swallowed (the card shows again next time). */
export function dismissStartCard(userId: string | null, storage: CardStorage | undefined): void {
  try {
    storage?.setItem(key(userId), '1')
  } catch {
    /* storage unavailable: the dismissal lasts until the page is left */
  }
}
