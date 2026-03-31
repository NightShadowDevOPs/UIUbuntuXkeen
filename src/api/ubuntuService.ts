import { BACKEND_KINDS, UBUNTU_BACKEND_ENDPOINTS } from '@/config/backendContract'
import { getAnyFromObj } from '@/helper/providerHealth'
import axios from 'axios'
import { agentMihomoProvidersAPI, agentProviderSslCacheRefreshAPI, agentUsersDbGetAPI, agentUsersDbPutAPI } from '@/api/agent'
import { detectBackendKind, getBackendEndpointPath } from '@/helper/backend'
import { activeBackend } from '@/store/setup'
import dayjs from 'dayjs'

const silentCfg = {
  timeout: 10000,
  silent: true as any,
  headers: {
    'X-Zash-Silent': '1',
    Accept: 'application/json',
  } as any,
}

const str = (value: any) => String(value || '').trim()

const num = (value: any, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toSec = (value: any): number => {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value > 10_000_000_000 ? Math.trunc(value / 1000) : Math.trunc(value)
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return 0
    if (/^[0-9]{10,13}$/.test(raw)) return toSec(Number(raw))
    const d = dayjs(raw)
    return d.isValid() ? d.unix() : 0
  }
  return 0
}

const pickList = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload
  const candidates = [
    payload?.items,
    payload?.providers,
    payload?.checks,
    payload?.results,
    payload?.data?.items,
    payload?.data?.providers,
    payload?.data,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

const normalizeJob = (payload: any) => {
  const raw = payload?.job || payload?.lastJob || payload?.currentJob || payload?.refreshJob || payload?.checkJob || null
  if (!raw || typeof raw !== 'object') return null
  return {
    id: str(getAnyFromObj(raw, ['id', 'jobId', 'job_id', 'uuid'])),
    status: str(getAnyFromObj(raw, ['status', 'state'])),
    error: str(getAnyFromObj(raw, ['error', 'errorText', 'error_text', 'message'])),
    startedAtSec: toSec(getAnyFromObj(raw, ['startedAtSec', 'started_at_sec', 'startedAt', 'started_at', 'createdAt'])),
    finishedAtSec: toSec(getAnyFromObj(raw, ['finishedAtSec', 'finished_at_sec', 'finishedAt', 'finished_at', 'completedAt'])),
    updatedAtSec: toSec(getAnyFromObj(raw, ['updatedAtSec', 'updated_at_sec', 'updatedAt', 'updated_at'])),
  }
}

export type UbuntuProviderState = {
  ok: boolean
  checkedAtSec?: number
  nextCheckAtSec?: number
  sslCacheReady?: boolean
  sslCacheFresh?: boolean
  sslRefreshing?: boolean
  sslRefreshPending?: boolean
  sslCacheAgeSec?: number
  sslCacheNextRefreshAtSec?: number
  providers?: Array<Record<string, any>>
  job?: ReturnType<typeof normalizeJob>
  error?: string
}

export const normalizeUbuntuProviderState = (payload: any): UbuntuProviderState => {
  const list = pickList(payload)
  const providers = list
    .map((item) => {
      const name = str(getAnyFromObj(item, ['name', 'providerName', 'provider_name', 'provider', 'id']))
      if (!name) return null
      return {
        ...item,
        name,
        url: str(getAnyFromObj(item, ['url', 'providerUrl', 'provider_url'])) || str((item as any)?.url),
        host: str(getAnyFromObj(item, ['host'])),
        port: str(getAnyFromObj(item, ['port'])),
        sslNotAfter: getAnyFromObj(item, ['sslNotAfter', 'notAfter', 'not_after', 'expiresAt', 'expires_at', 'expireAt']),
        sslCheckedAtSec: toSec(getAnyFromObj(item, ['sslCheckedAtSec', 'checkedAtSec', 'checked_at_sec', 'checkedAt', 'checked_at'])),
        sslIssuer: str(getAnyFromObj(item, ['sslIssuer', 'issuer'])),
        sslSubject: str(getAnyFromObj(item, ['sslSubject', 'subject'])),
        sslSan: getAnyFromObj(item, ['sslSan', 'san', 'subjectAltName']),
        sslError: str(getAnyFromObj(item, ['sslError', 'error', 'errorText', 'error_text'])),
        panelUrl: str(getAnyFromObj(item, ['panelUrl', 'panel_url', 'uiUrl', 'ui_url'])),
        panelSslNotAfter: getAnyFromObj(item, ['panelSslNotAfter', 'panel_not_after', 'panelExpiresAt', 'panel_expires_at']),
        panelSslCheckedAtSec: toSec(getAnyFromObj(item, ['panelSslCheckedAtSec', 'panel_checked_at_sec', 'panelCheckedAtSec'])),
        panelSslIssuer: str(getAnyFromObj(item, ['panelSslIssuer', 'panel_issuer'])),
        panelSslSubject: str(getAnyFromObj(item, ['panelSslSubject', 'panel_subject'])),
        panelSslSan: getAnyFromObj(item, ['panelSslSan', 'panel_san']),
        panelSslError: str(getAnyFromObj(item, ['panelSslError', 'panel_error'])),
        nextCheckAtSec: toSec(getAnyFromObj(item, ['nextCheckAtSec', 'next_check_at_sec', 'nextCheckAt', 'next_check_at'])),
        jobStatus: str(getAnyFromObj(item, ['jobStatus', 'job_status', 'status'])),
      }
    })
    .filter(Boolean) as Array<Record<string, any>>

  const cache = payload?.sslCache || payload?.cache || payload?.data?.sslCache || {}
  const directRefreshing = payload?.refreshing ?? payload?.sslRefreshing ?? payload?.sslRefreshPending
  const cacheRefreshing = cache?.refreshing ?? cache?.sslRefreshing ?? cache?.pending

  return {
    ok: Boolean(payload?.ok ?? providers.length),
    checkedAtSec: toSec(getAnyFromObj(payload, ['checkedAtSec', 'checked_at_sec', 'checkedAt', 'checked_at'])),
    nextCheckAtSec: toSec(getAnyFromObj(payload, ['nextCheckAtSec', 'next_check_at_sec', 'nextCheckAt', 'next_check_at'])),
    sslCacheReady: Boolean(payload?.sslCacheReady ?? cache?.ready ?? cache?.sslCacheReady),
    sslCacheFresh: Boolean(payload?.sslCacheFresh ?? cache?.fresh ?? cache?.sslCacheFresh),
    sslRefreshing: Boolean(directRefreshing ?? cacheRefreshing),
    sslRefreshPending: Boolean(payload?.sslRefreshPending ?? cache?.pending),
    sslCacheAgeSec: num(payload?.sslCacheAgeSec ?? cache?.ageSec ?? cache?.sslCacheAgeSec, -1),
    sslCacheNextRefreshAtSec: toSec(payload?.sslCacheNextRefreshAtSec ?? cache?.nextRefreshAtSec ?? cache?.next_refresh_at_sec),
    providers,
    job: normalizeJob(payload),
    error: str(payload?.error || payload?.message),
  }
}

const preferCompatibilityBridge = () => detectBackendKind(activeBackend.value) !== BACKEND_KINDS.UBUNTU_SERVICE


const ubuntuEndpoint = (endpoint: string) => {
  if (!activeBackend.value) return endpoint
  return getBackendEndpointPath(activeBackend.value, endpoint)
}

const decodeB64Utf8 = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    return decodeURIComponent(escape(atob(raw)))
  } catch {
    try {
      return atob(raw)
    } catch {
      return ''
    }
  }
}

