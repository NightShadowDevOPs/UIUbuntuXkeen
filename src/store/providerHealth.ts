import { agentMihomoProvidersAPI, agentProviderSslCacheRefreshAPI, agentSslProbeBatchAPI } from '@/api/agent'
import { fetchUbuntuProviderChecksAPI, fetchUbuntuProviderSslCacheStatusAPI, refreshUbuntuProviderSslCacheAPI, refreshUbuntuProvidersAPI, runUbuntuProviderChecksAPI } from '@/api/ubuntuService'
import { normalizeProxyProtoKey } from '@/helper/proxyProto'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { agentEnabled } from './agent'
import { activeBackendCapabilities } from './backendCapabilities'
import { activeBackend } from './setup'
import { proxyProviderSubscriptionUrlMap } from './settings'
import { proxyProviederList } from './proxies'

export const autoSortProxyProvidersByHealth = useStorage<boolean>(
  'config/auto-sort-proxy-providers-by-health',
  true,
)

/** Provider list sort mode on the Providers tab. */
export const proxyProvidersSortMode = useStorage<'health' | 'activity' | 'traffic' | 'name'>(
  'config/proxy-providers-sort-mode',
  'health',
)

/** Show only providers that currently have active connections (best-effort). */
export const showOnlyActiveProxyProviders = useStorage<boolean>(
  'config/show-only-active-proxy-providers',
  false,
)

/** Show only providers that already have observed traffic (today/session/live). */
export const showOnlyTrafficProxyProviders = useStorage<boolean>(
  'config/show-only-traffic-proxy-providers',
  false,
)

/** Optional quick filter for providers tab: expired | nearExpiry | offline | degraded | healthy */
export const providerHealthFilter = useStorage<string>('config/provider-health-filter', '')

/** Providers sub-tab: protocol filter on Providers page (all | wg | vless | ss | ...). */
const _proxyProvidersProtoFilter = useStorage<string>('config/proxy-providers-proto-filter', 'all')

/** Providers sub-tab: protocol filter on Providers page (all | wg | vless | ss | ...). */
export const proxyProvidersProtoFilter = computed({
  get: () => {
    const v = normalizeProxyProtoKey(_proxyProvidersProtoFilter.value || 'all')
    return v || 'all'
  },
  set: (val) => {
    const v = normalizeProxyProtoKey(val || 'all')
    _proxyProvidersProtoFilter.value = v || 'all'
  },
})

const isUbuntuProviderServiceMode = computed(() => activeBackend.value?.kind === 'ubuntu-service')

const hasUbuntuProviderCapability = (...keys: string[]) => {
  const caps = activeBackendCapabilities.value || {}
  return keys.some((key) => Boolean((caps as any)?.[key]))
}

export const providerHealthAvailable = computed(() => {
  if (isUbuntuProviderServiceMode.value) {
    return hasUbuntuProviderCapability('providers', 'providerChecks', 'providerSslCacheStatus', 'providerChecksRun', 'providerRefresh', 'providerSslCacheRefresh')
  }
  return agentEnabled.value
})

export const providerHealthActionsAvailable = computed(() => {
  if (isUbuntuProviderServiceMode.value) {
    return hasUbuntuProviderCapability('providerChecksRun', 'providerRefresh', 'providerSslCacheRefresh')
  }
  return agentEnabled.value
})

export const agentProvidersLoading = ref(false)
export const agentProvidersOk = ref(false)
export const agentProvidersError = ref<string | null>(null)
export const agentProvidersAt = ref<number>(0)
export const agentProviders = ref<any[]>([])
export const agentProvidersSslCacheReady = ref(false)
export const agentProvidersSslCacheFresh = ref(false)
export const agentProvidersSslRefreshing = ref(false)
export const agentProvidersSslRefreshPending = ref(false)
export const agentProvidersSslCacheAgeSec = ref<number>(-1)
export const agentProvidersSslCacheNextRefreshAtMs = ref<number>(0)
export const agentProvidersNextCheckAtMs = ref<number>(0)
export const agentProvidersJobStatus = ref('')
export const agentProvidersJobId = ref('')

