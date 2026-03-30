import dayjs from 'dayjs'

export type ProviderHealthStatus = 'expired' | 'nearExpiry' | 'offline' | 'degraded' | 'healthy'

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
  /** When router-agent is rebuilding SSL cache, do not mark missing SSL as degraded yet. */
  sslRefreshing?: boolean
}

const getAnyFromObj = (obj: any, candidates: string[]): any => {
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

export const getProviderSslNotAfter = (provider: any, agentProvider?: any): dayjs.Dayjs | null => {
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

  const raw2 = raw || agentProvider?.sslNotAfter
  return parseDateMaybe(raw2)
}

const isHttpsUrl = (url?: string) => typeof url === 'string' && url.trim().toLowerCase().startsWith('https://')

export const getProviderHealth = (provider: any, agentProvider?: any, opts?: ProviderHealthOpts): ProviderHealth => {
  const now = dayjs()

  const nearDays = typeof opts?.nearExpiryDays === 'number' && Number.isFinite(opts.nearExpiryDays)
    ? Math.max(0, Math.min(365, Math.trunc(opts.nearExpiryDays)))
    : 14

  const ssl = getProviderSslNotAfter(provider, agentProvider)
  const sslDays = ssl ? ssl.diff(now, 'day') : null
  const sslDate = ssl ? ssl.format('DD-MM-YYYY HH:mm:ss') : null

  // freshness / availability heuristics
  const updatedAt = parseDateMaybe(provider?.updatedAt)
  const ageMin = updatedAt ? Math.max(0, now.diff(updatedAt, 'minute')) : null
  const proxiesLen = Array.isArray(provider?.proxies) ? provider.proxies.length : null

  const offline = (ageMin !== null && ageMin >= 360) || (proxiesLen !== null && proxiesLen === 0) // 6h or empty
  const degraded =
    (ageMin !== null && ageMin >= 90) ||
    (isHttpsUrl(agentProvider?.url) && !ssl && !opts?.sslRefreshing) // https but no cert info

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
        isHttpsUrl(agentProvider?.url) && !ssl
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
