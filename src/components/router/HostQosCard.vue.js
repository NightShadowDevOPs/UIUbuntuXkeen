/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { agentHostTrafficLiveAPI, agentLanHostsAPI, agentQosStatusAPI, agentRemoveHostQosAPI, agentSetHostQosAPI, agentStatusAPI, } from '@/api/agent';
import { getIPLabelFromMap } from '@/helper/sourceip';
import { prettyBytesHelper } from '@/helper/utils';
import { agentEnabled } from '@/store/agent';
import { activeConnections } from '@/store/connections';
import { mergeRouterHostQosAppliedProfiles, routerHostQosAppliedProfiles, routerHostQosDraftProfiles, routerHostQosExpanded, setRouterHostQosAppliedProfile } from '@/store/routerHostQos';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const profileOrder = ['critical', 'high', 'elevated', 'normal', 'low', 'background'];
const { t } = useI18n();
const loading = ref(false);
const error = ref('');
const query = ref('');
const status = ref({ ok: false });
const qos = ref({ ok: false, supported: false, items: [] });
const hosts = ref([]);
const traffic = ref([]);
const draftProfiles = routerHostQosDraftProfiles;
const appliedProfiles = routerHostQosAppliedProfiles;
const busyIp = ref('');
const expanded = routerHostQosExpanded;
let timer;
const qosMap = computed(() => {
    const out = {};
    for (const item of qos.value.items || [])
        out[item.ip] = item;
    return out;
});
const rows = computed(() => {
    const hostMap = new Map();
    for (const host of hosts.value)
        hostMap.set(host.ip, host);
    const trafficMap = new Map();
    for (const item of traffic.value)
        trafficMap.set(item.ip, item);
    const activeConnectionIps = (activeConnections.value || [])
        .map((conn) => String(conn?.metadata?.sourceIP || '').trim())
        .filter(Boolean);
    const ips = new Set([
        ...Array.from(hostMap.keys()),
        ...Array.from(trafficMap.keys()),
        ...Object.keys(qosMap.value),
        ...Object.keys(appliedProfiles.value),
        ...activeConnectionIps,
    ]);
    return Array.from(ips)
        .map((ip) => {
        const host = hostMap.get(ip) || { ip };
        const live = trafficMap.get(ip) || { ip };
        const meta = qosMap.value[ip];
        const mappedLabel = getIPLabelFromMap(ip);
        const displayName = mappedLabel && mappedLabel !== ip ? mappedLabel : host.hostname || live.hostname || ip;
        return {
            ...host,
            ...live,
            ip,
            displayName,
            hostname: host.hostname || live.hostname || '',
            currentProfile: meta?.profile || appliedProfiles.value[ip],
            qosMeta: meta,
        };
    })
        .sort((a, b) => {
        const an = String(a.displayName || a.hostname || a.ip).toLowerCase();
        const bn = String(b.displayName || b.hostname || b.ip).toLowerCase();
        return an.localeCompare(bn);
    });
});
const filteredRows = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q)
        return rows.value;
    return rows.value.filter((row) => {
        return [row.displayName, row.hostname, row.ip, row.mac, row.currentProfile]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q));
    });
});
const appliedCount = computed(() => (qos.value.items || []).length);
const syncAppliedProfiles = () => {
    const next = {};
    for (const item of qos.value.items || []) {
        if (item?.ip && item?.profile)
            next[item.ip] = item.profile;
    }
    mergeRouterHostQosAppliedProfiles(next);
};
const ensureDrafts = () => {
    const next = { ...draftProfiles.value };
    for (const row of rows.value) {
        if (!next[row.ip])
            next[row.ip] = row.currentProfile || appliedProfiles.value[row.ip] || 'normal';
    }
    draftProfiles.value = next;
};
const formatRate = (bps) => {
    const n = Number(bps || 0);
    if (!Number.isFinite(n) || n <= 0)
        return '0 B/s';
    return `${prettyBytesHelper(n)}/s`;
};
const profileLabel = (profile) => {
    if (profile === 'critical')
        return t('hostQosCritical');
    if (profile === 'high')
        return t('hostQosHigh');
    if (profile === 'elevated')
        return t('hostQosElevated');
    if (profile === 'low')
        return t('hostQosLow');
    if (profile === 'background')
        return t('hostQosBackground');
    return t('hostQosNormal');
};
const profileIcon = (profile) => {
    if (profile === 'critical')
        return '⏫';
    if (profile === 'high')
        return '⬆';
    if (profile === 'elevated')
        return '↗';
    if (profile === 'low')
        return '↘';
    if (profile === 'background')
        return '⬇';
    return '•';
};
const qosLevel = (profile) => {
    if (profile === 'critical')
        return 6;
    if (profile === 'high')
        return 5;
    if (profile === 'elevated')
        return 4;
    if (profile === 'low')
        return 2;
    if (profile === 'background')
        return 1;
    return 3;
};
const profileBadgeClass = (profile) => {
    if (profile === 'critical')
        return 'badge-error';
    if (profile === 'high')
        return 'badge-success';
    if (profile === 'elevated')
        return 'badge-accent';
    if (profile === 'low')
        return 'badge-warning';
    if (profile === 'background')
        return 'badge-ghost';
    return 'badge-info';
};
const profilePillClass = (profile) => {
    if (profile === 'critical')
        return 'border-error/30 bg-error/10 text-error';
    if (profile === 'high')
        return 'border-success/30 bg-success/10 text-success';
    if (profile === 'elevated')
        return 'border-accent/30 bg-accent/10 text-accent';
    if (profile === 'low')
        return 'border-warning/30 bg-warning/10 text-warning';
    if (profile === 'background')
        return 'border-base-content/10 bg-base-200/50 text-base-content/70';
    return 'border-info/30 bg-info/10 text-info';
};
const profileBarClass = (profile) => {
    if (profile === 'critical')
        return 'bg-error';
    if (profile === 'high')
        return 'bg-success';
    if (profile === 'elevated')
        return 'bg-accent';
    if (profile === 'low')
        return 'bg-warning';
    if (profile === 'background')
        return 'bg-base-content/45';
    return 'bg-info';
};
const qosIndicatorBars = (profile) => {
    const active = qosLevel(profile);
    return [6, 8, 10, 12, 14, 16].map((height, index) => ({
        key: String(index),
        height,
        active: index < active,
    }));
};
const hasQosDefault = (profile) => Boolean(qos.value.defaults?.[profile]);
const profileSummary = (profile) => {
    const item = qos.value.defaults?.[profile];
    if (!item)
        return '—';
    return `${item.pct || 0}% · prio ${item.priority ?? '—'}`;
};
const refreshAll = async () => {
    if (!agentEnabled.value)
        return;
    loading.value = true;
    error.value = '';
    try {
        const [st, q, h, tr] = await Promise.all([
            agentStatusAPI(),
            agentQosStatusAPI(),
            agentLanHostsAPI(),
            agentHostTrafficLiveAPI(),
        ]);
        status.value = { ok: !!st.ok, hostQos: !!st.hostQos };
        qos.value = q.ok ? q : { ok: false, supported: false, items: [], error: q.error };
        if (q.ok)
            syncAppliedProfiles();
        hosts.value = h.ok && h.items ? h.items : [];
        traffic.value = tr.ok && tr.items ? tr.items : [];
        ensureDrafts();
        if (!st.ok)
            error.value = st.error || t('agentOfflineTip');
        else if (!q.ok)
            error.value = q.error || t('hostQosStatusFailed');
    }
    finally {
        loading.value = false;
    }
};
const applyRow = async (ip) => {
    const profile = draftProfiles.value[ip];
    if (!profile)
        return;
    busyIp.value = ip;
    error.value = '';
    try {
        const res = await agentSetHostQosAPI({ ip, profile });
        if (!res.ok) {
            error.value = res.error || t('hostQosApplyFailed');
            return;
        }
        setRouterHostQosAppliedProfile(ip, profile);
        draftProfiles.value = { ...draftProfiles.value, [ip]: profile };
        await refreshAll();
    }
    finally {
        busyIp.value = '';
    }
};
const clearRow = async (ip) => {
    busyIp.value = ip;
    error.value = '';
    try {
        const res = await agentRemoveHostQosAPI(ip);
        if (!res.ok) {
            error.value = res.error || t('hostQosApplyFailed');
            return;
        }
        setRouterHostQosAppliedProfile(ip);
        draftProfiles.value = { ...draftProfiles.value, [ip]: 'normal' };
        await refreshAll();
    }
    finally {
        busyIp.value = '';
    }
};
watch(rows, () => {
    ensureDrafts();
}, { deep: true });
watch(appliedProfiles, () => {
    ensureDrafts();
}, { deep: true });
const restartPolling = () => {
    if (timer)
        window.clearInterval(timer);
    timer = undefined;
    if (!expanded.value)
        return;
    timer = window.setInterval(() => {
        void refreshAll();
    }, 8000);
};
watch(expanded, async (value) => {
    restartPolling();
    if (value)
        await refreshAll();
});
onMounted(async () => {
    await refreshAll();
    restartPolling();
});
onBeforeUnmount(() => {
    if (timer)
        window.clearInterval(timer);
});
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
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('hostQosTitle'));
if (!__VLS_ctx.agentEnabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('disabled'));
}
else if (__VLS_ctx.status.ok && (__VLS_ctx.qos.supported || __VLS_ctx.status.hostQos)) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-success" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
    (__VLS_ctx.$t('online'));
}
else if (__VLS_ctx.status.ok && !(__VLS_ctx.qos.supported || __VLS_ctx.status.hostQos)) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-warning" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-error" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
    (__VLS_ctx.$t('offline'));
}
if (__VLS_ctx.qos.qosMode === 'wan-only') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-info" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
for (const [profile] of __VLS_vFor((__VLS_ctx.profileOrder))) {
    (`legend-${profile}`);
    if (__VLS_ctx.hasQosDefault(profile)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.profileLabel(profile));
        (__VLS_ctx.profileSummary(profile));
    }
    // @ts-ignore
    [$t, $t, $t, $t, agentEnabled, status, status, status, status, qos, qos, qos, profileOrder, hasQosDefault, profileLabel, profileSummary,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
(__VLS_ctx.$t('hostQosTrackedHosts', { count: __VLS_ctx.rows.length }));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
(__VLS_ctx.$t('hostQosAppliedHosts', { count: __VLS_ctx.appliedCount }));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.expanded = !__VLS_ctx.expanded;
            // @ts-ignore
            [$t, $t, rows, appliedCount, expanded, expanded,];
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.expanded ? __VLS_ctx.$t('collapse') : __VLS_ctx.$t('expand'));
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
if (!__VLS_ctx.agentEnabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('agentDisabledTip'));
}
else if (!__VLS_ctx.status.ok) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('agentOfflineTip'));
}
else if (!(__VLS_ctx.qos.supported || __VLS_ctx.status.hostQos)) {
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
    (__VLS_ctx.$t('hostQosNoTcTip'));
}
else if (!__VLS_ctx.expanded) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 text-sm opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('hostQosIntro'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 p-3 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('hostQosIntro'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-xs opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('hostQosShapeOverrideTip'));
    if (__VLS_ctx.qos.qosMode === 'wan-only') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-xs text-info/80" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-info/80']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-[minmax(0,1fr)_220px]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex min-w-0 flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('search'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-sm w-full" },
        placeholder: (__VLS_ctx.$t('hostQosSearchPlaceholder')),
    });
    (__VLS_ctx.query);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 text-xs opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('hostQosTrackedHosts', { count: __VLS_ctx.rows.length }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('hostQosAppliedHosts', { count: __VLS_ctx.appliedCount }));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('hostQosLineRates', { wan: __VLS_ctx.qos.wanRateMbit || '—', lan: __VLS_ctx.qos.lanRateMbit || '—' }));
    if (__VLS_ctx.qos.qosMode === 'wan-only') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    }
    if (__VLS_ctx.error) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-error/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-error/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
        (__VLS_ctx.error);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "overflow-x-auto rounded-lg border border-base-content/10 bg-base-100/50" },
    });
    /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
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
    (__VLS_ctx.$t('current'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    (__VLS_ctx.$t('hostQosLiveRate'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    (__VLS_ctx.$t('hostQosSetProfile'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    (__VLS_ctx.$t('actions'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [row] of __VLS_vFor((__VLS_ctx.filteredRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (row.ip),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "min-w-[240px]" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-[240px]']} */ ;
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
        (row.displayName || row.hostname || row.ip);
        if (row.currentProfile) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium" },
                ...{ class: (__VLS_ctx.profilePillClass(row.currentProfile)) },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                'aria-hidden': "true",
            });
            (__VLS_ctx.profileIcon(row.currentProfile));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-80" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-end gap-0.5" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
            for (const [bar] of __VLS_vFor((__VLS_ctx.qosIndicatorBars(row.currentProfile)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                    key: (`${row.ip}-title-${bar.key}`),
                    ...{ class: "w-1 rounded-full" },
                    ...{ class: (bar.active ? __VLS_ctx.profileBarClass(row.currentProfile) : 'bg-base-content/10') },
                    ...{ style: ({ height: `${bar.height}px` }) },
                });
                /** @type {__VLS_StyleScopedClasses['w-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, agentEnabled, status, status, qos, qos, qos, qos, qos, rows, appliedCount, expanded, expanded, refreshAll, loading, loading, query, error, error, filteredRows, profilePillClass, profileIcon, qosIndicatorBars, profileBarClass,];
            }
        }
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
        if (row.currentProfile) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium" },
                ...{ class: (__VLS_ctx.profilePillClass(row.currentProfile)) },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                'aria-hidden': "true",
            });
            (__VLS_ctx.profileIcon(row.currentProfile));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-80" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-end gap-0.5" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
            for (const [bar] of __VLS_vFor((__VLS_ctx.qosIndicatorBars(row.currentProfile)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                    key: (`${row.ip}-current-${bar.key}`),
                    ...{ class: "w-1 rounded-full" },
                    ...{ class: (bar.active ? __VLS_ctx.profileBarClass(row.currentProfile) : 'bg-base-content/10') },
                    ...{ style: ({ height: `${bar.height}px` }) },
                });
                /** @type {__VLS_StyleScopedClasses['w-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                // @ts-ignore
                [profilePillClass, profileIcon, qosIndicatorBars, profileBarClass,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.profileLabel(row.currentProfile));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('hostQosNotSet'));
        }
        if (row.qosMeta) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 flex flex-col gap-0.5 text-[11px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.$t('hostQosQueuePriority', { priority: row.qosMeta.priority ?? '—' }));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.$t('hostQosGuarantee', { up: row.qosMeta.upMinMbit || 0, down: row.qosMeta.downMinMbit || 0 }));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5 text-[11px] sm:text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.formatRate(row.totalDownBps));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.formatRate(row.totalUpBps));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.draftProfiles[row.ip]),
            ...{ class: "select select-sm min-w-[170px]" },
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-[170px]']} */ ;
        for (const [profile] of __VLS_vFor((__VLS_ctx.profileOrder))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (`${row.ip}-${profile}`),
                value: (profile),
            });
            (__VLS_ctx.profileLabel(profile));
            // @ts-ignore
            [$t, $t, $t, profileOrder, profileLabel, profileLabel, formatRate, formatRate, draftProfiles,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.profileSummary(__VLS_ctx.draftProfiles[row.ip] || 'normal'));
        if (__VLS_ctx.draftProfiles[row.ip] && __VLS_ctx.draftProfiles[row.ip] !== (row.currentProfile || 'normal')) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('hostQosWillApply', { profile: __VLS_ctx.profileLabel(__VLS_ctx.draftProfiles[row.ip]) }));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.agentEnabled))
                        return;
                    if (!!(!__VLS_ctx.status.ok))
                        return;
                    if (!!(!(__VLS_ctx.qos.supported || __VLS_ctx.status.hostQos)))
                        return;
                    if (!!(!__VLS_ctx.expanded))
                        return;
                    __VLS_ctx.applyRow(row.ip);
                    // @ts-ignore
                    [$t, profileLabel, profileSummary, draftProfiles, draftProfiles, draftProfiles, draftProfiles, applyRow,];
                } },
            type: "button",
            ...{ class: "btn btn-xs" },
            disabled: (__VLS_ctx.busyIp === row.ip || !__VLS_ctx.draftProfiles[row.ip]),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        if (__VLS_ctx.busyIp === row.ip) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "loading loading-spinner loading-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['loading']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.$t('apply'));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.agentEnabled))
                        return;
                    if (!!(!__VLS_ctx.status.ok))
                        return;
                    if (!!(!(__VLS_ctx.qos.supported || __VLS_ctx.status.hostQos)))
                        return;
                    if (!!(!__VLS_ctx.expanded))
                        return;
                    __VLS_ctx.clearRow(row.ip);
                    // @ts-ignore
                    [$t, draftProfiles, busyIp, busyIp, clearRow,];
                } },
            type: "button",
            ...{ class: "btn btn-ghost btn-xs" },
            disabled: (__VLS_ctx.busyIp === row.ip || !row.currentProfile),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('clear'));
        // @ts-ignore
        [$t, busyIp,];
    }
    if (!__VLS_ctx.filteredRows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            colspan: "5",
            ...{ class: "py-6 text-center text-sm opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('hostQosNoHosts'));
    }
}
// @ts-ignore
[$t, filteredRows,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