// SSL probe results for provider management panel URLs (name -> notAfter string).
export const panelSslNotAfterByName = ref<Record<string, string>>({})
export const panelSslErrorByName = ref<Record<string, string>>({})
export const panelSslUrlByName = ref<Record<string, string>>({})
export const panelSslCheckedAt = ref<number>(0)
export const panelSslProbeError = ref<string | null>(null)
export const panelSslProbeLoading = ref(false)

export const agentProviderByName = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {}
  for (const p of agentProviders.value || []) {
    if (p?.name) map[String(p.name)] = p
  }
  return map
})

export const fetchAgentProviders = async (force = false) => {
  if (providerHealthUsesUbuntuService.value) {
    if (agentProvidersLoading.value) return

    agentProvidersLoading.value = true
    try {
      const checksPromise = hasUbuntuProviderCapability('providerChecks', 'providers')
        ? fetchUbuntuProviderChecksAPI()
        : Promise.resolve({ ok: false, providers: [], error: '' } as any)
      const cachePromise = hasUbuntuProviderCapability('providerSslCacheStatus')
        ? fetchUbuntuProviderSslCacheStatusAPI()
        : Promise.resolve({ ok: false } as any)

      const [checksRes, cacheRes] = await Promise.allSettled([checksPromise, cachePromise])
      const checks = checksRes.status === 'fulfilled' ? checksRes.value : ({ ok: false, providers: [], error: checksRes.reason?.message || 'failed' } as any)
      const cache = cacheRes.status === 'fulfilled' ? cacheRes.value : ({ ok: false, error: cacheRes.reason?.message || '' } as any)

      const providers = Array.isArray(checks?.providers) ? checks.providers : []
      const hasProviders = providers.length > 0
      agentProvidersOk.value = Boolean(checks?.ok || cache?.ok || hasProviders)
      agentProvidersError.value = hasProviders ? null : checks?.error || cache?.error || null
      agentProviders.value = hasProviders ? providers : force ? [] : (agentProviders.value || [])

      agentProvidersSslCacheReady.value = Boolean(checks?.sslCacheReady ?? cache?.sslCacheReady)
      agentProvidersSslCacheFresh.value = Boolean(checks?.sslCacheFresh ?? cache?.sslCacheFresh)
      agentProvidersSslRefreshing.value = Boolean(checks?.sslRefreshing ?? cache?.sslRefreshing)
      agentProvidersSslRefreshPending.value = Boolean(checks?.sslRefreshPending ?? cache?.sslRefreshPending)

      const ageSec = Number(checks?.sslCacheAgeSec ?? cache?.sslCacheAgeSec)
      agentProvidersSslCacheAgeSec.value = Number.isFinite(ageSec) ? ageSec : -1

      const nextRefreshSec = Number(checks?.sslCacheNextRefreshAtSec ?? cache?.sslCacheNextRefreshAtSec)
      agentProvidersSslCacheNextRefreshAtMs.value = Number.isFinite(nextRefreshSec) && nextRefreshSec > 0 ? nextRefreshSec * 1000 : 0

      const checkedAtSec = Number(checks?.checkedAtSec ?? cache?.checkedAtSec)
      agentProvidersAt.value = Number.isFinite(checkedAtSec) && checkedAtSec > 0 ? checkedAtSec * 1000 : Date.now()

      const nextCheckSec = Number(checks?.nextCheckAtSec)
      agentProvidersNextCheckAtMs.value = Number.isFinite(nextCheckSec) && nextCheckSec > 0 ? nextCheckSec * 1000 : 0

      const job = checks?.job || cache?.job || null
      agentProvidersJobStatus.value = String(job?.status || '').trim()
      agentProvidersJobId.value = String(job?.id || '').trim()
      return
    } finally {
      agentProvidersLoading.value = false
    }
  }

  if (isUbuntuProviderServiceMode.value) {
    agentProvidersOk.value = false
    agentProvidersError.value = Object.keys(activeBackendCapabilities.value || {}).length ? 'capability-missing' : null
    agentProviders.value = []
    agentProvidersSslCacheReady.value = false
    agentProvidersSslCacheFresh.value = false
    agentProvidersSslRefreshing.value = false
    agentProvidersSslRefreshPending.value = false
    agentProvidersSslCacheAgeSec.value = -1
    agentProvidersSslCacheNextRefreshAtMs.value = 0
    agentProvidersNextCheckAtMs.value = 0
    agentProvidersJobStatus.value = ''
    agentProvidersJobId.value = ''
    agentProvidersAt.value = Date.now()
    return
  }

  if (!agentEnabled.value) {
    agentProvidersOk.value = false
    agentProvidersError.value = null
    agentProviders.value = []
    agentProvidersSslCacheReady.value = false
    agentProvidersSslCacheFresh.value = false
    agentProvidersSslRefreshing.value = false
    agentProvidersSslRefreshPending.value = false
    agentProvidersSslCacheAgeSec.value = -1
    agentProvidersSslCacheNextRefreshAtMs.value = 0
    agentProvidersNextCheckAtMs.value = 0
    agentProvidersJobStatus.value = ''
    agentProvidersJobId.value = ''
    agentProvidersAt.value = Date.now()
    return
  }

  if (agentProvidersLoading.value) return

  agentProvidersLoading.value = true
  try {
    const res = await agentMihomoProvidersAPI(force)
    const providers = Array.isArray((res as any)?.providers) ? ((res as any)?.providers as any[]) : []
    const hasProviders = providers.length > 0
    agentProvidersOk.value = !!res?.ok || hasProviders
    agentProvidersError.value = res?.ok || hasProviders ? null : res?.error || 'offline'
    agentProviders.value = hasProviders ? providers : (agentProviders.value || [])
    agentProvidersSslCacheReady.value = Boolean((res as any)?.sslCacheReady)
    agentProvidersSslCacheFresh.value = Boolean((res as any)?.sslCacheFresh)
    agentProvidersSslRefreshing.value = Boolean((res as any)?.sslRefreshing)
    agentProvidersSslRefreshPending.value = Boolean((res as any)?.sslRefreshPending)
    const ageSec = Number((res as any)?.sslCacheAgeSec)
    agentProvidersSslCacheAgeSec.value = Number.isFinite(ageSec) ? ageSec : -1
    const nextSec = Number((res as any)?.sslCacheNextRefreshAtSec)
    agentProvidersSslCacheNextRefreshAtMs.value = Number.isFinite(nextSec) && nextSec > 0 ? nextSec * 1000 : 0
    agentProvidersNextCheckAtMs.value = 0
    agentProvidersJobStatus.value = ''
    agentProvidersJobId.value = ''
    agentProvidersAt.value = typeof (res as any)?.checkedAtSec === 'number' && (res as any).checkedAtSec > 0 ? (res as any).checkedAtSec * 1000 : Date.now()
  } finally {
    agentProvidersLoading.value = false
  }
}