const normalizeProviderUrlMap = (raw: any) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {} as Record<string, string>
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const name = str(key)
    const url = str(value)
    if (!name || !url) continue
    out[name] = url
  }
  return out
}

const isPlainInventoryKey = (value: any) => {
  const key = str(value)
  if (!key) return false
  if (key.startsWith('/')) return false
  if (key.includes('/')) return false
  return true
}

const normalizeUsersDbLabels = (raw: any) => {
  if (!Array.isArray(raw)) return [] as any[]
  const seen = new Set<string>()
  const out: any[] = []
  for (const item of raw) {
    const key = str((item as any)?.key)
    if (!key || seen.has(key)) continue
    const label = str((item as any)?.label) || str((item as any)?.hostname) || key
    out.push({
      ...(item && typeof item === 'object' ? item : {}),
      id: str((item as any)?.id) || `lan_${key.replace(/[^0-9a-zA-Z]+/g, '_')}`,
      key,
      label,
      mac: str((item as any)?.mac).toLowerCase() || undefined,
      hostname: str((item as any)?.hostname) || undefined,
      source: str((item as any)?.source) || undefined,
      proxyAccess: typeof (item as any)?.proxyAccess === 'boolean' ? !!(item as any).proxyAccess : undefined,
    })
    seen.add(key)
  }
  return out
}

