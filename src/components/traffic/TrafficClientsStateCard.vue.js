/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { agentHostTrafficLiveAPI, agentLanHostsAPI } from '@/api/agent';
import { getChainsStringFromConnection, getHostFromConnection } from '@/helper';
import { getIPLabelFromMap } from '@/helper/sourceip';
import { prettyBytesHelper } from '@/helper/utils';
import { agentEnabled } from '@/store/agent';
import { activeConnections, closedConnections, lastConnectionsTick } from '@/store/connections';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const query = ref('');
const loading = ref(false);
const error = ref('');
const notice = ref('');
const hostTraffic = ref([]);
const lanHosts = ref([]);
const lastAgentUpdateAt = ref(0);
const agentLive = ref(false);
let timer;
const formatRate = (bytes) => `${prettyBytesHelper(bytes || 0)}/s`;
const formatBytes = (bytes) => prettyBytesHelper(bytes || 0);
const isLikelySystemOrSyntheticIp = (ip) => {
    const value = String(ip || '').trim().toLowerCase();
    if (!value)
        return true;
    if (value === '0.0.0.0' || value === '::' || value === '::1')
        return true;
    if (/^127\./.test(value))
        return true;
    if (/^169\.254\./.test(value))
        return true;
    if (/^198\.(18|19)\./.test(value))
        return true;
    return false;
};
const normalizeOptionalAgentError = (message) => {
    const raw = String(message || '').trim();
    if (!raw)
        return t('trafficHostTelemetryUnavailable');
    const low = raw.toLowerCase();
    if (low === 'network error'
        || low.includes('timeout')
        || low.includes('failed')
        || low.includes('offline')
        || low.includes('not found')
        || low.includes('404')
        || low.includes('cmd')) {
        return t('trafficHostTelemetryUnavailable');
    }
    return raw;
};
const refreshAll = async () => {
    if (!agentEnabled.value) {
        agentLive.value = false;
        error.value = '';
        notice.value = '';
        hostTraffic.value = [];
        lanHosts.value = [];
        return;
    }
    loading.value = true;
    notice.value = '';
    error.value = '';
    try {
        const [trafficRes, hostsRes] = await Promise.allSettled([agentHostTrafficLiveAPI(), agentLanHostsAPI()]);
        if (trafficRes.status === 'fulfilled' && trafficRes.value?.ok) {
            hostTraffic.value = trafficRes.value.items || [];
            lastAgentUpdateAt.value = Date.now();
            agentLive.value = true;
        }
        else {
            hostTraffic.value = [];
            agentLive.value = false;
            const rawError = trafficRes.status === 'fulfilled'
                ? String(trafficRes.value?.error || '')
                : String(trafficRes.reason?.message || '');
            notice.value = normalizeOptionalAgentError(rawError);
        }
        if (hostsRes.status === 'fulfilled' && hostsRes.value?.ok) {
            lanHosts.value = hostsRes.value.items || [];
        }
        else {
            lanHosts.value = [];
        }
    }
    catch (e) {
        agentLive.value = false;
        hostTraffic.value = [];
        lanHosts.value = [];
        error.value = normalizeOptionalAgentError(e?.message || 'agent host_traffic_live failed');
    }
    finally {
        loading.value = false;
    }
};
onMounted(() => {
    refreshAll();
    timer = window.setInterval(() => {
        refreshAll();
    }, 5000);
});
onBeforeUnmount(() => {
    if (timer)
        window.clearInterval(timer);
});
const hostsKnown = computed(() => lanHosts.value.length);
const updatedLabel = computed(() => {
    const use = Math.max(Number(lastAgentUpdateAt.value || 0), Number(lastConnectionsTick.value || 0));
    if (!use)
        return '—';
    const diff = Math.max(0, Math.round((Date.now() - use) / 1000));
    if (diff < 5)
        return '0s';
    if (diff < 60)
        return `${diff}s`;
    return `${Math.round(diff / 60)}m`;
});
const rows = computed(() => {
    const hostsMap = new Map();
    for (const host of lanHosts.value || []) {
        if (host?.ip)
            hostsMap.set(host.ip, host);
    }
    const trafficMap = new Map();
    for (const item of hostTraffic.value || []) {
        if (item?.ip)
            trafficMap.set(item.ip, item);
    }
    const activeByIp = new Map();
    for (const conn of activeConnections.value || []) {
        const ip = String(conn.metadata.sourceIP || '').trim();
        if (!ip)
            continue;
        const list = activeByIp.get(ip) || [];
        list.push(conn);
        activeByIp.set(ip, list);
    }
    const closedCountByIp = new Map();
    for (const conn of closedConnections.value || []) {
        const ip = String(conn.metadata.sourceIP || '').trim();
        if (!ip)
            continue;
        closedCountByIp.set(ip, (closedCountByIp.get(ip) || 0) + 1);
    }
    const keys = new Set();
    for (const ip of activeByIp.keys())
        keys.add(ip);
    for (const ip of trafficMap.keys())
        keys.add(ip);
    const list = [];
    for (const ip of keys) {
        const active = activeByIp.get(ip) || [];
        const host = hostsMap.get(ip);
        const traffic = trafficMap.get(ip);
        const label = getIPLabelFromMap(ip);
        if (!host && !traffic && isLikelySystemOrSyntheticIp(ip))
            continue;
        const mihomoDownBps = active.reduce((sum, conn) => sum + Number(conn.downloadSpeed || 0), 0);
        const mihomoUpBps = active.reduce((sum, conn) => sum + Number(conn.uploadSpeed || 0), 0);
        const mihomoTotalBytes = active.reduce((sum, conn) => sum + Number(conn.download || 0) + Number(conn.upload || 0), 0);
        const chainStats = new Map();
        const targetStats = new Map();
        for (const conn of active) {
            const chain = getChainsStringFromConnection(conn);
            chainStats.set(chain, (chainStats.get(chain) || 0) + 1);
            const target = getHostFromConnection(conn);
            targetStats.set(target, (targetStats.get(target) || 0) + 1);
        }
        const topRoute = Array.from(chainStats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const topTarget = Array.from(targetStats.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const hostDownBps = Number(traffic?.totalDownBps || 0);
        const hostUpBps = Number(traffic?.totalUpBps || 0);
        const bypassDownBps = Number(traffic?.bypassDownBps || 0);
        const bypassUpBps = Number(traffic?.bypassUpBps || 0);
        const vpnDownBps = Number(traffic?.vpnDownBps || 0);
        const vpnUpBps = Number(traffic?.vpnUpBps || 0);
        const badges = [];
        if (active.length)
            badges.push({ key: 'mihomo', label: t('trafficStateMihomo'), className: 'badge-success badge-outline' });
        if (vpnDownBps > 0 || vpnUpBps > 0)
            badges.push({ key: 'vpn', label: t('routerTrafficVpn'), className: 'badge-info badge-outline' });
        if (bypassDownBps > 0 || bypassUpBps > 0)
            badges.push({ key: 'bypass', label: t('routerTrafficBypass'), className: 'badge-warning badge-outline' });
        if (!badges.length && (hostDownBps > 0 || hostUpBps > 0))
            badges.push({ key: 'observed', label: t('trafficStateObserved'), className: 'badge-ghost' });
        list.push({
            ip,
            displayName: host?.hostname || (label && label !== ip ? label : ip),
            isLabelOnly: !!label && label !== ip && !host?.hostname,
            mac: String(host?.mac || traffic?.mac || ''),
            activeConnections: active.length,
            closedConnections: Number(closedCountByIp.get(ip) || 0),
            hostDownBps,
            hostUpBps,
            bypassDownBps,
            bypassUpBps,
            vpnDownBps,
            vpnUpBps,
            mihomoDownBps,
            mihomoUpBps,
            mihomoTotalBytes,
            topRoute,
            topTarget,
            badges,
        });
    }
    return list.sort((a, b) => {
        const aWeight = a.activeConnections * 1_000_000 + a.hostDownBps + a.hostUpBps + a.mihomoDownBps + a.mihomoUpBps;
        const bWeight = b.activeConnections * 1_000_000 + b.hostDownBps + b.hostUpBps + b.mihomoDownBps + b.mihomoUpBps;
        return bWeight - aWeight;
    });
});
const filteredRows = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q)
        return rows.value;
    return rows.value.filter((row) => {
        const haystack = [row.displayName, row.ip, row.mac, row.topRoute, row.topTarget]
            .join(' ')
            .toLowerCase();
        return haystack.includes(q);
    });
});
const __VLS_exposed = {
    rows,
    agentLive,
    lastAgentUpdateAt,
    notice,
    error,
    refreshAll,
};
defineExpose(__VLS_exposed);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-3 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('trafficClientStateTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('trafficClientStateTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "input input-sm flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('search'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.query),
    ...{ class: "grow bg-transparent" },
    type: "text",
    placeholder: (__VLS_ctx.$t('trafficClientStateSearchPlaceholder')),
});
/** @type {__VLS_StyleScopedClasses['grow']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-transparent']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshAll) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('refresh'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2 text-xs opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge" },
    ...{ class: (__VLS_ctx.agentLive ? 'badge-info' : 'badge-ghost') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
(__VLS_ctx.agentLive ? __VLS_ctx.$t('trafficDataSourceAgentLive') : __VLS_ctx.$t('trafficDataSourceMihomoOnly'));
if (__VLS_ctx.hostsKnown) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('trafficDataSourceLanHosts'));
    (__VLS_ctx.hostsKnown);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
(__VLS_ctx.$t('updated'));
(__VLS_ctx.updatedLabel);
if (__VLS_ctx.notice) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2 text-sm opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.notice);
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.error);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "overflow-x-auto rounded-lg border border-base-content/10 bg-base-100/40" },
});
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "table table-sm" },
});
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('host'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('trafficClientStateTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('trafficClientStateConnections'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('trafficClientStateHostTraffic'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('trafficClientStateMihomoTraffic'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('trafficClientStateRoute'));
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [row] of __VLS_vFor((__VLS_ctx.filteredRows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (row.ip),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "min-w-[220px]" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-[220px]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-0.5" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (row.displayName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono text-[11px] opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (row.ip);
    if (row.mac) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono text-[11px] opacity-50" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
        (row.mac);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    for (const [badge] of __VLS_vFor((row.badges))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            key: (`${row.ip}-${badge.key}`),
            ...{ class: "badge badge-xs" },
            ...{ class: (badge.className) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (badge.label);
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, query, refreshAll, loading, loading, agentLive, agentLive, hostsKnown, hostsKnown, updatedLabel, notice, notice, error, error, filteredRows,];
    }
    if (!row.badges.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.$t('idle'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs sm:text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('activeConnections'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (row.activeConnections);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('closedConnections'));
    (row.closedConnections);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs sm:text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.formatRate(row.hostDownBps));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.formatRate(row.hostUpBps));
    if (row.vpnDownBps || row.vpnUpBps) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('routerTrafficVpn'));
        (__VLS_ctx.formatRate(row.vpnDownBps));
        (__VLS_ctx.formatRate(row.vpnUpBps));
    }
    if (row.bypassDownBps || row.bypassUpBps) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('routerTrafficBypass'));
        (__VLS_ctx.formatRate(row.bypassDownBps));
        (__VLS_ctx.formatRate(row.bypassUpBps));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs sm:text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.formatRate(row.mihomoDownBps));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.formatRate(row.mihomoUpBps));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.formatBytes(row.mihomoTotalBytes));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "min-w-[220px]" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-[220px]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-0.5 text-xs sm:text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (row.topRoute || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (row.topTarget || '—');
    // @ts-ignore
    [$t, $t, $t, $t, $t, formatRate, formatRate, formatRate, formatRate, formatRate, formatRate, formatRate, formatRate, formatBytes,];
}
if (!__VLS_ctx.filteredRows.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "6",
        ...{ class: "py-6 text-center text-sm opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('trafficClientStateNoRows'));
}
// @ts-ignore
[$t, filteredRows,];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
});
export default {};
