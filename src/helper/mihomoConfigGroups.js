const SIMPLE_YAML_KEY_RE = /^[A-Za-z0-9_.@-]+$/;
const normalizeText = (value) => String(value || '').replace(/\r\n/g, '\n');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
const quoteYamlKey = (value) => (SIMPLE_YAML_KEY_RE.test(String(value || '').trim()) ? String(value || '').trim() : JSON.stringify(String(value || '').trim()));
const quoteYamlScalar = (value, mode = 'string') => {
    const trimmed = String(value || '').trim();
    if (!trimmed)
        return '';
    if (mode === 'number' && /^-?\d+$/.test(trimmed))
        return trimmed;
    if (mode === 'boolean') {
        if (/^(true|false)$/i.test(trimmed))
            return trimmed.toLowerCase();
        return JSON.stringify(trimmed);
    }
    return JSON.stringify(trimmed);
};
const dedentBlock = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.split('\n');
    while (lines.length && !String(lines[0] || '').trim().length)
        lines.shift();
    while (lines.length && !String(lines[lines.length - 1] || '').trim().length)
        lines.pop();
    if (!lines.length)
        return '';
    const indents = lines
        .filter((line) => String(line || '').trim().length > 0)
        .map((line) => {
        const match = String(line || '').match(/^\s*/);
        return match ? match[0].length : 0;
    });
    const minIndent = indents.length ? Math.min(...indents) : 0;
    return lines.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line.trimStart())).join('\n');
};
const indentBlock = (value, indent) => {
    const normalized = dedentBlock(value);
    if (!normalized.length)
        return [];
    const prefix = ' '.repeat(indent);
    return normalized.split('\n').map((line) => (line.length ? `${prefix}${line}` : ''));
};
const findTopLevelSectionRange = (lines, section) => {
    const start = lines.findIndex((line) => new RegExp(`^${escapeRegExp(section)}:\\s*(?:#.*)?$`).test(line || ''));
    if (start < 0)
        return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        if (!line.trim().length || /^\s*#/.test(line))
            continue;
        if (!/^\s/.test(line)) {
            end = i;
            break;
        }
    }
    return { start, end };
};
const parseInlineList = (raw) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed.length)
        return [];
    return trimmed
        .split(',')
        .map((item) => unquoteYamlValue(item))
        .map((item) => item.trim())
        .filter(Boolean);
};
const formatInlineList = (items) => `[${items.map((item) => quoteYamlScalar(item)).join(', ')}]`;
const parseListText = (value) => String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
const formatListText = (items) => items.join('\n');
const parseGroupName = (blockLines) => {
    for (const line of blockLines) {
        const inlineMatch = String(line || '').match(/^\s{2}-\s+name:\s*(.*?)\s*$/);
        if (inlineMatch)
            return unquoteYamlValue(inlineMatch[1]);
        const nestedMatch = String(line || '').match(/^\s{4}name:\s*(.*?)\s*$/);
        if (nestedMatch)
            return unquoteYamlValue(nestedMatch[1]);
    }
    return '—';
};
const collectArrayItemsInBlock = (blockLines, key) => {
    const items = [];
    const inlineRe = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*\\[(.*)\\]\\s*(?:#.*)?$`);
    const headerRe = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*(?:#.*)?$`);
    for (let i = 0; i < blockLines.length; i += 1) {
        const line = String(blockLines[i] || '');
        const inlineMatch = line.match(inlineRe);
        if (inlineMatch) {
            items.push(...parseInlineList(inlineMatch[1]));
            continue;
        }
        if (headerRe.test(line)) {
            for (let j = i + 1; j < blockLines.length; j += 1) {
                const nestedLine = String(blockLines[j] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                items.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
        }
    }
    return items;
};
const groupHasNamedArrayItems = (blockLines, key) => collectArrayItemsInBlock(blockLines, key).length > 0;
const ensureGroupFallbackDirect = (blockLines) => {
    const lines = [...blockLines];
    const inlineRe = /^\s{4}proxies:\s*\[(.*)\]\s*(?:#.*)?$/;
    const headerRe = /^\s{4}proxies:\s*(?:#.*)?$/;
    for (let i = 0; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        const inlineMatch = line.match(inlineRe);
        if (inlineMatch) {
            const items = parseInlineList(inlineMatch[1]);
            if (!items.length)
                lines[i] = '    proxies: ["DIRECT"]';
            return lines;
        }
        if (headerRe.test(line)) {
            let end = i + 1;
            const items = [];
            for (; end < lines.length; end += 1) {
                const nestedLine = String(lines[end] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                items.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
            if (!items.length)
                lines.splice(i, Math.max(1, end - i), '    proxies:', '      - "DIRECT"');
            return lines;
        }
    }
    lines.push('    proxies:', '      - "DIRECT"');
    return lines;
};
const rewriteNamedArrayInGroupBlock = (blockLines, key, target, replacement = '') => {
    const lines = [...blockLines];
    const normalizedTarget = String(target || '').trim();
    const normalizedReplacement = String(replacement || '').trim();
    const inlineRe = new RegExp(`^(\\s{4}${escapeRegExp(key)}:\\s*)\\[(.*)\\](\\s*(?:#.*)?)$`);
    const headerRe = new RegExp(`^\\s{4}${escapeRegExp(key)}:\\s*(?:#.*)?$`);
    for (let i = 0; i < lines.length; i += 1) {
        const line = String(lines[i] || '');
        const inlineMatch = line.match(inlineRe);
        if (inlineMatch) {
            const before = parseInlineList(inlineMatch[2]);
            const after = before
                .map((item) => (item === normalizedTarget && normalizedReplacement.length ? normalizedReplacement : item))
                .filter((item) => item !== normalizedTarget || normalizedReplacement.length > 0);
            const changed = before.length !== after.length || before.some((item, index) => after[index] !== item);
            if (!changed)
                return { lines, changed: false, empty: after.length === 0 };
            lines[i] = `${inlineMatch[1]}${formatInlineList(after)}${inlineMatch[3] || ''}`;
            return { lines, changed: true, empty: after.length === 0 };
        }
        if (headerRe.test(line)) {
            let end = i + 1;
            const before = [];
            for (; end < lines.length; end += 1) {
                const nestedLine = String(lines[end] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                before.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
            const after = before
                .map((item) => (item === normalizedTarget && normalizedReplacement.length ? normalizedReplacement : item))
                .filter((item) => item !== normalizedTarget || normalizedReplacement.length > 0);
            const changed = before.length !== after.length || before.some((item, index) => after[index] !== item);
            if (!changed)
                return { lines, changed: false, empty: after.length === 0 };
            const replacementLines = after.length ? [`    ${key}:`, ...after.map((item) => `      - ${quoteYamlScalar(item)}`)] : [`    ${key}: []`];
            lines.splice(i, Math.max(1, end - i), ...replacementLines);
            return { lines, changed: true, empty: after.length === 0 };
        }
    }
    return { lines, changed: false, empty: true };
};
const rewriteProxyGroupRefsInGroupBlock = (blockLines, groupName, replacement = '') => {
    let lines = [...blockLines];
    const touchedKeys = new Set();
    const result = rewriteNamedArrayInGroupBlock(lines, 'proxies', groupName, replacement);
    lines = result.lines;
    if (result.changed)
        touchedKeys.add('proxies');
    let fallbackInjected = false;
    if (!replacement && touchedKeys.size > 0) {
        const hasUseRefs = groupHasNamedArrayItems(lines, 'use');
        const hasProviderRefs = groupHasNamedArrayItems(lines, 'providers');
        const hasDirectProxies = groupHasNamedArrayItems(lines, 'proxies');
        if (!hasUseRefs && !hasProviderRefs && !hasDirectProxies) {
            lines = ensureGroupFallbackDirect(lines);
            fallbackInjected = true;
        }
    }
    return {
        lines,
        touched: touchedKeys.size > 0,
        keys: Array.from(touchedKeys),
        group: parseGroupName(lines),
        fallbackInjected,
    };
};
const rewriteProxyGroupReferences = (value, groupName, replacement = '') => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'proxy-groups');
    const impacts = [];
    if (!range)
        return { yaml: normalized, impacts };
    let i = range.start + 1;
    let end = range.end;
    while (i < end) {
        const line = String(lines[i] || '');
        if (!/^\s{2}-\s*/.test(line)) {
            i += 1;
            continue;
        }
        let j = i + 1;
        while (j < end && !/^\s{2}-\s*/.test(String(lines[j] || '')))
            j += 1;
        const block = lines.slice(i, j);
        const rewritten = rewriteProxyGroupRefsInGroupBlock(block, groupName, replacement);
        if (rewritten.touched) {
            lines.splice(i, block.length, ...rewritten.lines);
            const delta = rewritten.lines.length - block.length;
            end += delta;
            j = i + rewritten.lines.length;
            impacts.push({ group: rewritten.group, keys: rewritten.keys, fallbackInjected: rewritten.fallbackInjected });
        }
        i = j;
    }
    const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return { yaml: joined ? `${joined}\n` : '', impacts };
};
const rewriteRulesTarget = (value, groupName, replacement) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'rules');
    if (!range)
        return { lines, touchedCount: 0, samples: [] };
    const target = String(groupName || '').trim();
    const next = String(replacement || '').trim();
    if (!target.length || !next.length)
        return { lines, touchedCount: 0, samples: [] };
    let touchedCount = 0;
    const samples = [];
    for (let i = range.start + 1; i < range.end; i += 1) {
        const line = String(lines[i] || '');
        if (!/^\s{2}-\s*/.test(line))
            continue;
        const match = line.match(/^(\s{2}-\s*)(.*?)(\s*(?:#.*)?)$/);
        if (!match)
            continue;
        const body = match[2];
        const parts = body.split(',');
        let changed = false;
        const nextParts = parts.map((part) => {
            const trimmed = part.trim();
            if (trimmed === target) {
                changed = true;
                return part.replace(target, next);
            }
            return part;
        });
        if (!changed)
            continue;
        const nextLine = `${match[1]}${nextParts.join(',')}${match[3] || ''}`;
        lines[i] = nextLine;
        touchedCount += 1;
        if (samples.length < 8)
            samples.push({ kind: 'rule', lineNo: i + 1, text: nextLine.trim() });
    }
    return { lines, touchedCount, samples };
};
const extractGroupManagedFields = (blockLines) => {
    const form = {
        originalName: '',
        name: '',
        type: '',
        url: '',
        interval: '',
        strategy: '',
        lazy: '',
        disableUdp: '',
        includeAll: '',
        tolerance: '',
        timeout: '',
        proxiesText: '',
        useText: '',
        providersText: '',
        extraBody: '',
    };
    const extraLines = [];
    const fieldMap = {
        name: 'name',
        type: 'type',
        url: 'url',
        interval: 'interval',
        strategy: 'strategy',
        lazy: 'lazy',
        'disable-udp': 'disableUdp',
        'include-all': 'includeAll',
        tolerance: 'tolerance',
        timeout: 'timeout',
    };
    const listKeys = new Set(['proxies', 'use', 'providers']);
    for (let index = 0; index < blockLines.length; index += 1) {
        const line = String(blockLines[index] || '');
        if (index === 0) {
            const inlineName = line.match(/^\s{2}-\s+name:\s*(.*?)\s*$/);
            if (inlineName) {
                form.name = unquoteYamlValue(inlineName[1]);
                continue;
            }
            extraLines.push(line);
            continue;
        }
        const inlineMatch = line.match(/^\s{4}([A-Za-z0-9_.@-]+):\s*(.*?)\s*$/);
        if (inlineMatch && inlineMatch[1] in fieldMap) {
            form[fieldMap[inlineMatch[1]]] = unquoteYamlValue(inlineMatch[2]);
            continue;
        }
        if (inlineMatch && listKeys.has(inlineMatch[1]) && /^\[.*\]$/.test(inlineMatch[2].trim())) {
            const items = parseInlineList(inlineMatch[2].trim().replace(/^\[/, '').replace(/\]$/, ''));
            const text = formatListText(items);
            if (inlineMatch[1] === 'proxies')
                form.proxiesText = text;
            if (inlineMatch[1] === 'use')
                form.useText = text;
            if (inlineMatch[1] === 'providers')
                form.providersText = text;
            continue;
        }
        if (line.match(/^\s{4}(proxies|use|providers):\s*(?:#.*)?$/)) {
            const key = RegExp.$1;
            const items = [];
            let j = index + 1;
            for (; j < blockLines.length; j += 1) {
                const nestedLine = String(blockLines[j] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                items.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
            const text = formatListText(items);
            if (key === 'proxies')
                form.proxiesText = text;
            if (key === 'use')
                form.useText = text;
            if (key === 'providers')
                form.providersText = text;
            index = j - 1;
            continue;
        }
        extraLines.push(line);
    }
    form.extraBody = dedentBlock(extraLines.join('\n'));
    return form;
};
const parseProxyGroupEntriesRaw = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'proxy-groups');
    const entries = [];
    if (!range)
        return { entries, lines, range };
    let i = range.start + 1;
    while (i < range.end) {
        const line = String(lines[i] || '');
        if (!/^\s{2}-\s*/.test(line)) {
            i += 1;
            continue;
        }
        let j = i + 1;
        while (j < range.end && !/^\s{2}-\s*/.test(String(lines[j] || '')))
            j += 1;
        const blockLines = lines.slice(i, j);
        const form = extractGroupManagedFields(blockLines);
        const name = String(form.name || '').trim() || parseGroupName(blockLines);
        entries.push({
            name,
            type: form.type,
            url: form.url,
            interval: form.interval,
            strategy: form.strategy,
            lazy: form.lazy,
            disableUdp: form.disableUdp,
            includeAll: form.includeAll,
            tolerance: form.tolerance,
            timeout: form.timeout,
            proxies: parseListText(form.proxiesText),
            use: parseListText(form.useText),
            providers: parseListText(form.providersText),
            extraBody: form.extraBody,
            rawBlock: blockLines.join('\n'),
            references: [],
            blockStart: i,
            blockEnd: j,
        });
        i = j;
    }
    return { entries, lines, range };
};
const buildGroupBlockLines = (form) => {
    const lines = [`  - name: ${quoteYamlScalar(form.name)}`];
    const appendScalar = (key, value, mode = 'string') => {
        const cleaned = String(value || '').trim();
        if (!cleaned.length)
            return;
        lines.push(`    ${key}: ${quoteYamlScalar(cleaned, mode)}`);
    };
    const appendList = (key, text) => {
        const items = parseListText(text);
        if (!items.length)
            return;
        lines.push(`    ${key}:`);
        for (const item of items)
            lines.push(`      - ${quoteYamlScalar(item)}`);
    };
    appendScalar('type', form.type);
    appendScalar('url', form.url);
    appendScalar('interval', form.interval, 'number');
    appendScalar('strategy', form.strategy);
    appendScalar('lazy', form.lazy, 'boolean');
    appendScalar('disable-udp', form.disableUdp, 'boolean');
    appendScalar('include-all', form.includeAll, 'boolean');
    appendScalar('tolerance', form.tolerance, 'number');
    appendScalar('timeout', form.timeout, 'number');
    appendList('proxies', form.proxiesText);
    appendList('use', form.useText);
    appendList('providers', form.providersText);
    const extraLines = indentBlock(form.extraBody, 4);
    if (extraLines.length) {
        if (lines.length > 1 && extraLines[0])
            lines.push('');
        lines.push(...extraLines);
    }
    return lines;
};
const insertProxyGroupsSectionIfMissing = (lines, blockLines) => {
    const preferredAnchors = ['proxy-providers', 'rule-providers', 'rules'];
    let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`).test(String(line || ''))));
    if (insertAt < 0) {
        const afterKeys = ['proxies'];
        let anchorRange = null;
        for (const key of afterKeys) {
            const range = findTopLevelSectionRange(lines, key);
            if (range)
                anchorRange = range;
        }
        insertAt = anchorRange ? anchorRange.end : lines.length;
    }
    const sectionLines = ['proxy-groups:', ...blockLines];
    if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length)
        sectionLines.unshift('');
    lines.splice(insertAt, 0, ...sectionLines);
};
export const emptyProxyGroupForm = () => ({
    originalName: '',
    name: '',
    type: 'select',
    url: '',
    interval: '300',
    strategy: '',
    lazy: '',
    disableUdp: '',
    includeAll: '',
    tolerance: '',
    timeout: '',
    proxiesText: 'DIRECT',
    useText: '',
    providersText: '',
    extraBody: '',
});
export const proxyGroupFormFromEntry = (entry) => ({
    originalName: entry.name,
    name: entry.name,
    type: entry.type,
    url: entry.url,
    interval: entry.interval,
    strategy: entry.strategy,
    lazy: entry.lazy,
    disableUdp: entry.disableUdp,
    includeAll: entry.includeAll,
    tolerance: entry.tolerance,
    timeout: entry.timeout,
    proxiesText: formatListText(entry.proxies),
    useText: formatListText(entry.use),
    providersText: formatListText(entry.providers),
    extraBody: entry.extraBody,
});
export const collectProxyGroupReferences = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const map = {};
    const range = findTopLevelSectionRange(lines, 'proxy-groups');
    if (range) {
        let i = range.start + 1;
        while (i < range.end) {
            const line = String(lines[i] || '');
            if (!/^\s{2}-\s*/.test(line)) {
                i += 1;
                continue;
            }
            let j = i + 1;
            while (j < range.end && !/^\s{2}-\s*/.test(String(lines[j] || '')))
                j += 1;
            const block = lines.slice(i, j);
            const group = parseGroupName(block);
            for (const refName of collectArrayItemsInBlock(block, 'proxies')) {
                if (!map[refName])
                    map[refName] = [];
                map[refName].push({ kind: 'group', key: 'proxies', text: group });
            }
            i = j;
        }
    }
    const rulesRange = findTopLevelSectionRange(lines, 'rules');
    if (rulesRange) {
        for (let i = rulesRange.start + 1; i < rulesRange.end; i += 1) {
            const line = String(lines[i] || '');
            if (!/^\s{2}-\s*/.test(line))
                continue;
            const body = line.replace(/^\s{2}-\s*/, '').replace(/\s+#.*$/, '');
            const parts = body.split(',').map((part) => part.trim()).filter(Boolean);
            for (const part of parts) {
                if (!map[part])
                    map[part] = [];
            }
            const target = parts[parts.length - 1];
            if (target)
                map[target].push({ kind: 'rule', lineNo: i + 1, text: line.trim() });
        }
    }
    return map;
};
export const parseProxyGroupsFromConfig = (value) => {
    const refs = collectProxyGroupReferences(value);
    return parseProxyGroupEntriesRaw(value).entries.map((entry) => ({
        ...entry,
        references: refs[entry.name] || [],
    }));
};
export const upsertProxyGroupInConfig = (value, form) => {
    const normalized = normalizeText(value);
    const nextForm = {
        ...form,
        name: String(form.name || '').trim(),
        originalName: String(form.originalName || '').trim(),
        type: String(form.type || '').trim(),
        url: String(form.url || '').trim(),
        interval: String(form.interval || '').trim(),
        strategy: String(form.strategy || '').trim(),
        lazy: String(form.lazy || '').trim(),
        disableUdp: String(form.disableUdp || '').trim(),
        includeAll: String(form.includeAll || '').trim(),
        tolerance: String(form.tolerance || '').trim(),
        timeout: String(form.timeout || '').trim(),
        proxiesText: formatListText(parseListText(form.proxiesText)),
        useText: formatListText(parseListText(form.useText)),
        providersText: formatListText(parseListText(form.providersText)),
        extraBody: dedentBlock(form.extraBody || ''),
    };
    const blockLines = buildGroupBlockLines(nextForm);
    const parsed = parseProxyGroupEntriesRaw(normalized);
    const lines = [...parsed.lines];
    if (!parsed.range) {
        insertProxyGroupsSectionIfMissing(lines, blockLines);
    }
    else {
        const byOriginal = parsed.entries.find((entry) => entry.name === nextForm.originalName);
        const byName = parsed.entries.find((entry) => entry.name === nextForm.name);
        const existing = byOriginal || byName;
        if (existing)
            lines.splice(existing.blockStart, existing.blockEnd - existing.blockStart, ...blockLines);
        else
            lines.splice(parsed.range.end, 0, ...blockLines);
    }
    let joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    joined = joined ? `${joined}\n` : '';
    if (nextForm.originalName && nextForm.originalName !== nextForm.name) {
        joined = rewriteProxyGroupReferences(joined, nextForm.originalName, nextForm.name).yaml;
        joined = rewriteRulesTarget(joined, nextForm.originalName, nextForm.name).lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
        joined = joined ? `${joined}\n` : '';
    }
    return joined;
};
export const removeProxyGroupFromConfig = (value, groupName) => {
    const normalized = normalizeText(value);
    const parsed = parseProxyGroupEntriesRaw(normalized);
    const target = parsed.entries.find((entry) => entry.name === groupName);
    let joined = normalized;
    if (target) {
        const lines = [...parsed.lines];
        lines.splice(target.blockStart, target.blockEnd - target.blockStart);
        if (parsed.range) {
            const remainingEntries = parseProxyGroupEntriesRaw(lines.join('\n')).entries;
            if (!remainingEntries.length) {
                const lines2 = lines.join('\n').split('\n');
                const range2 = findTopLevelSectionRange(lines2, 'proxy-groups');
                if (range2)
                    lines2.splice(range2.start, Math.max(1, range2.end - range2.start), 'proxy-groups: []');
                joined = lines2.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
            }
            else {
                joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
            }
            joined = joined ? `${joined}\n` : '';
        }
    }
    const groupRewrite = rewriteProxyGroupReferences(joined, groupName, '');
    const rulesRewrite = rewriteRulesTarget(groupRewrite.yaml, groupName, 'DIRECT');
    let finalYaml = rulesRewrite.lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    finalYaml = finalYaml ? `${finalYaml}\n` : '';
    return { yaml: finalYaml, impacts: groupRewrite.impacts, rulesTouched: rulesRewrite.touchedCount, ruleSamples: rulesRewrite.samples };
};
export const simulateProxyGroupDisableImpact = (value, groupName) => {
    const groupRewrite = rewriteProxyGroupReferences(value, groupName, '');
    const rulesRewrite = rewriteRulesTarget(groupRewrite.yaml, groupName, 'DIRECT');
    return { impacts: groupRewrite.impacts, rulesTouched: rulesRewrite.touchedCount, ruleSamples: rulesRewrite.samples };
};
