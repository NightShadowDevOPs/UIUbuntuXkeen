import { agentUsersDbGetAPI, agentUsersDbHistoryAPI, agentUsersDbPutAPI, agentUsersDbRestoreAPI } from '@/api/agent'
import { decodeB64Utf8 } from '@/helper/b64'
import type { SourceIPLabel } from '@/types'
import { normalizeProviderIcon } from '@/helper/providerIcon'
import { useStorage } from '@vueuse/core'
import { debounce, isEqual } from 'lodash'
import { computed, ref, watch } from 'vue'
import { agentEnabled } from './agent'
import { proxyProviderIconMap, proxyProviderPanelUrlMap, proxyProviderSslWarnDaysMap, sourceIPLabelList, sslNearExpiryDaysDefault, tunnelInterfaceDescriptionMap } from './settings'
import { proxyAccessPolicyMode, type ProxyAccessPolicyMode } from './proxyAccess'
import { providerSslDbMeta, providerSslDbSnapshot, type ProviderSslDbItem, type ProviderSslDbMeta } from './providerSslDb'
import { userLimits, type UserLimit, type UserLimitsStore } from './userLimits'

/**
 * Shared users database stored on the router via router-agent.
 *
 * We keep Source IP labels + a couple of shared UI settings in a single payload.
 *
 * Goals:
 * - Sync enabled by default.
 * - Auto pull on start / when agent becomes available.
 * - Debounced auto push on local changes.
 * - Offline fallback to localStorage and catch-up when the agent is back.
 * - Conflict-safe revision (agent side).
 */

export type UsersDbSyncPhase = 'disabled' | 'idle' | 'pulling' | 'pushing' | 'offline' | 'conflict' | 'error'

export const usersDbSyncEnabled = useStorage<boolean>('config/users-db-sync-enabled', true)

export const usersDbRemoteRev = useStorage<number>('runtime/users-db-remote-rev-v1', 0)
export const usersDbRemoteUpdatedAt = useStorage<string>('runtime/users-db-remote-updated-at-v1', '')

export const usersDbLastPullAt = useStorage<number>('runtime/users-db-last-pull-at-v1', 0)
export const usersDbLastPushAt = useStorage<number>('runtime/users-db-last-push-at-v1', 0)
export const usersDbLastError = useStorage<string>('runtime/users-db-last-error-v1', '')

export const usersDbConflictAt = useStorage<number>('runtime/users-db-conflict-at-v1', 0)
export const usersDbConflictCount = useStorage<number>('runtime/users-db-conflict-count-v1', 0)

// Conflict context (for manual resolution UI)
export const usersDbConflictRemoteRev = useStorage<number>('runtime/users-db-conflict-remote-rev-v1', 0)
export const usersDbConflictRemoteUpdatedAt = useStorage<string>('runtime/users-db-conflict-remote-updated-at-v1', '')
export const usersDbConflictRemoteB64 = useStorage<string>('runtime/users-db-conflict-remote-b64-v1', '')
export const usersDbConflictLocalB64 = useStorage<string>('runtime/users-db-conflict-local-b64-v1', '')


// Snapshot of the last successfully synced payload (used for per-item synced markers).
export const usersDbLastSyncedLabels = useStorage<SourceIPLabel[]>('runtime/users-db-last-synced-labels-v1', [])
export const usersDbLastSyncedProviderPanelUrls = useStorage<Record<string, string>>(
  'runtime/users-db-last-synced-provider-panel-urls-v1',
  {},
)

export const usersDbLastSyncedProviderIcons = useStorage<Record<string, string>>(
  'runtime/users-db-last-synced-provider-icons-v1',
  {},
)

export const usersDbLastSyncedSslNearExpiryDaysDefault = useStorage<number>(
  'runtime/users-db-last-synced-ssl-near-expiry-days-default-v1',
  2,
)

export const usersDbLastSyncedProviderSslWarnDaysMap = useStorage<Record<string, number>>(
  'runtime/users-db-last-synced-provider-ssl-warn-days-map-v1',
  {},
)

export const usersDbLastSyncedTunnelInterfaceDescriptions = useStorage<Record<string, string>>(
  'runtime/users-db-last-synced-tunnel-interface-descriptions-v1',
  {},
)

// When agent is offline/disabled, keep local edits and sync later.
export const usersDbLocalDirty = useStorage<boolean>('runtime/users-db-local-dirty-v1', false)

export const usersDbPhase = ref<UsersDbSyncPhase>('idle')

export const usersDbSyncActive = computed(() => {
  return Boolean(usersDbSyncEnabled.value && agentEnabled.value)
})

// ---- payload helpers ----

type UsersDbPayload = {
  labels: SourceIPLabel[]
  providerPanelUrls: Record<string, string>
  providerIcons: Record<string, string>
  sslNearExpiryDaysDefault: number
  providerSslWarnDaysMap: Record<string, number>
  tunnelInterfaceDescriptions: Record<string, string>
  userLimits: UserLimitsStore
  proxyAccessPolicyMode: ProxyAccessPolicyMode
  providerSslSnapshots: Record<string, ProviderSslDbItem>
  providerSslMeta: ProviderSslDbMeta
}

export type UsersDbDiff = {
  safeAutoMerge: boolean
  labels: {
    localOnly: SourceIPLabel[]
    remoteOnly: SourceIPLabel[]
    changed: Array<{ key: string; local: SourceIPLabel; remote: SourceIPLabel }>
  }
  urls: {
    localOnly: Array<{ provider: string; url: string }>
    remoteOnly: Array<{ provider: string; url: string }>
    changed: Array<{ provider: string; local: string; remote: string }>
  }
  icons: {
    localOnly: Array<{ provider: string; icon: string }>
    remoteOnly: Array<{ provider: string; icon: string }>
    changed: Array<{ provider: string; local: string; remote: string }>
  }
  tunnels: {
    localOnly: Array<{ name: string; description: string }>
    remoteOnly: Array<{ name: string; description: string }>
    changed: Array<{ name: string; local: string; remote: string }>
  }
  ssl: {
    defaultDays: { local: number; remote: number; changed: boolean }
    providerDays: {
      localOnly: Array<{ provider: string; days: number }>
      remoteOnly: Array<{ provider: string; days: number }>
      changed: Array<{ provider: string; local: number; remote: number }>
    }
  }
  userLimits: {
    localOnly: Array<{ user: string; local: UserLimit }>
    remoteOnly: Array<{ user: string; remote: UserLimit }>
    changed: Array<{ user: string; local: UserLimit; remote: UserLimit }>
  }
}

export type UsersDbSmartChoiceMode = 'local' | 'remote' | 'custom'

export type UsersDbSmartMergeChoices = {
  // Keyed by SourceIPLabel.key
  labels?: Record<string, { mode: UsersDbSmartChoiceMode; customLabel?: string }>
  // Keyed by provider name
  urls?: Record<string, { mode: UsersDbSmartChoiceMode; customUrl?: string }>
  // Keyed by provider name
  icons?: Record<string, { mode: UsersDbSmartChoiceMode; customIcon?: string }>
  // Keyed by tunnel interface name
  tunnels?: Record<string, { mode: UsersDbSmartChoiceMode; customDescription?: string }>
  // Global SSL near-expiry days
  sslDefault?: { mode: UsersDbSmartChoiceMode; customDays?: number }
  // Keyed by provider name
  warnDays?: Record<string, { mode: UsersDbSmartChoiceMode; customDays?: number }>
}

export type UsersDbHistoryItem = {
  rev: number
  updatedAt?: string
  current?: boolean
}


// Deterministic small hash (djb2) to generate stable ids for legacy entries missing `id`.
const djb2 = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i)
  }
  // force uint32
  return (h >>> 0).toString(16)
}

// UTF-8 safe base64 encoding (browser)
const encodeB64Utf8 = (s?: string) => {
  const str = (s || '').toString()
  try {
    // eslint-disable-next-line no-undef
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    try {
      // eslint-disable-next-line no-undef
      return btoa(str)
    } catch {
      return ''
    }
  }
}



