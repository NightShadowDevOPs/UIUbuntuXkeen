import { fetchRuleProvidersAPI, fetchRulesAPI } from '@/api';
import { RULE_TAB_TYPE } from '@/constant';
import { computed, ref, watch } from 'vue';
import { activeConnections, closedConnections } from '@/store/connections';
export const rulesFilter = ref('');
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES);
const RULES_VIEW_MODE_LS_KEY = 'ui/rules/view-mode-v1';
const RULES_SORT_BY_LS_KEY = 'ui/rules/sort-by-v1';
const RULES_TYPE_FILTER_LS_KEY = 'ui/rules/type-filter-v1';
const RULES_PROXY_FILTER_LS_KEY = 'ui/rules/proxy-filter-v1';
const readLs = (k) => {
    try {
        return localStorage.getItem(k);
    }
    catch {
        return null;
    }
};
const writeLs = (k, v) => {
    try {
        localStorage.setItem(k, v);
    }
    catch {
        // ignore
    }
};
export const rulesViewMode = ref(readLs(RULES_VIEW_MODE_LS_KEY) || 'card');
export const rulesSortBy = ref(readLs(RULES_SORT_BY_LS_KEY) || 'config');
export const rulesTypeFilter = ref(readLs(RULES_TYPE_FILTER_LS_KEY) || '');
export const rulesProxyFilter = ref(readLs(RULES_PROXY_FILTER_LS_KEY) || '');
export const rules = ref([]);
export const ruleProviderList = ref([]);
// persist options
watch(rulesViewMode, (v) => writeLs(RULES_VIEW_MODE_LS_KEY, String(v)));
watch(rulesSortBy, (v) => writeLs(RULES_SORT_BY_LS_KEY, String(v)));
watch(rulesTypeFilter, (v) => writeLs(RULES_TYPE_FILTER_LS_KEY, String(v || '')));
watch(rulesProxyFilter, (v) => writeLs(RULES_PROXY_FILTER_LS_KEY, String(v || '')));
export const uniqueRuleTypes = computed(() => {
    return Array.from(new Set(rules.value.map((r) => String(r.type || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
});
export const uniqueRuleProxies = computed(() => {
    return Array.from(new Set(rules.value.map((r) => String(r.proxy || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
});
export const renderRules = computed(() => {
    const rulesFilterValue = rulesFilter.value.split(' ').map((f) => f.toLowerCase().trim());
    const base = rulesFilter.value === ''
        ? rules.value
        : rules.value.filter((rule) => {
            return rulesFilterValue.every((f) => [rule.type.toLowerCase(), rule.payload.toLowerCase(), rule.proxy.toLowerCase()].some((i) => i.includes(f)));
        });
    const typeOnly = String(rulesTypeFilter.value || '').trim();
    const proxyOnly = String(rulesProxyFilter.value || '').trim();
    const filtered = base.filter((r) => {
        if (typeOnly && String(r.type || '').trim() !== typeOnly)
            return false;
        if (proxyOnly && String(r.proxy || '').trim() !== proxyOnly)
            return false;
        return true;
    });
    const sort = rulesSortBy.value;
    if (sort === 'config')
        return filtered;
    const providerUpdatedAt = new Map();
    for (const p of ruleProviderList.value) {
        const n = String(p.name || '').trim();
        if (!n)
            continue;
        const ts = Date.parse(String(p.updatedAt || ''));
        if (!Number.isNaN(ts))
            providerUpdatedAt.set(n, ts);
    }
    const hitMap = ruleHitMap.value;
    const keyOf = (type, payload) => `${(type || '').trim()}\u0000${(payload || '').trim()}`;
    const hitsOf = (r) => hitMap.get(keyOf(r.type, r.payload)) || 0;
    const updatedOf = (r) => {
        if (String(r.type || '') !== 'RuleSet')
            return 0;
        const p = String(r.payload || '').trim();
        return providerUpdatedAt.get(p) || 0;
    };
    const sorted = filtered.slice();
    sorted.sort((a, b) => {
        if (sort === 'hits_desc')
            return hitsOf(b) - hitsOf(a);
        if (sort === 'hits_asc')
            return hitsOf(a) - hitsOf(b);
        if (sort === 'updated_desc')
            return updatedOf(b) - updatedOf(a);
        if (sort === 'type_asc') {
            const d = String(a.type || '').localeCompare(String(b.type || ''));
            return d !== 0 ? d : String(a.payload || '').localeCompare(String(b.payload || ''));
        }
        if (sort === 'proxy_asc') {
            const d = String(a.proxy || '').localeCompare(String(b.proxy || ''));
            if (d !== 0)
                return d;
            const dt = String(a.type || '').localeCompare(String(b.type || ''));
            return dt !== 0 ? dt : String(a.payload || '').localeCompare(String(b.payload || ''));
        }
        return 0;
    });
    return sorted;
});
export const renderRulesProvider = computed(() => {
    const rulesFilterValue = rulesFilter.value.split(' ').map((f) => f.toLowerCase().trim());
    if (rulesFilter.value === '') {
        return ruleProviderList.value;
    }
    return ruleProviderList.value.filter((ruleProvider) => {
        return rulesFilterValue.every((f) => [
            ruleProvider.name.toLowerCase(),
            ruleProvider.behavior.toLowerCase(),
            ruleProvider.vehicleType.toLowerCase(),
        ].some((i) => i.includes(f)));
    });
});
export const ruleHitMap = computed(() => {
    const map = new Map();
    const all = [...activeConnections.value, ...closedConnections.value];
    for (const c of all) {
        const type = (c.rule || '').trim();
        const payload = (c.rulePayload || '').trim();
        if (!type)
            continue;
        const key = `${type}\u0000${payload}`;
        map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
});
export const getRuleHitCount = (type, payload) => {
    const key = `${(type || '').trim()}\u0000${(payload || '').trim()}`;
    return ruleHitMap.value.get(key) || 0;
};
export const ruleMissCount = computed(() => {
    // In Clash/Mihomo, "MATCH" is the final catch-all rule.
    // We treat it as a "miss" from explicit filter rules.
    const all = [...activeConnections.value, ...closedConnections.value];
    return all.filter((c) => (c.rule || '').toUpperCase() === 'MATCH').length;
});
export const fetchRules = async () => {
    const { data: ruleData } = await fetchRulesAPI();
    const { data: providerData } = await fetchRuleProvidersAPI();
    rules.value = ruleData.rules.map((rule) => {
        const proxy = rule.proxy;
        const proxyName = proxy.startsWith('route(') ? proxy.substring(6, proxy.length - 1) : proxy;
        return {
            ...rule,
            proxy: proxyName,
        };
    });
    ruleProviderList.value = Object.values(providerData.providers);
};
