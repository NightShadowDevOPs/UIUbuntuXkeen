import { UBUNTU_BACKEND_ENDPOINTS } from '@/config/backendContract'
import { getAnyFromObj } from '@/helper/providerHealth'
import axios from 'axios'
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

export const fetchUbuntuProviderChecksAPI = async () => {
  const { data } = await axios.get(UBUNTU_BACKEND_ENDPOINTS.providerChecks, silentCfg)
  return normalizeUbuntuProviderState(data || {})
}

export const runUbuntuProviderChecksAPI = async () => {
  const { data } = await axios.post(UBUNTU_BACKEND_ENDPOINTS.providerChecksRun, null, {
    ...silentCfg,
    timeout: 15000,
  })
  return normalizeUbuntuProviderState(data || {})
}

export const refreshUbuntuProvidersAPI = async () => {
  const { data } = await axios.post(UBUNTU_BACKEND_ENDPOINTS.providerRefresh, null, {
    ...silentCfg,
    timeout: 15000,
  })
  return normalizeUbuntuProviderState(data || {})
}

export const refreshUbuntuProviderSslCacheAPI = async () => {
  const { data } = await axios.post(UBUNTU_BACKEND_ENDPOINTS.providerSslCacheRefresh, null, {
    ...silentCfg,
    timeout: 15000,
  })
  return normalizeUbuntuProviderState(data || {})
}

export const fetchUbuntuProviderSslCacheStatusAPI = async () => {
  const { data } = await axios.get(UBUNTU_BACKEND_ENDPOINTS.providerSslCacheStatus, silentCfg)
  return normalizeUbuntuProviderState(data || {})
}