const isLikelySourceKey = (k: string) => {
  const key = (k || '').trim()
  if (!key) return false
  // allow regex: /.../
  if (key.startsWith('/')) return true
  // disallow whitespace in non-regex keys
  if (/\s/.test(key)) return false
  // allow CIDR
  if (key.includes('/')) return true
  // allow IPv4 / IPv6 / EUI64 suffixes
  if (key.includes('.') || key.includes(':')) return true
  // allow pure hex suffix (rare, but used for IPv6 endsWith matching)
  if (/^[0-9a-fA-F]{2,}$/.test(key)) return true
  return false
}
const normalizeLabel = (x: any): SourceIPLabel | null => {
  if (!x || typeof x !== 'object') return null
  const key = String((x as any).key || '').trim()
  const label = String((x as any).label || '').trim()
  if (!isLikelySourceKey(key)) return null
  const scope = Array.isArray((x as any).scope) ? ((x as any).scope as any[]).map(String) : undefined
  if (!key || !label) return null

  let id = String((x as any).id || '').trim()
  if (!id) {
    const scopeSig = scope && scope.length ? [...scope].sort().join(',') : ''
    id = `legacy_${djb2(`${key}|${label}|${scopeSig}`)}`
  }

  const o: SourceIPLabel = { key, label, id }
  if (scope && scope.length) o.scope = scope
  const mac = String((x as any).mac || '').trim().toLowerCase()
  const hostname = String((x as any).hostname || '').trim()
  const source = String((x as any).source || '').trim()
  if (mac) o.mac = mac
  if (hostname) o.hostname = hostname
  if (source) o.source = source
  if (typeof (x as any).proxyAccess === 'boolean') o.proxyAccess = !!(x as any).proxyAccess
  return o
}

const sortLabels = (labels: SourceIPLabel[]) => {
  return [...(labels || [])].sort((a: any, b: any) => {
    const ak = String(a?.key || '')
    const bk = String(b?.key || '')
    if (ak !== bk) return ak.localeCompare(bk)
    const al = String(a?.label || '')
    const bl = String(b?.label || '')
    if (al !== bl) return al.localeCompare(bl)
    return String(a?.id || '').localeCompare(String(b?.id || ''))
  })
}

const sanitizeLabels = (raw: any): SourceIPLabel[] => {
  try {
    if (!Array.isArray(raw)) return []
    const out = raw.map(normalizeLabel).filter(Boolean) as SourceIPLabel[]

    // Deduplicate by key (prefer last) and stabilize order.
    const byKey = new Map<string, SourceIPLabel>()
    for (const it of out) {
      const k = String(it?.key || '').trim()
      if (!k) continue
      byKey.set(k, it)
    }
    return sortLabels(Array.from(byKey.values()))
  } catch {
    return []
  }
}

const sanitizeUrlMap = (raw: any): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const vv = String(v || '').trim()
    if (!vv) continue
    out[kk] = vv
  }
  return out
}

const sanitizeIconMap = (raw: any): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const nv = normalizeProviderIcon(v)
    if (!nv) continue
    out[kk] = nv
  }
  return out
}

const sanitizeTunnelDescriptionMap = (raw: any): Record<string, string> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) {
    const kk = String(k || '').trim().toLowerCase()
    if (!kk) continue
    const vv = String(v || '').trim()
    if (!vv) continue
    out[kk] = vv
  }
  return out
}


const sanitizeInt = (v: any, def: number, min: number, max: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

const sanitizeNumMap = (raw: any): Record<string, number> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    if (!Number.isFinite(n)) continue
    out[kk] = Math.max(0, Math.min(365, Math.trunc(n)))
  }
  return out
}


const sanitizeProxyAccessPolicyMode = (raw: any): ProxyAccessPolicyMode => {
  return String(raw || '').trim() === 'allowListOnly' ? 'allowListOnly' : 'allowAll'
}

const sanitizeProviderSslSnapshots = (raw: any): Record<string, ProviderSslDbItem> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, ProviderSslDbItem> = {}
  for (const [key, value] of Object.entries(raw)) {
    const name = String(key || '').trim()
    if (!name) continue
    const row = value && typeof value === 'object' ? (value as any) : {}
    const checkedAtMs = Number(row.checkedAtMs)
    out[name] = {
      name,
      url: String(row.url || '').trim() || undefined,
      host: String(row.host || '').trim() || undefined,
      port: String(row.port || '').trim() || undefined,
      sslNotAfter: String(row.sslNotAfter || '').trim() || undefined,
      panelUrl: String(row.panelUrl || '').trim() || undefined,
      panelSslNotAfter: String(row.panelSslNotAfter || '').trim() || undefined,
      checkedAtMs: Number.isFinite(checkedAtMs) && checkedAtMs > 0 ? Math.trunc(checkedAtMs) : undefined,
    }
  }
  return out
}

const sanitizeProviderSslMeta = (raw: any): ProviderSslDbMeta => {
  const row = raw && typeof raw === 'object' ? (raw as any) : {}
  const checkedAtMs = Number(row.checkedAtMs)
  const nextRefreshAtMs = Number(row.nextRefreshAtMs)
  return {
    checkedAtMs: Number.isFinite(checkedAtMs) && checkedAtMs > 0 ? Math.trunc(checkedAtMs) : 0,
    nextRefreshAtMs: Number.isFinite(nextRefreshAtMs) && nextRefreshAtMs > 0 ? Math.trunc(nextRefreshAtMs) : 0,
    cacheFresh: !!row.cacheFresh,
    cacheReady: !!row.cacheReady,
    refreshing: !!row.refreshing,
  }
}

const sanitizeUserLimit = (raw: any): UserLimit => {
  const out: UserLimit = {}
  if (!raw || typeof raw !== 'object') return out

  const mac = String((raw as any).mac || '').trim().toLowerCase()
  if (mac) out.mac = mac
  if (typeof (raw as any).enabled === 'boolean') out.enabled = !!(raw as any).enabled
  if (typeof (raw as any).disabled === 'boolean') out.disabled = !!(raw as any).disabled

  const trafficLimitBytes = Number((raw as any).trafficLimitBytes)
  if (Number.isFinite(trafficLimitBytes) && trafficLimitBytes >= 0) out.trafficLimitBytes = Math.trunc(trafficLimitBytes)

  const trafficLimitUnit = String((raw as any).trafficLimitUnit || '').trim()
  if (trafficLimitUnit === 'MB' || trafficLimitUnit === 'GB') out.trafficLimitUnit = trafficLimitUnit as 'MB' | 'GB'

  const trafficPeriod = String((raw as any).trafficPeriod || '').trim()
  if (trafficPeriod === '1d' || trafficPeriod === '30d' || trafficPeriod === 'month') out.trafficPeriod = trafficPeriod as any

  const resetAt = Number((raw as any).resetAt)
  if (Number.isFinite(resetAt) && resetAt > 0) out.resetAt = Math.trunc(resetAt)

  const resetHourKey = String((raw as any).resetHourKey || '').trim()
  if (resetHourKey) out.resetHourKey = resetHourKey

  const resetHourDl = Number((raw as any).resetHourDl)
  if (Number.isFinite(resetHourDl) && resetHourDl >= 0) out.resetHourDl = Math.trunc(resetHourDl)

  const resetHourUl = Number((raw as any).resetHourUl)
  if (Number.isFinite(resetHourUl) && resetHourUl >= 0) out.resetHourUl = Math.trunc(resetHourUl)

  const bandwidthLimitBps = Number((raw as any).bandwidthLimitBps)
  if (Number.isFinite(bandwidthLimitBps) && bandwidthLimitBps >= 0) out.bandwidthLimitBps = Math.trunc(bandwidthLimitBps)

  return out
}

