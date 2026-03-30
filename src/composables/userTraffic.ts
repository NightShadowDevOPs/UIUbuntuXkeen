import { getIPKeyFromLabel, getIPLabelFromMap } from '@/helper/sourceip'
import { activeConnections } from '@/store/connections'
import { prettyBytesHelper } from '@/helper/utils'
import dayjs from 'dayjs'
import { debounce } from 'lodash'
import { computed, ref, watch } from 'vue'

export type UserTrafficBucket = { dl: number; ul: number }
export type UserTrafficStore = Record<string, Record<string, UserTrafficBucket>>

const STORAGE_KEY = 'stats/user-traffic-hourly-v1'
const MAX_DAYS = 35 // keep ~1 month

const store = ref<UserTrafficStore>({})

const safeParse = (raw: string | null): UserTrafficStore => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const load = () => {
  store.value = safeParse(localStorage.getItem(STORAGE_KEY))
}

const save = debounce(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.value))
  } catch {
    // ignore
  }
}, 1500)

const bucketKey = (ts: number) => dayjs(ts).format('YYYY-MM-DDTHH')

const looksLikeIP = (s: string) => {
  const v = (s || '').trim()
  if (!v) return false
  const v4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(v)
  const v6 = v.includes(':')
  return v4 || v6
}

// Traffic history used to be keyed by "label" (hostname) which caused double-counting when
// a label was added later. Canonicalize legacy keys back to their IP when possible.
const canonicalUserKey = (k: string) => {
  const key = (k || '').toString().trim()
  if (!key) return ''
  if (looksLikeIP(key)) return key
  const ip = getIPKeyFromLabel(key)
  return ip || key
}

export const getUserHourBucket = (user: string, ts = Date.now()): UserTrafficBucket => {
  const u = (user || '').toString().trim()
  if (!u) return { dl: 0, ul: 0 }
  const k = bucketKey(ts)
  const bucket = store.value?.[k] || {}

  const keys = new Set<string>()
  keys.add(canonicalUserKey(u))
  // also include legacy label key (if it exists)
  if (!looksLikeIP(u)) keys.add(u)

  let dl = 0
  let ul = 0
  for (const kk of keys) {
    const b = (bucket as any)?.[kk]
    dl += b?.dl || 0
    ul += b?.ul || 0
  }
  return { dl, ul }
}

const trimOld = () => {
  const cutoff = dayjs().subtract(MAX_DAYS, 'day')
  const next: UserTrafficStore = {}
  for (const [k, v] of Object.entries(store.value)) {
    const t = dayjs(k, 'YYYY-MM-DDTHH')
    if (t.isBefore(cutoff)) continue
    next[k] = v
  }
  store.value = next
}

