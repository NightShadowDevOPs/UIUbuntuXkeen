export const normalizeProxyProtoKey = (type?: string | null): string => {
  const raw = String(type || '').trim().toLowerCase()
  if (!raw) return ''

  // Normalize separators: spaces, underscores, dashes, dots, slashes
  const compact = raw.replace(/[\s_\-./\\]/g, '')
  let t = compact

  // aliases / families
  if (raw === 'trojan-go' || t === 'trojango') t = 'trojan'
  if (t === 'shadowsocks' || t.startsWith('shadowsocks')) t = 'ss'
  if (t === 'hysteria' || t.startsWith('hysteria')) t = 'hy'

  // common protocol synonyms
  if (t === 'wireguard') t = 'wg'

  return t
}

export const getProxyProtoLabel = (type?: string | null): string => {
  const t = normalizeProxyProtoKey(type)
  if (!t) return ''

  if (t === 'wg') return 'WG'
  if (t === 'ss') return 'SS'
  if (t === 'hy') return 'HY'

  return t.toUpperCase()
}

// Backward-compatible alias used by some components
export const protoLabel = getProxyProtoLabel