const sanitizeUserLimits = (raw: any): UserLimitsStore => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: UserLimitsStore = {}
  for (const [k, v] of Object.entries(raw)) {
    const kk = String(k || '').trim()
    if (!kk) continue
    out[kk] = sanitizeUserLimit(v)
  }
  return out
}

const mergeUserLimits = (remote: UserLimitsStore, local: UserLimitsStore): UserLimitsStore => {
  const out: UserLimitsStore = { ...(remote || {}) }
  for (const [k, v] of Object.entries(local || {})) {
    const kk = String(k || '').trim()
    if (!kk) continue
    out[kk] = sanitizeUserLimit(v)
  }
  return sanitizeUserLimits(out)
}

const normalizePayload = (p: UsersDbPayload): UsersDbPayload => {
  const labels = sortLabels(sanitizeLabels(p?.labels || []))
  const urls = sanitizeUrlMap(p?.providerPanelUrls || {})
  const icons = sanitizeIconMap((p as any)?.providerIcons || (p as any)?.proxyProviderIcons || (p as any)?.proxyProviderIconMap || {})
  const sslNear = sanitizeInt((p as any)?.sslNearExpiryDaysDefault, 2, 0, 365)
  const warnMap = sanitizeNumMap((p as any)?.providerSslWarnDaysMap)
  const tunnelMap = sanitizeTunnelDescriptionMap((p as any)?.tunnelInterfaceDescriptions || (p as any)?.tunnelInterfaceDescriptionMap || {})
  const proxyAccessMode = sanitizeProxyAccessPolicyMode((p as any)?.proxyAccessPolicyMode)
  const providerSslSnapshots = sanitizeProviderSslSnapshots((p as any)?.providerSslSnapshots || (p as any)?.providerSslState)
  const providerSslMetaValue = sanitizeProviderSslMeta((p as any)?.providerSslMeta)
  return {
    labels,
    providerPanelUrls: urls,
    providerIcons: icons,
    sslNearExpiryDaysDefault: sslNear,
    providerSslWarnDaysMap: warnMap,
    tunnelInterfaceDescriptions: tunnelMap,
    userLimits: sanitizeUserLimits((p as any)?.userLimits),
    proxyAccessPolicyMode: proxyAccessMode,
    providerSslSnapshots,
    providerSslMeta: providerSslMetaValue,
  }
}

const labelSig = (x: any) => {
  const scope = Array.isArray(x?.scope) ? (x.scope as any[]).map(String).sort().join(',') : ''
  return `${String(x?.label || '').trim()}|${scope}|${String(x?.mac || '').trim().toLowerCase()}|${String(x?.hostname || '').trim()}|${String(x?.source || '').trim()}|${typeof x?.proxyAccess === 'boolean' ? (x.proxyAccess ? '1' : '0') : ''}`
}

export const computeUsersDbDiff = (remote: UsersDbPayload, local: UsersDbPayload): UsersDbDiff => {
  const r = normalizePayload(remote)
  const l = normalizePayload(local)

  const rByKey = new Map<string, SourceIPLabel>()
  for (const it of r.labels || []) rByKey.set(String(it.key || '').trim(), it as any)

  const lByKey = new Map<string, SourceIPLabel>()
  for (const it of l.labels || []) lByKey.set(String(it.key || '').trim(), it as any)

  const keys = new Set<string>([...rByKey.keys(), ...lByKey.keys()])

  const labelsLocalOnly: SourceIPLabel[] = []
  const labelsRemoteOnly: SourceIPLabel[] = []
  const labelsChanged: Array<{ key: string; local: SourceIPLabel; remote: SourceIPLabel }> = []

  for (const k of keys) {
    const rr = rByKey.get(k)
    const ll = lByKey.get(k)
    if (rr && !ll) labelsRemoteOnly.push(rr)
    else if (!rr && ll) labelsLocalOnly.push(ll)
    else if (rr && ll) {
      if (labelSig(rr) !== labelSig(ll)) labelsChanged.push({ key: k, local: ll, remote: rr })
    }
  }

  const urlsLocalOnly: Array<{ provider: string; url: string }> = []
  const urlsRemoteOnly: Array<{ provider: string; url: string }> = []
  const urlsChanged: Array<{ provider: string; local: string; remote: string }> = []

  const rUrls = r.providerPanelUrls || {}
  const lUrls = l.providerPanelUrls || {}
  const uKeys = new Set<string>([...Object.keys(rUrls), ...Object.keys(lUrls)])
  for (const k of uKeys) {
    const rr = String((rUrls as any)[k] || '').trim()
    const ll = String((lUrls as any)[k] || '').trim()
    if (rr && !ll) urlsRemoteOnly.push({ provider: k, url: rr })
    else if (!rr && ll) urlsLocalOnly.push({ provider: k, url: ll })
    else if (rr && ll && rr !== ll) urlsChanged.push({ provider: k, local: ll, remote: rr })
  }

  const iconsLocalOnly: Array<{ provider: string; icon: string }> = []
  const iconsRemoteOnly: Array<{ provider: string; icon: string }> = []
  const iconsChanged: Array<{ provider: string; local: string; remote: string }> = []

  const rIcons = (r as any).providerIcons || {}
  const lIcons = (l as any).providerIcons || {}
  const iKeys = new Set<string>([...Object.keys(rIcons), ...Object.keys(lIcons)])
  for (const k of iKeys) {
    const rr = normalizeProviderIcon((rIcons as any)[k])
    const ll = normalizeProviderIcon((lIcons as any)[k])
    if (rr && !ll) iconsRemoteOnly.push({ provider: k, icon: rr })
    else if (!rr && ll) iconsLocalOnly.push({ provider: k, icon: ll })
    else if (rr && ll && rr != ll) iconsChanged.push({ provider: k, local: ll, remote: rr })
  }

  const tunnelsLocalOnly: Array<{ name: string; description: string }> = []
  const tunnelsRemoteOnly: Array<{ name: string; description: string }> = []
  const tunnelsChanged: Array<{ name: string; local: string; remote: string }> = []

  const rTunnels = (r as any).tunnelInterfaceDescriptions || {}
  const lTunnels = (l as any).tunnelInterfaceDescriptions || {}
  const tKeys = new Set<string>([...Object.keys(rTunnels), ...Object.keys(lTunnels)])
  for (const k of tKeys) {
    const rr = String((rTunnels as any)[k] || '').trim()
    const ll = String((lTunnels as any)[k] || '').trim()
    if (rr && !ll) tunnelsRemoteOnly.push({ name: k, description: rr })
    else if (!rr && ll) tunnelsLocalOnly.push({ name: k, description: ll })
    else if (rr && ll && rr !== ll) tunnelsChanged.push({ name: k, local: ll, remote: rr })
  }

  const sslDefaultChanged = r.sslNearExpiryDaysDefault !== l.sslNearExpiryDaysDefault

  const rWarn = r.providerSslWarnDaysMap || {}
  const lWarn = l.providerSslWarnDaysMap || {}
  const wKeys = new Set<string>([...Object.keys(rWarn), ...Object.keys(lWarn)])
  const warnLocalOnly: Array<{ provider: string; days: number }> = []
  const warnRemoteOnly: Array<{ provider: string; days: number }> = []
  const warnChanged: Array<{ provider: string; local: number; remote: number }> = []
  for (const k of wKeys) {
    const rr = (rWarn as any)[k]
    const ll = (lWarn as any)[k]
    const rrNum = typeof rr === 'number' ? rr : typeof rr === 'string' ? Number(rr) : NaN
    const llNum = typeof ll === 'number' ? ll : typeof ll === 'string' ? Number(ll) : NaN
    const rrOk = Number.isFinite(rrNum)
    const llOk = Number.isFinite(llNum)
    if (rrOk && !llOk) warnRemoteOnly.push({ provider: k, days: Math.trunc(rrNum) })
    else if (!rrOk && llOk) warnLocalOnly.push({ provider: k, days: Math.trunc(llNum) })
    else if (rrOk && llOk && Math.trunc(rrNum) !== Math.trunc(llNum)) warnChanged.push({ provider: k, local: Math.trunc(llNum), remote: Math.trunc(rrNum) })
  }

  const rUserLimits = r.userLimits || {}
  const lUserLimits = l.userLimits || {}
  const limitKeys = new Set<string>([...Object.keys(rUserLimits), ...Object.keys(lUserLimits)])
  const userLimitsLocalOnly: Array<{ user: string; local: UserLimit }> = []
  const userLimitsRemoteOnly: Array<{ user: string; remote: UserLimit }> = []
  const userLimitsChanged: Array<{ user: string; local: UserLimit; remote: UserLimit }> = []
  for (const key of limitKeys) {
    const rr = sanitizeUserLimit((rUserLimits as any)[key])
    const ll = sanitizeUserLimit((lUserLimits as any)[key])
    const rrHas = Object.keys(rr || {}).length > 0
    const llHas = Object.keys(ll || {}).length > 0
    if (rrHas && !llHas) userLimitsRemoteOnly.push({ user: key, remote: rr })
    else if (!rrHas && llHas) userLimitsLocalOnly.push({ user: key, local: ll })
    else if (rrHas && llHas && !isEqual(rr, ll)) userLimitsChanged.push({ user: key, local: ll, remote: rr })
  }
  // Safe auto-merge only if there are NO "changed" collisions.
  const safeAutoMerge = labelsChanged.length === 0 && urlsChanged.length === 0 && iconsChanged.length === 0 && tunnelsChanged.length === 0 && !sslDefaultChanged && warnChanged.length === 0

  // Stabilize for UI
  labelsLocalOnly.sort((a: any, b: any) => String(a?.key || '').localeCompare(String(b?.key || '')))
  labelsRemoteOnly.sort((a: any, b: any) => String(a?.key || '').localeCompare(String(b?.key || '')))
  labelsChanged.sort((a, b) => a.key.localeCompare(b.key))
  urlsLocalOnly.sort((a, b) => a.provider.localeCompare(b.provider))
  urlsRemoteOnly.sort((a, b) => a.provider.localeCompare(b.provider))
  urlsChanged.sort((a, b) => a.provider.localeCompare(b.provider))
  iconsLocalOnly.sort((a, b) => a.provider.localeCompare(b.provider))
  iconsRemoteOnly.sort((a, b) => a.provider.localeCompare(b.provider))
  iconsChanged.sort((a, b) => a.provider.localeCompare(b.provider))
  tunnelsLocalOnly.sort((a, b) => a.name.localeCompare(b.name))
  tunnelsRemoteOnly.sort((a, b) => a.name.localeCompare(b.name))
  tunnelsChanged.sort((a, b) => a.name.localeCompare(b.name))

  warnLocalOnly.sort((a, b) => a.provider.localeCompare(b.provider))
  warnRemoteOnly.sort((a, b) => a.provider.localeCompare(b.provider))
  warnChanged.sort((a, b) => a.provider.localeCompare(b.provider))
  userLimitsLocalOnly.sort((a, b) => a.user.localeCompare(b.user))
  userLimitsRemoteOnly.sort((a, b) => a.user.localeCompare(b.user))
  userLimitsChanged.sort((a, b) => a.user.localeCompare(b.user))

  return {
    safeAutoMerge,
    labels: { localOnly: labelsLocalOnly, remoteOnly: labelsRemoteOnly, changed: labelsChanged },
    urls: { localOnly: urlsLocalOnly, remoteOnly: urlsRemoteOnly, changed: urlsChanged },
    icons: { localOnly: iconsLocalOnly, remoteOnly: iconsRemoteOnly, changed: iconsChanged },
    tunnels: { localOnly: tunnelsLocalOnly, remoteOnly: tunnelsRemoteOnly, changed: tunnelsChanged },
    ssl: {
      defaultDays: { local: l.sslNearExpiryDaysDefault, remote: r.sslNearExpiryDaysDefault, changed: sslDefaultChanged },
      providerDays: { localOnly: warnLocalOnly, remoteOnly: warnRemoteOnly, changed: warnChanged },
    },
    userLimits: { localOnly: userLimitsLocalOnly, remoteOnly: userLimitsRemoteOnly, changed: userLimitsChanged },
  }
}

