import { useStorage } from '@vueuse/core'
import type { AgentQosProfile } from '@/api/agent'

export const routerHostQosDraftProfiles = useStorage<Record<string, AgentQosProfile>>(
  'config/router-host-qos-drafts-v2',
  {},
)

export const routerHostQosAppliedProfiles = useStorage<Record<string, AgentQosProfile>>(
  'config/router-host-qos-applied-v1',
  {},
)

export const routerHostQosExpanded = useStorage<boolean>('config/router-host-qos-expanded-v1', false)

export const mergeRouterHostQosAppliedProfiles = (next: Record<string, AgentQosProfile>) => {
  if (!next || !Object.keys(next).length) return
  routerHostQosAppliedProfiles.value = {
    ...routerHostQosAppliedProfiles.value,
    ...next,
  }
}

export const setRouterHostQosAppliedProfile = (ip: string, profile?: AgentQosProfile) => {
  if (!ip) return
  const next = { ...routerHostQosAppliedProfiles.value }
  if (profile) next[ip] = profile
  else delete next[ip]
  routerHostQosAppliedProfiles.value = next
}
