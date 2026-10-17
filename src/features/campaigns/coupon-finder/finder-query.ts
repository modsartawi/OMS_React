// The coupon finder's URL (ticket 519): the code looked up lives in the address (`?code=`,
// replaced), so a reload or a wallet's code link lands on it. Pure.

export function codeFromParams(params: URLSearchParams): string {
  return (params.get('code') ?? '').trim()
}

export function codeToParams(code: string): URLSearchParams {
  const out = new URLSearchParams()
  if (code.trim()) out.set('code', code.trim())
  return out
}
