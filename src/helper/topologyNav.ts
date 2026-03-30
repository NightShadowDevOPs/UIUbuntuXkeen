import { ROUTE_NAME } from '@/constant'
import type { Router } from 'vue-router'

export const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1'

export type TopologyNavStage = 'C' | 'R' | 'G' | 'S' | 'P'
export type TopologyNavMode = 'none' | 'only' | 'exclude'

export type TopologyNavFocus = {
  stage: TopologyNavStage
  kind: 'value'
  value: string
}

export type PendingTopologyNavFilter = {
  ts: number
  mode: TopologyNavMode
  focus: TopologyNavFocus
  fallbackProxyName?: string
}

export const setPendingTopologyNavFilter = (payload: PendingTopologyNavFilter) => {
  try {
    localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export const clearPendingTopologyNavFilter = () => {
  try {
    localStorage.removeItem(TOPOLOGY_NAV_FILTER_KEY)
  } catch {
    // ignore
  }
}

export const navigateToTopology = async (
  router: Router,
  focus: { stage: TopologyNavStage; value: string },
  mode: TopologyNavMode = 'none',
  opts?: { fallbackProxyName?: string },
) => {
  const value = String(focus?.value || '').trim()
  if (!value) return

  const payload: PendingTopologyNavFilter = {
    ts: Date.now(),
    mode,
    focus: { stage: focus.stage, kind: 'value', value },
    fallbackProxyName: opts?.fallbackProxyName || '',
  }

  setPendingTopologyNavFilter(payload)
  await router.push({ name: ROUTE_NAME.overview })
}
