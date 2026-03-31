const SIMPLE_YAML_KEY_RE = /^[A-Za-z0-9_.@-]+$/;
const normalizeText = (value) => String(value || '').replace(/\r\n/g, '\n');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countIndent = (line) => {
    const match = String(line || '').match(/^\s*/);
    return match ? match[0].length : 0;
};
const unquoteYamlValue = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return '';
    const withoutComment = trimmed.replace(/\s+#.*$/, '').trim();
    if ((withoutComment.startsWith("'") && withoutComment.endsWith("'")) || (withoutComment.startsWith('"') && withoutComment.endsWith('"'))) {
        return withoutComment.slice(1, -1);
    }
    return withoutComment;
};
const quoteYamlKey = (value) => {
    const trimmed = String(value || '').trim();
    return SIMPLE_YAML_KEY_RE.test(trimmed) ? trimmed : JSON.stringify(trimmed);
};
const quoteYamlScalar = (value, mode = 'string') => {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return '';
    if (mode === 'auto' && /^(?:true|false|null|-?\d+(?:\.\d+)?)$/i.test(trimmed))
        return trimmed;
    return JSON.stringify(trimmed);
};
const splitMultilineItems = (value) => normalizeText(value)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
const joinMultilineItems = (items) => items.map((item) => String(item || '').trim()).filter(Boolean).join('\n');
const parseInlineList = (raw) => String(raw || '')
    .split(',')
    .map((item) => unquoteYamlValue(item))
    .map((item) => item.trim())
    .filter(Boolean);
