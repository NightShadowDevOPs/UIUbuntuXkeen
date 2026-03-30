import dayjs from 'dayjs'

export type ProviderHealthStatus = 'expired' | 'nearExpiry' | 'offline' | 'degraded' | 'healthy'
export type ProviderSslSource = 'subscription' | 'panel-probe' | 'panel' | 'provider' | 'none'
export type ProviderSslStatus = 'refreshing' | 'unavailable' | 'expired' | 'warning' | 'healthy'

export type ProviderHealth = {
  status: ProviderHealthStatus
  /** lower = worse */
  severity: number
  /** optional ssl info */
  sslDays: number | null
  sslDate: string | null
  /** i18n key for label */
  labelKey: string
  /** daisyui badge class */
  badgeCls: string
  /** optional tooltip */
  tip?: string
}

export type ProviderHealthOpts = {
  /** SSL "near expiry" threshold in days. Default: 14 (UI may override). */
  nearExpiryDays?: number
  /** When backend is rebuilding SSL cache, do not mark missing SSL as degraded yet. */
  sslRefreshing?: boolean
  /** Optional override for panel URL TLS expiry (for batch panel probe results). */
  panelSslNotAfter?: any
}

export type ProviderSslDiagnostics = {
  source: ProviderSslSource
  status: ProviderSslStatus
  days: number | null
  dateTime: string | null
  notAfter: dayjs.Dayjs | null
  checkedAtMs: number
  sourceUrl: string
  issuer: string
  subject: string
  san: string[]
  error: string
  hasHttpsSource: boolean
  isRefreshing: boolean
}

export const getAnyFromObj = (obj: any, candidates: string[]): any => {
  if (!obj || typeof obj !== 'object') return undefined
  const keys = Object.keys(obj)

  // exact match (case-insensitive)
  for (const c of candidates) {
    const k = keys.find((x) => x.toLowerCase() === c.toLowerCase())
    if (k) {
      const v = (obj as any)[k]
      if (v !== undefined && v !== null && `${v}`.trim() !== '') return v
    }
  }

  // contains match (case-insensitive)
  for (const c of candidates) {
    const lc = c.toLowerCase()
    const k = keys.find((x) => x.toLowerCase().includes(lc))
    if (k) {
      const v = (obj as any)[k]
      if (v !== undefined && v !== null && `${v}`.trim() !== '') return v
    }
  }

  return undefined
}

const clampWarnDays = (value?: number) => {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(365, Math.trunc(value)))
    : 14
}

const stringOrEmpty = (value: any) => String(value || '').trim()

const readSslMetaField = (sources: any[], candidates: string[]): any => {
  for (const src of sources) {
    const value = getAnyFromObj(src, candidates)
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return ''
}

const normalizeSan = (value: any): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  }
  const raw = String(value || '').trim()
  if (!raw) return []
  return raw
    .replace(/^DNS:/i, '')
    .split(/\s*,\s*|\s*;\s*|\s*\n\s*/)
    .map((item) => item.replace(/^DNS:/i, '').trim())
    .filter(Boolean)
}

export const parseDateMaybe = (v: any): dayjs.Dayjs | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ts = v > 10_000_000_000 ? v : v * 1000
    const d = dayjs(ts)
    return d.isValid() ? d : null
  }
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    if (/^[0-9]{10,13}$/.test(s)) {
      const num = Number(s)
      return parseDateMaybe(num)
    }
    const d = dayjs(s)
    return d.isValid() ? d : null
  }
  if (typeof v === 'object') {
    const inner = getAnyFromObj(v, ['expire', 'expiry', 'expiration', 'notAfter', 'not_after'])
    return parseDateMaybe(inner)
  }
  return null
}

export const getProviderSslNotAfter = (provider: any, agentProvider?: any, panelSslNotAfter?: any): dayjs.Dayjs | null => {
  const info: any = provider?.subscriptionInfo

  const raw =
    getAnyFromObj(provider, [
      'sslNotAfter',
      'sslNotafter',
      'sslNot_After',
      'sslExpire',
      'ssl_expire',
      'sslExpiration',
      'ssl_expiration',
      'certExpire',
      'cert_expire',
      'tlsExpire',
      'tls_expire',
      'certificateExpire',
      'certificate_expire',
      'certNotAfter',
      'notAfter',
      'not_after',
    ]) ||
    getAnyFromObj(info, [
      'sslNotAfter',
      'sslExpire',
      'ssl_expire',
      'sslExpiration',
      'ssl_expiration',
      'certExpire',
      'cert_expire',
      'tlsExpire',
      'tls_expire',
      'certificateExpire',
      'certificate_expire',
      'certNotAfter',
      'notAfter',
      'not_after',
    ])

  const raw2 = raw || panelSslNotAfter || agentProvider?.panelSslNotAfter || agentProvider?.sslNotAfter
  return parseDateMaybe(raw2)
}