export const clearUserTrafficHistory = () => {
  store.value = {}
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

const add = (user: string, dl: number, ul: number, ts = Date.now()) => {
  if (!user) return
  if (!Number.isFinite(dl)) dl = 0
  if (!Number.isFinite(ul)) ul = 0
  if (dl < 0) dl = 0
  if (ul < 0) ul = 0
  if (dl === 0 && ul === 0) return

  const b = bucketKey(ts)
  const bucket = (store.value[b] ||= {})
  const cur = (bucket[user] ||= { dl: 0, ul: 0 })
  cur.dl += dl
  cur.ul += ul

  trimOld()
  save()
}

const connTotals = new Map<string, { dl: number; ul: number }>()

let started = false
export const initUserTrafficRecorder = () => {
  if (started) return
  started = true

  load()

  // Every WS tick, connections list updates with per-connection counters (download/upload).
  // We compute deltas ourselves so that short-lived connections are still counted on their first appearance.
  watch(
    activeConnections,
    (list) => {
      const now = Date.now()
      const seen = new Set<string>()
      for (const c of list) {
        const id = (c as any)?.id || ''
        if (!id) continue
        seen.add(id)

        const ip = (c?.metadata?.sourceIP || '').toString()
        // Store traffic by stable key (IP) to avoid double counting when labels change.
        // Fallback for empty IP (some local/internal entries): keep a stable synthetic label.
        const userKey = (ip || getIPLabelFromMap(ip) || '').toString()

        const curDl = Number((c as any)?.download ?? 0) || 0
        const curUl = Number((c as any)?.upload ?? 0) || 0

        const prev = connTotals.get(id)
        let d = curDl
        let u = curUl
        if (prev) {
          d = curDl - (prev.dl || 0)
          u = curUl - (prev.ul || 0)
        }
        if (!Number.isFinite(d) || d < 0) d = 0
        if (!Number.isFinite(u) || u < 0) u = 0

        // Fallback: if totals are not available for some builds but per-tick deltas exist.
        if (d === 0 && u === 0) {
          const sd = Number((c as any)?.downloadSpeed ?? 0) || 0
          const su = Number((c as any)?.uploadSpeed ?? 0) || 0
          if (sd > 0 || su > 0) {
            d = sd
            u = su
          }
        }

        add(userKey, d, u, now)

        connTotals.set(id, { dl: curDl, ul: curUl })
      }

      // prune ended connections
      for (const id of Array.from(connTotals.keys())) {
        if (!seen.has(id)) connTotals.delete(id)
      }
    },
    { deep: false },
  )
}

export const getTrafficRange = (startTs: number, endTs: number) => {
  // inclusive start hour, exclusive end hour
  const out = new Map<string, UserTrafficBucket>()
  const startKey = dayjs(startTs).startOf('hour')
  const endKey = dayjs(endTs).startOf('hour')

  for (let t = startKey; t.isBefore(endKey) || t.isSame(endKey); t = t.add(1, 'hour')) {
    const k = t.format('YYYY-MM-DDTHH')
    const bucket = store.value[k]
    if (!bucket) continue
    for (const [user, v] of Object.entries(bucket)) {
      const key = canonicalUserKey(user)
      const cur = out.get(key) || { dl: 0, ul: 0 }
      cur.dl += v.dl || 0
      cur.ul += v.ul || 0
      out.set(key, cur)
    }
  }

  return out
}


export type TrafficGroupBy = 'day' | 'week' | 'month'

const isoWeekStart = (d: dayjs.Dayjs) => {
  // Monday as start of week
  const dow = d.day() // 0..6 (Sun..Sat)
  const diff = (dow + 6) % 7
  return d.subtract(diff, 'day').startOf('day')
}

const groupKeyForHour = (hourKey: string, groupBy: TrafficGroupBy) => {
  const t = dayjs(hourKey, 'YYYY-MM-DDTHH')
  if (groupBy === 'day') return t.startOf('day').format('YYYY-MM-DD')
  if (groupBy === 'month') return t.startOf('month').format('YYYY-MM')
  // week
  return isoWeekStart(t).format('YYYY-MM-DD')
}

export const getTrafficGrouped = (startTs: number, endTs: number, groupBy: TrafficGroupBy) => {
  // Returns: Map<periodKey, Map<user, {dl, ul}>>
  const out = new Map<string, Map<string, UserTrafficBucket>>()

  const startKey = dayjs(startTs).startOf('hour')
  const endKey = dayjs(endTs).startOf('hour')

  for (let t = startKey; t.isBefore(endKey) || t.isSame(endKey); t = t.add(1, 'hour')) {
    const k = t.format('YYYY-MM-DDTHH')
    const bucket = store.value[k]
    if (!bucket) continue

    const gk = groupKeyForHour(k, groupBy)
    const g = out.get(gk) || new Map<string, UserTrafficBucket>()

    for (const [user, v] of Object.entries(bucket)) {
      const key = canonicalUserKey(user)
      const cur = g.get(key) || { dl: 0, ul: 0 }
      cur.dl += v.dl || 0
      cur.ul += v.ul || 0
      g.set(key, cur)
    }

    out.set(gk, g)
  }

  return out
}

export const formatTraffic = (bytes: number) => prettyBytesHelper(bytes)

export const userTrafficStoreSize = computed(() => Object.keys(store.value).length)