const clearConflictContext = () => {
  usersDbConflictRemoteRev.value = 0
  usersDbConflictRemoteUpdatedAt.value = ''
  usersDbConflictRemoteB64.value = ''
  usersDbConflictLocalB64.value = ''
}

const getConflictRemotePayload = (): UsersDbPayload | null => {
  const b64 = String(usersDbConflictRemoteB64.value || '').trim()
  if (!b64) return null
  const raw = decodeB64Utf8(b64) || '{}'
  return safeParsePayload(raw)
}

export const usersDbHasConflict = computed(() => {
  return usersDbPhase.value === 'conflict' || Boolean(String(usersDbConflictRemoteB64.value || '').trim())
})

export const usersDbConflictDiff = computed<UsersDbDiff | null>(() => {
  const remotePayload = getConflictRemotePayload()
  if (!remotePayload) return null
  const localPayload = getLocalPayload()
  return computeUsersDbDiff(remotePayload, localPayload)
})

export const usersDbHistoryItems = ref<UsersDbHistoryItem[]>([])


const safeParsePayload = (raw: string): UsersDbPayload => {
  try {
    const v: any = JSON.parse(raw || '')

    // Backward compatibility: array means labels only.
    if (Array.isArray(v))
      return {
        labels: sanitizeLabels(v),
        providerPanelUrls: {},
        providerIcons: {},
        sslNearExpiryDaysDefault: 2,
        providerSslWarnDaysMap: {},
        tunnelInterfaceDescriptions: {},
        userLimits: {},
        proxyAccessPolicyMode: 'allowAll',
        providerSslSnapshots: {},
        providerSslMeta: sanitizeProviderSslMeta(null),
      }

    if (v && typeof v === 'object') {
      const labels = Array.isArray(v.labels)
        ? sanitizeLabels(v.labels)
        : Array.isArray(v.sourceIPLabelList)
          ? sanitizeLabels(v.sourceIPLabelList)
          : Array.isArray(v.users)
            ? sanitizeLabels(v.users)
            : []

      const urls =
        v.providerPanelUrls && typeof v.providerPanelUrls === 'object'
          ? sanitizeUrlMap(v.providerPanelUrls)
          : v.proxyProviderPanelUrls && typeof v.proxyProviderPanelUrls === 'object'
            ? sanitizeUrlMap(v.proxyProviderPanelUrls)
            : v.proxyProviderPanelUrlMap && typeof v.proxyProviderPanelUrlMap === 'object'
              ? sanitizeUrlMap(v.proxyProviderPanelUrlMap)
              : {}

      const iconsRaw =
        v.providerIcons && typeof v.providerIcons === 'object'
          ? v.providerIcons
          : v.proxyProviderIcons && typeof v.proxyProviderIcons === 'object'
            ? v.proxyProviderIcons
            : v.proxyProviderIconMap && typeof v.proxyProviderIconMap === 'object'
              ? v.proxyProviderIconMap
              : {}
      const icons = sanitizeIconMap(iconsRaw)

      const sslNear = sanitizeInt(v.sslNearExpiryDaysDefault, 2, 0, 365)
      const warnMapRaw =
        v.providerSslWarnDaysMap && typeof v.providerSslWarnDaysMap === 'object'
          ? v.providerSslWarnDaysMap
          : v.proxyProviderSslWarnDaysMap && typeof v.proxyProviderSslWarnDaysMap === 'object'
            ? v.proxyProviderSslWarnDaysMap
            : v.providerSslWarnDays && typeof v.providerSslWarnDays === 'object'
              ? v.providerSslWarnDays
              : {}
      const warnMap = sanitizeNumMap(warnMapRaw)

      return {
        labels,
        providerPanelUrls: urls,
        providerIcons: icons,
        sslNearExpiryDaysDefault: sslNear,
        providerSslWarnDaysMap: warnMap,
        tunnelInterfaceDescriptions: sanitizeTunnelDescriptionMap(v.tunnelInterfaceDescriptions || v.tunnelInterfaceDescriptionMap || {}),
        userLimits: sanitizeUserLimits(v.userLimits),
        proxyAccessPolicyMode: sanitizeProxyAccessPolicyMode(v.proxyAccessPolicyMode),
        providerSslSnapshots: sanitizeProviderSslSnapshots(v.providerSslSnapshots || v.providerSslState),
        providerSslMeta: sanitizeProviderSslMeta(v.providerSslMeta),
      }
    }
  } catch {
    // ignore
  }
  return { labels: [], providerPanelUrls: {}, providerIcons: {}, sslNearExpiryDaysDefault: 2, providerSslWarnDaysMap: {}, tunnelInterfaceDescriptions: {}, userLimits: {}, proxyAccessPolicyMode: 'allowAll', providerSslSnapshots: {}, providerSslMeta: sanitizeProviderSslMeta(null) }
}