const isHttpsUrl = (url?: string) => typeof url === 'string' && /^(https|wss):\/\//i.test(url.trim())

export const getProviderSslDiagnostics = (
  provider: any,
  agentProvider?: any,
  opts?: {
    panelProbeNotAfter?: any
    panelProbeError?: string
    panelProbeCheckedAtMs?: number
    panelProbeUrl?: string
    panelUrlOverride?: string
    nearExpiryDays?: number
    sslRefreshing?: boolean
  },
): ProviderSslDiagnostics => {
  const info: any = provider?.subscriptionInfo
  const now = dayjs()
  const nearDays = clampWarnDays(opts?.nearExpiryDays)

  const directNotAfter =
    getAnyFromObj(provider, [
      'sslNotAfter',
      'sslNotafter',
      'sslNot_After',
      'sslExpire',
      'ssl_expire',
      'sslExpiration',
      'ssl_expiration',
      'certExpire',
      'cert_expire',
      'tlsExpire',
      'tls_expire',
      'certificateExpire',
      'certificate_expire',
      'certNotAfter',
      'notAfter',
      'not_after',
    ]) ||
    getAnyFromObj(info, [
      'sslNotAfter',
      'sslExpire',
      'ssl_expire',
      'sslExpiration',
      'ssl_expiration',
      'certExpire',
      'cert_expire',
      'tlsExpire',
      'tls_expire',
      'certificateExpire',
      'certificate_expire',
      'certNotAfter',
      'notAfter',
      'not_after',
    ])

  const source: ProviderSslSource = directNotAfter
    ? 'subscription'
    : opts?.panelProbeNotAfter
      ? 'panel-probe'
      : agentProvider?.panelSslNotAfter
        ? 'panel'
        : agentProvider?.sslNotAfter
          ? 'provider'
          : 'none'

  const rawNotAfter =
    source === 'subscription'
      ? directNotAfter
      : source === 'panel-probe'
        ? opts?.panelProbeNotAfter
        : source === 'panel'
          ? agentProvider?.panelSslNotAfter
          : source === 'provider'
            ? agentProvider?.sslNotAfter
            : ''

  const notAfter = parseDateMaybe(rawNotAfter)

  const panelMeta =
    getAnyFromObj(agentProvider, ['panelSsl', 'panel_ssl', 'panelCertificate', 'panel_certificate', 'panelTls', 'panel_tls']) ||
    agentProvider ||
    {}
  const providerMeta =
    getAnyFromObj(agentProvider, ['providerSsl', 'provider_ssl', 'ssl', 'tls', 'certificate', 'cert']) ||
    agentProvider ||
    {}
  const directMeta = provider || {}
  const subscriptionMeta = info || {}

  const metaSources =
    source === 'subscription'
      ? [directMeta, subscriptionMeta]
      : source === 'panel-probe' || source === 'panel'
        ? [panelMeta, agentProvider, directMeta, subscriptionMeta]
        : source === 'provider'
          ? [providerMeta, agentProvider, directMeta, subscriptionMeta]
          : [agentProvider, directMeta, subscriptionMeta]

  const issuer = stringOrEmpty(readSslMetaField(metaSources, ['sslIssuer', 'certIssuer', 'tlsIssuer', 'issuer']))
  const subject = stringOrEmpty(readSslMetaField(metaSources, ['sslSubject', 'certSubject', 'tlsSubject', 'subject']))
  const san = normalizeSan(readSslMetaField(metaSources, ['sslSan', 'certSan', 'tlsSan', 'san', 'subjectAltName', 'subject_alt_name']))

  const sourceUrl =
    source === 'subscription'
      ? stringOrEmpty(opts?.panelUrlOverride) || stringOrEmpty(agentProvider?.panelUrl) || stringOrEmpty(agentProvider?.url)
      : source === 'panel-probe' || source === 'panel'
        ? stringOrEmpty(opts?.panelProbeUrl) || stringOrEmpty(opts?.panelUrlOverride) || stringOrEmpty(agentProvider?.panelUrl)
        : source === 'provider'
          ? stringOrEmpty(agentProvider?.url)
          : stringOrEmpty(opts?.panelProbeUrl) || stringOrEmpty(opts?.panelUrlOverride) || stringOrEmpty(agentProvider?.panelUrl) || stringOrEmpty(agentProvider?.url)

  const checkedAtMs =
    source === 'panel-probe'
      ? Number(opts?.panelProbeCheckedAtMs || 0)
      : source === 'panel'
        ? Number(agentProvider?.panelSslCheckedAtSec || agentProvider?.sslCheckedAtSec || 0) * 1000
        : source === 'provider'
          ? Number(agentProvider?.sslCheckedAtSec || 0) * 1000
          : 0

  const error = stringOrEmpty(
    source === 'panel-probe'
      ? opts?.panelProbeError
      : source === 'panel'
        ? readSslMetaField(metaSources, ['panelSslError', 'panel_ssl_error', 'sslError', 'certError', 'tlsError', 'error'])
        : source === 'provider'
          ? readSslMetaField(metaSources, ['sslError', 'certError', 'tlsError', 'error'])
          : readSslMetaField(metaSources, ['sslError', 'certError', 'tlsError', 'error']),
  )

  const hasHttpsSource = [sourceUrl, opts?.panelUrlOverride, agentProvider?.panelUrl, agentProvider?.url]
    .map((value) => stringOrEmpty(value).toLowerCase())
    .some((value) => value.startsWith('https://') || value.startsWith('wss://'))

  const isRefreshing = Boolean(opts?.sslRefreshing && hasHttpsSource && !notAfter)
  const days = notAfter ? notAfter.diff(now, 'day') : null
  const dateTime = notAfter ? notAfter.format('DD-MM-YYYY HH:mm:ss') : null

  const status: ProviderSslStatus = !notAfter
    ? isRefreshing
      ? 'refreshing'
      : 'unavailable'
    : (days ?? 0) < 0
      ? 'expired'
      : (days ?? 0) <= nearDays
        ? 'warning'
        : 'healthy'

  return {
    source,
    status,
    days,
    dateTime,
    notAfter,
    checkedAtMs,
    sourceUrl,
    issuer,
    subject,
    san,
    error,
    hasHttpsSource,
    isRefreshing,
  }
}

