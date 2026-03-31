import { getConfigsSilentAPI } from '@/api'
import {
  agentBlockIpPortsAPI,
  agentBlockMacPortsAPI,
  agentLanHostsAPI,
  agentStatusAPI,
  agentUnblockIpPortsAPI,
  agentUnblockMacPortsAPI,
  type AgentLanHost,
} from '@/api/agent'
import { activeConnections } from '@/store/connections'
import { managedAgentProxyPortIpBlocks, managedAgentProxyPortMacBlocks, agentEnabled } from '@/store/agent'
import { proxyAccessPolicyMode } from '@/store/proxyAccess'
import { sourceIPLabelList } from '@/store/settings'
import { debounce } from 'lodash'
import { ref, watch } from 'vue'
import type { SourceIPLabel } from '@/types'

export const proxyAccessKnownHosts = ref<AgentLanHost[]>([])
export const proxyAccessLastScanAt = ref(0)
export const proxyAccessLastApplyAt = ref(0)
export const proxyAccessLastError = ref('')

let started = false
let lastPortsKey = ''

const normalizeIp = (value: string) => String(value || '').trim().split('/')[0]
const normalizeMac = (value: string) => String(value || '').trim().toLowerCase()

const isLiteralIp = (value: string) => {
  const raw = normalizeIp(value)
  if (!raw) return false
  if (raw.includes(':')) return true
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)
}

const upsertKnownHostsIntoLabels = (items: AgentLanHost[]) => {
  if (!Array.isArray(items) || !items.length) return false

  const next = [...(sourceIPLabelList.value || [])] as SourceIPLabel[]
  let changed = false

  for (const host of items) {
    const ip = normalizeIp(host.ip || '')
    if (!ip || !isLiteralIp(ip)) continue

    const mac = normalizeMac(host.mac || '')
    const hostname = String(host.hostname || '').trim()
    const source = String(host.source || '').trim()

    let current = next.find((item) => normalizeIp((item as any)?.key || '') === ip) || null
    if (!current && mac) current = next.find((item) => normalizeMac((item as any)?.mac || '') === mac) || null

    if (!current) {
      const label = hostname || ip
      next.push({
        id: `lan_${ip.replace(/[^0-9a-fA-F]+/g, '_')}`,
        key: ip,
        label,
        mac: mac || undefined,
        hostname: hostname || undefined,
        source: source || undefined,
        proxyAccess: proxyAccessPolicyMode.value === 'allowListOnly' ? false : undefined,
      })
      changed = true
      continue
    }

    if (current.key !== ip) {
      current.key = ip
      changed = true
    }
    if (mac && current.mac !== mac) {
      current.mac = mac
      changed = true
    }
    if (hostname && current.hostname !== hostname) {
      current.hostname = hostname
      changed = true
    }
    if (source && current.source !== source) {
      current.source = source
      changed = true
    }
    if (!current.label) {
      current.label = hostname || ip
      changed = true
    }
  }

  if (changed) sourceIPLabelList.value = next as any
  return changed
}

const collectKnownHosts = () => {
  const byIp = new Map<string, AgentLanHost>()

  for (const host of proxyAccessKnownHosts.value || []) {
    const ip = normalizeIp(host.ip || '')
    if (!ip) continue
    byIp.set(ip, { ...host, ip })
  }

  for (const conn of activeConnections.value || []) {
    const ip = normalizeIp(String((conn as any)?.metadata?.sourceIP || '').trim())
    if (!ip) continue
    if (byIp.has(ip)) continue
    byIp.set(ip, { ip })
  }

  return Array.from(byIp.values())
}

const findLabelForHost = (host: AgentLanHost) => {
  const ip = normalizeIp(host.ip || '')
  const mac = normalizeMac(host.mac || '')
  let label = (sourceIPLabelList.value || []).find((item) => normalizeIp((item as any)?.key || '') === ip) || null
  if (!label && mac) label = (sourceIPLabelList.value || []).find((item) => normalizeMac((item as any)?.mac || '') === mac) || null
  return label as SourceIPLabel | null
}

const isHostAllowed = (host: AgentLanHost) => {
  const label = findLabelForHost(host)
  if (proxyAccessPolicyMode.value === 'allowListOnly') return label?.proxyAccess === true
  return label?.proxyAccess !== false
}

const getMihomoProxyPorts = async () => {
  try {
    const cfgResp = await getConfigsSilentAPI().catch(() => null)
    const cfg: any = cfgResp?.data
    const keys = ['port', 'socks-port', 'mixed-port', 'redir-port', 'tproxy-port']
    const out: number[] = []
    for (const key of keys) {
      const raw = cfg?.[key] ?? cfg?.[key.replace(/-/g, '')]
      const port = Number(raw)
      if (Number.isFinite(port) && port > 0) out.push(port)
    }
    return Array.from(new Set(out)).sort((a, b) => a - b)
  } catch {
    return [] as number[]
  }
}

