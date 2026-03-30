import { computed, ref, watch } from 'vue'
import { getNowProxyNodeName, proxyMap, proxyProviederList } from '@/store/proxies'
import { activeConnections, closedConnections } from '@/store/connections'
import { debounce, throttle } from 'lodash'
import { agentProviderTrafficGetAPI, agentProviderTrafficPutAPI } from '@/api/agent'
import { decodeB64Utf8 } from '@/helper/b64'
import { agentEnabled } from '@/store/agent'

const FALLBACK_SPEED_MULTIPLIER = 1
const REMOTE_SCHEMA_VERSION = 1
const REMOTE_PUSH_DEBOUNCE_MS = 15_000
const REMOTE_PULL_INTERVAL_MS = 90_000
const REMOTE_PUSH_INTERVAL_MS = 75_000
const REMOTE_HIDDEN_PUSH_THROTTLE_MS = 20_000

export type ProviderActivity = {
  connections: number
  active: boolean
  bytes: number
  speed: number
  activeProxy: string
  activeProxyBytes: number
  currentBytes: number
  download: number
  upload: number
  todayBytes: number
  todayDownload: number
  todayUpload: number
  updatedAt?: number
}

export type ProviderLiveStatus = {
  connections: number
  active: boolean
}

type ProviderTrafficTotals = {
  dl: number
  ul: number
  updatedAt?: number
}

type DailyTrafficStore = {
  day: string
  totals: Record<string, ProviderTrafficTotals>
}

type PersistedConnTotal = {
  provider: string
  dl: number
  ul: number
  start?: string
  seenAt?: number
}

type PersistedConnTotalStore = {
  entries: Record<string, PersistedConnTotal>
}

type ProviderTrafficRemotePayload = {
  version: number
  sessionResetAt?: number
  sessionTotals: Record<string, ProviderTrafficTotals>
  daily: DailyTrafficStore
  connTotals: PersistedConnTotalStore
}

const STORAGE_KEY = 'stats/provider-traffic-session-v7'
const DAILY_STORAGE_KEY = 'stats/provider-traffic-daily-v6'
const CONN_TOTALS_STORAGE_KEY = 'stats/provider-traffic-conn-baselines-v6'
const SESSION_RESET_STORAGE_KEY = 'stats/provider-traffic-session-reset-at-v1'
const MAX_PERSISTED_CONN_TOTALS = 5000
const trafficTotals = ref<Record<string, ProviderTrafficTotals>>({})
const dailyTrafficTotals = ref<Record<string, ProviderTrafficTotals>>({})
const connTotals = new Map<string, PersistedConnTotal>()
const providerActivityCurrent = ref<Record<string, ProviderActivity>>({})
const sessionResetAt = ref(0)
const providerTrafficRemoteRev = ref(0)
const providerTrafficRemoteUpdatedAt = ref('')
let lastTickAt = Date.now()
let providerTrafficSyncStarted = false
let providerTrafficRemoteBootstrapped = false
let providerTrafficPullInFlight = false
let providerTrafficPushInFlight = false
let providerTrafficSuppressRemotePush = 0
let providerTrafficLocalDirty = false
let providerTrafficLastPullAt = 0
let providerTrafficLastPushAt = 0
let providerTrafficLastHiddenPushAt = 0

const pad2 = (v: number) => String(v).padStart(2, '0')
const localDayKeyFromDate = (value: Date) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
const todayKey = () => localDayKeyFromDate(new Date())

const isLocalToday = (value: unknown) => {
  if (!value) return false
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return false
  return localDayKeyFromDate(date) === todayKey()
}

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object' ? parsed : fallback) as T
  } catch {
    return fallback
  }
}

const normalizeTrafficTotals = (raw: unknown): Record<string, ProviderTrafficTotals> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, ProviderTrafficTotals> = {}
  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    const name = String(key || '').trim()
    if (!name) continue
    const dl = Number(value?.dl ?? value?.download ?? 0)
    const ul = Number(value?.ul ?? value?.upload ?? 0)
    const updatedAt = Number(value?.updatedAt ?? 0)
    out[name] = {
      dl: Number.isFinite(dl) && dl >= 0 ? dl : 0,
      ul: Number.isFinite(ul) && ul >= 0 ? ul : 0,
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : undefined,
    }
  }
  return out
}

const normalizeConnEntry = (value: unknown): PersistedConnTotal | null => {
  if (!value || typeof value !== 'object') return null
  const provider = String((value as any)?.provider || '').trim()
  if (!provider) return null
  const dl = Number((value as any)?.dl ?? 0)
  const ul = Number((value as any)?.ul ?? 0)
  const start = String((value as any)?.start || '').trim()
  const seenAt = Number((value as any)?.seenAt ?? 0)
  return {
    provider,
    dl: Number.isFinite(dl) && dl >= 0 ? dl : 0,
    ul: Number.isFinite(ul) && ul >= 0 ? ul : 0,
    start: start || undefined,
    seenAt: Number.isFinite(seenAt) && seenAt > 0 ? seenAt : undefined,
  }
}

