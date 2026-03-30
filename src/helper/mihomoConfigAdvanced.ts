export type AdvancedSectionsFormModel = {
  tunEnable: string
  tunStack: string
  tunAutoRoute: string
  tunAutoDetectInterface: string
  tunDnsHijackText: string
  tunDevice: string
  tunMtu: string
  tunStrictRoute: string
  tunRouteIncludeAddressText: string
  tunRouteExcludeAddressText: string
  tunIncludeInterfaceText: string
  tunExcludeInterfaceText: string
  profileStoreSelected: string
  profileStoreFakeIp: string
  snifferEnable: string
  snifferForceDomainText: string
  snifferSkipDomainText: string
  snifferParsePureIp: string
  snifferOverrideDestination: string
  snifferSniffText: string
}

type SectionRange = { start: number; end: number }

const SIMPLE_YAML_KEY_RE = /^[A-Za-z0-9_.@-]+$/

const normalizeText = (value: string) => String(value || '').replace(/\r\n/g, '\n')
const escapeRegExp = (value: string) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const countIndent = (line: string) => {
  const match = String(line || '').match(/^\s*/)
  return match ? match[0].length : 0
}

const unquoteYamlValue = (value: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  const withoutComment = trimmed.replace(/\s+#.*$/, '').trim()
  if ((withoutComment.startsWith("'") && withoutComment.endsWith("'")) || (withoutComment.startsWith('"') && withoutComment.endsWith('"'))) {
    return withoutComment.slice(1, -1)
  }
  return withoutComment
}

const quoteYamlKey = (value: string) => {
  const trimmed = String(value || '').trim()
  return SIMPLE_YAML_KEY_RE.test(trimmed) ? trimmed : JSON.stringify(trimmed)
}

const quoteYamlScalar = (value: string, mode: 'string' | 'auto' = 'string') => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (mode === 'auto' && /^(?:true|false|null|-?\d+(?:\.\d+)?)$/i.test(trimmed)) return trimmed
  return JSON.stringify(trimmed)
}

const splitMultilineItems = (value: string) => normalizeText(value)
  .split('\n')
  .map((item) => item.trim())
  .filter(Boolean)

const joinMultilineItems = (items: string[]) => items.map((item) => String(item || '').trim()).filter(Boolean).join('\n')

const parseInlineList = (raw: string) => String(raw || '')
  .split(',')
  .map((item) => unquoteYamlValue(item))
  .map((item) => item.trim())
  .filter(Boolean)

const splitYamlMappingLine = (line: string) => {
  const body = String(line || '').trim()
  if (!body.length) return null
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== ':') continue
    const next = body[i + 1] || ''
    if (next && !/\s/.test(next)) continue
    const key = body.slice(0, i).trim()
    const value = body.slice(i + 1).trim()
    if (!key.length) return null
    return { key, value }
  }
  return null
}

const findTopLevelSectionRange = (lines: string[], section: string): SectionRange | null => {
  const start = lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(String(line || '')))
  if (start < 0) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (!line.trim().length || /^\s*#/.test(line)) continue
    if (countIndent(line) === 0) {
      end = i
      break
    }
  }
  return { start, end }
}