const buildPayloadForWrite = (p: UsersDbPayload) => {
  return {
    version: 4,
    labels: p.labels || [],
    providerPanelUrls: p.providerPanelUrls || {},
    providerIcons: (p as any).providerIcons || {},
    sslNearExpiryDaysDefault: p.sslNearExpiryDaysDefault,
    providerSslWarnDaysMap: p.providerSslWarnDaysMap || {},
    tunnelInterfaceDescriptions: (p as any).tunnelInterfaceDescriptions || {},
    userLimits: sanitizeUserLimits((p as any).userLimits || {}),
    proxyAccessPolicyMode: sanitizeProxyAccessPolicyMode((p as any).proxyAccessPolicyMode),
    providerSslSnapshots: sanitizeProviderSslSnapshots((p as any).providerSslSnapshots || {}),
    providerSslMeta: sanitizeProviderSslMeta((p as any).providerSslMeta),
  }
}

const mergeLabels = (remote: SourceIPLabel[], local: SourceIPLabel[]) => {
  // Union with local preference.
  const byId = new Map<string, SourceIPLabel>()
  for (const r of remote || []) {
    if (!r?.id) continue
    byId.set(r.id, r)
  }
  for (const l of local || []) {
    if (!l?.id) continue
    byId.set(l.id, l)
  }

  // Deduplicate by key (prefer local).
  const byKey = new Map<string, SourceIPLabel>()
  for (const v of byId.values()) {
    const k = (v.key || '').trim()
    if (!k) continue
    byKey.set(k, v)
  }
  return Array.from(byKey.values())
}

const mergePayload = (remote: UsersDbPayload, local: UsersDbPayload): UsersDbPayload => {
  const rN = normalizePayload(remote)
  const lN = normalizePayload(local)
  const labels = mergeLabels(rN.labels || [], lN.labels || [])
  const urls = { ...(rN.providerPanelUrls || {}) }
  for (const [k, v] of Object.entries(lN.providerPanelUrls || {})) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const vv = String(v || '').trim()
    if (!vv) continue
    urls[kk] = vv
  }

  const icons = { ...(rN.providerIcons || {}) }
  for (const [k, v] of Object.entries(lN.providerIcons || {})) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const nv = normalizeProviderIcon(v)
    if (!nv) continue
    icons[kk] = nv
  }

  const warnMap = { ...(rN.providerSslWarnDaysMap || {}) }
  for (const [k, v] of Object.entries(lN.providerSslWarnDaysMap || {})) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    if (!Number.isFinite(n)) continue
    warnMap[kk] = Math.max(0, Math.min(365, Math.trunc(n)))
  }

  const tunnelMap = { ...(rN.tunnelInterfaceDescriptions || {}) }
  for (const [k, v] of Object.entries(lN.tunnelInterfaceDescriptions || {})) {
    const kk = String(k || '').trim().toLowerCase()
    if (!kk) continue
    const vv = String(v || '').trim()
    if (!vv) {
      delete tunnelMap[kk]
      continue
    }
    tunnelMap[kk] = vv
  }

  const limits = mergeUserLimits(rN.userLimits || {}, lN.userLimits || {})

  // Local preference for the global threshold.
  const sslNear = sanitizeInt(lN.sslNearExpiryDaysDefault, rN.sslNearExpiryDaysDefault || 2, 0, 365)
  const proxyAccessMode = sanitizeProxyAccessPolicyMode(lN.proxyAccessPolicyMode || rN.proxyAccessPolicyMode)
  const providerSslSnapshots = { ...(rN.providerSslSnapshots || {}), ...(lN.providerSslSnapshots || {}) }
  const providerSslMeta = (() => {
    const left = sanitizeProviderSslMeta(rN.providerSslMeta)
    const right = sanitizeProviderSslMeta(lN.providerSslMeta)
    return right.checkedAtMs >= left.checkedAtMs ? right : left
  })()

  return normalizePayload({
    labels,
    providerPanelUrls: urls,
    providerIcons: icons,
    sslNearExpiryDaysDefault: sslNear,
    providerSslWarnDaysMap: warnMap,
    tunnelInterfaceDescriptions: tunnelMap,
    userLimits: limits,
    proxyAccessPolicyMode: proxyAccessMode,
    providerSslSnapshots,
    providerSslMeta,
  })
}

const payloadEqual = (a: UsersDbPayload, b: UsersDbPayload) => {
  const an = normalizePayload(a)
  const bn = normalizePayload(b)
  return (
    isEqual(an.labels || [], bn.labels || []) &&
    isEqual(an.providerPanelUrls || {}, bn.providerPanelUrls || {}) &&
    isEqual((an as any).providerIcons || {}, (bn as any).providerIcons || {}) &&
    an.sslNearExpiryDaysDefault === bn.sslNearExpiryDaysDefault &&
    isEqual(an.providerSslWarnDaysMap || {}, bn.providerSslWarnDaysMap || {}) &&
    isEqual((an as any).tunnelInterfaceDescriptions || {}, (bn as any).tunnelInterfaceDescriptions || {}) &&
    isEqual(an.userLimits || {}, bn.userLimits || {}) &&
    an.proxyAccessPolicyMode === bn.proxyAccessPolicyMode &&
    isEqual(an.providerSslSnapshots || {}, bn.providerSslSnapshots || {}) &&
    isEqual(an.providerSslMeta || {}, bn.providerSslMeta || {})
  )
}

const setLocalFromPayload = (p: UsersDbPayload) => {
  const n = normalizePayload(p)
  sourceIPLabelList.value = (n.labels || []) as any
  proxyProviderPanelUrlMap.value = (n.providerPanelUrls || {}) as any
  proxyProviderIconMap.value = ((n as any).providerIcons || {}) as any
  sslNearExpiryDaysDefault.value = n.sslNearExpiryDaysDefault
  proxyProviderSslWarnDaysMap.value = (n.providerSslWarnDaysMap || {}) as any
  tunnelInterfaceDescriptionMap.value = ((n as any).tunnelInterfaceDescriptions || {}) as any
  userLimits.value = (n.userLimits || {}) as any
  proxyAccessPolicyMode.value = sanitizeProxyAccessPolicyMode((n as any).proxyAccessPolicyMode)
  providerSslDbSnapshot.value = sanitizeProviderSslSnapshots((n as any).providerSslSnapshots || {}) as any
  providerSslDbMeta.value = sanitizeProviderSslMeta((n as any).providerSslMeta)
}

