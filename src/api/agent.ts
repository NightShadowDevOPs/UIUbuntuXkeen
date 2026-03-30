import axios from 'axios'
import { agentToken, agentUrl } from '@/store/agent'

// Normalized agent base URL for plain fetch() calls.
// (Vite does not typecheck by default; keeping this local avoids runtime ReferenceError.)
const getAgentBaseUrl = () => {
  const u = String(agentUrl.value || '').trim()
  if (!u) return ''
  return u.replace(/\/+$/g, '')
}

/**
 * Some router setups return CGI-style headers inside the response body,
 * e.g. "Content-Type: application/json\n...\n\n{...}".
 * Axios will then keep it as a string and JSON parsing downstream breaks.
 */
const parseMaybeCgiJson = (data: any) => {
  if (typeof data !== 'string') return data
  // Fast path: valid JSON.
  try {
    return JSON.parse(data)
  } catch {
    /* noop */
  }
  // Fallback: strip everything before the first '{'.
  const i = data.indexOf('{')
  if (i < 0) return data
  const j = data.lastIndexOf('}')
  const jsonStr = j >= i ? data.slice(i, j + 1) : data.slice(i)
  try {
    return JSON.parse(jsonStr)
  } catch {
    /* noop */
  }
  // Some router CGI scripts accidentally return pseudo-JSON with escaped quotes,
  // e.g. {"ok":true}. Best-effort normalize it for the UI.
  try {
    const normalized = jsonStr.replace(/\"/g, '"')
    return JSON.parse(normalized)
  } catch {
    return data
  }
}

type AgentStatus = {
  ok: boolean
  version?: string
  serverVersion?: string
  wan?: string
  lan?: string
  tc?: boolean
  iptables?: boolean
  hashlimit?: boolean
  hostQos?: boolean
  // optional system metrics (agent >= 0.4)
  cpuPct?: number
  load1?: string
  load5?: string
  load15?: string
  uptimeSec?: number
  memTotal?: number
  memUsed?: number
  memFree?: number
  memUsedPct?: number
  storagePath?: string
  storageTotal?: number
  storageUsed?: number
  storageFree?: number
  tempC?: string
  hostname?: string
  model?: string
  firmware?: string
  kernel?: string
  arch?: string
  xkeenVersion?: string
  mihomoBinVersion?: string
  error?: string
}

export type AgentFirmwareCheck = {
  ok: boolean
  currentVersion?: string
  latestVersion?: string
  mainLatestVersion?: string
  previewLatestVersion?: string
  devLatestVersion?: string
  updateAvailable?: boolean
  checkedAt?: string
  sourceUrl?: string
  channel?: string
  cached?: boolean
  stale?: boolean
  error?: string
}

export type AgentTrafficLiveIface = {
  name: string
  kind?: string
  rxBytes?: number
  txBytes?: number
}

export type AgentTrafficLive = {
  ok: boolean
  iface?: string
  rxBytes?: number
  txBytes?: number
  ts?: number
  extraIfaces?: AgentTrafficLiveIface[]
  error?: string
}

const agentAxios = () => {
  const instance = axios.create({
    baseURL: agentUrl.value || '',
    timeout: 4000,
    transformResponse: [
      (data) => {
        // Keep default behaviour for already-parsed objects.
        return parseMaybeCgiJson(data)
      },
    ],
  })

  instance.interceptors.request.use((cfg) => {
    const token = (agentToken.value || '').trim()
    if (token) {
      cfg.headers = cfg.headers || {}
      ;(cfg.headers as any).Authorization = `Bearer ${token}`
    }
    return cfg
  })

  return instance
}

export const agentStatusAPI = async (): Promise<AgentStatus> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'status' },
      // NOTE: this axios instance does not use the global interceptors.
      // Adding custom headers (like X-Zash-Silent) triggers CORS preflight
      // from browsers, so keep requests headerless unless a token is set.
    })
    return (data || {}) as AgentStatus
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentFirmwareCheckAPI = async (force = false): Promise<AgentFirmwareCheck> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'firmware_check', force: force ? '1' : '0' },
      timeout: 8000,
    })
    return (data || { ok: false }) as AgentFirmwareCheck
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentTrafficLiveAPI = async (): Promise<AgentTrafficLive> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'traffic_live' },
      timeout: 4000,
    })
    return (data || { ok: false }) as AgentTrafficLive
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentSetShapeAPI = async (args: {
  ip: string
  upMbps: number
  downMbps: number
}): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: {
        cmd: 'shape',
        ip: args.ip,
        up: args.upMbps,
        down: args.downMbps,
      },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentRemoveShapeAPI = async (ip: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'unshape', ip },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export type AgentNeighbor = { ip: string; mac: string; state?: string }

