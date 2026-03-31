import {
  BACKEND_KINDS,
  UBUNTU_BACKEND_ENDPOINTS,
  UBUNTU_BACKEND_FOUNDATION,
} from '@/config/backendContract'
import type { Backend, BackendCapabilities, BackendKind } from '@/types'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0'])

export const normalizeSecondaryPath = (value: string | undefined | null) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const trimmed = raw.replace(/\/+$/g, '')
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export const detectBackendKind = (backend?: Partial<Backend> | null): BackendKind => {
  const explicit = backend?.kind
  if (explicit === BACKEND_KINDS.UBUNTU_SERVICE || explicit === BACKEND_KINDS.COMPATIBILITY_BRIDGE) {
    return explicit
  }

  const path = normalizeSecondaryPath(backend?.secondaryPath)
  if (path.startsWith('/api') || path.includes('/ubuntu')) {
    return BACKEND_KINDS.UBUNTU_SERVICE
  }

  const host = String(backend?.host || '').trim().toLowerCase()
  if (LOCAL_HOSTS.has(host)) {
    return BACKEND_KINDS.UBUNTU_SERVICE
  }

  return BACKEND_KINDS.COMPATIBILITY_BRIDGE
}

export const normalizeBackendInput = <T extends Omit<Backend, 'uuid'>>(backend: T): T => {
  const kind = detectBackendKind(backend)
  return {
    ...backend,
    secondaryPath: normalizeSecondaryPath(backend.secondaryPath),
    kind,
  }
}



export const getBackendEndpointPath = (backend: Pick<Backend, 'protocol' | 'host' | 'port' | 'secondaryPath'>, endpoint: string) => {
  const secondaryPath = normalizeSecondaryPath(backend.secondaryPath)
  const normalizedEndpoint = normalizeSecondaryPath(endpoint)

  if (!secondaryPath) return normalizedEndpoint || '/'
  if (!normalizedEndpoint) return secondaryPath
  if (normalizedEndpoint === secondaryPath) return secondaryPath
  if (normalizedEndpoint.startsWith(`${secondaryPath}/`)) {
    return normalizedEndpoint.slice(secondaryPath.length) || '/'
  }

  return `${secondaryPath}${normalizedEndpoint}`
}

export const getBackendUrlForEndpoint = (backend: Pick<Backend, 'protocol' | 'host' | 'port' | 'secondaryPath'>, endpoint: string) => {
  return `${backend.protocol}://${backend.host}:${backend.port}${getBackendEndpointPath(backend, endpoint)}`
}

export const getRecommendedSecondaryPath = (kind: BackendKind | undefined | null) => {
  return kind === BACKEND_KINDS.UBUNTU_SERVICE
    ? UBUNTU_BACKEND_FOUNDATION.endpoints.status.replace(/\/status$/, '')
    : ''
}

export const getBackendKindBadgeClass = (kind: BackendKind | undefined | null) => {
  return kind === BACKEND_KINDS.UBUNTU_SERVICE
    ? 'badge badge-success badge-outline'
    : 'badge badge-ghost badge-outline'
}

export const getBackendRuntimeTitleKey = (kind: BackendKind | undefined | null) => {
  return kind === BACKEND_KINDS.UBUNTU_SERVICE ? 'hostRuntimeWorkspaceTitle' : 'routerWorkspaceTitle'
}

export const getBackendRuntimeTipKey = (kind: BackendKind | undefined | null) => {
  return kind === BACKEND_KINDS.UBUNTU_SERVICE ? 'hostRuntimeWorkspaceTip' : 'routerWorkspaceTip'
}

export const getBackendInfoTitleKey = (kind: BackendKind | undefined | null) => {
  return kind === BACKEND_KINDS.UBUNTU_SERVICE ? 'hostRuntimeInfo' : 'routerInfo'
}

export const getBackendInfoTipKey = (kind: BackendKind | undefined | null) => {
  return kind === BACKEND_KINDS.UBUNTU_SERVICE ? 'hostRuntimeInfoTip' : 'routerInfoTip'
}

export const getBackendProbePaths = (kind: BackendKind | undefined | null) => {
  if (kind === BACKEND_KINDS.UBUNTU_SERVICE) {
    return [
      UBUNTU_BACKEND_ENDPOINTS.status,
      UBUNTU_BACKEND_ENDPOINTS.health,
      UBUNTU_BACKEND_ENDPOINTS.version,
      UBUNTU_BACKEND_ENDPOINTS.capabilities,
    ]
  }

  return ['/version', '/configs', '/proxies', '/providers/proxies', '/rules', '/connections', '/logs']
}

export const isUbuntuServiceBackend = (backend?: Partial<Backend> | null) => {
  return detectBackendKind(backend) === BACKEND_KINDS.UBUNTU_SERVICE
}

export const applyRecommendedSecondaryPath = <T extends { secondaryPath?: string; kind?: BackendKind }>(backend: T): T => {
  return {
    ...backend,
    secondaryPath: getRecommendedSecondaryPath(backend.kind),
  }
}

export const mergeBackendCapabilities = (
  current?: BackendCapabilities,
  next?: BackendCapabilities,
): BackendCapabilities | undefined => {
  if (!current && !next) return undefined
  return {
    ...(current || {}),
    ...(next || {}),
  }
}