const parseUsersDbPayload = (content: string) => {
  const fallback = {
    version: 4,
    labels: [] as any[],
    providerPanelUrls: {} as Record<string, string>,
    proxyAccessPolicyMode: 'allowAll',
  }

  try {
    const parsed = JSON.parse(String(content || '').trim() || '{}')
    if (Array.isArray(parsed)) {
      return {
        ...fallback,
        labels: normalizeUsersDbLabels(parsed),
      }
    }
    if (!parsed || typeof parsed !== 'object') return fallback

    const labelsSource =
      Array.isArray((parsed as any).labels)
        ? (parsed as any).labels
        : Array.isArray((parsed as any).sourceIPLabelList)
          ? (parsed as any).sourceIPLabelList
          : Array.isArray((parsed as any).users)
            ? (parsed as any).users
            : []

    const urlSource =
      (parsed as any).providerPanelUrls && typeof (parsed as any).providerPanelUrls === 'object'
        ? (parsed as any).providerPanelUrls
        : (parsed as any).proxyProviderPanelUrls && typeof (parsed as any).proxyProviderPanelUrls === 'object'
          ? (parsed as any).proxyProviderPanelUrls
          : (parsed as any).proxyProviderPanelUrlMap && typeof (parsed as any).proxyProviderPanelUrlMap === 'object'
            ? (parsed as any).proxyProviderPanelUrlMap
            : {}

    return {
      ...(parsed as any),
      version: Number((parsed as any).version) || 4,
      labels: normalizeUsersDbLabels(labelsSource),
      providerPanelUrls: normalizeProviderUrlMap(urlSource),
      proxyAccessPolicyMode: str((parsed as any).proxyAccessPolicyMode) === 'allowListOnly' ? 'allowListOnly' : 'allowAll',
    }
  } catch {
    return fallback
  }
}

const loadUsersDbDocument = async () => {
  const remote = await agentUsersDbGetAPI()
  if (!remote?.ok) throw new Error(str(remote?.error) || 'users-db-get-failed')
  const content = decodeB64Utf8(str(remote?.contentB64))
  return {
    rev: Number(remote?.rev || 0),
    updatedAt: str(remote?.updatedAt),
    payload: parseUsersDbPayload(content),
  }
}

const saveUsersDbDocument = async (payload: any, rev: number) => {
  const doc = {
    ...(payload && typeof payload === 'object' ? payload : {}),
    version: Number(payload?.version || 4) || 4,
    labels: normalizeUsersDbLabels(payload?.labels || []),
    providerPanelUrls: normalizeProviderUrlMap(payload?.providerPanelUrls || {}),
    proxyAccessPolicyMode: str(payload?.proxyAccessPolicyMode) === 'allowListOnly' ? 'allowListOnly' : 'allowAll',
  }
  const content = JSON.stringify(doc, null, 2)
  const saved = await agentUsersDbPutAPI({ rev, content })
  if (!saved?.ok) throw new Error(str(saved?.error) || 'users-db-put-failed')
  return {
    rev: Number(saved?.rev || rev || 0),
    updatedAt: str(saved?.updatedAt),
    payload: doc,
  }
}

