import { useStorage } from '@vueuse/core'

/**
 * Router-side helper agent (optional).
 * Used for "adult" bandwidth shaping per client via tc/iptables, because Mihomo API
 * does not provide traffic shaping.
 */

export const agentEnabled = useStorage<boolean>('config/agent-enabled', false)

/**
 * Default tries same host as the UI, on port 9099.
 * Example: http://192.168.1.1:9099
 */
export const agentUrl = useStorage<string>(
  'config/agent-url',
  typeof window !== 'undefined' ? `http://${window.location.hostname}:9099` : '',
)

/** Optional Bearer token for the agent. */
export const agentToken = useStorage<string>('config/agent-token', '')

/**
 * If enabled, bandwidth limits (Mbps) are enforced by the agent (tc/iptables),
 * NOT by disconnecting connections.
 */
export const agentEnforceBandwidth = useStorage<boolean>('config/agent-enforce-bandwidth', false)

/**
 * One-time LAN bootstrap for fresh browsers / new PCs.
 * Older router builds relied on router-agent for shared users DB, QoS and shaping.
 * Older builds stored both switches only in localStorage, so on another PC the UI
 * started with agent disabled even when the router-agent was already installed and working.
 */
const agentLanBootstrapDone = useStorage<boolean>('config/agent-lan-bootstrap-done-v2', false)

const normalizeAgentUrl = (value: string) => String(value || '').trim().replace(/\/+$/g, '')

const isLikelyLanAgentUrl = (value: string) => {
  const raw = normalizeAgentUrl(value)
  if (!raw) return false
  try {
    const url = new URL(raw)
    if (url.port && url.port !== '9099') return false
    const host = (url.hostname || '').trim().toLowerCase()
    if (!host) return false
    const currentHost = typeof window !== 'undefined' ? String(window.location.hostname || '').trim().toLowerCase() : ''
    if (currentHost && host === currentHost) return true
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true
    if (/^192\.168\./.test(host)) return true
    if (/^10\./.test(host)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
    return false
  } catch {
    return false
  }
}

export const bootstrapRouterAgentForLan = () => {
  // Legacy router bootstrap is intentionally disabled in the Ubuntu host line.
  agentLanBootstrapDone.value = true
}


/**
 * Remember which IPs were shaped by the UI, so we can clean up removed limits.
 */
export const managedAgentShapers = useStorage<Record<string, { upMbps: number; downMbps: number }>>(
  'config/agent-managed-shapers-v1',
  {},
)

/**
 * Per-IP shaping status from the agent.
 * Useful to show "applied/failed" badges and allow manual re-apply.
 */
export const agentShaperStatus = useStorage<
  Record<string, { ok: boolean; at: number; error?: string }>
>('config/agent-shaper-status-v1', {})

/**
 * MAC blocks managed by the UI (best-effort). Key = mac.
 */
export const managedAgentBlocks = useStorage<Record<string, { ports: string }>>(
  'config/agent-managed-blocks-v1',
  {},
)

/**
 * IP blocks managed by the UI (best-effort). Key = ip.
 * Useful when a MAC cannot be resolved.
 */
export const managedAgentIpBlocks = useStorage<Record<string, true>>(
  'config/agent-managed-ip-blocks-v1',
  {},
)


/**
 * Proxy-port only MAC blocks managed by the proxy access control.
 */
export const managedAgentProxyPortMacBlocks = useStorage<Record<string, { ports: string }>>(
  'config/agent-managed-proxy-port-mac-blocks-v1',
  {},
)

/**
 * Proxy-port only IP blocks managed by the proxy access control.
 */
export const managedAgentProxyPortIpBlocks = useStorage<Record<string, { ports: string }>>(
  'config/agent-managed-proxy-port-ip-blocks-v1',
  {},
)

/**
 * Scheduled backups (cron). Stored locally; can be applied to the router via the agent.
 * Default: daily at 04:00.
 */
export const agentBackupAutoEnabled = useStorage<boolean>('config/agent-backup-auto-enabled-v1', true)

/** Time in HH:MM (24h). */
export const agentBackupAutoTime = useStorage<string>('config/agent-backup-auto-time-v1', '04:00')