const getLocalPayload = (): UsersDbPayload => {
  return normalizePayload({
    labels: (sourceIPLabelList.value || []) as any,
    providerPanelUrls: (proxyProviderPanelUrlMap.value || {}) as any,
    providerIcons: (proxyProviderIconMap.value || {}) as any,
    sslNearExpiryDaysDefault: sslNearExpiryDaysDefault.value,
    providerSslWarnDaysMap: (proxyProviderSslWarnDaysMap.value || {}) as any,
    tunnelInterfaceDescriptions: (tunnelInterfaceDescriptionMap.value || {}) as any,
    userLimits: (userLimits.value || {}) as any,
    proxyAccessPolicyMode: proxyAccessPolicyMode.value,
    providerSslSnapshots: (providerSslDbSnapshot.value || {}) as any,
    providerSslMeta: (providerSslDbMeta.value || {}) as any,
  })
}

const markSynced = (p: UsersDbPayload) => {
  usersDbLastSyncedLabels.value = (p.labels || []) as any
  usersDbLastSyncedProviderPanelUrls.value = (p.providerPanelUrls || {}) as any
  usersDbLastSyncedProviderIcons.value = ((p as any).providerIcons || {}) as any
  usersDbLastSyncedSslNearExpiryDaysDefault.value = p.sslNearExpiryDaysDefault
  usersDbLastSyncedProviderSslWarnDaysMap.value = (p.providerSslWarnDaysMap || {}) as any
  usersDbLastSyncedTunnelInterfaceDescriptions.value = ((p as any).tunnelInterfaceDescriptions || {}) as any
}

export const usersDbSyncedIdSet = computed(() => {
  // Per-item marker: item is considered synced if it matches the last synced snapshot by id + fields.
  const snapById = new Map<string, string>()
  const sig = (x: any) => {
    const scope = Array.isArray(x?.scope) ? (x.scope as any[]).map(String).sort().join(',') : ''
    return `${String(x?.id || '')}|${String(x?.key || '')}|${String(x?.label || '')}|${scope}|${String(x?.mac || '').trim().toLowerCase()}|${String(x?.hostname || '').trim()}|${String(x?.source || '').trim()}|${typeof x?.proxyAccess === 'boolean' ? (x.proxyAccess ? '1' : '0') : ''}`
  }

  for (const it of (usersDbLastSyncedLabels.value || []) as any[]) {
    const id = String(it?.id || '').trim()
    if (!id) continue
    snapById.set(id, sig(it))
  }

  const out = new Set<string>()
  for (const it of (sourceIPLabelList.value || []) as any[]) {
    const id = String(it?.id || '').trim()
    if (!id) continue
    if (snapById.get(id) == sig(it)) out.add(id)
  }
  return out
})

// ---- sync engine ----

let started = false
let suppressPushCount = 0
let pullInFlight = false
let pushInFlight = false

export const usersDbPullNow = async () => {
  if (!usersDbSyncActive.value) {
    usersDbPhase.value = usersDbSyncEnabled.value ? 'offline' : 'disabled'
    return { ok: false, error: 'agent-disabled' }
  }
  if (pullInFlight) return { ok: false, error: 'busy' }
  pullInFlight = true
  usersDbPhase.value = 'pulling'
  usersDbLastError.value = ''
  try {
    const r: any = await agentUsersDbGetAPI()
    if (!r?.ok) {
      usersDbPhase.value = 'offline'
      usersDbLastError.value = r?.error || 'offline'
      return { ok: false, error: usersDbLastError.value }
    }

    const remoteRev = Number(r.rev) || 0
    const remoteUpdatedAt = String(r.updatedAt || '').trim()
    const remoteB64 = String(r.contentB64 || '').trim()
    const remoteRaw = decodeB64Utf8(remoteB64) || '{}' // may be array or object
    const remotePayload = safeParsePayload(remoteRaw)

    usersDbRemoteRev.value = remoteRev
    usersDbRemoteUpdatedAt.value = remoteUpdatedAt

    const localPayload = getLocalPayload()

    // If we had offline edits, merge them into the remote and push back.
    if (usersDbLocalDirty.value) {
      const diff = computeUsersDbDiff(remotePayload, localPayload)
      if (diff.safeAutoMerge) {
        const merged = mergePayload(remotePayload, localPayload)
        suppressPushCount = 4
        setLocalFromPayload(merged)
        const put = await usersDbPushNow(remoteRev, merged)
        usersDbLocalDirty.value = !put.ok
        if (put.ok) markSynced(merged)
      } else {
        // Real conflict: keep local edits and require user decision.
        usersDbPhase.value = 'conflict'
        usersDbConflictAt.value = Date.now()
        usersDbConflictCount.value = (Number(usersDbConflictCount.value) || 0) + 1
        usersDbConflictRemoteRev.value = remoteRev
        usersDbConflictRemoteUpdatedAt.value = remoteUpdatedAt
        usersDbConflictRemoteB64.value = remoteB64
        usersDbConflictLocalB64.value = encodeB64Utf8(JSON.stringify(buildPayloadForWrite(localPayload)))
        usersDbLastError.value = 'conflict'
        return { ok: false, error: 'conflict' }
      }
    } else {
      // First-time bootstrap: remote empty and local has data -> seed remote.
      const remoteEmpty =
        remotePayload.labels.length === 0 &&
        Object.keys(remotePayload.providerPanelUrls || {}).length === 0 &&
        Object.keys(remotePayload.providerSslWarnDaysMap || {}).length === 0 &&
        Object.keys((remotePayload as any).tunnelInterfaceDescriptions || {}).length === 0 &&
        Object.keys(remotePayload.userLimits || {}).length === 0 &&
        Number(remotePayload.sslNearExpiryDaysDefault) === 2

      const localHasData =
        localPayload.labels.length > 0 ||
        Object.keys(localPayload.providerPanelUrls || {}).length > 0 ||
        Object.keys(localPayload.providerSslWarnDaysMap || {}).length > 0 ||
        Object.keys((localPayload as any).tunnelInterfaceDescriptions || {}).length > 0 ||
        Object.keys(localPayload.userLimits || {}).length > 0 ||
        Number(localPayload.sslNearExpiryDaysDefault) !== 2

      if (remoteRev == 0 && remoteEmpty && localHasData) {
        const put = await usersDbPushNow(remoteRev, localPayload)
        if (put.ok) markSynced(localPayload)
      } else if (!payloadEqual(remotePayload, localPayload)) {
        suppressPushCount = 4
        setLocalFromPayload(remotePayload)
        markSynced(remotePayload)
      } else {
        markSynced(localPayload)
      }
    }

    usersDbLastPullAt.value = Date.now()
    usersDbPhase.value = 'idle'
    return { ok: true }
  } catch (e: any) {
    usersDbPhase.value = 'offline'
    usersDbLastError.value = e?.message || 'offline'
    return { ok: false, error: usersDbLastError.value }
  } finally {
    pullInFlight = false
  }
}