const syncProxyPortBlocks = async (desiredMacs: string[], desiredIps: string[], ports: number[]) => {
  const portsStr = (ports || []).join(',')

  const prevMac = managedAgentProxyPortMacBlocks.value || {}
  const prevIp = managedAgentProxyPortIpBlocks.value || {}

  const macSet = Array.from(new Set((desiredMacs || []).map(normalizeMac).filter(Boolean))).sort()
  const ipSet = Array.from(new Set((desiredIps || []).map(normalizeIp).filter(Boolean))).sort()

  const removeMac = Object.keys(prevMac).filter((mac) => !macSet.includes(normalizeMac(mac)))
  const removeIp = Object.keys(prevIp).filter((ip) => !ipSet.includes(normalizeIp(ip)))

  if (removeMac.length) await Promise.allSettled(removeMac.map((mac) => agentUnblockMacPortsAPI(mac)))
  if (removeIp.length) await Promise.allSettled(removeIp.map((ip) => agentUnblockIpPortsAPI(ip)))

  const addMac = macSet.filter((mac) => !prevMac[mac] || prevMac[mac].ports !== portsStr)
  const addIp = ipSet.filter((ip) => !prevIp[ip] || prevIp[ip].ports !== portsStr)

  if (addMac.length) {
    await Promise.allSettled(addMac.map((mac) => agentBlockMacPortsAPI({ mac, ports })))
  }
  if (addIp.length) {
    await Promise.allSettled(addIp.map((ip) => agentBlockIpPortsAPI({ ip, ports })))
  }

  managedAgentProxyPortMacBlocks.value = Object.fromEntries(macSet.map((mac) => [mac, { ports: portsStr }]))
  managedAgentProxyPortIpBlocks.value = Object.fromEntries(ipSet.map((ip) => [ip, { ports: portsStr }]))
}

export const refreshProxyAccessKnownHosts = async (force = false) => {
  if (!agentEnabled.value && !force) return { ok: false as const, error: 'agent-disabled' }
  const res = await agentLanHostsAPI()
  if (!res?.ok) {
    proxyAccessLastError.value = String(res?.error || 'failed')
    return { ok: false as const, error: proxyAccessLastError.value }
  }

  const items = Array.isArray(res.items) ? res.items : []
  proxyAccessKnownHosts.value = items.map((item) => ({
    ip: normalizeIp(item.ip || ''),
    mac: normalizeMac(item.mac || '') || undefined,
    hostname: String(item.hostname || '').trim() || undefined,
    source: String(item.source || '').trim() || undefined,
  })).filter((item) => item.ip)
  proxyAccessLastScanAt.value = Date.now()
  proxyAccessLastError.value = ''
  upsertKnownHostsIntoLabels(proxyAccessKnownHosts.value)
  return { ok: true as const, count: proxyAccessKnownHosts.value.length }
}

export const applyProxyAccessControlNow = async () => {
  if (!agentEnabled.value) return { ok: false as const, error: 'agent-disabled' }

  const status = await agentStatusAPI()
  if (!status?.ok) return { ok: false as const, error: status?.error || 'offline' }
  if (status.iptables === false) return { ok: false as const, error: 'iptables-unavailable' }

  if (!proxyAccessKnownHosts.value.length) await refreshProxyAccessKnownHosts(true)

  const ports = await getMihomoProxyPorts()
  const portsKey = ports.join(',')
  if (!ports.length) {
    if (Object.keys(managedAgentProxyPortMacBlocks.value || {}).length) await Promise.allSettled(Object.keys(managedAgentProxyPortMacBlocks.value || {}).map((mac) => agentUnblockMacPortsAPI(mac)))
    if (Object.keys(managedAgentProxyPortIpBlocks.value || {}).length) await Promise.allSettled(Object.keys(managedAgentProxyPortIpBlocks.value || {}).map((ip) => agentUnblockIpPortsAPI(ip)))
    managedAgentProxyPortMacBlocks.value = {}
    managedAgentProxyPortIpBlocks.value = {}
    lastPortsKey = ''
    proxyAccessLastApplyAt.value = Date.now()
    return { ok: true as const, ports: [] as number[] }
  }

  const deniedMacs: string[] = []
  const deniedIps: string[] = []
  for (const host of collectKnownHosts()) {
    if (isHostAllowed(host)) continue
    const mac = normalizeMac(host.mac || '')
    if (mac) deniedMacs.push(mac)
    else deniedIps.push(normalizeIp(host.ip || ''))
  }

  await syncProxyPortBlocks(deniedMacs, deniedIps, ports)
  lastPortsKey = portsKey
  proxyAccessLastApplyAt.value = Date.now()
  proxyAccessLastError.value = ''
  return { ok: true as const, ports }
}

const debouncedApply = debounce(() => {
  applyProxyAccessControlNow()
}, 500)

export const initProxyAccessControl = () => {
  if (started) return
  started = true

  watch(
    [proxyAccessPolicyMode, sourceIPLabelList, activeConnections, agentEnabled],
    () => {
      if (!agentEnabled.value) return
      debouncedApply()
    },
    { deep: true },
  )

  window.setInterval(() => {
    if (!agentEnabled.value) return
    refreshProxyAccessKnownHosts(true)
    applyProxyAccessControlNow()
  }, 60_000)

  if (agentEnabled.value) {
    refreshProxyAccessKnownHosts(true)
    applyProxyAccessControlNow()
  }
}
