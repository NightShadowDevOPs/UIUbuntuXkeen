const normalizeText = (value) => String(value || '').replace(/\r\n/g, '\n');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
const splitRuleParts = (value) => String(value || '')
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
export const parseRuleRaw = (value) => {
    const body = String(value || '').replace(/^\s{2}-\s*/, '').replace(/\s+#.*$/, '').trim();
    const parts = splitRuleParts(body);
    const type = parts[0] || '';
    const upperType = type.toUpperCase();
    const isMatchLike = upperType === 'MATCH' || upperType === 'FINAL';
    const payload = isMatchLike ? '' : (parts[1] || '');
    const provider = /^RULE-SET/i.test(type) ? payload : '';
    const target = isMatchLike ? (parts[1] || '') : (parts[2] || '');
    const params = isMatchLike ? parts.slice(2) : parts.slice(3);
    return { raw: body, type, payload, target, provider, params };
};
const formatParamsText = (params) => params.join('\n');
const parseParamsText = (value) => splitRuleParts(value);
export const buildRuleRaw = (form) => {
    const type = String(form.type || '').trim();
    if (!type.length)
        return '';
    const upperType = type.toUpperCase();
    const isMatchLike = upperType === 'MATCH' || upperType === 'FINAL';
    const payload = String(form.payload || '').trim();
    const target = String(form.target || '').trim();
    const params = parseParamsText(form.paramsText);
    const parts = [type];
    if (isMatchLike) {
        if (target.length)
            parts.push(target);
    }
    else {
        if (payload.length)
            parts.push(payload);
        if (target.length)
            parts.push(target);
    }
    parts.push(...params);
    return parts.filter(Boolean).join(',');
};
const parseRulesRaw = (value) => {
    const normalized = normalizeText(value);
    const lines = normalized.length ? normalized.split('\n') : [];
    const range = findTopLevelSectionRange(lines, 'rules');
    const entries = [];
    if (!range)
        return { lines, range, entries };
    let index = 0;
    for (let i = range.start + 1; i < range.end; i += 1) {
        const line = String(lines[i] || '');
        if (!/^\s{2}-\s*/.test(line))
            continue;
        const parsed = parseRuleRaw(line);
        entries.push({ index, lineNo: i + 1, ...parsed });
        index += 1;
    }
    return { lines, range, entries };
};
const insertRulesSectionIfMissing = (lines, blockLine) => {
    const preferredAnchors = ['hosts'];
    let insertAt = lines.findIndex((line) => preferredAnchors.some((key) => new RegExp(`^${escapeRegExp(key)}:\\s*(?:#.*)?$`).test(String(line || ''))));
    if (insertAt < 0)
        insertAt = lines.length;
    const sectionLines = ['rules:', blockLine];
    if (insertAt > 0 && String(lines[insertAt - 1] || '').trim().length)
        sectionLines.unshift('');
    lines.splice(insertAt, 0, ...sectionLines);
};
export const emptyRuleForm = () => ({
    originalIndex: '',
    raw: 'MATCH,DIRECT',
    type: 'MATCH',
    payload: '',
    target: 'DIRECT',
    paramsText: '',
});
export const syncRuleFormFromRaw = (form) => {
    const parsed = parseRuleRaw(form.raw);
    return {
        ...form,
        raw: parsed.raw,
        type: parsed.type,
        payload: parsed.payload,
        target: parsed.target,
        paramsText: formatParamsText(parsed.params),
    };
};
export const syncRuleRawFromForm = (form) => ({
    ...form,
    raw: buildRuleRaw(form),
});
export const ruleFormFromEntry = (entry) => ({
    originalIndex: String(entry.index),
    raw: entry.raw,
    type: entry.type,
    payload: entry.payload,
    target: entry.target,
    paramsText: formatParamsText(entry.params),
});
export const parseRulesFromConfig = (value) => parseRulesRaw(value).entries;
export const upsertRuleInConfig = (value, form) => {
    const normalized = normalizeText(value);
    const nextRaw = String(form.raw || '').trim();
    if (!nextRaw)
        return normalized;
    const parsed = parseRulesRaw(normalized);
    const lines = [...parsed.lines];
    const ruleLine = `  - ${nextRaw}`;
    const originalIndex = Number.parseInt(String(form.originalIndex || ''), 10);
    if (!parsed.range) {
        insertRulesSectionIfMissing(lines, ruleLine);
    }
    else {
        const ruleLines = parsed.entries.map((entry) => entry.lineNo - 1);
        if (Number.isFinite(originalIndex) && originalIndex >= 0 && originalIndex < ruleLines.length)
            lines[ruleLines[originalIndex]] = ruleLine;
        else
            lines.splice(parsed.range.end, 0, ruleLine);
    }
    const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return joined ? `${joined}\n` : '';
};
export const removeRuleFromConfig = (value, ruleIndex) => {
    const normalized = normalizeText(value);
    const parsed = parseRulesRaw(normalized);
    const lines = [...parsed.lines];
    const target = parsed.entries.find((entry) => entry.index === ruleIndex);
    if (!target)
        return normalized;
    lines.splice(target.lineNo - 1, 1);
    if (parsed.range) {
        const remaining = parseRulesRaw(lines.join('\n')).entries;
        if (!remaining.length) {
            const lines2 = lines.join('\n').split('\n');
            const range2 = findTopLevelSectionRange(lines2, 'rules');
            if (range2)
                lines2.splice(range2.start, Math.max(1, range2.end - range2.start), 'rules: []');
            const joined = lines2.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
            return joined ? `${joined}\n` : '';
        }
    }
    const joined = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    return joined ? `${joined}\n` : '';
};
