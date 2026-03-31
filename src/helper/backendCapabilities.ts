import type { BackendCapabilities } from '@/types'

const toCamel = (value: string) =>
  String(value || '')
    .trim()
    .replace(/^[\s._-]+|[\s._-]+$/g, '')
    .replace(/[._-]+([a-zA-Z0-9])/g, (_, ch: string) => ch.toUpperCase())

const findKeyCaseInsensitive = (obj: Record<string, any>, key: string) => {
  const target = String(key || '').trim().toLowerCase()
  if (!target) return undefined
  return Object.keys(obj).find((candidate) => String(candidate || '').trim().toLowerCase() === target)
}

const getByPathCaseInsensitive = (obj: any, path: string): any => {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = String(path || '')
    .trim()
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)

  if (!parts.length) return undefined

  let cursor: any = obj
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined
    const found = findKeyCaseInsensitive(cursor as Record<string, any>, part)
    if (!found) return undefined
    cursor = (cursor as Record<string, any>)[found]
  }

  return cursor
}

const boolish = (value: any): boolean | undefined => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase()
    if (!raw) return undefined
    if (['1', 'true', 'yes', 'y', 'on', 'enabled', 'ready', 'supported', 'available'].includes(raw)) return true
    if (['0', 'false', 'no', 'n', 'off', 'disabled', 'unsupported', 'unavailable'].includes(raw)) return false
  }
  return undefined
}

const buildCapabilityStringSet = (raw: any): Set<string> => {
  const out = new Set<string>()

  const visit = (value: any, prefix = '') => {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const trimmed = item.trim()
          if (!trimmed) continue
          out.add(trimmed)
          out.add(toCamel(trimmed))
        } else {
          visit(item, prefix)
        }
      }
      return
    }

    if (!value || typeof value !== 'object') return

    for (const [key, child] of Object.entries(value)) {
      const full = prefix ? `${prefix}.${key}` : key
      const normalizedFull = full.trim()
      if (!normalizedFull) continue
      const childBool = boolish(child)
      if (childBool === true) {
        out.add(normalizedFull)
        out.add(toCamel(normalizedFull))
        out.add(key)
        out.add(toCamel(key))
      }
      if (child && typeof child === 'object') visit(child, normalizedFull)
    }
  }

  visit(raw)
  return out
}

const capabilityAliases: Record<keyof BackendCapabilities, string[]> = {
  status: ['status'],
  health: ['health'],
  version: ['version'],
  capabilities: ['capabilities'],
  metrics: ['metrics', 'system.metrics'],
  resources: ['resources', 'system.resources'],
  services: ['services', 'system.services'],
  network: ['network', 'system.network'],
  providers: ['providers'],
  providerChecks: ['providerChecks', 'providers.checks', 'providers.sslChecks'],
  providerChecksRun: ['providerChecksRun', 'providers.checks.run', 'providers.sslChecksRun'],
  providerRefresh: ['providerRefresh', 'providers.refresh'],
  providerSslCacheRefresh: ['providerSslCacheRefresh', 'providers.sslCacheRefresh'],
  providerSslCacheStatus: ['providerSslCacheStatus', 'providers.sslCacheStatus'],
  geoInfo: ['geoInfo', 'geo.info'],
  geoUpdate: ['geoUpdate', 'geo.update'],
  geoHistory: ['geoHistory', 'geo.history'],
  trafficOverview: ['trafficOverview', 'traffic.overview'],
  trafficClients: ['trafficClients', 'traffic.clients'],
  trafficTopology: ['trafficTopology', 'traffic.topology'],
  qosStatus: ['qosStatus', 'qos.status'],
  qosSet: ['qosSet', 'qos.set'],
  qosRemove: ['qosRemove', 'qos.remove'],
  shapeSet: ['shapeSet', 'shape.set'],
  shapeRemove: ['shapeRemove', 'shape.remove'],
  jobs: ['jobs'],
  jobsRetry: ['jobsRetry', 'jobs.retry'],
  usersInventory: ['usersInventory', 'users.inventory'],
  usersInventoryPut: ['usersInventoryPut', 'users.inventory.put'],
  connections: ['connections'],
  logs: ['logs', 'system.logs'],
  configActive: ['configActive', 'mihomo.configActive'],
  configDraft: ['configDraft', 'mihomo.configDraft'],
  configHistory: ['configHistory', 'mihomo.configHistory'],
  configValidate: ['configValidate', 'mihomo.configValidate', 'mihomo.configFlow'],
  configApply: ['configApply', 'mihomo.configApply', 'mihomo.configFlow'],
  configRollback: ['configRollback', 'mihomo.configRollback', 'mihomo.configFlow'],
}

const hasCapability = (raw: any, flags: Set<string>, aliases: string[]) => {
  for (const alias of aliases) {
    const trimmed = String(alias || '').trim()
    if (!trimmed) continue
    if (flags.has(trimmed) || flags.has(toCamel(trimmed))) return true

    const pathValue = getByPathCaseInsensitive(raw, trimmed)
    const pathBool = boolish(pathValue)
    if (pathBool !== undefined) return pathBool

    if (raw && typeof raw === 'object') {
      const exact = findKeyCaseInsensitive(raw as Record<string, any>, trimmed)
      if (exact) {
        const exactBool = boolish((raw as Record<string, any>)[exact])
        if (exactBool !== undefined) return exactBool
      }

      const camel = toCamel(trimmed)
      const camelKey = findKeyCaseInsensitive(raw as Record<string, any>, camel)
      if (camelKey) {
        const camelBool = boolish((raw as Record<string, any>)[camelKey])
        if (camelBool !== undefined) return camelBool
      }
    }
  }
  return false
}

export const normalizeBackendCapabilities = (input: any): BackendCapabilities => {
  const raw = input?.capabilities ?? input ?? {}
  const flags = buildCapabilityStringSet(raw)
  const out = {} as BackendCapabilities

  for (const key of Object.keys(capabilityAliases) as Array<keyof BackendCapabilities>) {
    out[key] = hasCapability(raw, flags, capabilityAliases[key])
  }

  return out
}

export const buildCompatibilityBridgeCapabilities = (): BackendCapabilities => ({
  status: true,
  health: false,
  version: true,
  capabilities: false,
  metrics: false,
  resources: false,
  services: false,
  network: false,
  providers: true,
  providerChecks: false,
  providerChecksRun: false,
  providerRefresh: false,
  providerSslCacheRefresh: false,
  providerSslCacheStatus: false,
  geoInfo: false,
  geoUpdate: false,
  geoHistory: false,
  trafficOverview: false,
  trafficClients: false,
  trafficTopology: false,
  qosStatus: false,
  qosSet: false,
  qosRemove: false,
  shapeSet: false,
  shapeRemove: false,
  jobs: false,
  jobsRetry: false,
  usersInventory: false,
  usersInventoryPut: false,
  connections: true,
  logs: true,
  configActive: false,
  configDraft: false,
  configHistory: false,
  configValidate: false,
  configApply: false,
  configRollback: false,
})
