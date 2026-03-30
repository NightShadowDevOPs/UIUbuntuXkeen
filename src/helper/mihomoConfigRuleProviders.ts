export type RuleProviderFormModel = {
  originalName: string
  name: string
  type: string
  behavior: string
  url: string
  path: string
  interval: string
  format: string
  extraBody: string
}

export type RuleProviderReferenceInfo = {
  lineNo: number
  text: string
  type: string
  target: string
}

export type RuleProviderDisableImpact = {
  rulesRemoved: number
  samples: RuleProviderReferenceInfo[]
}

export type ParsedRuleProviderEntry = {
  name: string
  type: string
  behavior: string
  url: string
  path: string
  interval: string
  format: string
  extraBody: string
  rawBlock: string
  references: RuleProviderReferenceInfo[]
}

type SectionRange = { start: number; end: number }

const SIMPLE_YAML_KEY_RE = /^[A-Za-z0-9_.@-]+$/

const normalizeText = (value: string) => String(value || '').replace(/\r\n/g, '\n')
const escapeRegExp = (value: string) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const unquoteYamlValue = (value: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const withoutComment = trimmed.replace(/\s+#.*$/, '').trim()
  if ((withoutComment.startsWith("'") && withoutComment.endsWith("'")) || (withoutComment.startsWith('"') && withoutComment.endsWith('"'))) {
    return withoutComment.slice(1, -1)
  }
  return withoutComment
}

const quoteYamlKey = (value: string) => (SIMPLE_YAML_KEY_RE.test(String(value || '').trim()) ? String(value || '').trim() : JSON.stringify(String(value || '').trim()))
const quoteYamlScalar = (value: string, mode: 'string' | 'number' = 'string') => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (mode === 'number' && /^-?\d+$/.test(trimmed)) return trimmed
  return JSON.stringify(trimmed)
}

const dedentBlock = (value: string) => {
  const normalized = normalizeText(value)
  const lines = normalized.split('\n')
  while (lines.length && !String(lines[0] || '').trim().length) lines.shift()
  while (lines.length && !String(lines[lines.length - 1] || '').trim().length) lines.pop()
  if (!lines.length) return ''
  const indents = lines
    .filter((line) => String(line || '').trim().length > 0)
    .map((line) => {
      const match = String(line || '').match(/^\s*/)
      return match ? match[0].length : 0
    })
  const minIndent = indents.length ? Math.min(...indents) : 0
  return lines.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line.trimStart())).join('\n')
}

const indentBlock = (value: string, indent: number) => {
  const normalized = dedentBlock(value)
  if (!normalized.length) return [] as string[]
  const prefix = ' '.repeat(indent)
  return normalized.split('\n').map((line) => (line.length ? `${prefix}${line}` : ''))
}

const findTopLevelSectionRange = (lines: string[], section: string): SectionRange | null => {
  const start = lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(line || ''))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (!line.trim().length || /^\s*#/.test(line)) continue
    if (!/^\s/.test(line)) {
      end = i
      break
    }
  }
  return { start, end }
}

