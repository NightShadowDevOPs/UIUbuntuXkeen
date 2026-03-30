// Cross-page focus helper
// Used to pass a "focus target" between routes (Topology -> Proxies/Rules/Users, Global search, etc.)

export type PendingPageFocus = {
  ts: number
  route: string
  kind: string
  value: string
}

const KEY = 'runtime/page-focus-v1'
// Keep it short to avoid stale highlights after navigation.
const TTL_MS = 45_000

const safeNow = () => (typeof Date !== 'undefined' ? Date.now() : 0)

const read = (): PendingPageFocus | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const obj = JSON.parse(raw) as Partial<PendingPageFocus>
    const ts = Number(obj.ts || 0)
    const route = String(obj.route || '').trim()
    const kind = String(obj.kind || '').trim()
    const value = String(obj.value || '').trim()
    if (!ts || !route || !kind) return null
    return { ts, route, kind, value }
  } catch {
    return null
  }
}

const write = (v: PendingPageFocus) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // ignore
  }
}

export const clearPendingPageFocus = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export const cleanupExpiredPendingPageFocus = () => {
  const pf = read()
  if (!pf) return
  if (safeNow() - pf.ts > TTL_MS) clearPendingPageFocus()
}

export const setPendingPageFocus = (route: string, kind: string, value: string) => {
  const v = String(value || '').trim()
  write({ ts: safeNow(), route: String(route || '').trim(), kind: String(kind || '').trim(), value: v })
}

export const getPendingPageFocusForRoute = (route: string): PendingPageFocus | null => {
  const pf = read()
  if (!pf) return null
  if (safeNow() - pf.ts > TTL_MS) {
    clearPendingPageFocus()
    return null
  }
  if (String(pf.route || '').trim() !== String(route || '').trim()) return null
  return pf
}

// Visual highlight helper.
export const flashNavHighlight = (el: HTMLElement | null, durationMs = 2600) => {
  if (!el) return
  try {
    el.classList.add('nav-focus-highlight')
    window.setTimeout(() => {
      try {
        el.classList.remove('nav-focus-highlight')
      } catch {
        // ignore
      }
    }, Math.max(600, durationMs))
  } catch {
    // ignore
  }
}
