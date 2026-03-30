import { UBUNTU_PATHS } from './project'

export const BACKEND_KINDS = {
  COMPATIBILITY_BRIDGE: 'compatibility-bridge',
  UBUNTU_SERVICE: 'ubuntu-service',
} as const

export const UBUNTU_BACKEND_ENDPOINTS = {
  status: '/api/status',
  health: '/api/health',
  version: '/api/version',
  capabilities: '/api/capabilities',
  metrics: '/api/system/metrics',
  connections: '/api/system/connections',
  logs: '/api/system/logs',
  configActive: '/api/mihomo/config/active',
  configDraft: '/api/mihomo/config/draft',
  configHistory: '/api/mihomo/config/history',
  configValidate: '/api/mihomo/config/validate',
  configApply: '/api/mihomo/config/apply',
  configRollback: '/api/mihomo/config/rollback',
} as const

export const UBUNTU_BACKEND_CAPABILITIES = [
  'status',
  'health',
  'version',
  'capabilities',
  'metrics',
  'connections',
  'logs',
  'configActive',
  'configDraft',
  'configHistory',
  'configValidate',
  'configApply',
  'configRollback',
] as const

export const UBUNTU_BACKEND_FOUNDATION = {
  kind: BACKEND_KINDS.UBUNTU_SERVICE,
  endpoints: UBUNTU_BACKEND_ENDPOINTS,
  paths: UBUNTU_PATHS,
  capabilityKeys: UBUNTU_BACKEND_CAPABILITIES,
} as const