const normalizeConnEntries = (raw: unknown): Record<string, PersistedConnTotal> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, PersistedConnTotal> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = String(key || '').trim()
    if (!id) continue
    const entry = normalizeConnEntry(value)
    if (!entry) continue
    out[id] = entry
  }
  return out
}

const normalizeDailyStore = (raw: unknown): DailyTrafficStore => {
  const day = todayKey()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { day, totals: {} }
  const incomingDay = String((raw as any)?.day || '').trim() || day
  return {
    day: incomingDay,
    totals: normalizeTrafficTotals((raw as any)?.totals),
  }
}

const normalizeRemotePayload = (raw: unknown): ProviderTrafficRemotePayload => {
  const day = todayKey()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      version: REMOTE_SCHEMA_VERSION,
      sessionResetAt: 0,
      sessionTotals: {},
      daily: { day, totals: {} },
      connTotals: { entries: {} },
    }
  }
  return {
    version: Number((raw as any)?.version ?? REMOTE_SCHEMA_VERSION) || REMOTE_SCHEMA_VERSION,
    sessionResetAt: Number((raw as any)?.sessionResetAt ?? 0) || 0,
    sessionTotals: normalizeTrafficTotals((raw as any)?.sessionTotals),
    daily: normalizeDailyStore((raw as any)?.daily),
    connTotals: { entries: normalizeConnEntries((raw as any)?.connTotals?.entries) },
  }
}

const mergeTrafficTotals = (
  left: Record<string, ProviderTrafficTotals>,
  right: Record<string, ProviderTrafficTotals>,
): Record<string, ProviderTrafficTotals> => {
  const out: Record<string, ProviderTrafficTotals> = {}
  const keys = new Set<string>([...Object.keys(left || {}), ...Object.keys(right || {})])
  for (const key of keys) {
    const a = left?.[key]
    const b = right?.[key]
    out[key] = {
      dl: Math.max(Number(a?.dl ?? 0) || 0, Number(b?.dl ?? 0) || 0),
      ul: Math.max(Number(a?.ul ?? 0) || 0, Number(b?.ul ?? 0) || 0),
      updatedAt: Math.max(Number(a?.updatedAt ?? 0) || 0, Number(b?.updatedAt ?? 0) || 0) || undefined,
    }
  }
  return out
}

const pickNewerConnEntry = (left: PersistedConnTotal, right: PersistedConnTotal): PersistedConnTotal => {
  const leftSeen = Number(left?.seenAt ?? 0) || 0
  const rightSeen = Number(right?.seenAt ?? 0) || 0
  if (rightSeen > leftSeen) return right
  if (leftSeen > rightSeen) return left
  const leftBytes = (Number(left?.dl ?? 0) || 0) + (Number(left?.ul ?? 0) || 0)
  const rightBytes = (Number(right?.dl ?? 0) || 0) + (Number(right?.ul ?? 0) || 0)
  return rightBytes >= leftBytes ? right : left
}

const mergeConnEntries = (
  left: Record<string, PersistedConnTotal>,
  right: Record<string, PersistedConnTotal>,
): Record<string, PersistedConnTotal> => {
  const merged = new Map<string, PersistedConnTotal>()
  const keys = new Set<string>([...Object.keys(left || {}), ...Object.keys(right || {})])
  for (const key of keys) {
    const a = left?.[key]
    const b = right?.[key]
    if (!a && b) {
      merged.set(key, b)
      continue
    }
    if (a && !b) {
      merged.set(key, a)
      continue
    }
    if (!a || !b) continue
    if ((a.start || '') === (b.start || '') && a.provider === b.provider) {
      merged.set(key, {
        provider: a.provider || b.provider,
        start: a.start || b.start,
        dl: Math.max(Number(a.dl || 0), Number(b.dl || 0)),
        ul: Math.max(Number(a.ul || 0), Number(b.ul || 0)),
        seenAt: Math.max(Number(a.seenAt || 0), Number(b.seenAt || 0)) || undefined,
      })
      continue
    }
    merged.set(key, pickNewerConnEntry(a, b))
  }
  return Object.fromEntries(
    Array.from(merged.entries())
      .sort((a, b) => (Number(b[1]?.seenAt ?? 0) || 0) - (Number(a[1]?.seenAt ?? 0) || 0))
      .slice(0, MAX_PERSISTED_CONN_TOTALS),
  )
}

