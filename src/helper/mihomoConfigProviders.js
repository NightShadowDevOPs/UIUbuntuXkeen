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
            let start = i + 1;
            let end = start;
            const items = [];
            for (; end < lines.length; end += 1) {
                const nestedLine = String(lines[end] || '');
                if (!nestedLine.trim().length || /^\s{6}#/.test(nestedLine))
                    continue;
                if (!/^\s{6}-\s*/.test(nestedLine))
                    break;
                items.push(unquoteYamlValue(nestedLine.replace(/^\s{6}-\s*/, '')));
            }
            if (!items.length) {
                lines.splice(i, end - i, '    proxies:', '      - "DIRECT"');
            }
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
const rewriteProxyProviderRefsInGroupBlock = (blockLines, providerName, replacement = '') => {
    let lines = [...blockLines];
    const touchedKeys = new Set();
    for (const key of ['use', 'providers']) {
        const result = rewriteNamedArrayInGroupBlock(lines, key, providerName, replacement);
        lines = result.lines;
        if (result.changed)
            touchedKeys.add(key);
    }
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
const rewriteProxyGroupProviderReferences = (value, providerName, replacement = '') => {
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
        const rewritten = rewriteProxyProviderRefsInGroupBlock(block, providerName, replacement);
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
const extractProviderManagedFields = (blockLines) => {
    const form = {
        originalName: '',
        name: '',
        type: '',
        url: '',
        path: '',
        interval: '',
        filter: '',
        excludeFilter: '',
        healthCheckEnable: '',
        healthCheckUrl: '',
        healthCheckInterval: '',
        healthCheckLazy: '',
        healthCheckExtraBody: '',
        overrideBody: '',
        extraBody: '',
    };
    const extraLines = [];
    const fieldMap = {
        type: 'type',
        url: 'url',
        path: 'path',
        interval: 'interval',
        filter: 'filter',
        'exclude-filter': 'excludeFilter',
    };
    const healthFieldMap = {
        enable: 'healthCheckEnable',
        url: 'healthCheckUrl',
        interval: 'healthCheckInterval',
        lazy: 'healthCheckLazy',
    };
    for (let index = 1; index < blockLines.length; index += 1) {
        const line = String(blockLines[index] || '');
        const match = line.match(/^\s{4}([A-Za-z0-9_.@-]+):\s*(.*?)\s*$/);
        if (match && match[1] in fieldMap) {
            form[fieldMap[match[1]]] = unquoteYamlValue(match[2]);
            continue;
        }
        if (/^\s{4}health-check:\s*(?:#.*)?$/.test(line)) {
            const nestedLines = [];
            let j = index + 1;
            for (; j < blockLines.length; j += 1) {
                const nestedLine = String(blockLines[j] || '');
                if (!nestedLine.trim().length) {
                    nestedLines.push(nestedLine);
                    continue;
                }
                if (/^\s{4}#/.test(nestedLine)) {
                    nestedLines.push(nestedLine);
                    continue;
                }
                if (!/^\s{6}/.test(nestedLine))
                    break;
                nestedLines.push(nestedLine);
            }
            const extraHealthLines = [];
            for (const nestedLine of nestedLines) {
                const nestedMatch = String(nestedLine || '').match(/^\s{6}([A-Za-z0-9_.@-]+):\s*(.*?)\s*$/);
                if (nestedMatch && nestedMatch[1] in healthFieldMap) {
                    form[healthFieldMap[nestedMatch[1]]] = unquoteYamlValue(nestedMatch[2]);
                    continue;
                }
                extraHealthLines.push(nestedLine);
            }
            form.healthCheckExtraBody = dedentBlock(extraHealthLines.join('\n'));
            index = j - 1;
            continue;
        }
        if (/^\s{4}override:\s*(?:#.*)?$/.test(line)) {
            const nestedLines = [];
            let j = index + 1;
            for (; j < blockLines.length; j += 1) {
                const nestedLine = String(blockLines[j] || '');
                if (!nestedLine.trim().length) {
                    nestedLines.push(nestedLine);
                    continue;
                }
                if (/^\s{4}#/.test(nestedLine)) {
                    nestedLines.push(nestedLine);
                    continue;
                }
                if (!/^\s{6}/.test(nestedLine))
                    break;
                nestedLines.push(nestedLine);
            }
            form.overrideBody = dedentBlock(nestedLines.join('\n'));
            index = j - 1;
            continue;
        }
        extraLines.push(line);
    }
    form.extraBody = dedentBlock(extraLines.join('\n'));
    return form;
};
const parseProxyProviderEntriesRaw = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'proxy-providers');
    const entries = [];
    if (!range)
        return { entries, lines, range };
    const entryRe = /^\s{2}([^#\s][^:]*|"[^"]+"|'[^']+'):\s*(?:#.*)?$/;
    let i = range.start + 1;
    while (i < range.end) {
        const line = String(lines[i] || '');
        const match = line.match(entryRe);
        if (!match) {
            i += 1;
            continue;
        }
        const name = unquoteYamlValue(match[1]);
        let j = i + 1;
        while (j < range.end) {
            const nextLine = String(lines[j] || '');
            if (entryRe.test(nextLine))
                break;
            j += 1;
        }
        const blockLines = lines.slice(i, j);
        const form = extractProviderManagedFields(blockLines);
        entries.push({
            name,
            type: form.type,
            url: form.url,
            path: form.path,
            interval: form.interval,
            filter: form.filter,
            excludeFilter: form.excludeFilter,
            healthCheckEnable: form.healthCheckEnable,
            healthCheckUrl: form.healthCheckUrl,
            healthCheckInterval: form.healthCheckInterval,
            healthCheckLazy: form.healthCheckLazy,
            healthCheckExtraBody: form.healthCheckExtraBody,
            overrideBody: form.overrideBody,
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
const buildProviderBlockLines = (form) => {
    const lines = [`  ${quoteYamlKey(form.name)}:`];
    const appendScalar = (key, value, mode = 'string') => {
        const cleaned = String(value || '').trim();
        if (!cleaned.length)
            return;
        lines.push(`    ${key}: ${quoteYamlScalar(cleaned, mode)}`);
    };
    appendScalar('type', form.type);
    appendScalar('url', form.url);
    appendScalar('path', form.path);
    appendScalar('interval', form.interval, 'number');
    appendScalar('filter', form.filter);
    appendScalar('exclude-filter', form.excludeFilter);
    const healthCheckLines = [];
    const appendHealthScalar = (key, value, mode = 'string') => {
        const cleaned = String(value || '').trim();
        if (!cleaned.length)
            return;
        healthCheckLines.push(`      ${key}: ${quoteYamlScalar(cleaned, mode)}`);
    };
    appendHealthScalar('enable', form.healthCheckEnable);
    appendHealthScalar('url', form.healthCheckUrl);
    appendHealthScalar('interval', form.healthCheckInterval, 'number');
    appendHealthScalar('lazy', form.healthCheckLazy);
    healthCheckLines.push(...indentBlock(form.healthCheckExtraBody, 6));
    if (healthCheckLines.length) {
        lines.push('    health-check:');
        lines.push(...healthCheckLines);
    }
    const overrideLines = indentBlock(form.overrideBody, 6);
    if (overrideLines.length) {
        lines.push('    override:');
        lines.push(...overrideLines);
    }
    const extraLines = indentBlock(form.extraBody, 4);
    if (extraLines.length) {
        if (lines.length > 1 && extraLines[0])
            lines.push('');
        lines.push(...extraLines);
    }
    return lines;
};
const insertProxyProvidersSectionIfMissing = (lines, blockLines) => {
    const preferredAnchors = ['rule-providers', 'rules'];
    let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`).test(String(line || ''))));
    if (insertAt < 0) {
        const afterKeys = ['proxy-groups', 'proxies'];
        let anchorRange = null;
        for (const key of afterKeys) {
            const range = findTopLevelSectionRange(lines, key);
            if (range)
                anchorRange = range;
        }
        insertAt = anchorRange ? anchorRange.end : lines.length;
    }
    const sectionLines = ['proxy-providers:', ...blockLines];
    if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length)
        sectionLines.unshift('');
    lines.splice(insertAt, 0, ...sectionLines);
};
export const emptyProxyProviderForm = () => ({
    originalName: '',
    name: '',
    type: 'http',
    url: '',
    path: '',
    interval: '86400',
    filter: '',
    excludeFilter: '',
    healthCheckEnable: 'true',
    healthCheckUrl: 'https://www.gstatic.com/generate_204',
    healthCheckInterval: '600',
    healthCheckLazy: '',
    healthCheckExtraBody: '',
    overrideBody: '',
    extraBody: '',
});
export const proxyProviderFormFromEntry = (entry) => ({
    originalName: entry.name,
    name: entry.name,
    type: entry.type,
    url: entry.url,
    path: entry.path,
    interval: entry.interval,
    filter: entry.filter,
    excludeFilter: entry.excludeFilter,
    healthCheckEnable: entry.healthCheckEnable,
    healthCheckUrl: entry.healthCheckUrl,
    healthCheckInterval: entry.healthCheckInterval,
    healthCheckLazy: entry.healthCheckLazy,
    healthCheckExtraBody: entry.healthCheckExtraBody,
    overrideBody: entry.overrideBody,
    extraBody: entry.extraBody,
});
export const collectProxyProviderReferences = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'proxy-groups');
    const map = {};
    if (!range)
        return map;
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
        for (const key of ['use', 'providers']) {
            for (const providerName of collectArrayItemsInBlock(block, key)) {
                if (!map[providerName])
                    map[providerName] = [];
                map[providerName].push({ group, key });
            }
        }
        i = j;
    }
    return map;
};
export const parseProxyProvidersFromConfig = (value) => {
    const refs = collectProxyProviderReferences(value);
    return parseProxyProviderEntriesRaw(value).entries.map((entry) => ({
        ...entry,
        references: refs[entry.name] || [],
    }));
};
export const upsertProxyProviderInConfig = (value, form) => {
    const normalized = normalizeText(value);
    const nextForm = {
        ...form,
        name: String(form.name || '').trim(),
        originalName: String(form.originalName || '').trim(),
        type: String(form.type || '').trim(),
        url: String(form.url || '').trim(),
        path: String(form.path || '').trim(),
        interval: String(form.interval || '').trim(),
        filter: String(form.filter || '').trim(),
        excludeFilter: String(form.excludeFilter || '').trim(),
        healthCheckEnable: String(form.healthCheckEnable || '').trim(),
        healthCheckUrl: String(form.healthCheckUrl || '').trim(),
        healthCheckInterval: String(form.healthCheckInterval || '').trim(),
        healthCheckLazy: String(form.healthCheckLazy || '').trim(),
        healthCheckExtraBody: dedentBlock(form.healthCheckExtraBody || ''),
        overrideBody: dedentBlock(form.overrideBody || ''),
        extraBody: dedentBlock(form.extraBody || ''),
    };
    const blockLines = buildProviderBlockLines(nextForm);
    const parsed = parseProxyProviderEntriesRaw(normalized);
    const lines = [...parsed.lines];
    if (!parsed.range) {
        insertProxyProvidersSectionIfMissing(lines, blockLines);
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
        joined = rewriteProxyGroupProviderReferences(joined, nextForm.originalName, nextForm.name).yaml;
    }
    return joined;
};
export const removeProxyProviderFromConfig = (value, providerName) => {
    const normalized = normalizeText(value);
    const parsed = parseProxyProviderEntriesRaw(normalized);
    const target = parsed.entries.find((entry) => entry.name === providerName);
    let joined = normalized;
    if (target) {
        const lines = [...parsed.lines];
        lines.splice(target.blockStart, target.blockEnd - target.blockStart);
        if (parsed.range) {
            const remainingEntries = parseProxyProviderEntriesRaw(lines.join('\n')).entries;
            const hasProviders = remainingEntries.length > 0;
            if (!hasProviders) {
                const lines2 = lines.join('\n').split('\n');
                const range2 = findTopLevelSectionRange(lines2, 'proxy-providers');
                if (range2)
                    lines2.splice(range2.start, Math.max(1, range2.end - range2.start), 'proxy-providers: {}');
                joined = lines2.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
            }
            else {
                joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
            }
            joined = joined ? `${joined}\n` : '';
        }
    }
    return rewriteProxyGroupProviderReferences(joined, providerName, '');
};
export const simulateProxyProviderDisableImpact = (value, providerName) => rewriteProxyGroupProviderReferences(value, providerName, '').impacts;