export const agentNeighborsAPI = async (): Promise<{ ok: boolean; items?: AgentNeighbor[]; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'neighbors' },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


export type AgentLanHost = { ip: string; mac?: string; hostname?: string; source?: string }

export type AgentHostTrafficLiveItem = {
  ip: string
  mac?: string
  hostname?: string
  source?: string
  bypassDownBps?: number
  bypassUpBps?: number
  vpnDownBps?: number
  vpnUpBps?: number
  totalDownBps?: number
  totalUpBps?: number
}

export type AgentHostTrafficLive = {
  ok: boolean
  ts?: number
  dtMs?: number
  trackedHosts?: number
  items?: AgentHostTrafficLiveItem[]
  error?: string
}

export type AgentHostRemoteTargetItem = {
  target: string
  scope?: 'mihomo' | 'vpn' | 'bypass'
  kind?: string
  via?: string
  proto?: string
  connections?: number
  downBps?: number
  upBps?: number
}

export type AgentHostRemoteTargets = {
  ok: boolean
  ip?: string
  ts?: number
  dtMs?: number
  trackedTargets?: number
  items?: AgentHostRemoteTargetItem[]
  error?: string
}

export const agentLanHostsAPI = async (): Promise<{ ok: boolean; items?: AgentLanHost[]; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'lan_hosts' },
      timeout: 15000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentHostTrafficLiveAPI = async (): Promise<AgentHostTrafficLive> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'host_traffic_live' },
      timeout: 8000,
    })
    return (data || { ok: false }) as AgentHostTrafficLive
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentHostRemoteTargetsAPI = async (ip: string): Promise<AgentHostRemoteTargets> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'host_remote_targets', ip },
      timeout: 8000,
    })
    return (data || { ok: false }) as AgentHostRemoteTargets
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


export type AgentQosProfile = 'critical' | 'high' | 'elevated' | 'normal' | 'low' | 'background'

export type AgentQosStatusItem = {
  ip: string
  profile: AgentQosProfile
  priority?: number
  upMinMbit?: number
  downMinMbit?: number
}

export type AgentQosStatus = {
  ok: boolean
  supported?: boolean
  wanRateMbit?: number
  lanRateMbit?: number
  qosMode?: string
  qosDownlinkEnabled?: boolean
  defaults?: Partial<Record<AgentQosProfile, { pct?: number; priority?: number }>>
  items?: AgentQosStatusItem[]
  error?: string
}

export const agentIpToMacAPI = async (ip: string): Promise<{ ok: boolean; mac?: string; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'ip2mac', ip },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


