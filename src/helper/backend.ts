import { BACKEND_KINDS } from '@/config/backendContract'
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
  if (path.startsWith('/api') || path.includes('/service') || path.includes('/ubuntu')) {
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