const listProvidersFromUsersDb = async () => {
  const doc = await loadUsersDbDocument()
  const byName = new Map<string, { name: string; panelUrl: string; enabled: boolean }>()

  for (const [nameRaw, panelUrlRaw] of Object.entries(doc.payload.providerPanelUrls || {})) {
    const name = str(nameRaw)
    const panelUrl = str(panelUrlRaw)
    if (!name) continue
    byName.set(name, { name, panelUrl, enabled: true })
  }

  try {
    const remote = await agentMihomoProvidersAPI(false)
    for (const item of remote?.providers || []) {
      const name = str((item as any)?.name)
      if (!name) continue
      const current = byName.get(name)
      const panelUrl = str((item as any)?.panelUrl) || current?.panelUrl || ''
      byName.set(name, { name, panelUrl, enabled: true })
    }
  } catch {
    // keep users-db snapshot only
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const saveProvidersToUsersDb = async (items: Array<{ name: string; panelUrl: string; enabled?: boolean }>) => {
  const doc = await loadUsersDbDocument()
  const nextUrls: Record<string, string> = {}
  for (const item of items || []) {
    const name = str(item?.name)
    const panelUrl = str(item?.panelUrl)
    const enabled = boolish((item as any)?.enabled) ?? true
    if (!name || !panelUrl || !enabled) continue
    nextUrls[name] = panelUrl
  }
  doc.payload.providerPanelUrls = nextUrls
  const saved = await saveUsersDbDocument(doc.payload, doc.rev)
  return Object.entries(saved.payload.providerPanelUrls || {})
    .map(([name, panelUrl]) => ({ name: str(name), panelUrl: str(panelUrl), enabled: true }))
    .filter((item) => item.name && item.panelUrl)
    .sort((a, b) => a.name.localeCompare(b.name))
}

const listUsersInventoryFromUsersDb = async () => {
  const doc = await loadUsersDbDocument()
  const items = (doc.payload.labels || [])
    .filter((item: any) => isPlainInventoryKey(item?.key))
    .map((item: any) => ({
      ip: str(item?.key),
      key: str(item?.key),
      mac: str(item?.mac),
      label: str(item?.label),
      hostname: str(item?.hostname),
      source: str(item?.source),
      proxyAccess: typeof item?.proxyAccess === 'boolean' ? !!item.proxyAccess : false,
      updatedAt: doc.updatedAt,
    }))
    .filter((item: any) => item.ip)
    .sort((a: any, b: any) => String(a.label || a.hostname || a.ip).localeCompare(String(b.label || b.hostname || b.ip)))

  return {
    items,
    policyMode: str(doc.payload.proxyAccessPolicyMode) === 'allowListOnly' ? 'allowListOnly' : 'allowAll',
  }
}

const saveUsersInventoryToUsersDb = async (
  items: Array<{ ip: string; mac?: string; label?: string; hostname?: string; source?: string; proxyAccess?: boolean }>,
  policyMode: string,
) => {
  const doc = await loadUsersDbDocument()
  const existingByKey = new Map<string, any>()
  for (const item of doc.payload.labels || []) {
    const key = str((item as any)?.key)
    if (!key) continue
    existingByKey.set(key, item)
  }

  const preserved = (doc.payload.labels || []).filter((item: any) => !isPlainInventoryKey(item?.key))
  const nextInventory = (items || [])
    .map((item) => {
      const ip = str(item?.ip)
      if (!ip) return null
      const current = existingByKey.get(ip) || {}
      return {
        ...current,
        id: str(current?.id) || `lan_${ip.replace(/[^0-9a-zA-Z]+/g, '_')}`,
        key: ip,
        label: str(item?.label) || str(item?.hostname) || ip,
        mac: str(item?.mac).toLowerCase() || undefined,
        hostname: str(item?.hostname) || undefined,
        source: str(item?.source) || undefined,
        proxyAccess: item?.proxyAccess === true,
      }
    })
    .filter(Boolean)

  doc.payload.labels = [...preserved, ...nextInventory]
  doc.payload.proxyAccessPolicyMode = policyMode === 'allowListOnly' ? 'allowListOnly' : 'allowAll'
  const saved = await saveUsersDbDocument(doc.payload, doc.rev)
  return {
    items: (saved.payload.labels || [])
      .filter((item: any) => isPlainInventoryKey(item?.key))
      .map((item: any) => ({
        ip: str(item?.key),
        key: str(item?.key),
        mac: str(item?.mac),
        label: str(item?.label),
        hostname: str(item?.hostname),
        source: str(item?.source),
        proxyAccess: item?.proxyAccess === true,
        updatedAt: saved.updatedAt,
      }))
      .filter((item: any) => item.ip)
      .sort((a: any, b: any) => String(a.label || a.hostname || a.ip).localeCompare(String(b.label || b.hostname || b.ip))),
    policyMode: str(saved.payload.proxyAccessPolicyMode) === 'allowListOnly' ? 'allowListOnly' : 'allowAll',
  }
}

const bridgeProviderChecks = async (force = false) => {
  const payload = await agentMihomoProvidersAPI(force)
  return normalizeUbuntuProviderState(payload || {})
}

const bridgeRefreshProviderSslCache = async () => {
  const refresh = await agentProviderSslCacheRefreshAPI()
  const checks = await agentMihomoProvidersAPI(true)
  return normalizeUbuntuProviderState({
    ...(checks || {}),
    checkedAtSec: Number((refresh as any)?.checkedAtSec || (checks as any)?.checkedAtSec || 0) || undefined,
    sslCacheReady: (refresh as any)?.ready ?? (checks as any)?.sslCacheReady,
    sslCacheFresh: (refresh as any)?.fresh ?? (checks as any)?.sslCacheFresh,
    sslRefreshing: (refresh as any)?.refreshing ?? (checks as any)?.sslRefreshing,
    sslCacheAgeSec: (refresh as any)?.cacheAgeSec ?? (checks as any)?.sslCacheAgeSec,
    sslCacheNextRefreshAtSec: (refresh as any)?.nextRefreshAtSec ?? (checks as any)?.sslCacheNextRefreshAtSec,
    error: str((refresh as any)?.error || (checks as any)?.error),
  })
}



export const fetchUbuntuProvidersAPI = async () => {
  if (preferCompatibilityBridge()) return listProvidersFromUsersDb()
  try {
    const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.providers), silentCfg)
    return pickList(data || {}).map((item) => ({
      ...item,
      name: str(getAnyFromObj(item, ['name', 'providerName', 'provider_name', 'id'])),
      panelUrl: str(getAnyFromObj(item, ['panelUrl', 'panel_url', 'url'])),
      enabled: boolish(getAnyFromObj(item, ['enabled'])) ?? true,
    }))
  } catch {
    return listProvidersFromUsersDb()
  }
}

