import { fetchUbuntuProviderChecksAPI, fetchUbuntuProviderSslCacheStatusAPI, refreshUbuntuProviderSslCacheAPI, refreshUbuntuProvidersAPI, runUbuntuProviderChecksAPI } from '@/api/ubuntuService'
import { normalizeProxyProtoKey } from '@/helper/proxyProto'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { activeBackendCapabilities, activeBackendCapabilitiesError } from './backendCapabilities'
import { activeBackend } from './setup'
import { providerSslDbMeta, providerSslDbSnapshot } from './providerSslDb'
import { proxyProviderSubscriptionUrlMap } from './settings'
import { proxyProviederList } from './proxies'

export const autoSortProxyProvidersByHealth = useStorage<boolean>(
  'config/auto-sort-proxy-providers-by-health',
  true,
)

export const proxyProvidersSortMode = useStorage<'health' | 'activity' | 'traffic' | 'name'>(
  'config/proxy-providers-sort-mode',
  'health',
)

export const showOnlyActiveProxyProviders = useStorage<boolean>(
  'config/show-only-active-proxy-providers',
  false,
)

export const showOnlyTrafficProxyProviders = useStorage<boolean>(
  'config/show-only-traffic-proxy-providers',
  false,
)

export const providerHealthFilter = useStorage<string>('config/provider-health-filter', '')

const _proxyProvidersProtoFilter = useStorage<string>('config/proxy-providers-proto-filter', 'all')
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

const hasUbuntuProviderCapability = (...keys: string[]) => {
  const caps = activeBackendCapabilities.value || {}
  return keys.some((key) => Boolean((caps as any)?.[key]))
}

export const providerHealthAvailable = computed(() => {
  return hasUbuntuProviderCapability('providers', 'providerChecks', 'providerSslCacheStatus', 'providerChecksRun', 'providerRefresh', 'providerSslCacheRefresh')
})