const findChildBlockRange = (lines: string[], parentRange: SectionRange, key: string, childIndent: number): SectionRange | null => {
  const childRe = new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*(?:#.*)?(?:.*)?$`)
  const siblingIndentMax = childIndent
  const start = lines.findIndex((line, index) => index > parentRange.start && index < parentRange.end && childRe.test(String(line || '')))
  if (start < 0) return null
  let end = parentRange.end
  for (let i = start + 1; i < parentRange.end; i += 1) {
    const line = String(lines[i] || '')
    if (!line.trim().length || /^\s*#/.test(line)) continue
    if (countIndent(line) <= siblingIndentMax) {
      end = i
      break
    }
  }
  return { start, end }
}

const ensureTopLevelSection = (lines: string[], section: string) => {
  let range = findTopLevelSectionRange(lines, section)
  if (range) return range
  const preferredAnchors = ['dns', 'hosts', 'proxies', 'proxy-groups', 'proxy-providers', 'rule-providers', 'rules']
  let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*.*$`).test(String(line || ''))))
  if (insertAt < 0) insertAt = lines.length
  const block = [`${section}:`]
  if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length) block.unshift('')
  lines.splice(insertAt, 0, ...block)
  range = findTopLevelSectionRange(lines, section)
  return range || { start: insertAt + (block.length > 1 ? 1 : 0), end: lines.length }
}

const upsertChildBlock = (lines: string[], parentSection: string, key: string, childIndent: number, blockLines: string[]) => {
  if (!blockLines.length) {
    const parentRange = findTopLevelSectionRange(lines, parentSection)
    if (!parentRange) return
    const existing = findChildBlockRange(lines, parentRange, key, childIndent)
    if (!existing) return
    lines.splice(existing.start, existing.end - existing.start)
    return
  }
  const parentRange = ensureTopLevelSection(lines, parentSection)
  const existing = findChildBlockRange(lines, parentRange, key, childIndent)
  if (existing) lines.splice(existing.start, existing.end - existing.start, ...blockLines)
  else lines.splice(parentRange.end, 0, ...blockLines)
}

const removeSectionIfEmpty = (lines: string[], section: string) => {
  const range = findTopLevelSectionRange(lines, section)
  if (!range) return
  const meaningful = lines.slice(range.start + 1, range.end).some((line) => {
    const trimmed = String(line || '').trim()
    return trimmed.length > 0 && !trimmed.startsWith('#')
  })
  if (meaningful) return
  let removeFrom = range.start
  if (removeFrom > 0 && !String(lines[removeFrom - 1] || '').trim().length) removeFrom -= 1
  lines.splice(removeFrom, range.end - removeFrom)
}

const extractListField = (lines: string[], parentRange: SectionRange | null, key: string, childIndent: number) => {
  if (!parentRange) return [] as string[]
  const block = findChildBlockRange(lines, parentRange, key, childIndent)
  if (!block) return [] as string[]
  const firstLine = String(lines[block.start] || '')
  const inlineMatch = firstLine.match(new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*\\[(.*)\\]\\s*(?:#.*)?$`))
  if (inlineMatch) return parseInlineList(inlineMatch[1])
  const scalarMatch = firstLine.match(new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*(.*?)\\s*(?:#.*)?$`))
  if (scalarMatch && scalarMatch[1] && !/^\s*$/.test(scalarMatch[1])) return [unquoteYamlValue(scalarMatch[1])]

  const items: string[] = []
  for (let i = block.start + 1; i < block.end; i += 1) {
    const line = String(lines[i] || '')
    if (!line.trim().length || /^\s*#/.test(line)) continue
    const match = line.match(new RegExp(`^\\s{${childIndent + 2}}-\\s*(.*?)\\s*$`))
    if (!match) continue
    items.push(unquoteYamlValue(match[1]))
  }
  return items
}

const buildListBlock = (key: string, childIndent: number, itemsText: string) => {
  const items = splitMultilineItems(itemsText)
  if (!items.length) return [] as string[]
  return [`${' '.repeat(childIndent)}${key}:`, ...items.map((item) => `${' '.repeat(childIndent + 2)}- ${quoteYamlScalar(item)}`)]
}

const extractScalarField = (lines: string[], parentRange: SectionRange | null, key: string, childIndent: number) => {
  if (!parentRange) return ''
  const block = findChildBlockRange(lines, parentRange, key, childIndent)
  if (!block) return ''
  const firstLine = String(lines[block.start] || '')
  const match = firstLine.match(new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*(.*?)\\s*(?:#.*)?$`))
  return match ? unquoteYamlValue(match[1]) : ''
}

const buildScalarBlock = (key: string, childIndent: number, value: string, mode: 'string' | 'auto' = 'string') => {
  const trimmed = String(value || '').trim()
  if (!trimmed.length) return [] as string[]
  return [`${' '.repeat(childIndent)}${key}: ${quoteYamlScalar(trimmed, mode)}`]
}

const extractSniffText = (lines: string[], snifferRange: SectionRange | null) => {
  if (!snifferRange) return ''
  const block = findChildBlockRange(lines, snifferRange, 'sniff', 2)
  if (!block) return ''
  const items: string[] = []
  for (let i = block.start + 1; i < block.end; i += 1) {
    const line = String(lines[i] || '')
    if (!line.trim().length || /^\s*#/.test(line)) continue
    if (countIndent(line) !== 4) continue
    const parsed = splitYamlMappingLine(line.replace(/^\s{4}/, '').replace(/\s+#.*$/, ''))
    if (!parsed?.key) continue
    items.push(unquoteYamlValue(parsed.key))
  }
  return joinMultilineItems(items)
}

const buildSniffBlock = (text: string) => {
  const items = splitMultilineItems(text)
  if (!items.length) return [] as string[]
  const block = ['  sniff:']
  for (const item of items) {
    block.push(`    ${quoteYamlKey(item)}: {}`)
  }
  return block
}

export const emptyAdvancedSectionsForm = (): AdvancedSectionsFormModel => ({
  tunEnable: '',
  tunStack: '',
  tunAutoRoute: '',
  tunAutoDetectInterface: '',
  tunDnsHijackText: '',
  tunDevice: '',
  tunMtu: '',
  tunStrictRoute: '',
  tunRouteIncludeAddressText: '',
  tunRouteExcludeAddressText: '',
  tunIncludeInterfaceText: '',
  tunExcludeInterfaceText: '',
  profileStoreSelected: '',
  profileStoreFakeIp: '',
  snifferEnable: '',
  snifferForceDomainText: '',
  snifferSkipDomainText: '',
  snifferParsePureIp: '',
  snifferOverrideDestination: '',
  snifferSniffText: '',
})

export const advancedSectionsFormFromConfig = (value: string): AdvancedSectionsFormModel => {
  const normalized = normalizeText(value)
  const lines = normalized.length ? normalized.split('\n') : []
  const tunRange = findTopLevelSectionRange(lines, 'tun')
  const profileRange = findTopLevelSectionRange(lines, 'profile')
  const snifferRange = findTopLevelSectionRange(lines, 'sniffer')
  return {
    tunEnable: extractScalarField(lines, tunRange, 'enable', 2),
    tunStack: extractScalarField(lines, tunRange, 'stack', 2),
    tunAutoRoute: extractScalarField(lines, tunRange, 'auto-route', 2),
    tunAutoDetectInterface: extractScalarField(lines, tunRange, 'auto-detect-interface', 2),
    tunDnsHijackText: joinMultilineItems(extractListField(lines, tunRange, 'dns-hijack', 2)),
    tunDevice: extractScalarField(lines, tunRange, 'device', 2),
    tunMtu: extractScalarField(lines, tunRange, 'mtu', 2),
    tunStrictRoute: extractScalarField(lines, tunRange, 'strict-route', 2),
    tunRouteIncludeAddressText: joinMultilineItems(extractListField(lines, tunRange, 'route-include-address', 2)),
    tunRouteExcludeAddressText: joinMultilineItems(extractListField(lines, tunRange, 'route-exclude-address', 2)),
    tunIncludeInterfaceText: joinMultilineItems(extractListField(lines, tunRange, 'include-interface', 2)),
    tunExcludeInterfaceText: joinMultilineItems(extractListField(lines, tunRange, 'exclude-interface', 2)),
    profileStoreSelected: extractScalarField(lines, profileRange, 'store-selected', 2),
    profileStoreFakeIp: extractScalarField(lines, profileRange, 'store-fake-ip', 2),
    snifferEnable: extractScalarField(lines, snifferRange, 'enable', 2),
    snifferForceDomainText: joinMultilineItems(extractListField(lines, snifferRange, 'force-domain', 2)),
    snifferSkipDomainText: joinMultilineItems(extractListField(lines, snifferRange, 'skip-domain', 2)),
    snifferParsePureIp: extractScalarField(lines, snifferRange, 'parse-pure-ip', 2),
    snifferOverrideDestination: extractScalarField(lines, snifferRange, 'override-destination', 2),
    snifferSniffText: extractSniffText(lines, snifferRange),
  }
}

export const upsertAdvancedSectionsInConfig = (value: string, form: AdvancedSectionsFormModel) => {
  const normalized = normalizeText(value)
  const lines = normalized.length ? normalized.split('\n') : []

  upsertChildBlock(lines, 'tun', 'enable', 2, buildScalarBlock('enable', 2, form.tunEnable, 'auto'))
  upsertChildBlock(lines, 'tun', 'stack', 2, buildScalarBlock('stack', 2, form.tunStack, 'string'))
  upsertChildBlock(lines, 'tun', 'auto-route', 2, buildScalarBlock('auto-route', 2, form.tunAutoRoute, 'auto'))
  upsertChildBlock(lines, 'tun', 'auto-detect-interface', 2, buildScalarBlock('auto-detect-interface', 2, form.tunAutoDetectInterface, 'auto'))
  upsertChildBlock(lines, 'tun', 'dns-hijack', 2, buildListBlock('dns-hijack', 2, form.tunDnsHijackText))
  upsertChildBlock(lines, 'tun', 'device', 2, buildScalarBlock('device', 2, form.tunDevice, 'string'))
  upsertChildBlock(lines, 'tun', 'mtu', 2, buildScalarBlock('mtu', 2, form.tunMtu, 'auto'))
  upsertChildBlock(lines, 'tun', 'strict-route', 2, buildScalarBlock('strict-route', 2, form.tunStrictRoute, 'auto'))
  upsertChildBlock(lines, 'tun', 'route-include-address', 2, buildListBlock('route-include-address', 2, form.tunRouteIncludeAddressText))
  upsertChildBlock(lines, 'tun', 'route-exclude-address', 2, buildListBlock('route-exclude-address', 2, form.tunRouteExcludeAddressText))
  upsertChildBlock(lines, 'tun', 'include-interface', 2, buildListBlock('include-interface', 2, form.tunIncludeInterfaceText))
  upsertChildBlock(lines, 'tun', 'exclude-interface', 2, buildListBlock('exclude-interface', 2, form.tunExcludeInterfaceText))
  removeSectionIfEmpty(lines, 'tun')

  upsertChildBlock(lines, 'profile', 'store-selected', 2, buildScalarBlock('store-selected', 2, form.profileStoreSelected, 'auto'))
  upsertChildBlock(lines, 'profile', 'store-fake-ip', 2, buildScalarBlock('store-fake-ip', 2, form.profileStoreFakeIp, 'auto'))
  removeSectionIfEmpty(lines, 'profile')

  upsertChildBlock(lines, 'sniffer', 'enable', 2, buildScalarBlock('enable', 2, form.snifferEnable, 'auto'))
  upsertChildBlock(lines, 'sniffer', 'force-domain', 2, buildListBlock('force-domain', 2, form.snifferForceDomainText))
  upsertChildBlock(lines, 'sniffer', 'skip-domain', 2, buildListBlock('skip-domain', 2, form.snifferSkipDomainText))
  upsertChildBlock(lines, 'sniffer', 'parse-pure-ip', 2, buildScalarBlock('parse-pure-ip', 2, form.snifferParsePureIp, 'auto'))
  upsertChildBlock(lines, 'sniffer', 'override-destination', 2, buildScalarBlock('override-destination', 2, form.snifferOverrideDestination, 'auto'))
  upsertChildBlock(lines, 'sniffer', 'sniff', 2, buildSniffBlock(form.snifferSniffText))
  removeSectionIfEmpty(lines, 'sniffer')

  const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  return joined ? `${joined}\n` : ''
}
