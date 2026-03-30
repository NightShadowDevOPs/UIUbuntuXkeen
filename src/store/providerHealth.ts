import { agentMihomoProvidersAPI, agentProviderSslCacheRefreshAPI, agentSslProbeBatchAPI } from '@/api/agent'
import { normalizeProxyProtoKey } from '@/helper/proxyProto'
import { useStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { agentEnabled } from './agent'
import { proxyProviderPanelUrlMap } from './settings'

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
    agentProvidersAt.value = typeof (res as any)?.checkedAtSec === 'number' && (res as any).checkedAtSec > 0 ? (res as any).checkedAtSec * 1000 : Date.now()
  } finally {
    agentProvidersLoading.value = false
  }
}

export const refreshAgentProviderSslCache = async () => {
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

const buildProbeLines = (): string => {
  const map = proxyProviderPanelUrlMap.value || {}
  const lines: string[] = []
  for (const [name, url] of Object.entries(map)) {
    const n = String(name || '').trim()
    const u = String(url || '').trim()
    if (!n || !u) continue
    // We probe only https/wss. Other schemes will return empty anyway.
    lines.push(`${n}\t${u}`)
  }
  return lines.join('\n') + (lines.length ? '\n' : '')
}

export const probePanelSsl = async (force = false) => {
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
  agentEnabled,
  (on) => {
    if (on) fetchAgentProviders(false)
  },
  { immediate: true },
)

// When panel URLs change, keep the previous SSL state visible until the user
// explicitly refreshes it. This avoids false 'agent unavailable' / empty-state
// regressions when one dead panel makes SSL probing slow.
watch(
  proxyProviderPanelUrlMap,
  () => {
    panelSslCheckedAt.value = 0
    panelSslErrorByName.value = {}
    panelSslUrlByName.value = {}
    panelSslProbeError.value = null
  },
  { deep: true },
)