const serializeConnTotalsEntries = (): Record<string, PersistedConnTotal> => {
  const out: Record<string, PersistedConnTotal> = {}
  const sorted = Array.from(connTotals.entries())
    .sort((a, b) => (Number(b[1]?.seenAt ?? 0) || 0) - (Number(a[1]?.seenAt ?? 0) || 0))
    .slice(0, MAX_PERSISTED_CONN_TOTALS)
  for (const [key, value] of sorted) {
    out[key] = {
      provider: value.provider,
      dl: Number(value.dl || 0) || 0,
      ul: Number(value.ul || 0) || 0,
      start: value.start || undefined,
      seenAt: Number(value.seenAt || 0) || undefined,
    }
  }
  return out
}

const replaceConnTotalsFromEntries = (entries: Record<string, PersistedConnTotal>) => {
  connTotals.clear()
  for (const [key, value] of Object.entries(entries || {})) {
    connTotals.set(key, value)
  }
}

const loadTrafficTotals = () => {
  if (typeof localStorage === 'undefined') return
  trafficTotals.value = normalizeTrafficTotals(safeParse<Record<string, ProviderTrafficTotals>>(localStorage.getItem(STORAGE_KEY), {}))
}

const loadDailyTrafficTotals = () => {
  if (typeof localStorage === 'undefined') return
  const parsed = normalizeDailyStore(safeParse<DailyTrafficStore>(localStorage.getItem(DAILY_STORAGE_KEY), { day: todayKey(), totals: {} }))
  if (parsed.day !== todayKey()) {
    dailyTrafficTotals.value = {}
    return
  }
  dailyTrafficTotals.value = parsed.totals || {}
}

const loadConnTotals = () => {
  connTotals.clear()
  if (typeof localStorage === 'undefined') return
  const parsed = safeParse<PersistedConnTotalStore>(localStorage.getItem(CONN_TOTALS_STORAGE_KEY), { entries: {} })
  for (const [id, entry] of Object.entries(normalizeConnEntries(parsed.entries || {}))) {
    connTotals.set(id, entry)
  }
}

const loadSessionResetAt = () => {
  if (typeof localStorage === 'undefined') return
  const raw = Number(localStorage.getItem(SESSION_RESET_STORAGE_KEY) || 0)
  sessionResetAt.value = Number.isFinite(raw) && raw > 0 ? raw : 0
}

const saveTrafficTotals = debounce(() => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trafficTotals.value || {}))
  } catch {
    // ignore
  }
}, 1500)

const saveDailyTrafficTotals = debounce(() => {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: DailyTrafficStore = { day: todayKey(), totals: dailyTrafficTotals.value || {} }
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore
  }
}, 1500)

const saveConnTotals = debounce(() => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CONN_TOTALS_STORAGE_KEY, JSON.stringify({ entries: serializeConnTotalsEntries() }))
  } catch {
    // ignore
  }
}, 1500)

const saveSessionResetAt = () => {
  if (typeof localStorage === 'undefined') return
  try {
    if (sessionResetAt.value > 0) localStorage.setItem(SESSION_RESET_STORAGE_KEY, String(sessionResetAt.value))
    else localStorage.removeItem(SESSION_RESET_STORAGE_KEY)
  } catch {
    // ignore
  }
}

const emptyActivity = (): ProviderActivity => ({
  connections: 0,
  active: false,
  bytes: 0,
  speed: 0,
  activeProxy: '',
  activeProxyBytes: 0,
  currentBytes: 0,
  download: 0,
  upload: 0,
  todayBytes: 0,
  todayDownload: 0,
  todayUpload: 0,
  updatedAt: undefined,
})

const buildRemotePayload = (): ProviderTrafficRemotePayload => ({
  version: REMOTE_SCHEMA_VERSION,
  sessionResetAt: Number(sessionResetAt.value || 0) || 0,
  sessionTotals: normalizeTrafficTotals(trafficTotals.value || {}),
  daily: { day: todayKey(), totals: normalizeTrafficTotals(dailyTrafficTotals.value || {}) },
  connTotals: { entries: serializeConnTotalsEntries() },
})

const syncStoredTotalsIntoCurrent = () => {
  const next: Record<string, ProviderActivity> = { ...(providerActivityCurrent.value || {}) }
  const keys = new Set<string>([
    ...Object.keys(next),
    ...Object.keys(trafficTotals.value || {}),
    ...Object.keys(dailyTrafficTotals.value || {}),
    ...((proxyProviederList.value || []).map((provider: any) => String(provider?.name || '').trim()).filter(Boolean)),
  ])

  for (const providerName of keys) {
    const rec = next[providerName] || emptyActivity()
    const totals = trafficTotals.value[providerName]
    const daily = dailyTrafficTotals.value[providerName]
    rec.download = Number(totals?.dl ?? 0) || 0
    rec.upload = Number(totals?.ul ?? 0) || 0
    rec.bytes = rec.download + rec.upload
    rec.todayDownload = Number(daily?.dl ?? 0) || 0
    rec.todayUpload = Number(daily?.ul ?? 0) || 0
    rec.todayBytes = rec.todayDownload + rec.todayUpload
    rec.updatedAt = Math.max(Number(totals?.updatedAt ?? 0) || 0, Number(daily?.updatedAt ?? 0) || 0) || undefined
    next[providerName] = rec
  }

  providerActivityCurrent.value = next
}

