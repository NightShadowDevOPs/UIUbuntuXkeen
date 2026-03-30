export const normalizeProviderIcon = (v: any): string => {
  const s = String(v || '').trim()
  if (!s) return ''
  const low = s.toLowerCase()
  if (low === 'globe' || s === '🌍' || s === '🌎' || s === '🌏' || s === '🌐') return 'globe'
  // Backward compatibility: stored emoji flag (e.g. "🇩🇪")
  const fromEmoji = flagEmojiToCountryCode(s)
  if (fromEmoji) return fromEmoji
  // ISO 3166-1 alpha-2
  if (/^[a-zA-Z]{2}$/.test(s)) return s.toUpperCase()
  return ''
}

/**
 * Convert a flag emoji (pair of Regional Indicator Symbols) to ISO 3166-1 alpha-2.
 * Examples: "🇩🇪" -> "DE", "🇯🇵" -> "JP".
 */
export const flagEmojiToCountryCode = (emoji: string): string => {
  const chars = Array.from(String(emoji || '').trim())
  if (chars.length < 2) return ''

  const isRegional = (cp: number) => cp >= 0x1f1e6 && cp <= 0x1f1ff
  const cps = chars
    .map((c) => c.codePointAt(0))
    .filter((cp): cp is number => typeof cp === 'number')

  for (let i = 0; i < cps.length - 1; i++) {
    const a = cps[i]
    const b = cps[i + 1]
    if (!isRegional(a) || !isRegional(b)) continue
    const A = 0x1f1e6
    const c1 = String.fromCharCode(65 + (a - A))
    const c2 = String.fromCharCode(65 + (b - A))
    const cc = `${c1}${c2}`
    if (/^[A-Z]{2}$/.test(cc)) return cc
  }
  return ''
}

export const countryCodeToFlagEmoji = (code: string): string => {
  const cc = String(code || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ''
  const A = 0x1f1e6
  const cp1 = A + (cc.charCodeAt(0) - 65)
  const cp2 = A + (cc.charCodeAt(1) - 65)
  try {
    // eslint-disable-next-line no-undef
    return String.fromCodePoint(cp1, cp2)
  } catch {
    return ''
  }
}

export const providerIconLabel = (icon: string): { kind: 'none' | 'globe' | 'flag'; text: string } => {
  const n = normalizeProviderIcon(icon)
  if (!n) return { kind: 'none', text: '' }
  if (n === 'globe') return { kind: 'globe', text: 'globe' }
  const flag = countryCodeToFlagEmoji(n)
  return { kind: flag ? 'flag' : 'none', text: flag || '' }
}
