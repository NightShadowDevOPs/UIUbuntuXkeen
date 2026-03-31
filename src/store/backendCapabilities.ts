import { buildCompatibilityBridgeCapabilities, normalizeBackendCapabilities } from '@/helper/backendCapabilities'
import { detectBackendKind } from '@/helper/backend'
import { getUrlFromBackend } from '@/helper/utils'
import { activeBackend } from '@/store/setup'
import type { BackendCapabilities } from '@/types'
import { ref, watch } from 'vue'

export const activeBackendCapabilities = ref<BackendCapabilities>({})
export const activeBackendCapabilitiesReady = ref(false)
export const activeBackendCapabilitiesError = ref('')
export const activeBackendCapabilitiesUpdatedAt = ref(0)

const normalizeCapabilitiesPayload = (payload: any): BackendCapabilities => {
  const normalized = normalizeBackendCapabilities(payload)
  return {
    ...normalized,
    status: normalized.status ?? true,
    version: normalized.version ?? true,
  }
}

export const refreshActiveBackendCapabilities = async (force = false) => {
  const backend = activeBackend.value
  if (!backend) {
    activeBackendCapabilities.value = {}
    activeBackendCapabilitiesReady.value = false
    activeBackendCapabilitiesError.value = ''
    activeBackendCapabilitiesUpdatedAt.value = 0
    return {}
  }

  const kind = detectBackendKind(backend)
  const secondaryPath = String(backend.secondaryPath || '').trim()
  const shouldProbeCapabilities = kind === 'ubuntu-service' || secondaryPath.startsWith('/api')
  if (!shouldProbeCapabilities) {
    const fallback = buildCompatibilityBridgeCapabilities()
    activeBackendCapabilities.value = fallback
    activeBackendCapabilitiesReady.value = true
    activeBackendCapabilitiesError.value = ''
    activeBackendCapabilitiesUpdatedAt.value = Date.now()
    return fallback
  }

  if (!force && activeBackendCapabilitiesReady.value && activeBackendCapabilitiesUpdatedAt.value && Date.now() - activeBackendCapabilitiesUpdatedAt.value < 20_000) {
    return activeBackendCapabilities.value
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`${getUrlFromBackend(backend)}/api/capabilities`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${backend.password}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`capabilities-http-${res.status}`)
    const payload = await res.json()
    const normalized = normalizeCapabilitiesPayload(payload)
    activeBackendCapabilities.value = normalized
    activeBackendCapabilitiesReady.value = true
    activeBackendCapabilitiesError.value = ''
    activeBackendCapabilitiesUpdatedAt.value = Date.now()
    return normalized
  } catch (e: any) {
    activeBackendCapabilities.value = {}
    activeBackendCapabilitiesReady.value = false
    activeBackendCapabilitiesError.value = e?.message || 'failed'
    activeBackendCapabilitiesUpdatedAt.value = Date.now()
    return {}
  } finally {
    clearTimeout(timeoutId)
  }
}

watch(
  activeBackend,
  () => {
    refreshActiveBackendCapabilities(true)
  },
  { immediate: true, deep: true },
)