const applyRemotePayload = (raw: unknown) => {
  const payload = normalizeRemotePayload(raw)
  const remoteResetAt = Number(payload.sessionResetAt || 0) || 0
  const localResetAt = Number(sessionResetAt.value || 0) || 0
  const mergedSession = remoteResetAt > localResetAt
    ? normalizeTrafficTotals(payload.sessionTotals || {})
    : localResetAt > remoteResetAt
      ? normalizeTrafficTotals(trafficTotals.value || {})
      : mergeTrafficTotals(trafficTotals.value || {}, payload.sessionTotals || {})
  const mergedDaily = payload.daily.day === todayKey()
    ? mergeTrafficTotals(dailyTrafficTotals.value || {}, payload.daily.totals || {})
    : normalizeTrafficTotals(dailyTrafficTotals.value || {})
  const mergedConnEntries = mergeConnEntries(serializeConnTotalsEntries(), payload.connTotals?.entries || {})

  providerTrafficSuppressRemotePush += 1
  sessionResetAt.value = Math.max(localResetAt, remoteResetAt)
  saveSessionResetAt()
  trafficTotals.value = mergedSession
  dailyTrafficTotals.value = mergedDaily
  replaceConnTotalsFromEntries(mergedConnEntries)
  saveTrafficTotals()
  saveDailyTrafficTotals()
  saveConnTotals()
  syncStoredTotalsIntoCurrent()
}

const pushProviderTrafficRemoteNow = async () => {
  if (!agentEnabled.value || providerTrafficPushInFlight || providerTrafficPullInFlight) return
  if (!providerTrafficRemoteBootstrapped) return
  if (!providerTrafficLocalDirty) return
  providerTrafficPushInFlight = true
  try {
    const body = JSON.stringify(buildRemotePayload())
    const res: any = await agentProviderTrafficPutAPI({
      rev: Number(providerTrafficRemoteRev.value || 0),
      content: body,
    })

    if (res?.ok) {
      providerTrafficRemoteRev.value = Number(res.rev ?? providerTrafficRemoteRev.value + 1) || providerTrafficRemoteRev.value + 1
      providerTrafficRemoteUpdatedAt.value = String(res.updatedAt || '').trim()
      providerTrafficLocalDirty = false
      providerTrafficLastPushAt = Date.now()
      return
    }

    if (res?.error === 'conflict') {
      const remoteRev = Number(res.rev ?? providerTrafficRemoteRev.value) || providerTrafficRemoteRev.value
      providerTrafficRemoteRev.value = remoteRev
      providerTrafficRemoteUpdatedAt.value = String(res.updatedAt || '').trim()
      const content = decodeB64Utf8(String(res.contentB64 || ''))
      const parsed = content ? safeParse<ProviderTrafficRemotePayload>(content, buildRemotePayload()) : buildRemotePayload()
      applyRemotePayload(parsed)
      const retryBody = JSON.stringify(buildRemotePayload())
      const retry: any = await agentProviderTrafficPutAPI({ rev: remoteRev, content: retryBody })
      if (retry?.ok) {
        providerTrafficRemoteRev.value = Number(retry.rev ?? remoteRev + 1) || remoteRev + 1
        providerTrafficRemoteUpdatedAt.value = String(retry.updatedAt || '').trim()
        providerTrafficLocalDirty = false
        providerTrafficLastPushAt = Date.now()
      }
    }
  } finally {
    providerTrafficPushInFlight = false
  }
}

const scheduleProviderTrafficRemotePush = debounce(() => {
  pushProviderTrafficRemoteNow()
}, REMOTE_PUSH_DEBOUNCE_MS)

const markProviderTrafficDirty = () => {
  if (providerTrafficSuppressRemotePush > 0) {
    providerTrafficSuppressRemotePush -= 1
    return
  }
  providerTrafficLocalDirty = true
  scheduleProviderTrafficRemotePush()
}