export const usersDbPushNow = async (baseRev?: number, overridePayload?: UsersDbPayload) => {
  if (!usersDbSyncActive.value) {
    usersDbPhase.value = usersDbSyncEnabled.value ? 'offline' : 'disabled'
    usersDbLocalDirty.value = true
    return { ok: false, error: 'agent-disabled' }
  }
  if (pushInFlight) return { ok: false, error: 'busy' }
  pushInFlight = true
  usersDbPhase.value = 'pushing'
  usersDbLastError.value = ''
  try {
    const payload = overridePayload ? overridePayload : getLocalPayload()
    const body = JSON.stringify(buildPayloadForWrite(payload))
    const rev = Number(baseRev ?? usersDbRemoteRev.value) || 0

    const r: any = await agentUsersDbPutAPI({ rev, content: body })
    if (r?.ok) {
      usersDbRemoteRev.value = Number(r.rev) || usersDbRemoteRev.value + 1
      usersDbRemoteUpdatedAt.value = String(r.updatedAt || '').trim()
      usersDbLastPushAt.value = Date.now()
      usersDbLocalDirty.value = false
      usersDbPhase.value = 'idle'
      markSynced(payload)
      return { ok: true }
    }

    if (r?.error === 'conflict') {
      usersDbPhase.value = 'conflict'
      usersDbConflictAt.value = Date.now()
      usersDbConflictCount.value = (Number(usersDbConflictCount.value) || 0) + 1

      const remoteRev = Number(r.rev) || 0
      const remoteUpdatedAt = String(r.updatedAt || '').trim()
      const remoteB64 = String(r.contentB64 || '').trim()
      const remoteRaw = decodeB64Utf8(remoteB64) || '{}'
      const remotePayload = safeParsePayload(remoteRaw)

      usersDbRemoteRev.value = remoteRev
      usersDbRemoteUpdatedAt.value = remoteUpdatedAt

      // Save conflict context for manual resolution UI.
      usersDbConflictRemoteRev.value = remoteRev
      usersDbConflictRemoteUpdatedAt.value = remoteUpdatedAt
      usersDbConflictRemoteB64.value = remoteB64
      usersDbConflictLocalB64.value = encodeB64Utf8(body)

      const diff = computeUsersDbDiff(remotePayload, payload)

      // Auto-merge only if there are no "changed" collisions.
      if (diff.safeAutoMerge) {
        const merged = mergePayload(remotePayload, payload)

        suppressPushCount = 4
        setLocalFromPayload(merged)

        const r2: any = await agentUsersDbPutAPI({ rev: remoteRev, content: JSON.stringify(buildPayloadForWrite(merged)) })
        if (r2?.ok) {
          usersDbRemoteRev.value = Number(r2.rev) || remoteRev + 1
          usersDbRemoteUpdatedAt.value = String(r2.updatedAt || '').trim()
          usersDbLastPushAt.value = Date.now()
          usersDbLocalDirty.value = false
          usersDbPhase.value = 'idle'
          markSynced(merged)
          clearConflictContext()
          return { ok: true }
        }

        usersDbLastError.value = r2?.error || 'conflict'
        usersDbLocalDirty.value = true
        usersDbPhase.value = 'error'
        return { ok: false, error: usersDbLastError.value }
      }

      // Real conflict: stop and wait for user decision.
      usersDbLastError.value = 'conflict'
      usersDbLocalDirty.value = true
      return { ok: false, error: 'conflict' }
    }

    usersDbLastError.value = r?.error || 'failed'
    usersDbLocalDirty.value = true
    usersDbPhase.value = 'error'
    return { ok: false, error: usersDbLastError.value }
  } catch (e: any) {
    usersDbLastError.value = e?.message || 'failed'
    usersDbLocalDirty.value = true
    usersDbPhase.value = 'offline'
    return { ok: false, error: usersDbLastError.value }
  } finally {
    pushInFlight = false
  }
}


export const usersDbResolvePull = async () => {
  const remotePayload = getConflictRemotePayload()
  if (!remotePayload) return { ok: false, error: 'no-conflict' }
  suppressPushCount = 4
  setLocalFromPayload(remotePayload)
  markSynced(remotePayload)
  usersDbLocalDirty.value = false
  usersDbPhase.value = 'idle'
  clearConflictContext()
  return { ok: true }
}

export const usersDbResolvePush = async () => {
  // Overwrite router with our local data (using latest remote rev).
  const rev = Number(usersDbConflictRemoteRev.value || usersDbRemoteRev.value) || 0
  const res = await usersDbPushNow(rev, getLocalPayload())
  if (res.ok) clearConflictContext()
  return res
}

const smartMergePayload = (remote: UsersDbPayload, local: UsersDbPayload, choices?: UsersDbSmartMergeChoices): UsersDbPayload => {
  const rN = normalizePayload(remote)
  const lN = normalizePayload(local)

  const labelChoices = (choices?.labels || {}) as Record<string, any>
  const urlChoices = (choices?.urls || {}) as Record<string, any>
  const iconChoices = (choices?.icons || {}) as Record<string, any>
  const tunnelChoices = (choices?.tunnels || {}) as Record<string, any>
  const warnChoices = (choices?.warnDays || {}) as Record<string, any>
  const sslChoice = choices?.sslDefault as any

  // ---- labels (by key) ----
  const rByKey = new Map<string, SourceIPLabel>()
  const lByKey = new Map<string, SourceIPLabel>()
  for (const it of rN.labels || []) {
    const k = String(it?.key || '').trim()
    if (k) rByKey.set(k, it as any)
  }
  for (const it of lN.labels || []) {
    const k = String(it?.key || '').trim()
    if (k) lByKey.set(k, it as any)
  }

  const keys = Array.from(new Set<string>([...rByKey.keys(), ...lByKey.keys()])).sort((a, b) => a.localeCompare(b))

  const mergedLabels: SourceIPLabel[] = []
  for (const key of keys) {
    const r = rByKey.get(key)
    const l = lByKey.get(key)

    if (r && l) {
      const ch = labelChoices[key] || { mode: 'local' }
      const mode = (ch?.mode || 'local') as UsersDbSmartChoiceMode

      if (mode === 'remote') mergedLabels.push(r)
      else if (mode === 'custom') {
        const base: any = l || r
        const customLabel = String(ch?.customLabel ?? base?.label ?? '').trim()
        const out: any = { ...(base || {}) }
        if (customLabel) out.label = customLabel
        mergedLabels.push(out)
      } else {
        mergedLabels.push(l)
      }
    } else if (l) mergedLabels.push(l)
    else if (r) mergedLabels.push(r)
  }

  // ---- provider panel URLs ----
  const mergedUrls: Record<string, string> = { ...(rN.providerPanelUrls || {}) }
  for (const [k, v] of Object.entries(lN.providerPanelUrls || {})) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const lv = String(v || '').trim()
    const rv = String(mergedUrls[kk] || '').trim()

    if (!rv) {
      if (lv) mergedUrls[kk] = lv
      continue
    }

    if (lv && rv && lv !== rv) {
      const ch = urlChoices[kk] || { mode: 'local' }
      const mode = (ch?.mode || 'local') as UsersDbSmartChoiceMode
      if (mode === 'remote') {
        // keep router
      } else if (mode === 'custom') {
        const customUrl = String(ch?.customUrl ?? '').trim()
        if (customUrl) mergedUrls[kk] = customUrl
      } else {
        mergedUrls[kk] = lv
      }
    } else if (lv) {
      mergedUrls[kk] = lv
    }
  }

  // ---- provider icons ----
  const mergedIcons: Record<string, string> = { ...(rN.providerIcons || {}) }
  for (const [k, v] of Object.entries(lN.providerIcons || {})) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const lv = normalizeProviderIcon(v)
    const rv = normalizeProviderIcon(mergedIcons[kk])

    if (!rv) {
      if (lv) mergedIcons[kk] = lv
      continue
    }

    if (lv && rv && lv !== rv) {
      const ch = iconChoices[kk] || { mode: 'local' }
      const mode = (ch?.mode || 'local') as UsersDbSmartChoiceMode
      if (mode === 'remote') {
        // keep router
      } else if (mode === 'custom') {
        const customIcon = normalizeProviderIcon(ch?.customIcon)
        if (customIcon) mergedIcons[kk] = customIcon
        else if (String(ch?.customIcon || '').trim() === '') delete mergedIcons[kk]
      } else {
        mergedIcons[kk] = lv
      }
    } else if (lv) {
      mergedIcons[kk] = lv
    }
  }

  // ---- tunnel descriptions ----
  const mergedTunnels: Record<string, string> = { ...(rN.tunnelInterfaceDescriptions || {}) }
  for (const [k, v] of Object.entries(lN.tunnelInterfaceDescriptions || {})) {
    const kk = String(k || '').trim().toLowerCase()
    if (!kk) continue
    const lv = String(v || '').trim()
    const rv = String(mergedTunnels[kk] || '').trim()

    if (!rv) {
      if (lv) mergedTunnels[kk] = lv
      continue
    }

    if (lv && rv && lv !== rv) {
      const ch = tunnelChoices[kk] || { mode: 'local' }
      const mode = (ch?.mode || 'local') as UsersDbSmartChoiceMode
      if (mode === 'remote') {
        // keep router
      } else if (mode === 'custom') {
        const customDescription = String(ch?.customDescription ?? '').trim()
        if (customDescription) mergedTunnels[kk] = customDescription
        else delete mergedTunnels[kk]
      } else {
        mergedTunnels[kk] = lv
      }
    } else if (lv) {
      mergedTunnels[kk] = lv
    }
  }

  // ---- ssl default ----
  let mergedSslNear = sanitizeInt(lN.sslNearExpiryDaysDefault, rN.sslNearExpiryDaysDefault || 2, 0, 365)
  if (sslChoice) {
    const mode = (sslChoice?.mode || 'local') as UsersDbSmartChoiceMode
    if (mode === 'remote') mergedSslNear = sanitizeInt(rN.sslNearExpiryDaysDefault, 2, 0, 365)
    else if (mode === 'custom') mergedSslNear = sanitizeInt(sslChoice?.customDays, mergedSslNear, 0, 365)
    else mergedSslNear = sanitizeInt(lN.sslNearExpiryDaysDefault, mergedSslNear, 0, 365)
  }

  // ---- provider warn days ----
  const mergedWarn: Record<string, number> = { ...(rN.providerSslWarnDaysMap || {}) }
  for (const [k, v] of Object.entries(lN.providerSslWarnDaysMap || {})) {
    const kk = String(k || '').trim()
    if (!kk) continue
    const lNum = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    const rNumRaw = mergedWarn[kk]
    const rNum = typeof rNumRaw === 'number' ? rNumRaw : typeof rNumRaw === 'string' ? Number(rNumRaw as any) : NaN

    if (!Number.isFinite(rNum)) {
      if (Number.isFinite(lNum)) mergedWarn[kk] = Math.max(0, Math.min(365, Math.trunc(lNum)))
      continue
    }

    if (Number.isFinite(lNum) && Math.trunc(lNum) !== Math.trunc(rNum)) {
      const ch = warnChoices[kk] || { mode: 'local' }
      const mode = (ch?.mode || 'local') as UsersDbSmartChoiceMode
      if (mode === 'remote') {
        // keep router
      } else if (mode === 'custom') {
        const customDays = sanitizeInt(ch?.customDays, Math.trunc(lNum), 0, 365)
        mergedWarn[kk] = customDays
      } else {
        mergedWarn[kk] = Math.max(0, Math.min(365, Math.trunc(lNum)))
      }
    } else if (Number.isFinite(lNum)) {
      mergedWarn[kk] = Math.max(0, Math.min(365, Math.trunc(lNum)))
    }
  }

  return normalizePayload({
    labels: sanitizeLabels(mergedLabels as any),
    providerPanelUrls: sanitizeUrlMap(mergedUrls),
    providerIcons: sanitizeIconMap(mergedIcons),
    sslNearExpiryDaysDefault: mergedSslNear,
    providerSslWarnDaysMap: sanitizeNumMap(mergedWarn),
    tunnelInterfaceDescriptions: sanitizeTunnelDescriptionMap(mergedTunnels),
    userLimits: mergeUserLimits(rN.userLimits || {}, lN.userLimits || {}),
    proxyAccessPolicyMode: sanitizeProxyAccessPolicyMode(lN.proxyAccessPolicyMode || rN.proxyAccessPolicyMode),
    providerSslSnapshots: { ...(rN.providerSslSnapshots || {}), ...(lN.providerSslSnapshots || {}) },
    providerSslMeta: sanitizeProviderSslMeta(
      Number((lN.providerSslMeta || {}).checkedAtMs || 0) >= Number((rN.providerSslMeta || {}).checkedAtMs || 0)
        ? lN.providerSslMeta
        : rN.providerSslMeta,
    ),
  })
}