export const saveUbuntuProvidersAPI = async (items: Array<{ name: string; panelUrl: string; enabled?: boolean }>) => {
  if (preferCompatibilityBridge()) return saveProvidersToUsersDb(items)
  try {
    const { data } = await axios.put(
      ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.providers),
      { providers: items },
      {
        ...silentCfg,
        timeout: 15000,
      },
    )
    return pickList(data || {}).map((item) => ({
      ...item,
      name: str(getAnyFromObj(item, ['name', 'providerName', 'provider_name', 'id'])),
      panelUrl: str(getAnyFromObj(item, ['panelUrl', 'panel_url', 'url'])),
      enabled: boolish(getAnyFromObj(item, ['enabled'])) ?? true,
    }))
  } catch {
    return saveProvidersToUsersDb(items)
  }
}

export type UbuntuUsersInventoryRow = {
  ip: string
  key: string
  mac?: string
  label?: string
  hostname?: string
  source?: string
  proxyAccess?: boolean
  updatedAt?: string
}

export const fetchUbuntuUsersInventoryAPI = async () => {
  if (preferCompatibilityBridge()) return listUsersInventoryFromUsersDb()
  try {
    const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.usersInventory), silentCfg)
    return {
      items: pickList(data || {}).map((item) => ({
        ip: str(getAnyFromObj(item, ['ip', 'key'])),
        key: str(getAnyFromObj(item, ['key', 'ip'])),
        mac: str(getAnyFromObj(item, ['mac'])),
        label: str(getAnyFromObj(item, ['label', 'displayName', 'display_name'])),
        hostname: str(getAnyFromObj(item, ['hostname'])),
        source: str(getAnyFromObj(item, ['source'])),
        proxyAccess: boolish(getAnyFromObj(item, ['proxyAccess', 'proxy_access'])) ?? true,
        updatedAt: str(getAnyFromObj(item, ['updatedAt', 'updated_at'])),
      })),
      policyMode: str(getAnyFromObj(data || {}, ['policyMode', 'policy_mode'])) || 'allowAll',
    }
  } catch {
    return listUsersInventoryFromUsersDb()
  }
}

export const saveUbuntuUsersInventoryAPI = async (
  items: Array<{ ip: string; mac?: string; label?: string; hostname?: string; source?: string; proxyAccess?: boolean }>,
  policyMode: string,
) => {
  if (preferCompatibilityBridge()) return saveUsersInventoryToUsersDb(items, policyMode)
  try {
    const { data } = await axios.put(
      ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.usersInventory),
      { items, policyMode },
      {
        ...silentCfg,
        timeout: 15000,
      },
    )
    return {
      items: pickList(data || {}).map((item) => ({
        ip: str(getAnyFromObj(item, ['ip', 'key'])),
        key: str(getAnyFromObj(item, ['key', 'ip'])),
        mac: str(getAnyFromObj(item, ['mac'])),
        label: str(getAnyFromObj(item, ['label', 'displayName', 'display_name'])),
        hostname: str(getAnyFromObj(item, ['hostname'])),
        source: str(getAnyFromObj(item, ['source'])),
        proxyAccess: boolish(getAnyFromObj(item, ['proxyAccess', 'proxy_access'])) ?? true,
        updatedAt: str(getAnyFromObj(item, ['updatedAt', 'updated_at'])),
      })),
      policyMode: str(getAnyFromObj(data || {}, ['policyMode', 'policy_mode'])) || policyMode || 'allowAll',
    }
  } catch {
    return saveUsersInventoryToUsersDb(items, policyMode)
  }
}

export const fetchUbuntuProviderChecksAPI = async () => {
  if (preferCompatibilityBridge()) return bridgeProviderChecks(false)
  try {
    const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.providerChecks), silentCfg)
    return normalizeUbuntuProviderState(data || {})
  } catch {
    return bridgeProviderChecks(false)
  }
}

export const runUbuntuProviderChecksAPI = async () => {
  if (preferCompatibilityBridge()) return bridgeRefreshProviderSslCache()
  try {
    const { data } = await axios.post(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.providerChecksRun), null, {
      ...silentCfg,
      timeout: 15000,
    })
    return normalizeUbuntuProviderState(data || {})
  } catch {
    return bridgeRefreshProviderSslCache()
  }
}

export const refreshUbuntuProvidersAPI = async () => {
  if (preferCompatibilityBridge()) return bridgeProviderChecks(true)
  try {
    const { data } = await axios.post(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.providerRefresh), null, {
      ...silentCfg,
      timeout: 15000,
    })
    return normalizeUbuntuProviderState(data || {})
  } catch {
    return bridgeProviderChecks(true)
  }
}