const formatInlineList = (items) => `[${items.map((item) => quoteYamlScalar(item)).join(', ')}]`;
const splitYamlMappingLine = (line) => {
    const body = String(line || '').trim();
    if (!body.length)
        return null;
    for (let i = 0; i < body.length; i += 1) {
        if (body[i] !== ':')
            continue;
        const next = body[i + 1] || '';
        if (next && !/\s/.test(next))
            continue;
        const key = body.slice(0, i).trim();
        const value = body.slice(i + 1).trim();
        if (!key.length)
            return null;
        return { key, value };
    }
    return null;
};
const findTopLevelSectionRange = (lines, section) => {
    const start = lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(String(line || '')));
    if (start < 0)
        return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        if (!line.trim().length || /^\s*#/.test(line))
            continue;
        if (countIndent(line) === 0) {
            end = i;
            break;
        }
    }
    return { start, end };
};
const findChildBlockRange = (lines, parentRange, key, childIndent) => {
    const childRe = new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*(?:#.*)?(?:.*)?$`);
    const siblingIndentMax = childIndent;
    const start = lines.findIndex((line, index) => index > parentRange.start && index < parentRange.end && childRe.test(String(line || '')));
    if (start < 0)
        return null;
    let end = parentRange.end;
    for (let i = start + 1; i < parentRange.end; i += 1) {
        const line = String(lines[i] || '');
        if (!line.trim().length || /^\s*#/.test(line))
            continue;
        if (countIndent(line) <= siblingIndentMax) {
            end = i;
            break;
        }
    }
    return { start, end };
};
const ensureTopLevelSection = (lines, section) => {
    let range = findTopLevelSectionRange(lines, section);
    if (range)
        return range;
    const preferredAnchors = ['proxies', 'proxy-groups', 'proxy-providers', 'rule-providers', 'rules'];
    let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*.*$`).test(String(line || ''))));
    if (insertAt < 0)
        insertAt = lines.length;
    const block = [`${section}:`];
    if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length)
        block.unshift('');
    lines.splice(insertAt, 0, ...block);
    range = findTopLevelSectionRange(lines, section);
    return range || { start: insertAt + (block.length > 1 ? 1 : 0), end: lines.length };
};
const upsertChildBlock = (lines, parentSection, key, childIndent, blockLines) => {
    if (!blockLines.length) {
        const parentRange = findTopLevelSectionRange(lines, parentSection);
        if (!parentRange)
            return;
        const existing = findChildBlockRange(lines, parentRange, key, childIndent);
        if (!existing)
            return;
        lines.splice(existing.start, existing.end - existing.start);
        return;
    }
    const parentRange = ensureTopLevelSection(lines, parentSection);
    const existing = findChildBlockRange(lines, parentRange, key, childIndent);
    if (existing)
        lines.splice(existing.start, existing.end - existing.start, ...blockLines);
    else
        lines.splice(parentRange.end, 0, ...blockLines);
};
const removeSectionIfEmpty = (lines, section) => {
    const range = findTopLevelSectionRange(lines, section);
    if (!range)
        return;
    const meaningful = lines.slice(range.start + 1, range.end).some((line) => {
        const trimmed = String(line || '').trim();
        return trimmed.length > 0 && !trimmed.startsWith('#');
    });
    if (meaningful)
        return;
    let removeFrom = range.start;
    if (removeFrom > 0 && !String(lines[removeFrom - 1] || '').trim().length)
        removeFrom -= 1;
    lines.splice(removeFrom, range.end - removeFrom);
};
const extractListField = (lines, parentRange, key, childIndent) => {
    if (!parentRange)
        return [];
    const block = findChildBlockRange(lines, parentRange, key, childIndent);
    if (!block)
        return [];
    const firstLine = String(lines[block.start] || '');
    const inlineMatch = firstLine.match(new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*\\[(.*)\\]\\s*(?:#.*)?$`));
    if (inlineMatch)
        return parseInlineList(inlineMatch[1]);
    const scalarMatch = firstLine.match(new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*(.*?)\\s*(?:#.*)?$`));
    if (scalarMatch && scalarMatch[1] && !/^\s*$/.test(scalarMatch[1]))
        return [unquoteYamlValue(scalarMatch[1])];
    const items = [];
    for (let i = block.start + 1; i < block.end; i += 1) {
        const line = String(lines[i] || '');
        if (!line.trim().length || /^\s*#/.test(line))
            continue;
        const match = line.match(new RegExp(`^\\s{${childIndent + 2}}-\\s*(.*?)\\s*$`));
        if (!match)
            continue;
        items.push(unquoteYamlValue(match[1]));
    }
    return items;
};
const buildListBlock = (key, childIndent, itemsText) => {
    const items = splitMultilineItems(itemsText);
    if (!items.length)
        return [];
    return [`${' '.repeat(childIndent)}${key}:`, ...items.map((item) => `${' '.repeat(childIndent + 2)}- ${quoteYamlScalar(item)}`)];
};
const extractScalarField = (lines, parentRange, key, childIndent) => {
    if (!parentRange)
        return '';
    const block = findChildBlockRange(lines, parentRange, key, childIndent);
    if (!block)
        return '';
    const firstLine = String(lines[block.start] || '');
    const match = firstLine.match(new RegExp(`^\\s{${childIndent}}${escapeRegExp(key)}:\\s*(.*?)\\s*(?:#.*)?$`));
    return match ? unquoteYamlValue(match[1]) : '';
};
const buildScalarBlock = (key, childIndent, value, mode = 'string') => {
    const trimmed = String(value || '').trim();
    if (!trimmed.length)
        return [];
    return [`${' '.repeat(childIndent)}${key}: ${quoteYamlScalar(trimmed, mode)}`];
};
const extractPolicyText = (lines, dnsRange) => {
    if (!dnsRange)
        return '';
    const block = findChildBlockRange(lines, dnsRange, 'nameserver-policy', 2);
    if (!block)
        return '';
    const items = [];
    for (let i = block.start + 1; i < block.end; i += 1) {
        const line = String(lines[i] || '');
        if (!line.trim().length || /^\s*#/.test(line))
            continue;
        if (countIndent(line) !== 4)
            continue;
        const parsed = splitYamlMappingLine(line.replace(/^\s{4}/, '').replace(/\s+#.*$/, ''));
        if (!parsed)
            continue;
        const key = unquoteYamlValue(parsed.key);
        const rest = String(parsed.value || '').trim();
        if (rest.startsWith('[') && rest.endsWith(']')) {
            items.push(`${key} = ${parseInlineList(rest.slice(1, -1)).join(', ')}`);
            continue;
        }
        if (rest.length) {
            items.push(`${key} = ${unquoteYamlValue(rest)}`);
            continue;
        }
        const nestedItems = [];
        let j = i + 1;
        for (; j < block.end; j += 1) {
            const nestedLine = String(lines[j] || '');
            if (!nestedLine.trim().length || /^\s*#/.test(nestedLine))
                continue;
            const indent = countIndent(nestedLine);
            if (indent <= 4)
                break;
            const nestedMatch = nestedLine.match(/^\s{6}-\s*(.*?)\s*$/);
            if (nestedMatch)
                nestedItems.push(unquoteYamlValue(nestedMatch[1]));
        }
        items.push(`${key} = ${nestedItems.join(', ')}`);
        i = j - 1;
    }
    return items.join('\n');
};
const buildPolicyBlock = (text) => {
    const lines = splitMultilineItems(text);
    if (!lines.length)
        return [];
    const block = ['  nameserver-policy:'];
    for (const line of lines) {
        const dividerIndex = line.indexOf('=');
        if (dividerIndex <= 0)
            continue;
        const key = line.slice(0, dividerIndex).trim();
        const rawValue = line.slice(dividerIndex + 1).trim();
        if (!key.length || !rawValue.length)
            continue;
        if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
            block.push(`    ${quoteYamlKey(key)}: ${rawValue}`);
            continue;
        }
        if (rawValue.includes(',')) {
            block.push(`    ${quoteYamlKey(key)}: ${formatInlineList(rawValue.split(',').map((item) => item.trim()).filter(Boolean))}`);
            continue;
        }
        block.push(`    ${quoteYamlKey(key)}: ${quoteYamlScalar(rawValue, 'auto')}`);
    }
    return block.length > 1 ? block : [];
};
export const emptyDnsEditorForm = () => ({
    defaultNameserverText: '',
    nameserverText: '',
    fallbackText: '',
    proxyServerNameserverText: '',
    fakeIpFilterText: '',
    dnsHijackText: '',
    nameserverPolicyText: '',
    fallbackFilterGeoip: '',
    fallbackFilterGeoipCode: '',
    fallbackFilterDomainText: '',
    fallbackFilterGeositeText: '',
    fallbackFilterIpcidrText: '',
});
export const dnsEditorFormFromConfig = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const dnsRange = findTopLevelSectionRange(lines, 'dns');
    const fallbackFilterRange = dnsRange ? findChildBlockRange(lines, dnsRange, 'fallback-filter', 2) : null;
    return {
        defaultNameserverText: joinMultilineItems(extractListField(lines, dnsRange, 'default-nameserver', 2)),
        nameserverText: joinMultilineItems(extractListField(lines, dnsRange, 'nameserver', 2)),
        fallbackText: joinMultilineItems(extractListField(lines, dnsRange, 'fallback', 2)),
        proxyServerNameserverText: joinMultilineItems(extractListField(lines, dnsRange, 'proxy-server-nameserver', 2)),
        fakeIpFilterText: joinMultilineItems(extractListField(lines, dnsRange, 'fake-ip-filter', 2)),
        dnsHijackText: joinMultilineItems(extractListField(lines, dnsRange, 'dns-hijack', 2)),
        nameserverPolicyText: extractPolicyText(lines, dnsRange),
        fallbackFilterGeoip: extractScalarField(lines, fallbackFilterRange, 'geoip', 4),
        fallbackFilterGeoipCode: extractScalarField(lines, fallbackFilterRange, 'geoip-code', 4),
        fallbackFilterDomainText: joinMultilineItems(extractListField(lines, fallbackFilterRange, 'domain', 4)),
        fallbackFilterGeositeText: joinMultilineItems(extractListField(lines, fallbackFilterRange, 'geosite', 4)),
        fallbackFilterIpcidrText: joinMultilineItems(extractListField(lines, fallbackFilterRange, 'ipcidr', 4)),
    };
};
export const upsertDnsEditorInConfig = (value, form) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    upsertChildBlock(lines, 'dns', 'default-nameserver', 2, buildListBlock('default-nameserver', 2, form.defaultNameserverText));
    upsertChildBlock(lines, 'dns', 'nameserver', 2, buildListBlock('nameserver', 2, form.nameserverText));
    upsertChildBlock(lines, 'dns', 'fallback', 2, buildListBlock('fallback', 2, form.fallbackText));
    upsertChildBlock(lines, 'dns', 'proxy-server-nameserver', 2, buildListBlock('proxy-server-nameserver', 2, form.proxyServerNameserverText));
    upsertChildBlock(lines, 'dns', 'fake-ip-filter', 2, buildListBlock('fake-ip-filter', 2, form.fakeIpFilterText));
    upsertChildBlock(lines, 'dns', 'dns-hijack', 2, buildListBlock('dns-hijack', 2, form.dnsHijackText));
    upsertChildBlock(lines, 'dns', 'nameserver-policy', 2, buildPolicyBlock(form.nameserverPolicyText));
    const fallbackFilterBlocks = [
        ...buildScalarBlock('geoip', 4, form.fallbackFilterGeoip, 'auto'),
        ...buildScalarBlock('geoip-code', 4, form.fallbackFilterGeoipCode),
        ...buildListBlock('geosite', 4, form.fallbackFilterGeositeText),
        ...buildListBlock('ipcidr', 4, form.fallbackFilterIpcidrText),
        ...buildListBlock('domain', 4, form.fallbackFilterDomainText),
    ];
    upsertChildBlock(lines, 'dns', 'fallback-filter', 2, fallbackFilterBlocks.length ? ['  fallback-filter:', ...fallbackFilterBlocks] : []);
    removeSectionIfEmpty(lines, 'dns');
    const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return joined ? `${joined}\n` : '';
};