export const agentQosStatusAPI = async (): Promise<AgentQosStatus> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'qos_status' },
      timeout: 5000,
    })
    return (data || { ok: false }) as AgentQosStatus
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentSetHostQosAPI = async (args: {
  ip: string
  profile: AgentQosProfile
}): Promise<{ ok: boolean; error?: string; priority?: number; upMinMbit?: number; downMinMbit?: number }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'qos_set', ip: args.ip, profile: args.profile },
      timeout: 6000,
    })
    return (data || { ok: false }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentRemoveHostQosAPI = async (ip: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'qos_remove', ip },
      timeout: 6000,
    })
    return (data || { ok: false }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentBlockMacAPI = async (args: {
  mac: string
  /**
   * 'all' = drop all traffic from the MAC.
   * number[] = legacy mode (block only selected ports).
   */
  ports: number[] | 'all'
}): Promise<{ ok: boolean; error?: string }> => {
  try {
    const portsParam = args.ports === 'all' ? 'all' : args.ports.join(',')
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'blockmac', mac: args.mac, ports: portsParam },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentBlockIpAPI = async (ip: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'blockip', ip },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentUnblockIpAPI = async (ip: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'unblockip', ip },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentLogsAPI = async (args: {
  type: 'mihomo' | 'agent' | 'config'
  lines?: number
}): Promise<{ ok: boolean; kind?: string; path?: string; contentB64?: string; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'logs', type: args.type, lines: args.lines ?? 200 },
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

export const agentLogsFollowAPI = async (args: {
  type: 'mihomo' | 'agent'
  lines?: number
  offset?: number
}): Promise<{
  ok: boolean
  kind?: string
  path?: string
  contentB64?: string
  offset?: number
  mode?: 'full' | 'delta'
  truncated?: boolean
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'logs_follow', type: args.type, lines: args.lines ?? 200, offset: args.offset ?? 0 },
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


export const agentGeoInfoAPI = async (): Promise<{
  ok: boolean
  items?: Array<{
    kind?: string
    path?: string
    exists?: boolean
    mtimeSec?: number | string
    sizeBytes?: number | string
  }>
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'geo_info' },
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


export const agentGeoUpdateAPI = async (): Promise<{
  ok: boolean
  items?: Array<{
    kind?: string
    path?: string
    changed?: boolean
    mtimeSec?: number | string
    sizeBytes?: number | string
    method?: string
    source?: string
    error?: string
  }>
  note?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'geo_update' },
      timeout: 30000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


export const agentRulesInfoAPI = async (): Promise<{
  ok: boolean
  dir?: string
  count?: number
  newestMtimeSec?: number | string
  oldestMtimeSec?: number | string
  items?: Array<{
    name?: string
    path?: string
    mtimeSec?: number | string
    sizeBytes?: number | string
  }>
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'rules_info' },
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


export const agentUnblockMacAPI = async (mac: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'unblockmac', mac },
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}


let _mihomoProvidersCache: { ok: boolean; providers?: any[]; error?: string } | null = null
let _mihomoProvidersAt = 0

export const agentMihomoConfigAPI = async (): Promise<{
  ok: boolean
  contentB64?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'mihomo_config' },
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export type MihomoConfigManagedState = {
  ok: boolean
  active?: {
    path?: string
    rev?: number
    updatedAt?: string
    exists?: boolean
    sizeBytes?: number
  }
  draft?: {
    path?: string
    rev?: number
    updatedAt?: string
    exists?: boolean
    sizeBytes?: number
  }
  baseline?: {
    path?: string
    updatedAt?: string
    exists?: boolean
    sizeBytes?: number
  }
  lastApplyStatus?: string
  lastApplyAt?: string
  lastApplySource?: string
  lastError?: string
  lastSuccessful?: {
    rev?: number
    updatedAt?: string
    source?: string
    exists?: boolean
    current?: boolean
  }
  validator?: {
    available?: boolean
    bin?: string
  }
  restart?: {
    available?: boolean
    mode?: string
  }
  error?: string
}

export const agentMihomoConfigStateAPI = async (): Promise<MihomoConfigManagedState> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'mihomo_cfg_state' },
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedGetAPI = async (kind: 'active' | 'draft' | 'baseline'): Promise<{
  ok: boolean
  kind?: string
  path?: string
  rev?: number
  updatedAt?: string
  contentB64?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'mihomo_cfg_get', kind },
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedPutDraftAPI = async (content: string): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_put&kind=draft', content ?? '', {
      headers: {
        'Content-Type': 'text/plain',
      },
      timeout: 20000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedCopyAPI = async (from: 'active' | 'baseline'): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=mihomo_cfg_copy&from=${encodeURIComponent(from)}&to=draft`, null, {
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedValidateAPI = async (kind: 'active' | 'draft' | 'baseline'): Promise<{
  ok: boolean
  phase?: string
  kind?: string
  source?: string
  cmd?: string
  exitCode?: number
  output?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'mihomo_cfg_validate', kind },
      timeout: 25000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedApplyAPI = async (): Promise<{
  ok: boolean
  phase?: string
  rev?: number
  updatedAt?: string
  source?: string
  appliedFrom?: string
  restored?: string
  recovery?: string
  restartMethod?: string
  restartOutput?: string
  firstRestartMethod?: string
  firstRestartOutput?: string
  rollbackRestartMethod?: string
  rollbackRestartOutput?: string
  baselineRestartMethod?: string
  baselineRestartOutput?: string
  validateCmd?: string
  error?: string
  output?: string
}> => {
  try {
    const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_apply', null, {
      timeout: 30000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedSetBaselineFromActiveAPI = async (): Promise<{
  ok: boolean
  updatedAt?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_set_baseline_from_active', null, {
      timeout: 20000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedRestoreBaselineAPI = async (): Promise<{
  ok: boolean
  phase?: string
  rev?: number
  updatedAt?: string
  source?: string
  restored?: string
  recovery?: string
  restartMethod?: string
  restartOutput?: string
  firstRestartMethod?: string
  firstRestartOutput?: string
  rollbackRestartMethod?: string
  rollbackRestartOutput?: string
  baselineRestartMethod?: string
  baselineRestartOutput?: string
  validateCmd?: string
  error?: string
  output?: string
}> => {
  try {
    const { data } = await agentAxios().post('/cgi-bin/api.sh?cmd=mihomo_cfg_restore_baseline', null, {
      timeout: 30000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export type MihomoConfigHistoryItem = {
  rev: number
  updatedAt?: string
  current?: boolean
  source?: string
}

export const agentMihomoConfigManagedHistoryAPI = async (): Promise<{
  ok: boolean
  items?: MihomoConfigHistoryItem[]
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'mihomo_cfg_history' },
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedGetRevAPI = async (rev: number): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  source?: string
  contentB64?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'mihomo_cfg_get_rev', rev: String(rev ?? 0) },
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoConfigManagedRestoreRevAPI = async (rev: number): Promise<{
  ok: boolean
  phase?: string
  rev?: number
  updatedAt?: string
  source?: string
  restored?: string
  recovery?: string
  restartMethod?: string
  restartOutput?: string
  firstRestartMethod?: string
  firstRestartOutput?: string
  rollbackRestartMethod?: string
  rollbackRestartOutput?: string
  baselineRestartMethod?: string
  baselineRestartOutput?: string
  validateCmd?: string
  error?: string
  output?: string
}> => {
  try {
    const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=mihomo_cfg_restore_rev&rev=${encodeURIComponent(String(rev ?? 0))}`, null, {
      timeout: 30000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentMihomoProvidersAPI = async (force = false): Promise<{
  ok: boolean
  checkedAtSec?: number
  sslCacheReady?: boolean
  sslCacheFresh?: boolean
  sslRefreshing?: boolean
  sslRefreshPending?: boolean
  sslCacheAgeSec?: number
  sslCacheNextRefreshAtSec?: number
  providers?: Array<{
    name: string
    url?: string
    host?: string
    port?: string
    sslNotAfter?: string
    panelUrl?: string
    panelSslNotAfter?: string
  }>
  error?: string
}> => {
  const now = Date.now()
  if (!force && _mihomoProvidersCache && now - _mihomoProvidersAt < 60_000) return _mihomoProvidersCache as any

  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'mihomo_providers', force: force ? '1' : '0' },
      timeout: 15000,
    })
    _mihomoProvidersCache = (data || {}) as any
    _mihomoProvidersAt = now
    return _mihomoProvidersCache as any
  } catch (e: any) {
    // Keep the last good provider list to avoid false "agent unavailable"
    // badges when one probe or router response is temporarily slow.
    if (_mihomoProvidersCache?.ok) return _mihomoProvidersCache as any
    const res = { ok: false, error: e?.message || 'offline' }
    _mihomoProvidersAt = now
    return res as any
  }
}