export const refreshUbuntuProviderSslCacheAPI = async () => {
  if (preferCompatibilityBridge()) return bridgeRefreshProviderSslCache()
  try {
    const { data } = await axios.post(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.providerSslCacheRefresh), null, {
      ...silentCfg,
      timeout: 15000,
    })
    return normalizeUbuntuProviderState(data || {})
  } catch {
    return bridgeRefreshProviderSslCache()
  }
}

export const fetchUbuntuProviderSslCacheStatusAPI = async () => {
  if (preferCompatibilityBridge()) return bridgeProviderChecks(false)
  try {
    const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.providerSslCacheStatus), silentCfg)
    return normalizeUbuntuProviderState(data || {})
  } catch {
    return bridgeProviderChecks(false)
  }
}

const boolish = (value: any): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase()
    if (!raw) return undefined
    if (['1', 'true', 'yes', 'y', 'on', 'enabled', 'active', 'running', 'ready'].includes(raw)) return true
    if (['0', 'false', 'no', 'n', 'off', 'disabled', 'inactive', 'dead', 'failed'].includes(raw)) return false
  }
  return undefined
}

const firstNonEmpty = (sources: any[], keys: string[]) => {
  for (const source of sources) {
    const value = getAnyFromObj(source, keys)
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return undefined
}

const numOrUndef = (value: any) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const objectItems = (payload: any, keys: string[]) => {
  for (const key of keys) {
    const raw = getAnyFromObj(payload, [key])
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([name, value]) => ({
        ...(value && typeof value === 'object' ? value : { value }),
        name,
      }))
    }
  }
  return [] as any[]
}

export type UbuntuSystemStatus = {
  ok: boolean
  hostname?: string
  serviceVersion?: string
  version?: string
  mihomoVersion?: string
  mihomoRunning?: boolean
  serviceStatus?: string
  serviceUnit?: string
  platform?: string
  kernel?: string
  arch?: string
  startedAtSec?: number
  uptimeSec?: number
  updatedAtSec?: number
  mihomoLogPath?: string
  error?: string
}

export type UbuntuSystemResources = {
  ok: boolean
  hostname?: string
  cpuPct?: number
  load1?: string
  load5?: string
  load15?: string
  memTotalBytes?: number
  memUsedBytes?: number
  memAvailableBytes?: number
  memUsedPct?: number
  diskTotalBytes?: number
  diskUsedBytes?: number
  diskFreeBytes?: number
  diskUsedPct?: number
  diskPath?: string
  uptimeSec?: number
  kernel?: string
  arch?: string
  platform?: string
  updatedAtSec?: number
  error?: string
}

export type UbuntuSystemServiceItem = {
  name: string
  label?: string
  description?: string
  activeState?: string
  subState?: string
  enabled?: boolean
  mainPid?: number
  sinceSec?: number
  version?: string
  error?: string
}

export type UbuntuSystemServices = {
  ok: boolean
  items: UbuntuSystemServiceItem[]
  updatedAtSec?: number
  error?: string
}

export type UbuntuSystemLogs = {
  ok: boolean
  source?: string
  path?: string
  tail?: number
  lines?: string[]
  text: string
  updatedAtSec?: number
  error?: string
}

export const normalizeUbuntuSystemStatus = (payload: any): UbuntuSystemStatus => {
  const hostSources = [payload?.host, payload?.system, payload?.service, payload?.data, payload]
  const mihomoSources = [payload?.mihomo, payload?.services?.mihomo, payload?.service?.mihomo, payload]
  const serviceSources = [payload?.service, payload?.services?.service, payload?.services?.ubuntu, payload]

  const ok = boolish(payload?.ok) ?? Boolean(payload?.service || payload?.mihomo || payload?.hostname || payload?.host)

  return {
    ok,
    hostname: str(firstNonEmpty(hostSources, ['hostname', 'host', 'nodeName', 'node', 'machine'])),
    serviceVersion: str(firstNonEmpty(serviceSources, ['version', 'serviceVersion', 'appVersion'])) || str(firstNonEmpty(hostSources, ['serviceVersion', 'appVersion', 'version'])),
    version: str(firstNonEmpty(hostSources, ['version', 'appVersion'])),
    mihomoVersion: str(firstNonEmpty(mihomoSources, ['version', 'mihomoVersion', 'coreVersion'])),
    mihomoRunning: boolish(firstNonEmpty(mihomoSources, ['running', 'active', 'ok', 'healthy', 'alive'])),
    serviceStatus: str(firstNonEmpty(serviceSources, ['status', 'state', 'activeState', 'active_state'])) || str(firstNonEmpty(mihomoSources, ['status', 'state'])),
    serviceUnit: str(firstNonEmpty(serviceSources, ['unit', 'serviceUnit', 'name'])) || 'ultra-ui-ubuntu.service',
    platform: str(firstNonEmpty(hostSources, ['platform', 'prettyName', 'pretty_name', 'os', 'distribution'])),
    kernel: str(firstNonEmpty(hostSources, ['kernel', 'kernelVersion', 'kernel_version'])),
    arch: str(firstNonEmpty(hostSources, ['arch', 'architecture'])),
    startedAtSec: toSec(firstNonEmpty(serviceSources, ['startedAtSec', 'started_at_sec', 'startedAt', 'started_at'])),
    uptimeSec: numOrUndef(firstNonEmpty(hostSources, ['uptimeSec', 'uptime_sec', 'uptime'])),
    updatedAtSec: toSec(firstNonEmpty(hostSources, ['updatedAtSec', 'updated_at_sec', 'updatedAt', 'updated_at', 'ts'])),
    mihomoLogPath: str(firstNonEmpty(mihomoSources, ['logPath', 'log_path', 'path'])) || '/var/log/mihomo/mihomo.log',
    error: str(payload?.error || payload?.message),
  }
}