const providerHealthUsesUbuntuService = computed(() => isUbuntuProviderServiceMode.value && providerHealthAvailable.value)

export const refreshAgentProviderSslCache = async () => {
  if (providerHealthUsesUbuntuService.value) {
    let res: any = { ok: false, error: 'capability-missing' }

    if (hasUbuntuProviderCapability('providerSslCacheRefresh')) {
      res = await refreshUbuntuProviderSslCacheAPI()
    } else if (hasUbuntuProviderCapability('providerChecksRun')) {
      res = await runUbuntuProviderChecksAPI()
    } else if (hasUbuntuProviderCapability('providerRefresh')) {
      res = await refreshUbuntuProvidersAPI()
    }

    if (res?.ok) {
      agentProvidersSslCacheReady.value = Boolean(res?.sslCacheReady)
      agentProvidersSslCacheFresh.value = Boolean(res?.sslCacheFresh)
      agentProvidersSslRefreshing.value = Boolean(res?.sslRefreshing ?? true)
      agentProvidersSslRefreshPending.value = Boolean(res?.sslRefreshPending ?? true)
      const ageSec = Number(res?.sslCacheAgeSec)
      agentProvidersSslCacheAgeSec.value = Number.isFinite(ageSec) ? ageSec : -1
      const nextSec = Number(res?.sslCacheNextRefreshAtSec)
      agentProvidersSslCacheNextRefreshAtMs.value = Number.isFinite(nextSec) && nextSec > 0 ? nextSec * 1000 : 0
      const checkedAtSec = Number(res?.checkedAtSec)
      agentProvidersAt.value = Number.isFinite(checkedAtSec) && checkedAtSec > 0 ? checkedAtSec * 1000 : Date.now()
      const nextCheckSec = Number(res?.nextCheckAtSec)
      agentProvidersNextCheckAtMs.value = Number.isFinite(nextCheckSec) && nextCheckSec > 0 ? nextCheckSec * 1000 : agentProvidersNextCheckAtMs.value
      agentProvidersJobStatus.value = String(res?.job?.status || agentProvidersJobStatus.value || '').trim()
      agentProvidersJobId.value = String(res?.job?.id || agentProvidersJobId.value || '').trim()
    }
    return res
  }

  if (isUbuntuProviderServiceMode.value) return { ok: false, error: 'capability-missing' }
  if (!agentEnabled.value) return { ok: false, error: 'agent-disabled' }
  const res: any = await agentProviderSslCacheRefreshAPI()
  if (res?.ok) {
    agentProvidersSslCacheReady.value = Boolean(res?.ready)
    agentProvidersSslCacheFresh.value = Boolean(res?.fresh)
    agentProvidersSslRefreshing.value = Boolean(res?.refreshing ?? true)
    agentProvidersSslRefreshPending.value = true
    const ageSec = Number(res?.cacheAgeSec)
    agentProvidersSslCacheAgeSec.value = Number.isFinite(ageSec) ? ageSec : -1
    const nextSec = Number(res?.nextRefreshAtSec)
    agentProvidersSslCacheNextRefreshAtMs.value = Number.isFinite(nextSec) && nextSec > 0 ? nextSec * 1000 : 0
    agentProvidersAt.value = typeof res?.checkedAtSec === 'number' && res.checkedAtSec > 0 ? res.checkedAtSec * 1000 : Date.now()
  }
  return res
}