const parseRuleLine = (line: string) => {
  const body = String(line || '').replace(/^\s{2}-\s*/, '').replace(/\s+#.*$/, '').trim()
  const parts = body.split(',').map((part) => part.trim()).filter(Boolean)
  const type = parts[0] || ''
  const provider = /^RULE-SET/i.test(type) ? (parts[1] || '') : ''
  const target = /^RULE-SET/i.test(type) ? (parts[2] || '') : type === 'MATCH' ? (parts[1] || '') : (parts[2] || parts[parts.length - 1] || '')
  return { raw: body, type, provider, target }
}

const rewriteRulesUsingProvider = (value: string, providerName: string, replacement = '') => {
  const normalized = normalizeText(value)
  const lines = normalized.length ? normalized.split('\n') : []
  const range = findTopLevelSectionRange(lines, 'rules')
  const samples: RuleProviderReferenceInfo[] = []
  let touched = 0
  if (!range) return { yaml: normalized, touched, samples }

  const nextLines: string[] = []
  for (let i = range.start + 1; i < range.end; i += 1) {
    const line = String(lines[i] || '')
    if (!/^\s{2}-\s*/.test(line)) {
      nextLines.push(line)
      continue
    }
    const parsed = parseRuleLine(line)
    if (!/^RULE-SET/i.test(parsed.type) || parsed.provider !== providerName) {
      nextLines.push(line)
      continue
    }
    touched += 1
    if (samples.length < 8) samples.push({ lineNo: i + 1, text: line.trim(), type: parsed.type, target: parsed.target })
    if (replacement) {
      const body = line.replace(/^\s{2}-\s*/, '').replace(/\s+#.*$/, '')
      const parts = body.split(',').map((part) => part.trim())
      if (parts.length >= 2) parts[1] = replacement
      nextLines.push(`  - ${parts.join(',')}`)
    }
  }

  lines.splice(range.start + 1, Math.max(0, range.end - (range.start + 1)), ...nextLines)
  let joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  joined = joined ? `${joined}\n` : ''
  return { yaml: joined, touched, samples }
}

const extractManagedFields = (blockLines: string[]) => {
  const form: RuleProviderFormModel = {
    originalName: '',
    name: '',
    type: '',
    behavior: '',
    url: '',
    path: '',
    interval: '',
    format: '',
    extraBody: '',
  }
  const extraLines: string[] = []
  const fieldMap: Record<string, keyof RuleProviderFormModel> = {
    type: 'type',
    behavior: 'behavior',
    url: 'url',
    path: 'path',
    interval: 'interval',
    format: 'format',
  }
  for (const line of blockLines.slice(1)) {
    const match = String(line || '').match(/^\s{4}([A-Za-z0-9_.@-]+):\s*(.*?)\s*$/)
    if (match && match[1] in fieldMap) {
      form[fieldMap[match[1]]] = unquoteYamlValue(match[2])
      continue
    }
    extraLines.push(line)
  }
  form.extraBody = dedentBlock(extraLines.join('\n'))
  return form
}

const parseEntriesRaw = (value: string) => {
  const normalized = normalizeText(value)
  const lines = normalized.length ? normalized.split('\n') : []
  const range = findTopLevelSectionRange(lines, 'rule-providers')
  const entries: Array<ParsedRuleProviderEntry & { blockStart: number; blockEnd: number }> = []
  if (!range) return { entries, lines, range }

  const entryRe = /^\s{2}([^#\s][^:]*|"[^"]+"|'[^']+'):\s*(?:#.*)?$/
  let i = range.start + 1
  while (i < range.end) {
    const line = String(lines[i] || '')
    const match = line.match(entryRe)
    if (!match) {
      i += 1
      continue
    }
    const name = unquoteYamlValue(match[1])
    let j = i + 1
    while (j < range.end && !entryRe.test(String(lines[j] || ''))) j += 1
    const blockLines = lines.slice(i, j)
    const form = extractManagedFields(blockLines)
    entries.push({
      name,
      type: form.type,
      behavior: form.behavior,
      url: form.url,
      path: form.path,
      interval: form.interval,
      format: form.format,
      extraBody: form.extraBody,
      rawBlock: blockLines.join('\n'),
      references: [],
      blockStart: i,
      blockEnd: j,
    })
    i = j
  }

  return { entries, lines, range }
}

const buildBlockLines = (form: RuleProviderFormModel) => {
  const lines = [`  ${quoteYamlKey(form.name)}:`]
  const appendScalar = (key: string, value: string, mode: 'string' | 'number' = 'string') => {
    const cleaned = String(value || '').trim()
    if (!cleaned.length) return
    lines.push(`    ${key}: ${quoteYamlScalar(cleaned, mode)}`)
  }
  appendScalar('type', form.type)
  appendScalar('behavior', form.behavior)
  appendScalar('url', form.url)
  appendScalar('path', form.path)
  appendScalar('interval', form.interval, 'number')
  appendScalar('format', form.format)
  const extraLines = indentBlock(form.extraBody, 4)
  if (extraLines.length) {
    if (lines.length > 1 && extraLines[0]) lines.push('')
    lines.push(...extraLines)
  }
  return lines
}

const insertSectionIfMissing = (lines: string[], blockLines: string[]) => {
  const preferredAnchors = ['rules']
  let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`).test(String(line || ''))))
  if (insertAt < 0) {
    const afterKeys = ['proxy-providers', 'proxy-groups', 'proxies']
    let anchorRange: SectionRange | null = null
    for (const key of afterKeys) {
      const range = findTopLevelSectionRange(lines, key)
      if (range) anchorRange = range
    }
    insertAt = anchorRange ? anchorRange.end : lines.length
  }
  const sectionLines = ['rule-providers:', ...blockLines]
  if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length) sectionLines.unshift('')
  lines.splice(insertAt, 0, ...sectionLines)
}

export const emptyRuleProviderForm = (): RuleProviderFormModel => ({
  originalName: '',
  name: '',
  type: 'http',
  behavior: 'classical',
  url: '',
  path: '',
  interval: '86400',
  format: 'yaml',
  extraBody: '',
})

export const ruleProviderFormFromEntry = (entry: ParsedRuleProviderEntry): RuleProviderFormModel => ({
  originalName: entry.name,
  name: entry.name,
  type: entry.type,
  behavior: entry.behavior,
  url: entry.url,
  path: entry.path,
  interval: entry.interval,
  format: entry.format,
  extraBody: entry.extraBody,
})

export const collectRuleProviderReferences = (value: string) => {
  const normalized = normalizeText(value)
  const lines = normalized.length ? normalized.split('\n') : []
  const range = findTopLevelSectionRange(lines, 'rules')
  const map: Record<string, RuleProviderReferenceInfo[]> = {}
  if (!range) return map
  for (let i = range.start + 1; i < range.end; i += 1) {
    const line = String(lines[i] || '')
    if (!/^\s{2}-\s*/.test(line)) continue
    const parsed = parseRuleLine(line)
    if (!/^RULE-SET/i.test(parsed.type) || !parsed.provider) continue
    if (!map[parsed.provider]) map[parsed.provider] = []
    map[parsed.provider].push({ lineNo: i + 1, text: line.trim(), type: parsed.type, target: parsed.target })
  }
  return map
}

export const parseRuleProvidersFromConfig = (value: string): ParsedRuleProviderEntry[] => {
  const refs = collectRuleProviderReferences(value)
  return parseEntriesRaw(value).entries.map((entry) => ({ ...entry, references: refs[entry.name] || [] }))
}

export const upsertRuleProviderInConfig = (value: string, form: RuleProviderFormModel) => {
  const normalized = normalizeText(value)
  const nextForm: RuleProviderFormModel = {
    ...form,
    name: String(form.name || '').trim(),
    originalName: String(form.originalName || '').trim(),
    type: String(form.type || '').trim(),
    behavior: String(form.behavior || '').trim(),
    url: String(form.url || '').trim(),
    path: String(form.path || '').trim(),
    interval: String(form.interval || '').trim(),
    format: String(form.format || '').trim(),
    extraBody: dedentBlock(form.extraBody || ''),
  }
  const blockLines = buildBlockLines(nextForm)
  const parsed = parseEntriesRaw(normalized)
  const lines = [...parsed.lines]

  if (!parsed.range) insertSectionIfMissing(lines, blockLines)
  else {
    const byOriginal = parsed.entries.find((entry) => entry.name === nextForm.originalName)
    const byName = parsed.entries.find((entry) => entry.name === nextForm.name)
    const existing = byOriginal || byName
    if (existing) lines.splice(existing.blockStart, existing.blockEnd - existing.blockStart, ...blockLines)
    else lines.splice(parsed.range.end, 0, ...blockLines)
  }

  let joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  joined = joined ? `${joined}\n` : ''
  if (nextForm.originalName && nextForm.originalName !== nextForm.name) {
    joined = rewriteRulesUsingProvider(joined, nextForm.originalName, nextForm.name).yaml
  }
  return joined
}

export const removeRuleProviderFromConfig = (value: string, providerName: string) => {
  const normalized = normalizeText(value)
  const parsed = parseEntriesRaw(normalized)
  const target = parsed.entries.find((entry) => entry.name === providerName)
  let joined = normalized
  if (target) {
    const lines = [...parsed.lines]
    lines.splice(target.blockStart, target.blockEnd - target.blockStart)
    if (parsed.range) {
      const remainingEntries = parseEntriesRaw(lines.join('\n')).entries
      if (!remainingEntries.length) {
        const lines2 = lines.join('\n').split('\n')
        const range2 = findTopLevelSectionRange(lines2, 'rule-providers')
        if (range2) lines2.splice(range2.start, Math.max(1, range2.end - range2.start), 'rule-providers: {}')
        joined = lines2.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
      } else {
        joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
      }
      joined = joined ? `${joined}\n` : ''
    }
  }
  const rulesRewrite = rewriteRulesUsingProvider(joined, providerName, '')
  return { yaml: rulesRewrite.yaml, rulesRemoved: rulesRewrite.touched, samples: rulesRewrite.samples }
}

export const simulateRuleProviderDisableImpact = (value: string, providerName: string): RuleProviderDisableImpact => {
  const rulesRewrite = rewriteRulesUsingProvider(value, providerName, '')
  return { rulesRemoved: rulesRewrite.touched, samples: rulesRewrite.samples }
}
