import { isSingBox } from '@/api';
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant';
import { isHiddenGroup } from '@/helper';
import { normalizeProxyProtoKey } from '@/helper/proxyProto';
import { getProviderHealth } from '@/helper/providerHealth';
import { configs } from '@/store/config';
import { providerActivityByName, providerActivitySnapshot, providerLiveStatusByName } from '@/store/providerActivity';
import { proxiesTabShow, proxyGroupList, proxyMap, proxyProviederList } from '@/store/proxies';
import { customGlobalNode, displayGlobalByMode, hideUnusedProxyProviders, manageHiddenGroup, proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault, } from '@/store/settings';
import { agentProviderByName, autoSortProxyProvidersByHealth, providerHealthFilter, proxyProvidersSortMode, showOnlyActiveProxyProviders, showOnlyTrafficProxyProviders, proxyProvidersProtoFilter, } from '@/store/providerHealth';
import { isEmpty } from 'lodash';
import { computed, ref } from 'vue';
// Provider list ordering can become "jumpy" when health/activity changes trigger a re-sort.
// To keep the UI stable, we keep the previous order and only append new providers.
// The order resets only when the user changes sorting-related settings.
const providerOrderMemo = ref([]);
const providerOrderSig = ref('');
const stableProviderOrder = (desired, sig) => {
    const set = new Set(desired);
    const prev = providerOrderMemo.value || [];
    if (!prev.length || providerOrderSig.value !== sig) {
        providerOrderSig.value = sig;
        providerOrderMemo.value = [...desired];
        return providerOrderMemo.value;
    }
    // Keep previous order for existing items; remove missing; append new ones in desired order.
    const kept = prev.filter((n) => set.has(n));
    const keptSet = new Set(kept);
    const appended = desired.filter((n) => !keptSet.has(n));
    providerOrderMemo.value = [...kept, ...appended];
    return providerOrderMemo.value;
};
const filterGroups = (all) => {
    if (manageHiddenGroup.value) {
        return all;
    }
    return all.filter((name) => !isHiddenGroup(name));
};
export const renderGroups = computed(() => {
    if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
        // IMPORTANT:
        // The Providers tab should not disappear when proxyMap is temporarily empty.
        // Some core operations (e.g. provider update/healthcheck) may briefly clear /proxies,
        // but providers list (/providers/proxies) remains available. Keeping Providers visible
        // avoids a full-page "blink".
        const usedProxyNames = new Set();
        // Собираем все реальные прокси, которые входят хотя бы в одну группу.
        // Если провайдер не даёт ни одного прокси, попавшего в группы — считаем его неиспользуемым.
        for (const g of proxyGroupList.value) {
            for (const n of proxyMap.value[g]?.all || [])
                usedProxyNames.add(n);
        }
        const isUsed = (provider) => {
            if (usedProxyNames.has(provider.name))
                return true;
            return (provider.proxies || []).some((p) => {
                const name = typeof p === 'string' ? p : p?.name;
                return name ? usedProxyNames.has(name) : false;
            });
        };
        // When proxyMap is temporarily empty, usedProxyNames becomes empty and the "hide unused" filter
        // would incorrectly hide ALL providers, causing the whole tab to blink.
        // Apply the filter only when we have at least some group membership info.
        const canJudgeUsed = usedProxyNames.size > 0;
        let list = proxyProviederList.value.filter((p) => !hideUnusedProxyProviders.value || !canJudgeUsed || isUsed(p));
        if (providerHealthFilter.value) {
            const target = providerHealthFilter.value;
            list = list.filter((p) => {
                const override = Number((proxyProviderSslWarnDaysMap.value || {})[p.name]);
                const base = Number(sslNearExpiryDaysDefault.value);
                const nearDays = Number.isFinite(override) ? override : Number.isFinite(base) ? base : 2;
                const h = getProviderHealth(p, agentProviderByName.value[p.name], { nearExpiryDays: nearDays });
                return h.status === target;
            });
        }
        // Optionally show only providers with active connections (best-effort).
        if (showOnlyActiveProxyProviders.value) {
            list = list.filter((p) => {
                const act = providerActivityByName.value[p.name] || {};
                const live = providerLiveStatusByName.value[p.name] || {};
                return Boolean(live.active)
                    || Number(live.connections || 0) > 0
                    || Boolean(act.active)
                    || Number(act.connections || 0) > 0
                    || Number(act.currentBytes || 0) > 0
                    || Number(act.speed || 0) > 0;
            });
        }
        // Optional quick filter for providers that already have observed traffic counters.
        // IMPORTANT: rely on both aggregated counters and direct live connection matching.
        // Some providers (especially inside load-balance chains) may already carry traffic
        // while per-provider deltas are still incomplete or ambiguous. In that case
        // providerLiveStatusByName still sees active mapped connections and should keep
        // the provider visible under the “Only with traffic” filter.
        if (showOnlyTrafficProxyProviders.value) {
            list = list.filter((p) => {
                const act = providerActivityByName.value[p.name] || {};
                const live = providerLiveStatusByName.value[p.name] || {};
                return Number(act.todayBytes || 0) > 0
                    || Number(act.bytes || 0) > 0
                    || Number(act.currentBytes || 0) > 0
                    || Number(act.speed || 0) > 0
                    || Boolean(live.active)
                    || Number(live.connections || 0) > 0;
            });
        }
        // Optional protocol filter sub-tab (wg/vless/ss/...)
        const proto = String(proxyProvidersProtoFilter.value || 'all').trim();
        if (proto && proto !== 'all') {
            list = list.filter((p) => {
                // Some backends (or proxy types like WireGuard) may omit proxy items or their `type`.
                // Prefer provider-level `type` when available, then fall back to scanning proxy items.
                const providerProto = normalizeProxyProtoKey(p?.type);
                if (providerProto === proto)
                    return true;
                return (p?.proxies || []).some((n) => {
                    const t0 = typeof n === 'string' ? proxyMap.value[n]?.type : n?.type;
                    return normalizeProxyProtoKey(t0) === proto;
                });
            });
        }
        const mode = proxyProvidersSortMode.value || 'health';
        const sig = [
            `mode:${mode}`,
            `autoHealth:${autoSortProxyProvidersByHealth.value ? 1 : 0}`,
            `healthFilter:${providerHealthFilter.value || ''}`,
            `onlyActive:${showOnlyActiveProxyProviders.value ? 1 : 0}`,
            `onlyTraffic:${showOnlyTrafficProxyProviders.value ? 1 : 0}`,
            `hideUnused:${hideUnusedProxyProviders.value ? 1 : 0}`,
            `proto:${proxyProvidersProtoFilter.value || 'all'}`,
        ].join('|');
        if (mode === 'traffic') {
            list = [...list].sort((a, b) => {
                const aa = providerActivitySnapshot.value[a.name] || { todayBytes: 0, bytes: 0, currentBytes: 0, speed: 0, connections: 0 };
                const bb = providerActivitySnapshot.value[b.name] || { todayBytes: 0, bytes: 0, currentBytes: 0, speed: 0, connections: 0 };
                if ((bb.todayBytes || 0) !== (aa.todayBytes || 0))
                    return (bb.todayBytes || 0) - (aa.todayBytes || 0);
                if ((bb.bytes || 0) !== (aa.bytes || 0))
                    return (bb.bytes || 0) - (aa.bytes || 0);
                if ((bb.currentBytes || 0) !== (aa.currentBytes || 0))
                    return (bb.currentBytes || 0) - (aa.currentBytes || 0);
                if ((bb.speed || 0) !== (aa.speed || 0))
                    return (bb.speed || 0) - (aa.speed || 0);
                if ((bb.connections || 0) !== (aa.connections || 0))
                    return (bb.connections || 0) - (aa.connections || 0);
                return String(a.name).localeCompare(String(b.name));
            });
        }
        else if (mode === 'activity') {
            list = [...list].sort((a, b) => {
                // Use throttled snapshot to avoid constant UI re-ordering.
                const aa = providerActivitySnapshot.value[a.name] || { bytes: 0, currentBytes: 0, speed: 0, connections: 0 };
                const bb = providerActivitySnapshot.value[b.name] || { bytes: 0, currentBytes: 0, speed: 0, connections: 0 };
                if ((bb.connections || 0) !== (aa.connections || 0))
                    return (bb.connections || 0) - (aa.connections || 0);
                if ((bb.speed || 0) !== (aa.speed || 0))
                    return (bb.speed || 0) - (aa.speed || 0);
                if ((bb.currentBytes || 0) !== (aa.currentBytes || 0))
                    return (bb.currentBytes || 0) - (aa.currentBytes || 0);
                if ((bb.bytes || 0) !== (aa.bytes || 0))
                    return (bb.bytes || 0) - (aa.bytes || 0);
                return String(a.name).localeCompare(String(b.name));
            });
        }
        else if (mode === 'name') {
            list = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        }
        else {
            // mode === 'health'
            if (autoSortProxyProvidersByHealth.value) {
                list = [...list].sort((a, b) => {
                    const oa = Number((proxyProviderSslWarnDaysMap.value || {})[a.name]);
                    const ob = Number((proxyProviderSslWarnDaysMap.value || {})[b.name]);
                    const base = Number(sslNearExpiryDaysDefault.value);
                    const na = Number.isFinite(oa) ? oa : Number.isFinite(base) ? base : 2;
                    const nb = Number.isFinite(ob) ? ob : Number.isFinite(base) ? base : 2;
                    const ha = getProviderHealth(a, agentProviderByName.value[a.name], { nearExpiryDays: na });
                    const hb = getProviderHealth(b, agentProviderByName.value[b.name], { nearExpiryDays: nb });
                    if (ha.severity !== hb.severity)
                        return ha.severity - hb.severity;
                    return String(a.name).localeCompare(String(b.name));
                });
            }
            else {
                list = [...list].sort((a, b) => String(a.name).localeCompare(String(b.name)));
            }
        }
        const desired = list.map((p) => p.name);
        return stableProviderOrder(desired, sig);
    }
    if (isEmpty(proxyMap.value)) {
        return [];
    }
    if (displayGlobalByMode.value) {
        if (configs.value?.mode.toUpperCase() === GLOBAL) {
            return [
                isSingBox.value && proxyMap.value[customGlobalNode.value] ? customGlobalNode.value : GLOBAL,
            ];
        }
        return filterGroups(proxyGroupList.value);
    }
    return filterGroups([...proxyGroupList.value, GLOBAL]);
});
