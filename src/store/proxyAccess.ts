import { useStorage } from '@vueuse/core'

export type ProxyAccessPolicyMode = 'allowAll' | 'allowListOnly'

export const proxyAccessPolicyMode = useStorage<ProxyAccessPolicyMode>(
  'config/proxy-access-policy-mode-v1',
  'allowAll',
)