const pullProviderTrafficRemote = async () => {
  if (!agentEnabled.value || providerTrafficPullInFlight) return
  providerTrafficPullInFlight = true
  try {
    const res: any = await agentProviderTrafficGetAPI()
    if (!res?.ok) return
    providerTrafficRemoteRev.value = Number(res.rev ?? 0) || 0
    providerTrafficRemoteUpdatedAt.value = String(res.updatedAt || '').trim()
    providerTrafficLastPullAt = Date.now()
    const content = decodeB64Utf8(String(res.contentB64 || ''))
    const parsed = content ? safeParse<ProviderTrafficRemotePayload>(content, buildRemotePayload()) : buildRemotePayload()
    applyRemotePayload(parsed)
    providerTrafficRemoteBootstrapped = true
    if (providerTrafficLocalDirty) scheduleProviderTrafficRemotePush()
  } finally {
    providerTrafficPullInFlight = false
  }
}

export const initProviderTrafficSync = () => {
  if (providerTrafficSyncStarted || typeof window === 'undefined') return
  providerTrafficSyncStarted = true

  watch(
    agentEnabled,
    async (enabled) => {
      if (!enabled) {
        providerTrafficRemoteBootstrapped = false
        return
      }
      await pullProviderTrafficRemote()
      providerTrafficRemoteBootstrapped = true
      if (providerTrafficLocalDirty) scheduleProviderTrafficRemotePush()
    },
    { immediate: true },
  )

  window.setInterval(() => {
    if (!agentEnabled.value) return
    if (providerTrafficPullInFlight || providerTrafficPushInFlight) return
    if (Date.now() - providerTrafficLastPullAt < REMOTE_PULL_INTERVAL_MS) return
    pullProviderTrafficRemote()
  }, 30_000)

  window.setInterval(() => {
    if (!agentEnabled.value) return
    if (!providerTrafficLocalDirty) return
    if (providerTrafficPullInFlight || providerTrafficPushInFlight) return
    if (!providerTrafficRemoteBootstrapped) return
    if (Date.now() - providerTrafficLastPushAt < REMOTE_PUSH_INTERVAL_MS) return
    pushProviderTrafficRemoteNow()
  }, 20_000)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return
    if (!agentEnabled.value || !providerTrafficLocalDirty) return
    if (Date.now() - providerTrafficLastHiddenPushAt < REMOTE_HIDDEN_PUSH_THROTTLE_MS) return
    providerTrafficLastHiddenPushAt = Date.now()
    pushProviderTrafficRemoteNow()
  })
}

loadTrafficTotals()
loadDailyTrafficTotals()
loadConnTotals()
loadSessionResetAt()

export const providerProxyNames = (provider: any): string[] => {
  const raw = provider?.proxies
  const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : []
  return (items as any[])
    .map((node: any) => (typeof node === 'string' ? node : node?.name))
    .map((name: any) => String(name || '').trim())
    .filter(Boolean)
}

const pushCandidate = (out: string[], value: unknown) => {
  const name = String(value || '').trim()
  if (name) out.push(name)
}

const pushCandidateList = (out: string[], value: unknown, reverse = false) => {
  const arr = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Record<string, unknown>)
      : []
  const items = reverse ? [...arr].reverse() : arr
  for (const item of items) pushCandidate(out, item)
}