export const normalizeUbuntuSystemResources = (payload: any): UbuntuSystemResources => {
  const root = payload?.resources || payload?.data || payload || {}
  const cpuSources = [root?.cpu, root?.system, root]
  const memSources = [root?.memory, root?.mem, root?.ram, root]
  const diskSources = [root?.disk, root?.storage, root?.filesystem, root?.fs, root]
  const loadSources = [root?.load, root?.cpu, root?.system, root]
  const hostSources = [root?.system, root?.host, root]

  const memTotalBytes = numOrUndef(firstNonEmpty(memSources, ['totalBytes', 'total_bytes', 'total', 'memTotal', 'mem_total']))
  const memUsedBytes = numOrUndef(firstNonEmpty(memSources, ['usedBytes', 'used_bytes', 'used', 'memUsed', 'mem_used']))
  const memAvailableBytes = numOrUndef(firstNonEmpty(memSources, ['availableBytes', 'available_bytes', 'freeBytes', 'free_bytes', 'available', 'free', 'memAvailable', 'mem_available', 'memFree']))
  const diskTotalBytes = numOrUndef(firstNonEmpty(diskSources, ['totalBytes', 'total_bytes', 'total', 'sizeBytes', 'size_bytes']))
  const diskUsedBytes = numOrUndef(firstNonEmpty(diskSources, ['usedBytes', 'used_bytes', 'used']))
  const diskFreeBytes = numOrUndef(firstNonEmpty(diskSources, ['freeBytes', 'free_bytes', 'availableBytes', 'available_bytes', 'free', 'available']))

  return {
    ok: boolish(root?.ok) ?? Boolean(memTotalBytes || diskTotalBytes || firstNonEmpty(cpuSources, ['cpuPct', 'usagePct', 'percent'])),
    hostname: str(firstNonEmpty(hostSources, ['hostname', 'host', 'nodeName', 'node'])),
    cpuPct: numOrUndef(firstNonEmpty(cpuSources, ['cpuPct', 'cpu_percent', 'usagePct', 'usage_pct', 'percent', 'usage'])),
    load1: str(firstNonEmpty(loadSources, ['load1', 'load_1', 'one', 'avg1'])),
    load5: str(firstNonEmpty(loadSources, ['load5', 'load_5', 'five', 'avg5'])),
    load15: str(firstNonEmpty(loadSources, ['load15', 'load_15', 'fifteen', 'avg15'])),
    memTotalBytes,
    memUsedBytes,
    memAvailableBytes,
    memUsedPct: numOrUndef(firstNonEmpty(memSources, ['usedPct', 'used_pct', 'usagePct', 'usage_pct', 'percent']))
      ?? (memTotalBytes && memUsedBytes ? (memUsedBytes / memTotalBytes) * 100 : undefined),
    diskTotalBytes,
    diskUsedBytes,
    diskFreeBytes,
    diskUsedPct: numOrUndef(firstNonEmpty(diskSources, ['usedPct', 'used_pct', 'usagePct', 'usage_pct', 'percent']))
      ?? (diskTotalBytes && diskUsedBytes ? (diskUsedBytes / diskTotalBytes) * 100 : undefined),
    diskPath: str(firstNonEmpty(diskSources, ['path', 'mount', 'mountpoint', 'mountPoint'])),
    uptimeSec: numOrUndef(firstNonEmpty(hostSources, ['uptimeSec', 'uptime_sec', 'uptime'])) || 0,
    kernel: str(firstNonEmpty(hostSources, ['kernel', 'kernelVersion', 'kernel_version'])),
    arch: str(firstNonEmpty(hostSources, ['arch', 'architecture'])),
    platform: str(firstNonEmpty(hostSources, ['platform', 'prettyName', 'pretty_name', 'os', 'distribution'])),
    updatedAtSec: toSec(firstNonEmpty([root], ['updatedAtSec', 'updated_at_sec', 'updatedAt', 'updated_at', 'ts'])),
    error: str(root?.error || root?.message),
  }
}