export const agentProviderSslCacheRefreshAPI = async (): Promise<{
  ok: boolean
  checkedAtSec?: number
  ready?: boolean
  fresh?: boolean
  refreshing?: boolean
  cacheAgeSec?: number
  nextRefreshAtSec?: number
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'ssl_cache_refresh' },
      timeout: 10000,
    })
    return (data || { ok: false }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'failed' }
  }
}

// Batch probe TLS certificate expiry (notAfter) for a list of HTTPS/WSS URLs.
// Input format (text/plain): each line "<name>\t<url>".
// Returns: { ok, checkedAtSec, items: [{ name, url, sslNotAfter, error }] }
export const agentSslProbeBatchAPI = async (lines: string): Promise<any> => {
  const base = getAgentBaseUrl()
  if (!base) return { ok: false, error: 'agent-disabled' }

  const url = `${base}/cgi-bin/api.sh?cmd=ssl_probe_batch`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: lines || '',
  })
  return await res.json()
}

// --- Shared users DB (Source IP mapping) ---

export const agentUsersDbGetAPI = async (): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  contentB64?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'users_db_get' },
      // Router can be slow on flash IO; keep sync stable.
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentUsersDbPutAPI = async (args: { rev: number; content: string }): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  error?: string
  contentB64?: string
}> => {
  try {
    const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=users_db_put&rev=${encodeURIComponent(String(args.rev ?? 0))}`,
      args.content,
      {
        headers: {
          'Content-Type': 'text/plain',
        },
        // Allow slower writes on embedded storage.
        timeout: 20000,
      },
    )
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' } as any
  }
}


// --- Shared provider traffic store (provider Today / Since reset counters) ---

export const agentProviderTrafficGetAPI = async (): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  contentB64?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'provider_traffic_get' },
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentProviderTrafficPutAPI = async (args: { rev: number; content: string }): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  error?: string
  contentB64?: string
}> => {
  try {
    const { data } = await agentAxios().post(`/cgi-bin/api.sh?cmd=provider_traffic_put&rev=${encodeURIComponent(String(args.rev ?? 0))}`,
      args.content,
      {
        headers: {
          'Content-Type': 'text/plain',
        },
        timeout: 20000,
      },
    )
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' } as any
  }
}


// --- Shared users DB history / restore ---

export type UsersDbHistoryItem = {
  rev: number
  updatedAt?: string
  current?: boolean
}

export const agentUsersDbHistoryAPI = async (): Promise<{
  ok: boolean
  items?: UsersDbHistoryItem[]
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'users_db_history' },
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentUsersDbGetRevAPI = async (rev: number): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  contentB64?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'users_db_get_rev', rev: String(rev ?? 0) },
      timeout: 15000,
    })
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentUsersDbRestoreAPI = async (rev: number): Promise<{
  ok: boolean
  rev?: number
  updatedAt?: string
  restoredFromRev?: number
  error?: string
}> => {
  try {
    const { data } = await agentAxios().post(
      `/cgi-bin/api.sh?cmd=users_db_restore&rev=${encodeURIComponent(String(rev ?? 0))}`,
      '',
      {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 20000,
      },
    )
    return (data || {}) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' } as any
  }
}


export type AgentBackupStatus = {
  ok: boolean
  running?: boolean
  startedAt?: string
  finishedAt?: string
  success?: boolean
  file?: string
  uploaded?: boolean
  uploadOkCount?: number
  uploadFailCount?: number
  uploadResults?: Array<{ remote?: string; ok?: boolean; error?: string }>
  requestedRemotes?: string
  error?: string
}

export const agentBackupStatusAPI = async (): Promise<AgentBackupStatus> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_status' },
      timeout: 8000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export type AgentBackupCloudStatus = {
  ok: boolean
  rcloneInstalled?: boolean
  configPath?: string
  remote?: string
  remoteExists?: boolean
  remotes?: Array<{ name?: string; exists?: boolean }>
  path?: string
  cloudReady?: boolean
  keepDays?: string
  localKeepDays?: string
  uiZipEnabled?: boolean
  error?: string
}

export const agentBackupCloudStatusAPI = async (): Promise<AgentBackupCloudStatus> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_cloud_status' },
      timeout: 8000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentBackupStartAPI = async (remotes?: string | string[]): Promise<{ ok: boolean; running?: boolean; requestedRemotes?: string; error?: string }> => {
  try {
    const selected = Array.isArray(remotes) ? remotes.map((it) => String(it || '').trim()).filter(Boolean).join(',') : String(remotes || '').trim()
    const params: Record<string, string> = { cmd: 'backup_start' }
    if (selected) params.remotes = selected
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params,
      timeout: 8000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentBackupLogAPI = async (lines: number = 200): Promise<{ ok: boolean; path?: string; contentB64?: string; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_log', lines: String(lines ?? 200) },
      timeout: 8000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}


export type AgentBackupListItem = { name: string; size?: number; mtime?: number }


export type AgentBackupCloudListItem = {
  Name?: string
  Path?: string
  Size?: number
  ModTime?: string
  Remote?: string
  RemotePath?: string
}

export const agentBackupCloudListAPI = async (): Promise<{
  ok: boolean
  remote?: string
  path?: string
  dir?: string
  items?: AgentBackupCloudListItem[]
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_cloud_list' },
      timeout: 12000,
    })
    return (data || { ok: true, items: [] }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentBackupListAPI = async (): Promise<{ ok: boolean; dir?: string; items?: AgentBackupListItem[]; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_list' },
      timeout: 8000,
    })
    return (data || { ok: true, items: [] }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentBackupDeleteAPI = async (file: string): Promise<{ ok: boolean; deleted?: boolean; name?: string; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_delete', file },
      timeout: 15000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentBackupCloudDeleteAPI = async (file: string, remote: string = ''): Promise<{ ok: boolean; deleted?: boolean; name?: string; remote?: string; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_cloud_delete', file, remote: remote || undefined },
      timeout: 12000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentBackupCloudDownloadAPI = async (file: string, remote: string = ''): Promise<{
  ok: boolean
  downloaded?: boolean
  existed?: boolean
  name?: string
  path?: string
  size?: number
  mtime?: number
  remote?: string
  error?: string
}> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_cloud_download', file, remote: remote || undefined },
      timeout: 60000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export type AgentRestoreStatus = {
  ok: boolean
  running?: boolean
  startedAt?: string
  finishedAt?: string
  success?: boolean
  file?: string
  scope?: string
  includeEnv?: boolean
  source?: string
  stage?: string
  progressPct?: number
  bytesDone?: number
  bytesTotal?: number
  detail?: string
  error?: string
}

export const agentRestoreStatusAPI = async (): Promise<AgentRestoreStatus> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'restore_status' },
      timeout: 8000,
    })
    return (data || { ok: true, running: false }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentRestoreStartAPI = async (
  file: string,
  scope: string,
  includeEnv: boolean,
  source: 'local' | 'cloud' = 'local',
  remote: string = '',
): Promise<{ ok: boolean; running?: boolean; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: {
        cmd: 'restore_start',
        file: file || 'latest',
        scope: scope || 'all',
        env: includeEnv ? '1' : '0',
        source: source || 'local',
        remote: source === 'cloud' && remote ? remote : undefined,
      },
      timeout: 12000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentRestoreLogAPI = async (lines: number = 200): Promise<{ ok: boolean; path?: string; contentB64?: string; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'restore_log', lines: String(lines ?? 200) },
      timeout: 8000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export type AgentBackupCronStatus = {
  ok: boolean
  enabled?: boolean
  schedule?: string
  line?: string
  path?: string
  error?: string
}

export const agentBackupCronGetAPI = async (): Promise<AgentBackupCronStatus> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_cron_get' },
      timeout: 8000,
    })
    return (data || { ok: true, enabled: false }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}

export const agentBackupCronSetAPI = async (enabled: boolean, schedule: string): Promise<{ ok: boolean; enabled?: boolean; schedule?: string; path?: string; error?: string }> => {
  try {
    const { data } = await agentAxios().get('/cgi-bin/api.sh', {
      params: { cmd: 'backup_cron_set', enabled: enabled ? '1' : '0', schedule },
      timeout: 15000,
    })
    return (data || { ok: true }) as any
  } catch (e: any) {
    return { ok: false, error: e?.message || 'offline' }
  }
}