export const usersDbResolveSmartMerge = async (choices?: UsersDbSmartMergeChoices) => {
  const remotePayload = getConflictRemotePayload()
  if (!remotePayload) return { ok: false, error: 'no-conflict' }
  const merged = smartMergePayload(remotePayload, getLocalPayload(), choices)
  suppressPushCount = 4
  setLocalFromPayload(merged)
  const rev = Number(usersDbConflictRemoteRev.value || usersDbRemoteRev.value) || 0
  const res = await usersDbPushNow(rev, merged)
  if (res.ok) clearConflictContext()
  return res
}

export const usersDbResolveMerge = async () => {
  const remotePayload = getConflictRemotePayload()
  if (!remotePayload) return { ok: false, error: 'no-conflict' }
  const merged = mergePayload(remotePayload, getLocalPayload())
  suppressPushCount = 4
  setLocalFromPayload(merged)
  const rev = Number(usersDbConflictRemoteRev.value || usersDbRemoteRev.value) || 0
  const res = await usersDbPushNow(rev, merged)
  if (res.ok) clearConflictContext()
  return res
}

export const usersDbFetchHistory = async () => {
  if (!usersDbSyncActive.value) return { ok: false, error: 'agent-disabled' }
  const r: any = await agentUsersDbHistoryAPI()
  if (!r?.ok) return { ok: false, error: r?.error || 'offline' }
  usersDbHistoryItems.value = (Array.isArray(r.items) ? r.items : []) as any
  return { ok: true }
}

export const usersDbRestoreRev = async (rev: number) => {
  if (!usersDbSyncActive.value) return { ok: false, error: 'agent-disabled' }
  const r: any = await agentUsersDbRestoreAPI(rev)
  if (!r?.ok) return { ok: false, error: r?.error || 'failed' }
  clearConflictContext()
  await usersDbPullNow()
  await usersDbFetchHistory()
  return { ok: true }
}


const debouncedPush = debounce(() => {
  if (usersDbHasConflict.value) return
  usersDbPushNow()
}, 800)

export const initUsersDbSync = () => {
  if (started) return
  started = true

  watch(
    [usersDbSyncEnabled, agentEnabled],
    async () => {
      if (!usersDbSyncEnabled.value) {
        usersDbPhase.value = 'disabled'
        return
      }
      if (!agentEnabled.value) {
        usersDbPhase.value = 'offline'
        return
      }
      if (usersDbHasConflict.value) return
      await usersDbPullNow()
      usersDbFetchHistory()
    },
    { immediate: true },
  )

  watch(
    [sourceIPLabelList, proxyProviderPanelUrlMap, proxyProviderIconMap, sslNearExpiryDaysDefault, proxyProviderSslWarnDaysMap, tunnelInterfaceDescriptionMap, userLimits, proxyAccessPolicyMode, providerSslDbSnapshot, providerSslDbMeta],
    () => {
      if (suppressPushCount > 0) {
        suppressPushCount -= 1
        return
      }
      if (!usersDbSyncEnabled.value) return
      if (!agentEnabled.value) {
        usersDbLocalDirty.value = true
        return
      }
      usersDbLocalDirty.value = true
      if (usersDbHasConflict.value) return
      debouncedPush()
    },
    { deep: true },
  )

  // Periodic catch-up when dirty.
  window.setInterval(() => {
    if (!usersDbSyncEnabled.value) return
    if (!agentEnabled.value) return
    if (!usersDbLocalDirty.value) return
    if (usersDbPhase.value === 'pulling' || usersDbPhase.value === 'pushing') return
    if (usersDbHasConflict.value) return
    usersDbPullNow()
  }, 45_000)

  // Periodic pull to propagate updates from other devices (when we have no local edits).
  window.setInterval(() => {
    if (!usersDbSyncEnabled.value) return
    if (!agentEnabled.value) return
    if (usersDbLocalDirty.value) return
    if (usersDbPhase.value === 'pulling' || usersDbPhase.value === 'pushing') return
    if (usersDbHasConflict.value) return

    const lastPull = Number(usersDbLastPullAt.value) || 0
    if (Date.now() - lastPull < 55_000) return
    usersDbPullNow()
  }, 60_000)
}