const normalizeServiceItem = (item: any): UbuntuSystemServiceItem | null => {
  const name = str(getAnyFromObj(item, ['name', 'unit', 'service', 'id']))
  if (!name) return null

  const enabledValue = firstNonEmpty([item], ['enabled', 'isEnabled', 'unitFileState', 'unit_file_state'])
  const enabledBool = boolish(enabledValue)
  const unitFileState = String(enabledValue || '').trim().toLowerCase()

  return {
    name,
    label: str(getAnyFromObj(item, ['label', 'title', 'displayName', 'display_name'])) || name,
    description: str(getAnyFromObj(item, ['description', 'desc', 'summary'])),
    activeState: str(getAnyFromObj(item, ['activeState', 'active_state', 'status', 'state'])),
    subState: str(getAnyFromObj(item, ['subState', 'sub_state'])),
    enabled: enabledBool ?? (unitFileState ? ['enabled', 'static', 'linked'].includes(unitFileState) : undefined),
    mainPid: numOrUndef(getAnyFromObj(item, ['mainPid', 'main_pid', 'pid'])),
    sinceSec: toSec(getAnyFromObj(item, ['sinceSec', 'since_sec', 'startedAtSec', 'started_at_sec', 'startedAt', 'started_at'])),
    version: str(getAnyFromObj(item, ['version', 'serviceVersion', 'appVersion'])),
    error: str(getAnyFromObj(item, ['error', 'message', 'statusText', 'status_text'])),
  }
}

export const normalizeUbuntuSystemServices = (payload: any): UbuntuSystemServices => {
  const rawItems = [
    ...pickList(payload),
    ...objectItems(payload, ['services', 'units']),
  ]

  const unique = new Map<string, UbuntuSystemServiceItem>()
  for (const item of rawItems) {
    const normalized = normalizeServiceItem(item)
    if (!normalized) continue
    unique.set(normalized.name, normalized)
  }

  const items = Array.from(unique.values()).sort((a, b) => {
    const ap = /mihomo/i.test(a.name) ? 0 : /ultra-ui|ubuntu/i.test(a.name) ? 1 : 2
    const bp = /mihomo/i.test(b.name) ? 0 : /ultra-ui|ubuntu/i.test(b.name) ? 1 : 2
    if (ap !== bp) return ap - bp
    return a.name.localeCompare(b.name)
  })

  return {
    ok: boolish(payload?.ok) ?? Boolean(items.length),
    items,
    updatedAtSec: toSec(firstNonEmpty([payload], ['updatedAtSec', 'updated_at_sec', 'updatedAt', 'updated_at', 'ts'])),
    error: str(payload?.error || payload?.message),
  }
}

export const normalizeUbuntuSystemLogs = (payload: any, fallback: { source?: string; tail?: number } = {}): UbuntuSystemLogs => {
  const linesRaw = pickList(payload)
  const lines = linesRaw.length
    ? linesRaw.map((item) => (typeof item === 'string' ? item : str(getAnyFromObj(item, ['line', 'text', 'message', 'payload'])))).filter(Boolean)
    : []
  const text = str(payload?.text || payload?.log || payload?.content || payload?.data?.text) || lines.join('\n')

  return {
    ok: boolish(payload?.ok) ?? Boolean(text),
    source: str(payload?.source) || fallback.source || 'mihomo',
    path: str(payload?.path || payload?.file || payload?.logPath || payload?.log_path),
    tail: num(payload?.tail ?? fallback.tail, 0) || undefined,
    lines,
    text,
    updatedAtSec: toSec(firstNonEmpty([payload], ['updatedAtSec', 'updated_at_sec', 'updatedAt', 'updated_at', 'ts'])),
    error: str(payload?.error || payload?.message),
  }
}

export const fetchUbuntuSystemStatusAPI = async () => {
  const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.status), silentCfg)
  return normalizeUbuntuSystemStatus(data || {})
}

export const fetchUbuntuSystemResourcesAPI = async () => {
  const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.resources), silentCfg)
  return normalizeUbuntuSystemResources(data || {})
}

export const fetchUbuntuSystemServicesAPI = async () => {
  const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.services), silentCfg)
  return normalizeUbuntuSystemServices(data || {})
}

export const fetchUbuntuSystemLogsAPI = async (args?: { source?: 'mihomo' | 'service'; tail?: number }) => {
  const { data } = await axios.get(ubuntuEndpoint(UBUNTU_BACKEND_ENDPOINTS.logs), {
    ...silentCfg,
    params: {
      source: args?.source || 'mihomo',
      tail: args?.tail || 160,
    },
  })
  return normalizeUbuntuSystemLogs(data || {}, args)
}
