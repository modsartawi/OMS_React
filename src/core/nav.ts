// Router indirection so non-component code (the API client) can navigate
// without importing the router (avoids circular imports).
type Navigate = (to: string) => void

let navigate: Navigate = () => {}

export function setNavigator(fn: Navigate) {
  navigate = fn
}

export function navigateTo(to: string) {
  navigate(to)
}

export function currentPath(): string {
  return window.location.pathname + window.location.search
}
