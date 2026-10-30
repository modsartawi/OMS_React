// The three calls of Web `Storage` a pure module makes, taken as a parameter so its suite runs in node. Shared by the
// playground's experiment store (localStorage) and the rule-to-playground handoff (sessionStorage).

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