const readProviderProbeUrl = (provider: any, agentProvider: any, name: string): string => {
  const key = String(name || '').trim()
  const override = String((proxyProviderSubscriptionUrlMap.value || {})[key] || '').trim()
  if (override) return override

  const candidates = [provider, provider?.subscriptionInfo, agentProvider]
  for (const item of candidates) {
    const url = String(
      item?.url ??
      item?.uri ??
      item?.link ??
      item?.subscriptionUrl ??
      item?.subscription_url ??
      item?.sourceUrl ??
      item?.source_url ??
      item?.downloadUrl ??
      item?.download_url ??
      item?.subscribe ??
      item?.subscription ??
      item?.panelUrl ??
      item?.panel_url ??
      '',
    ).trim()
    if (url) return url
  }

  return ''
}

const buildProbeLines = (): string => {
  const names: string[] = []
  const seen = new Set<string>()
  const pushName = (raw: any) => {
    const name = String(raw || '').trim()
    if (!name || seen.has(name) || name === 'default') return
    seen.add(name)
    names.push(name)
  }

  for (const provider of proxyProviederList.value || []) pushName((provider as any)?.name)
  for (const name of Object.keys(proxyProviderSubscriptionUrlMap.value || {})) pushName(name)
  for (const provider of agentProviders.value || []) pushName((provider as any)?.name)

  const providerMetaByName = new Map<string, any>()
  for (const provider of proxyProviederList.value || []) {
    const name = String((provider as any)?.name || '').trim()
    if (name) providerMetaByName.set(name, provider)
  }

  const agentMetaByName = new Map<string, any>()
  for (const provider of agentProviders.value || []) {
    const name = String((provider as any)?.name || '').trim()
    if (name) agentMetaByName.set(name, provider)
  }

  const lines: string[] = []
  for (const name of names) {
    const url = readProviderProbeUrl(providerMetaByName.get(name), agentMetaByName.get(name), name)
    if (!/^(https|wss):\/\//i.test(url)) continue
    lines.push(`${name}	${url}`)
  }

  return lines.join('\n') + (lines.length ? '\n' : '')
}

export const probePanelSsl = async (force = false) => {
  if (providerHealthUsesUbuntuService.value) {
    if (panelSslProbeLoading.value) return
    panelSslProbeLoading.value = true
    panelSslProbeError.value = null
    try {
      if (force && providerHealthActionsAvailable.value) {
        await refreshAgentProviderSslCache()
      }
      await fetchAgentProviders(true)
      panelSslCheckedAt.value = Date.now()
      panelSslNotAfterByName.value = {}
      panelSslErrorByName.value = {}
      panelSslUrlByName.value = {}
    } catch (e: any) {
      panelSslProbeError.value = e?.message || 'failed'
    } finally {
      panelSslProbeLoading.value = false
    }
    return
  }

  if (isUbuntuProviderServiceMode.value) {
    panelSslNotAfterByName.value = {}
    panelSslErrorByName.value = {}
    panelSslUrlByName.value = {}
    panelSslCheckedAt.value = Date.now()
    panelSslProbeError.value = providerHealthAvailable.value ? null : 'capability-missing'
    return
  }

  if (!agentEnabled.value) {
    panelSslNotAfterByName.value = {}
    panelSslErrorByName.value = {}
    panelSslUrlByName.value = {}
    panelSslCheckedAt.value = Date.now()
    panelSslProbeError.value = null
    return
  }
  if (panelSslProbeLoading.value) return

  // basic TTL: avoid spamming openssl probes
  const ttlMs = 60_000
  if (!force && panelSslCheckedAt.value && Date.now() - panelSslCheckedAt.value < ttlMs) return

  const payload = buildProbeLines()
  if (!payload) {
    panelSslNotAfterByName.value = {}
    panelSslErrorByName.value = {}
    panelSslUrlByName.value = {}
    panelSslCheckedAt.value = Date.now()
    panelSslProbeError.value = null
    return
  }

  panelSslProbeLoading.value = true
  panelSslProbeError.value = null
  try {
    const res: any = await agentSslProbeBatchAPI(payload)
    if (!res?.ok) {
      panelSslProbeError.value = res?.error || 'failed'
      return
    }
    const out: Record<string, string> = {}
    const outErrors: Record<string, string> = {}
    const outUrls: Record<string, string> = {}
    for (const it of (res?.items || []) as any[]) {
      const name = String(it?.name || '').trim()
      if (!name) continue
      const na = String(it?.sslNotAfter || '').trim()
      const err = String(it?.error || '').trim()
      const url = String(it?.url || '').trim()
      if (na) out[name] = na
      if (err) outErrors[name] = err
      if (url) outUrls[name] = url
    }
    panelSslNotAfterByName.value = out
    panelSslErrorByName.value = outErrors
    panelSslUrlByName.value = outUrls
    panelSslCheckedAt.value = typeof res?.checkedAtSec === 'number' && res.checkedAtSec > 0 ? res.checkedAtSec * 1000 : Date.now()
  } catch (e: any) {
    panelSslProbeError.value = e?.message || 'failed'
  } finally {
    panelSslProbeLoading.value = false
  }
}

// best-effort: refresh when agent toggled
watch(
  [agentEnabled, activeBackend, activeBackendCapabilities],
  () => {
    fetchAgentProviders(false)
  },
  { immediate: true, deep: true },
)

// When subscription URLs change, drop the previous SSL probe snapshot so the
// Tasks table never shows stale certificate dates for a different link.
watch(
  proxyProviderSubscriptionUrlMap,
  () => {
    panelSslCheckedAt.value = 0
    panelSslNotAfterByName.value = {}
    panelSslErrorByName.value = {}
    panelSslUrlByName.value = {}
    panelSslProbeError.value = null
  },
  { deep: true },
)