export const getProviderHealth = (provider: any, agentProvider?: any, opts?: ProviderHealthOpts): ProviderHealth => {
  const now = dayjs()

  const nearDays = clampWarnDays(opts?.nearExpiryDays)
  const ssl = getProviderSslNotAfter(provider, agentProvider, opts?.panelSslNotAfter)
  const sslDays = ssl ? ssl.diff(now, 'day') : null
  const sslDate = ssl ? ssl.format('DD-MM-YYYY HH:mm:ss') : null

  // freshness / availability heuristics
  const updatedAt = parseDateMaybe(provider?.updatedAt)
  const ageMin = updatedAt ? Math.max(0, now.diff(updatedAt, 'minute')) : null
  const proxiesLen = Array.isArray(provider?.proxies) ? provider.proxies.length : null

  const offline = (ageMin !== null && ageMin >= 360) || (proxiesLen !== null && proxiesLen === 0) // 6h or empty
  const httpsUrl = isHttpsUrl(agentProvider?.panelUrl) || isHttpsUrl(agentProvider?.url)
  const degraded =
    (ageMin !== null && ageMin >= 90) ||
    (httpsUrl && !ssl && !opts?.sslRefreshing) // https but no cert info

  // priority per request: expired -> nearExpiry -> offline -> degraded -> healthy
  if (sslDays !== null && sslDays < 0) {
    return {
      status: 'expired',
      severity: 1,
      sslDays,
      sslDate,
      labelKey: 'providerHealthExpired',
      badgeCls: 'badge-error',
      tip: sslDate ? `SSL: ${sslDate}` : undefined,
    }
  }

  if (sslDays !== null && sslDays <= nearDays) {
    return {
      status: 'nearExpiry',
      severity: 2,
      sslDays,
      sslDate,
      labelKey: 'providerHealthNearExpiry',
      badgeCls: 'badge-warning',
      tip: sslDate ? `SSL: ${sslDate} (${sslDays}d)` : undefined,
    }
  }

  if (offline) {
    return {
      status: 'offline',
      severity: 3,
      sslDays,
      sslDate,
      labelKey: 'providerHealthOffline',
      badgeCls: 'badge-error badge-outline',
      tip: ageMin !== null ? `updated ${ageMin}m ago` : undefined,
    }
  }

  if (degraded) {
    return {
      status: 'degraded',
      severity: 4,
      sslDays,
      sslDate,
      labelKey: 'providerHealthDegraded',
      badgeCls: 'badge-warning badge-outline',
      tip:
        httpsUrl && !ssl
          ? 'SSL: n/a'
          : ageMin !== null
            ? `updated ${ageMin}m ago`
            : undefined,
    }
  }

  return {
    status: 'healthy',
    severity: 5,
    sslDays,
    sslDate,
    labelKey: 'providerHealthHealthy',
    badgeCls: 'badge-success badge-outline',
    tip: sslDate ? `SSL: ${sslDate} (${sslDays}d)` : undefined,
  }
}
