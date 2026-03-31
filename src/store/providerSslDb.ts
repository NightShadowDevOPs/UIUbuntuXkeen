import { useStorage } from '@vueuse/core'

export type ProviderSslDbItem = {
  name: string
  url?: string
  host?: string
  port?: string
  sslNotAfter?: string
  panelUrl?: string
  panelSslNotAfter?: string
  checkedAtMs?: number
}

export type ProviderSslDbMeta = {
  checkedAtMs: number
  nextRefreshAtMs: number
  cacheFresh: boolean
  cacheReady: boolean
  refreshing: boolean
}

export const providerSslDbSnapshot = useStorage<Record<string, ProviderSslDbItem>>(
  'config/provider-ssl-db-snapshot-v1',
  {},
)

export const providerSslDbMeta = useStorage<ProviderSslDbMeta>('config/provider-ssl-db-meta-v1', {
  checkedAtMs: 0,
  nextRefreshAtMs: 0,
  cacheFresh: false,
  cacheReady: false,
  refreshing: false,
})