export const providerHealthActionsAvailable = computed(() => {
  return hasUbuntuProviderCapability('providerChecksRun', 'providerRefresh', 'providerSslCacheRefresh')
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

const resetProviderRuntimeState = (error: string | null = null) => {
  agentProvidersOk.value = false
  agentProvidersError.value = error
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
  providerSslDbMeta.value = {
    checkedAtMs: agentProvidersAt.value,
    nextRefreshAtMs: 0,
    cacheFresh: false,
    cacheReady: false,
    refreshing: false,
  }
}

const normalizeSavedProviderSubscriptionUrl = (raw: any): string => {
  const url = String(raw || '').trim()
  if (!url) return ''
  const normalized = /^(https?|wss):\/\//i.test(url) ? url : `https://${url}`
  return /^(https|wss):\/\//i.test(normalized) ? normalized : ''
}

const collectSavedProviderSubscriptionTargets = () => {
  const ordered: { name: string; url: string }[] = []
  const seen = new Set<string>()
  const pushTarget = (rawName: any) => {
    const name = String(rawName || '').trim()
    if (!name || seen.has(name)) return
    const url = normalizeSavedProviderSubscriptionUrl((proxyProviderSubscriptionUrlMap.value || {})[name])
    if (!url) return
    seen.add(name)
    ordered.push({ name, url })
  }

  for (const provider of (proxyProviederList.value || []) as any[]) {
    const name = String(provider?.name || '').trim()
    if (!name || name === 'default' || provider?.vehicleType === 'Compatible') continue
    pushTarget(name)
  }

  for (const name of Object.keys(proxyProviderSubscriptionUrlMap.value || {})) pushTarget(name)
  return ordered
}

export const fetchAgentProviders = async (force = false) => {
  if (!providerHealthAvailable.value) {
    resetProviderRuntimeState(activeBackendCapabilitiesError.value || (Object.keys(activeBackendCapabilities.value || {}).length ? 'capability-missing' : null))
    return
  }

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

    const checkedAtMs = agentProvidersAt.value || Date.now()
    const snapshot: Record<string, any> = {}
    for (const provider of agentProviders.value || []) {
      const name = String((provider as any)?.name || '').trim()
      if (!name) continue
      snapshot[name] = {
        name,
        url: String((provider as any)?.url || '').trim(),
        host: String((provider as any)?.host || '').trim(),
        port: String((provider as any)?.port || '').trim(),
        sslNotAfter: String((provider as any)?.sslNotAfter || '').trim(),
        panelUrl: String((provider as any)?.panelUrl || '').trim(),
        panelSslNotAfter: String((provider as any)?.panelSslNotAfter || '').trim(),
        panelSslValidFrom: String((provider as any)?.panelSslValidFrom || '').trim(),
        panelSslFingerprintSha256: String((provider as any)?.panelSslFingerprintSha256 || '').trim(),
        panelSslVerifyError: String((provider as any)?.panelSslVerifyError || '').trim(),
        panelSslStatus: String((provider as any)?.panelSslStatus || '').trim(),
        panelSslDaysLeft: Number((provider as any)?.panelSslDaysLeft),
        panelSslIssuer: String((provider as any)?.panelSslIssuer || '').trim(),
        panelSslSubject: String((provider as any)?.panelSslSubject || '').trim(),
        panelSslSan: (provider as any)?.panelSslSan,
        panelSslError: String((provider as any)?.panelSslError || '').trim(),
        checkedAtMs,
      }
    }
    providerSslDbSnapshot.value = snapshot
    providerSslDbMeta.value = {
      checkedAtMs,
      nextRefreshAtMs: agentProvidersSslCacheNextRefreshAtMs.value || 0,
      cacheFresh: !!agentProvidersSslCacheFresh.value,
      cacheReady: !!agentProvidersSslCacheReady.value,
      refreshing: !!(agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value),
    }
  } finally {
    agentProvidersLoading.value = false
  }
}

export const refreshSavedProviderSubscriptionSsl = async () => {
  const targets = collectSavedProviderSubscriptionTargets()
  panelSslCheckedAt.value = Date.now()
  panelSslNotAfterByName.value = {}
  panelSslErrorByName.value = {}
  panelSslUrlByName.value = Object.fromEntries(targets.map((target) => [target.name, target.url]))

  const error = targets.length ? 'server-side-ssl-unavailable' : 'no-providers'
  panelSslProbeError.value = error
  return { ok: false, error, checkedAtSec: Math.floor(Date.now() / 1000), items: [] as any[] }
}

const providerHealthUsesUbuntuService = computed(() => providerHealthAvailable.value)

const applyProviderState = (res: any, opts?: { optimisticRefreshing?: boolean }) => {
  if (!res?.ok) {
    const nextError = String(res?.error || '').trim()
    if (nextError) agentProvidersError.value = nextError
    return res
  }

  agentProvidersOk.value = true
  agentProvidersError.value = null
  agentProvidersSslCacheReady.value = Boolean(res?.sslCacheReady)
  agentProvidersSslCacheFresh.value = Boolean(res?.sslCacheFresh)
  agentProvidersSslRefreshing.value = Boolean(res?.sslRefreshing ?? opts?.optimisticRefreshing ?? false)
  agentProvidersSslRefreshPending.value = Boolean(res?.sslRefreshPending ?? opts?.optimisticRefreshing ?? false)

  const ageSec = Number(res?.sslCacheAgeSec)
  agentProvidersSslCacheAgeSec.value = Number.isFinite(ageSec) ? ageSec : -1

  const nextSec = Number(res?.sslCacheNextRefreshAtSec)
  agentProvidersSslCacheNextRefreshAtMs.value = Number.isFinite(nextSec) && nextSec > 0 ? nextSec * 1000 : 0

  const checkedAtSec = Number(res?.checkedAtSec)
  agentProvidersAt.value = Number.isFinite(checkedAtSec) && checkedAtSec > 0 ? checkedAtSec * 1000 : Date.now()

  const nextCheckSec = Number(res?.nextCheckAtSec)
  if (Number.isFinite(nextCheckSec) && nextCheckSec > 0) {
    agentProvidersNextCheckAtMs.value = nextCheckSec * 1000
  }

  agentProvidersJobStatus.value = String(res?.job?.status || agentProvidersJobStatus.value || '').trim()
  agentProvidersJobId.value = String(res?.job?.id || agentProvidersJobId.value || '').trim()
  panelSslProbeError.value = null
  return res
}

export const runAgentProviderChecks = async () => {
  if (!providerHealthUsesUbuntuService.value) {
    return refreshSavedProviderSubscriptionSsl()
  }

  let res: any = { ok: false, error: 'capability-missing' }
  try {
    if (hasUbuntuProviderCapability('providerChecksRun')) {
      res = await runUbuntuProviderChecksAPI()
    } else if (hasUbuntuProviderCapability('providerSslCacheRefresh')) {
      res = await refreshUbuntuProviderSslCacheAPI()
    } else if (hasUbuntuProviderCapability('providerRefresh')) {
      res = await refreshUbuntuProvidersAPI()
    }
  } catch (e: any) {
    res = { ok: false, error: e?.message || 'failed' }
  }

  return applyProviderState(res, { optimisticRefreshing: true })
}

export const refreshAgentProviderSslCache = async () => {
  if (!providerHealthUsesUbuntuService.value) {
    return refreshSavedProviderSubscriptionSsl()
  }

  let res: any = { ok: false, error: 'capability-missing' }
  try {
    if (hasUbuntuProviderCapability('providerSslCacheRefresh')) {
      res = await refreshUbuntuProviderSslCacheAPI()
    } else if (hasUbuntuProviderCapability('providerChecksRun')) {
      res = await runUbuntuProviderChecksAPI()
    } else if (hasUbuntuProviderCapability('providerRefresh')) {
      res = await refreshUbuntuProvidersAPI()
    }
  } catch (e: any) {
    res = { ok: false, error: e?.message || 'failed' }
  }

  return applyProviderState(res, { optimisticRefreshing: true })
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

  await refreshSavedProviderSubscriptionSsl()
}

watch(
  [activeBackend, activeBackendCapabilities],
  () => {
    fetchAgentProviders(false)
  },
  { immediate: true, deep: true },
)

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