export const connectionProviderCandidates = (conn: any): string[] => {
  const candidates: string[] = []
  pushCandidateList(candidates, (conn as any)?.providerChains, true)
  pushCandidateList(candidates, (conn as any)?.metadata?.providerChains, true)
  pushCandidate(candidates, (conn as any)?.provider)
  pushCandidate(candidates, (conn as any)?.providerName)
  pushCandidate(candidates, (conn as any)?.['provider-name'])
  pushCandidate(candidates, (conn as any)?.metadata?.provider)
  pushCandidate(candidates, (conn as any)?.metadata?.providerName)
  pushCandidate(candidates, (conn as any)?.metadata?.['provider-name'])
  const out: string[] = []
  const seen = new Set<string>()
  for (const name of candidates) {
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

export const connectionProxyCandidates = (conn: any): string[] => {
  const candidates: string[] = []
  const specialProxy = String(conn?.metadata?.specialProxy || '').trim()
  if (specialProxy) candidates.push(specialProxy)
  pushCandidate(candidates, (conn as any)?.metadata?.proxy)
  pushCandidate(candidates, (conn as any)?.metadata?.proxyName)
  pushCandidate(candidates, (conn as any)?.metadata?.['proxy-name'])
  const chains = Array.isArray(conn?.chains) ? conn.chains : []
  for (let i = chains.length - 1; i >= 0; i--) {
    const name = String(chains[i] || '').trim()
    if (name) candidates.push(name)
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const name of candidates) {
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

const resolvedProxyCandidateNames = (name: string): string[] => {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown) => {
    const next = String(value || '').trim()
    if (!next || seen.has(next)) return
    seen.add(next)
    out.push(next)
  }

  const candidate = String(name || '').trim()
  if (!candidate) return out

  push(candidate)

  const node = (proxyMap.value || {})[candidate] as any
  if (node?.now) push(node.now)

  try {
    push(getNowProxyNodeName(candidate))
  } catch {
    // ignore
  }

  if (node?.now) {
    try {
      push(getNowProxyNodeName(String(node.now || '').trim()))
    } catch {
      // ignore
    }
  }

  return out
}

export const connectionMatchesProviderProxyNames = (conn: any, proxyNames: Iterable<string>): string => {
  const set = proxyNames instanceof Set ? proxyNames : new Set(Array.from(proxyNames || []))
  for (const proxyName of connectionProxyCandidates(conn)) {
    for (const alias of resolvedProxyCandidateNames(proxyName)) {
      if (set.has(alias)) return alias
    }

    const node = (proxyMap.value || {})[String(proxyName || '').trim()] as any
    const members = Array.isArray(node?.all) ? node.all : []
    if (!members.length || members.length > 16) continue

    for (const member of members) {
      const candidate = String(member || '').trim()
      if (!candidate) continue
      if (set.has(candidate)) return candidate
      try {
        const resolved = getNowProxyNodeName(candidate)
        if (set.has(resolved)) return resolved
      } catch {
        // ignore
      }
    }
  }
  return ''
}

export const connectionMatchesProvider = (conn: any, providerName: string, proxyNames: Iterable<string>): string => {
  const provider = String(providerName || '').trim()
  if (provider) {
    const providerCandidates = connectionProviderCandidates(conn)
    for (const candidate of providerCandidates) {
      if (candidate === provider) return connectionProxyCandidates(conn)[0] || provider
    }
  }
  return connectionMatchesProviderProxyNames(conn, proxyNames)
}

watch(
  [activeConnections, closedConnections, proxyProviederList],
  ([list, closedList, providers]) => {
    if (todayKey() !== safeParse<DailyTrafficStore>(typeof localStorage === 'undefined' ? null : localStorage.getItem(DAILY_STORAGE_KEY), { day: todayKey(), totals: {} }).day) {
      dailyTrafficTotals.value = {}
      saveDailyTrafficTotals()
      markProviderTrafficDirty()
    }

    const now = Date.now()
    const dt = Math.max(1, (now - lastTickAt) / 1000)
    lastTickAt = now
    const current: Record<string, ProviderActivity> = {}
    const providerProxySets = new Map<string, Set<string>>()
    const liveCurrentByProvider: Record<string, { dl: number; ul: number }> = {}
    const liveTodayByProvider: Record<string, { dl: number; ul: number }> = {}

    for (const p of providers || []) {
      const providerName = String((p as any)?.name || '').trim()
      if (!providerName) continue
      current[providerName] = emptyActivity()
      providerProxySets.set(providerName, new Set(providerProxyNames(p as any)))
    }

    const perProxyBytes: Record<string, number> = {}
    const seen = new Set<string>()
    let totalsChanged = false
    let dailyChanged = false
    let connTotalsChanged = false

    const processConnection = (c: any, mode: 'active' | 'closed') => {
      const id = String((c as any)?.id || '').trim()
      if (!id) return

      const curDl = Number((c as any)?.download ?? 0) || 0
      const curUl = Number((c as any)?.upload ?? 0) || 0
      const curSpeedDl = mode === 'active' ? (Number((c as any)?.downloadSpeed ?? 0) || 0) : 0
      const curSpeedUl = mode === 'active' ? (Number((c as any)?.uploadSpeed ?? 0) || 0) : 0
      const curSpeed = curSpeedDl + curSpeedUl
      const curBytes = curDl + curUl
      const start = String((c as any)?.start || '')

      for (const [providerName, proxyNames] of providerProxySets.entries()) {
        if (!proxyNames.size) continue
        const proxyName = connectionMatchesProvider(c as any, providerName, proxyNames)
        if (!proxyName) continue

        const seenKey = `${providerName}\u0000${id}`
        if (seen.has(seenKey)) continue
        seen.add(seenKey)

        const rec = current[providerName] || (current[providerName] = emptyActivity())
        if (mode === 'active') {
          rec.connections += 1
          rec.currentBytes += curBytes
          rec.speed += curSpeed
          rec.active = true

          const liveTotals = liveCurrentByProvider[providerName] || { dl: 0, ul: 0 }
          liveTotals.dl += curDl
          liveTotals.ul += curUl
          liveCurrentByProvider[providerName] = liveTotals
          if (isLocalToday(start)) {
            const todayLiveTotals = liveTodayByProvider[providerName] || { dl: 0, ul: 0 }
            todayLiveTotals.dl += curDl
            todayLiveTotals.ul += curUl
            liveTodayByProvider[providerName] = todayLiveTotals
          }

          const proxyKey = `${providerName}|${proxyName}`
          perProxyBytes[proxyKey] = (perProxyBytes[proxyKey] || 0) + curBytes
        }

        let prev = connTotals.get(seenKey)
        if (prev && prev.start && start && prev.start !== start) prev = undefined

        let dDl = 0
        let dUl = 0
        if (prev) {
          dDl = curDl - (prev.dl || 0)
          dUl = curUl - (prev.ul || 0)
        } else if (isLocalToday(start)) {
          dDl = curDl
          dUl = curUl
        }
        if (!Number.isFinite(dDl) || dDl < 0) dDl = 0
        if (!Number.isFinite(dUl) || dUl < 0) dUl = 0

        if (mode === 'active' && dDl <= 0 && dUl <= 0 && (curSpeedDl > 0 || curSpeedUl > 0)) {
          dDl = Math.max(0, curSpeedDl * dt * FALLBACK_SPEED_MULTIPLIER)
          dUl = Math.max(0, curSpeedUl * dt * FALLBACK_SPEED_MULTIPLIER)
        }

        if (dDl > 0 || dUl > 0) {
          const totals = trafficTotals.value[providerName] || { dl: 0, ul: 0 }
          const nextDl = (Number(totals.dl || 0) || 0) + dDl
          const nextUl = (Number(totals.ul || 0) || 0) + dUl
          if (nextDl !== totals.dl || nextUl !== totals.ul) totalsChanged = true
          totals.dl = nextDl
          totals.ul = nextUl
          totals.updatedAt = now
          trafficTotals.value[providerName] = totals

          const daily = dailyTrafficTotals.value[providerName] || { dl: 0, ul: 0 }
          const nextDailyDl = (Number(daily.dl || 0) || 0) + dDl
          const nextDailyUl = (Number(daily.ul || 0) || 0) + dUl
          if (nextDailyDl !== daily.dl || nextDailyUl !== daily.ul) dailyChanged = true
          daily.dl = nextDailyDl
          daily.ul = nextDailyUl
          daily.updatedAt = now
          dailyTrafficTotals.value[providerName] = daily
        }

        const prevConn = connTotals.get(seenKey)
        if (!prevConn || prevConn.dl !== curDl || prevConn.ul !== curUl || prevConn.start !== (start || undefined) || prevConn.provider !== providerName) {
          connTotalsChanged = true
        }
        connTotals.set(seenKey, { provider: providerName, dl: curDl, ul: curUl, start: start || undefined, seenAt: now })
      }
    }

    for (const c of list || []) processConnection(c, 'active')
    for (const c of closedList || []) processConnection(c, 'closed')

    for (const id of Array.from(connTotals.keys())) {
      if (!seen.has(id)) {
        connTotals.delete(id)
        connTotalsChanged = true
      }
    }

    for (const [providerName, totals] of Object.entries(trafficTotals.value || {})) {
      const rec = current[providerName] || (current[providerName] = emptyActivity())
      rec.download = Number(totals?.dl ?? 0) || 0
      rec.upload = Number(totals?.ul ?? 0) || 0
      rec.bytes = rec.download + rec.upload
      rec.updatedAt = Number(totals?.updatedAt ?? 0) || undefined
    }

    for (const [providerName, totals] of Object.entries(dailyTrafficTotals.value || {})) {
      const rec = current[providerName] || (current[providerName] = emptyActivity())
      rec.todayDownload = Number(totals?.dl ?? 0) || 0
      rec.todayUpload = Number(totals?.ul ?? 0) || 0
      rec.todayBytes = rec.todayDownload + rec.todayUpload
      rec.updatedAt = Math.max(Number(rec.updatedAt || 0), Number(totals?.updatedAt ?? 0) || 0) || undefined
    }

    for (const [providerName, rec] of Object.entries(current)) {
      const liveTotals = liveCurrentByProvider[providerName]
      if (liveTotals) {
        const liveBytes = Math.max(0, Number(liveTotals.dl || 0)) + Math.max(0, Number(liveTotals.ul || 0))
        if (liveBytes > rec.bytes) {
          rec.download = Math.max(rec.download, Math.max(0, Number(liveTotals.dl || 0)))
          rec.upload = Math.max(rec.upload, Math.max(0, Number(liveTotals.ul || 0)))
          rec.bytes = rec.download + rec.upload
          const totals = trafficTotals.value[providerName] || { dl: 0, ul: 0 }
          const nextDl = Math.max(Number(totals.dl || 0), rec.download)
          const nextUl = Math.max(Number(totals.ul || 0), rec.upload)
          if (nextDl !== totals.dl || nextUl !== totals.ul) totalsChanged = true
          totals.dl = nextDl
          totals.ul = nextUl
          totals.updatedAt = now
          trafficTotals.value[providerName] = totals
          rec.updatedAt = Math.max(Number(rec.updatedAt || 0), now) || undefined
        }
      }

      const dailyLiveTotals = liveTodayByProvider[providerName]
      const dailyLiveBytes = dailyLiveTotals
        ? Math.max(0, Number(dailyLiveTotals.dl || 0)) + Math.max(0, Number(dailyLiveTotals.ul || 0))
        : 0
      const fallbackDailyBytes = rec.todayBytes <= 0 && rec.currentBytes > 0 ? rec.currentBytes : 0
      if (dailyLiveBytes > rec.todayBytes || fallbackDailyBytes > rec.todayBytes) {
        const nextTodayDl = dailyLiveBytes > 0
          ? Math.max(rec.todayDownload, Math.max(0, Number(dailyLiveTotals?.dl || 0)))
          : Math.max(rec.todayDownload, Math.max(0, Number(liveTotals?.dl || 0)))
        const nextTodayUl = dailyLiveBytes > 0
          ? Math.max(rec.todayUpload, Math.max(0, Number(dailyLiveTotals?.ul || 0)))
          : Math.max(rec.todayUpload, Math.max(0, Number(liveTotals?.ul || 0)))
        rec.todayDownload = nextTodayDl
        rec.todayUpload = nextTodayUl
        rec.todayBytes = rec.todayDownload + rec.todayUpload
        const daily = dailyTrafficTotals.value[providerName] || { dl: 0, ul: 0 }
        const nextDl = Math.max(Number(daily.dl || 0), rec.todayDownload)
        const nextUl = Math.max(Number(daily.ul || 0), rec.todayUpload)
        if (nextDl !== daily.dl || nextUl !== daily.ul) dailyChanged = true
        daily.dl = nextDl
        daily.ul = nextUl
        daily.updatedAt = now
        dailyTrafficTotals.value[providerName] = daily
        rec.updatedAt = Math.max(Number(rec.updatedAt || 0), now) || undefined
      }
    }

    for (const [key, value] of Object.entries(perProxyBytes)) {
      const idx = key.indexOf('|')
      if (idx < 0) continue
      const providerName = key.slice(0, idx)
      const proxyName = key.slice(idx + 1)
      const rec = current[providerName]
      if (!rec) continue
      if (value > rec.activeProxyBytes) {
        rec.activeProxyBytes = value
        rec.activeProxy = proxyName
      }
    }

    providerActivityCurrent.value = current
    saveTrafficTotals()
    saveDailyTrafficTotals()
    saveConnTotals()
    if (totalsChanged || dailyChanged || connTotalsChanged) markProviderTrafficDirty()
  },
  { immediate: true, deep: false },
)

export const providerActivityByName = computed<Record<string, ProviderActivity>>(() => providerActivityCurrent.value || {})

export const providerActivitySnapshot = ref<Record<string, ProviderActivity>>({})
watch(
  providerActivityByName,
  throttle(
    (v) => {
      providerActivitySnapshot.value = v || {}
    },
    30_000,
    { leading: true, trailing: true },
  ),
  { immediate: true, deep: true },
)

export const providerLiveStatusByName = computed<Record<string, ProviderLiveStatus>>(() => {
  const out: Record<string, ProviderLiveStatus> = {}
  const list = activeConnections.value || []
  for (const provider of proxyProviederList.value || []) {
    const providerName = String((provider as any)?.name || '').trim()
    if (!providerName) continue
    const names = new Set(providerProxyNames(provider as any))
    if (!names.size) {
      out[providerName] = { connections: 0, active: false }
      continue
    }
    let connections = 0
    for (const c of list) {
      if (connectionMatchesProvider(c as any, providerName, names)) connections += 1
    }
    out[providerName] = { connections, active: connections > 0 }
  }
  return out
})

export const providerTrafficSyncState = computed(() => ({
  enabled: !!agentEnabled.value,
  bootstrapped: providerTrafficRemoteBootstrapped,
  pulling: providerTrafficPullInFlight,
  pushing: providerTrafficPushInFlight,
  dirty: providerTrafficLocalDirty,
  rev: Number(providerTrafficRemoteRev.value || 0) || 0,
  remoteUpdatedAt: String(providerTrafficRemoteUpdatedAt.value || '').trim(),
  lastPullAt: Number(providerTrafficLastPullAt || 0) || 0,
  lastPushAt: Number(providerTrafficLastPushAt || 0) || 0,
}))

export const providerTrafficPullNow = async () => {
  await pullProviderTrafficRemote()
}

export const providerTrafficPushNow = async () => {
  await pushProviderTrafficRemoteNow()
}

export const clearProviderTrafficSession = () => {
  sessionResetAt.value = Date.now()
  saveSessionResetAt()
  trafficTotals.value = {}
  providerActivityCurrent.value = {}
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
  providerTrafficLocalDirty = true
  scheduleProviderTrafficRemotePush()
}
