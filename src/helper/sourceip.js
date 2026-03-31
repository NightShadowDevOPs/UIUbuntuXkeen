import { sourceIPLabelList } from '@/store/settings';
import { activeBackend, backendList } from '@/store/setup';
import * as ipaddr from 'ipaddr.js';
import { watch } from 'vue';
const CACHE_SIZE = 256;
const ipLabelCache = new Map();
const sourceIPMap = new Map();
const sourceIPRegexList = [];
const sourceIPCIDRList = [];
export const isSourceIpScopeVisible = (scope) => {
    if (!scope?.length)
        return true;
    const normalizedScope = scope.map((item) => String(item || '').trim()).filter(Boolean);
    if (!normalizedScope.length)
        return true;
    const currentBackendId = String(activeBackend.value?.uuid || '').trim();
    if (currentBackendId && normalizedScope.includes(currentBackendId))
        return true;
    const localBackendIds = new Set((backendList.value || [])
        .map((backend) => String(backend?.uuid || '').trim())
        .filter(Boolean));
    if (!localBackendIds.size)
        return true;
    const hasAnyLocalScope = normalizedScope.some((id) => localBackendIds.has(id));
    return !hasAnyLocalScope;
};
const preprocessSourceIPList = () => {
    ipLabelCache.clear();
    sourceIPMap.clear();
    sourceIPRegexList.length = 0;
    sourceIPCIDRList.length = 0;
    for (const { key, label, scope } of sourceIPLabelList.value) {
        if (!isSourceIpScopeVisible(scope))
            continue;
        // Regex: /.../
        if (key.startsWith('/')) {
            sourceIPRegexList.push({ regex: new RegExp(key.slice(1), 'i'), label, key });
            continue;
        }
        // CIDR: 192.168.0.0/24 or 2001:db8::/32
        if (key.includes('/')) {
            try {
                const cidr = ipaddr.parseCIDR(key);
                sourceIPCIDRList.push({ cidr, label, key });
                continue;
            }
            catch {
                // fallthrough to exact match map
            }
        }
        sourceIPMap.set(key, label);
    }
};
const cacheResult = (ip, label) => {
    ipLabelCache.set(ip, label);
    if (ipLabelCache.size > CACHE_SIZE) {
        const firstKey = ipLabelCache.keys().next().value;
        if (firstKey) {
            ipLabelCache.delete(firstKey);
        }
    }
    return label;
};
watch(() => [sourceIPLabelList.value, activeBackend.value], preprocessSourceIPList, {
    immediate: true,
    deep: true,
});
export const getSourceIpRuleKind = (key) => {
    const raw = String(key || '').trim();
    if (!raw)
        return 'exact';
    if (raw.startsWith('/'))
        return 'regex';
    if (raw.includes('/')) {
        try {
            ipaddr.parseCIDR(raw);
            return 'cidr';
        }
        catch {
            // fall through
        }
    }
    if (raw.includes(':') && !ipaddr.isValid(raw))
        return 'suffix';
    return 'exact';
};
export const matchesSourceIpRule = (key, ip) => {
    const raw = String(key || '').trim();
    const target = String(ip || '').trim();
    if (!raw || !target)
        return false;
    const kind = getSourceIpRuleKind(raw);
    if (kind === 'regex') {
        try {
            return new RegExp(raw.slice(1), 'i').test(target);
        }
        catch {
            return false;
        }
    }
    if (kind === 'cidr') {
        if (!ipaddr.isValid(target))
            return false;
        try {
            const addr = ipaddr.parse(target);
            const cidr = ipaddr.parseCIDR(raw);
            if (addr.kind() !== cidr[0].kind())
                return false;
            return addr.match(cidr);
        }
        catch {
            return false;
        }
    }
    if (kind === 'suffix')
        return target.includes(':') && target.endsWith(raw);
    return target === raw;
};
const getCIDRLabel = (ip) => {
    if (!sourceIPCIDRList.length)
        return '';
    if (!ipaddr.isValid(ip))
        return '';
    let addr;
    try {
        addr = ipaddr.parse(ip);
    }
    catch {
        return '';
    }
    for (const { cidr, label, key } of sourceIPCIDRList) {
        // IPv4 can't match IPv6 ranges and vice versa
        if (addr.kind() !== cidr[0].kind())
            continue;
        try {
            if (addr.match(cidr)) {
                // If label is empty, fall back to the key itself.
                return (label || '').trim() ? label : key;
            }
        }
        catch {
            // ignore parse/match edge cases
        }
    }
    return '';
};
const resolveRuleLabel = (kind, key, label, ip) => {
    const trimmedLabel = String(label || '').trim();
    if (trimmedLabel)
        return trimmedLabel;
    if (kind === 'cidr' || kind === 'suffix')
        return key;
    return ip || key;
};
export const getPrimarySourceIpRule = (ip) => {
    const target = String(ip || '').trim();
    if (!target)
        return null;
    if (sourceIPMap.has(target)) {
        const label = sourceIPMap.get(target) || '';
        return {
            key: target,
            label,
            resolvedLabel: resolveRuleLabel('exact', target, label, target),
            kind: 'exact',
        };
    }
    if (target.includes(':')) {
        for (const [key, label] of sourceIPMap.entries()) {
            if (!target.endsWith(key))
                continue;
            const kind = getSourceIpRuleKind(key);
            return {
                key,
                label,
                resolvedLabel: resolveRuleLabel(kind, key, label, target),
                kind,
            };
        }
    }
    if (ipaddr.isValid(target)) {
        let addr;
        try {
            addr = ipaddr.parse(target);
        }
        catch {
            addr = null;
        }
        if (addr) {
            for (const { cidr, label, key } of sourceIPCIDRList) {
                if (addr.kind() !== cidr[0].kind())
                    continue;
                try {
                    if (addr.match(cidr)) {
                        return {
                            key,
                            label,
                            resolvedLabel: resolveRuleLabel('cidr', key, label, target),
                            kind: 'cidr',
                        };
                    }
                }
                catch {
                    // ignore
                }
            }
        }
    }
    for (const { regex, label, key } of sourceIPRegexList) {
        if (!regex.test(target))
            continue;
        return {
            key,
            label,
            resolvedLabel: resolveRuleLabel('regex', key, label, target),
            kind: 'regex',
        };
    }
    return null;
};
export const getExactIPLabelFromMap = (ip) => {
    if (!ip)
        return ip === '' ? 'Inner' : '';
    if (sourceIPMap.has(ip)) {
        const label = sourceIPMap.get(ip);
        return (label || '').trim() ? label : ip;
    }
    return '';
};
export const getIPLabelFromMap = (ip) => {
    if (!ip)
        return ip === '' ? 'Inner' : '';
    if (ipLabelCache.has(ip)) {
        return ipLabelCache.get(ip);
    }
    const isIPv6 = ip.includes(':');
    if (isIPv6) {
        for (const [key, label] of sourceIPMap.entries()) {
            if (ip.endsWith(key)) {
                // If label is empty, fall back to the key itself.
                return cacheResult(ip, (label || '').trim() ? label : key);
            }
        }
        const cidrLabel = getCIDRLabel(ip);
        if (cidrLabel)
            return cacheResult(ip, cidrLabel);
    }
    else if (sourceIPMap.has(ip)) {
        const label = sourceIPMap.get(ip);
        // If label is empty, fall back to IP itself.
        return cacheResult(ip, (label || '').trim() ? label : ip);
    }
    else {
        const cidrLabel = getCIDRLabel(ip);
        if (cidrLabel)
            return cacheResult(ip, cidrLabel);
    }
    for (const { regex, label } of sourceIPRegexList) {
        if (regex.test(ip)) {
            // If label is empty, fall back to IP itself.
            return cacheResult(ip, (label || '').trim() ? label : ip);
        }
    }
    return cacheResult(ip, ip);
};
// Best-effort reverse lookup: map a saved "label" back to the original IP key.
// Used to merge legacy traffic history that was recorded under labels.
// Only supports exact IP keys (not CIDR / regex).
export const getIPKeyFromLabel = (label) => {
    const l = (label || '').trim();
    if (!l)
        return '';
    const backendId = activeBackend.value?.uuid;
    for (const it of sourceIPLabelList.value || []) {
        const lb = (it.label || '').trim();
        if (lb !== l)
            continue;
        if (!isSourceIpScopeVisible(it.scope))
            continue;
        const k = (it.key || '').trim();
        if (!k)
            continue;
        if (k.startsWith('/'))
            continue; // regex
        if (k.includes('/'))
            continue; // CIDR
        return k;
    }
    return '';
};
