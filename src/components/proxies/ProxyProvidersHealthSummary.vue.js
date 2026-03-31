/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { getProviderHealth } from '@/helper/providerHealth';
import { isMiddleScreen } from '@/helper/utils';
import { normalizeProxyProtoKey, protoLabel } from '@/helper/proxyProto';
import { PROXY_TAB_TYPE } from '@/constant';
import { proxiesTabShow, proxyGroupList, proxyMap, proxyProviederList } from '@/store/proxies';
import { providerActivityByName, providerLiveStatusByName } from '@/store/providerActivity';
import { hideUnusedProxyProviders, hiddenProxyProviderProtoKeys, proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings';
import { agentProviderByName, agentProviders, agentProvidersAt, agentProvidersError, agentProvidersLoading, agentProvidersOk, agentProvidersSslCacheReady, agentProvidersSslRefreshPending, agentProvidersSslRefreshing, fetchAgentProviders, providerHealthFilter, proxyProvidersSortMode, showOnlyActiveProxyProviders, showOnlyTrafficProxyProviders, proxyProvidersProtoFilter, } from '@/store/providerHealth';
import dayjs from 'dayjs';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const props = withDefaults(defineProps(), {
    compact: false,
});
const { t } = useI18n();
const usedProxyNames = computed(() => {
    const set = new Set();
    for (const g of proxyGroupList.value) {
        for (const n of proxyMap.value[g]?.all || [])
            set.add(n);
    }
    return set;
});
const isUsed = (provider) => {
    if (usedProxyNames.value.has(provider.name))
        return true;
    return (provider.proxies || []).some((p) => {
        const name = typeof p === 'string' ? p : p?.name;
        return name ? usedProxyNames.value.has(name) : false;
    });
};
const allProviders = computed(() => proxyProviederList.value || []);
const providersAfterHideUnused = computed(() => {
    let list = allProviders.value || [];
    if (hideUnusedProxyProviders.value) {
        list = list.filter((p) => isUsed(p));
    }
    return list;
});
const providerMatchesProto = (provider, protoKeyRaw) => {
    const protoKey = normalizeProxyProtoKey(String(protoKeyRaw || 'all')) || 'all';
    if (protoKey === 'all')
        return true;
    const providerProto = normalizeProxyProtoKey(provider?.type);
    if (providerProto === protoKey)
        return true;
    return (provider?.proxies || []).some((n) => {
        const t0 = typeof n === 'string' ? proxyMap.value[n]?.type : n?.type;
        return normalizeProxyProtoKey(t0) === protoKey;
    });
};
const selectedProto = computed(() => String(proxyProvidersProtoFilter.value || 'all').trim());
const providersProtoScoped = computed(() => {
    return (providersAfterHideUnused.value || []).filter((p) => providerMatchesProto(p, selectedProto.value));
});
const isProviderActive = (provider) => {
    const act = (providerActivityByName.value || {})[provider?.name];
    const live = (providerLiveStatusByName.value || {})[provider?.name];
    return Boolean(live?.active)
        || Number(live?.connections ?? 0) > 0
        || Boolean(act?.active)
        || Number(act?.connections ?? 0) > 0
        || Number(act?.currentBytes ?? 0) > 0
        || Number(act?.speed ?? 0) > 0
        || Number(act?.bytes ?? 0) > 0;
};
const isProviderWithTraffic = (provider) => {
    const act = (providerActivityByName.value || {})[provider?.name];
    const live = (providerLiveStatusByName.value || {})[provider?.name];
    return Number(act?.todayBytes ?? 0) > 0
        || Number(act?.bytes ?? 0) > 0
        || Number(act?.currentBytes ?? 0) > 0
        || Number(act?.speed ?? 0) > 0
        || Boolean(live?.active)
        || Number(live?.connections ?? 0) > 0;
};
const activeProvidersScoped = computed(() => {
    return (providersProtoScoped.value || []).filter((p) => isProviderActive(p));
});
const trafficProvidersScoped = computed(() => {
    return (providersProtoScoped.value || []).filter((p) => isProviderWithTraffic(p));
});
const providersScoped = computed(() => {
    let list = providersProtoScoped.value || [];
    if (showOnlyActiveProxyProviders.value) {
        list = list.filter((p) => isProviderActive(p));
    }
    if (showOnlyTrafficProxyProviders.value) {
        list = list.filter((p) => isProviderWithTraffic(p));
    }
    return list;
});
const hiddenUnusedCount = computed(() => {
    if (!hideUnusedProxyProviders.value)
        return 0;
    return Math.max(0, (allProviders.value.length || 0) - (providersAfterHideUnused.value.length || 0));
});
const counts = computed(() => {
    const c = { total: 0, expired: 0, nearExpiry: 0, offline: 0, degraded: 0, healthy: 0 };
    for (const p of providersScoped.value) {
        c.total++;
        const override = Number((proxyProviderSslWarnDaysMap.value || {})[p.name]);
        const base = Number(sslNearExpiryDaysDefault.value);
        const nearDays = Number.isFinite(override) ? override : Number.isFinite(base) ? base : 2;
        const h = getProviderHealth(p, agentProviderByName.value[p.name], { nearExpiryDays: nearDays });
        c[h.status]++;
    }
    return c;
});
const protoTabs = computed(() => {
    const m = new Map();
    for (const p of providersAfterHideUnused.value || []) {
        const seen = new Set();
        for (const n of (p?.proxies || [])) {
            const t0 = typeof n === 'string' ? proxyMap.value[n]?.type : n?.type;
            const k = normalizeProxyProtoKey(t0);
            if (k)
                seen.add(k);
        }
        for (const k of seen) {
            m.set(k, (m.get(k) || 0) + 1);
        }
    }
    const arr = Array.from(m.entries()).map(([key, count]) => ({
        key,
        label: protoLabel(key),
        count,
    }));
    arr.sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key));
    const out = [{ key: 'all', label: '', count: providersAfterHideUnused.value.length }];
    out.push(...arr);
    return out;
});
const hiddenProtoSet = computed(() => {
    const raw = hiddenProxyProviderProtoKeys.value || [];
    const out = new Set();
    for (const k of raw) {
        const kk = normalizeProxyProtoKey(String(k || ''));
        if (kk && kk !== 'all')
            out.add(kk);
    }
    return out;
});
const protoTabsVisible = computed(() => {
    const hidden = hiddenProtoSet.value;
    const tabs = protoTabs.value || [];
    return tabs.filter((t) => String(t?.key) === 'all' || !hidden.has(String(t?.key)));
});
const manageableProtoTabs = computed(() => {
    return (protoTabs.value || []).filter((t) => String(t?.key) !== 'all');
});
const setHiddenProtoKeys = (keys) => {
    const set = new Set();
    for (const x of keys || []) {
        const k = normalizeProxyProtoKey(String(x || ''));
        if (k && k !== 'all')
            set.add(k);
    }
    hiddenProxyProviderProtoKeys.value = Array.from(set).sort((a, b) => a.localeCompare(b));
};
const presetShowAllProtos = () => {
    hiddenProxyProviderProtoKeys.value = [];
};
const presetHideDirectReject = () => {
    // overwrite to exactly DIRECT+REJECT (if they exist)
    const available = new Set((manageableProtoTabs.value || []).map((t) => String(t?.key)));
    const keys = ['direct', 'reject'].filter((k) => available.has(k));
    setHiddenProtoKeys(keys);
};
const toggleProtoHidden = (k0) => {
    const k = normalizeProxyProtoKey(String(k0 || ''));
    if (!k || k === 'all')
        return;
    const cur = Array.isArray(hiddenProxyProviderProtoKeys.value) ? [...hiddenProxyProviderProtoKeys.value] : [];
    const set = new Set();
    for (const x of cur) {
        const kk = normalizeProxyProtoKey(String(x || ''));
        if (kk && kk !== 'all')
            set.add(kk);
    }
    if (set.has(k))
        set.delete(k);
    else
        set.add(k);
    hiddenProxyProviderProtoKeys.value = Array.from(set).sort((a, b) => a.localeCompare(b));
};
const setProto = (k) => {
    proxyProvidersProtoFilter.value = k || 'all';
};
watch(protoTabsVisible, (tabs) => {
    const keys = new Set((tabs || []).map((t) => String(t.key)));
    const cur = String(proxyProvidersProtoFilter.value || 'all');
    if (!keys.has(cur))
        proxyProvidersProtoFilter.value = 'all';
}, { immediate: true });
const activeProvidersCount = computed(() => activeProvidersScoped.value.length);
const trafficProvidersCount = computed(() => trafficProvidersScoped.value.length);
const lastAgentUpdate = computed(() => {
    if (!agentProvidersAt.value)
        return '';
    return dayjs(agentProvidersAt.value).format('HH:mm:ss');
});
const agentProvidersAvailable = computed(() => agentProvidersOk.value || (agentProviders.value?.length || 0) > 0);
const providerSslRefreshingText = computed(() => {
    if (agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value)
        return t('providerSslRefreshing');
    if (!agentProvidersSslCacheReady.value && agentProvidersAvailable.value)
        return t('providerSslPending');
    return '';
});
const setFilter = (v) => {
    providerHealthFilter.value = providerHealthFilter.value === v ? '' : v;
};
const refresh = async () => {
    await fetchAgentProviders(true);
};
const show = computed(() => proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER);
const isViewportCompact = computed(() => props.compact || isMiddleScreen.value);
const scrolledCondensed = ref(false);
let scrollRaf = 0;
const updateScrollCondensed = () => {
    if (typeof window === 'undefined')
        return;
    const y = window.scrollY || window.pageYOffset || 0;
    scrolledCondensed.value = y > 180;
};
const handleViewportScroll = () => {
    if (typeof window === 'undefined')
        return;
    if (scrollRaf)
        return;
    scrollRaf = window.requestAnimationFrame(() => {
        scrollRaf = 0;
        updateScrollCondensed();
    });
};
onMounted(() => {
    updateScrollCondensed();
    if (typeof window === 'undefined')
        return;
    window.addEventListener('scroll', handleViewportScroll, { passive: true });
    window.addEventListener('resize', handleViewportScroll, { passive: true });
});
onBeforeUnmount(() => {
    if (typeof window === 'undefined')
        return;
    window.removeEventListener('scroll', handleViewportScroll);
    window.removeEventListener('resize', handleViewportScroll);
    if (scrollRaf) {
        window.cancelAnimationFrame(scrollRaf);
        scrollRaf = 0;
    }
});
const miniToolbar = computed(() => isViewportCompact.value || scrolledCondensed.value);
const wrapperClass = computed(() => [
    'sticky top-0 z-30 -mx-2 px-2 pb-2 transition-all duration-150',
    miniToolbar.value
        ? 'bg-base-100/75 supports-[backdrop-filter]:bg-base-100/55 backdrop-blur-md shadow-sm'
        : 'bg-transparent',
]);
const panelClass = computed(() => [
    'flex flex-wrap items-center rounded-xl ring-1 ring-base-300 transition-all duration-150',
    miniToolbar.value
        ? 'gap-1.5 bg-base-200/95 px-2.5 py-2 shadow-lg sm:gap-2 sm:px-3'
        : 'gap-2 bg-base-200 px-3 py-2 shadow-md',
]);
const protoRowClass = computed(() => miniToolbar.value
    ? 'flex w-full flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2'
    : 'flex w-full flex-wrap items-center gap-2');
const protoTabsWrapClass = computed(() => miniToolbar.value
    ? 'w-full overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0'
    : '');
const healthSectionClass = computed(() => miniToolbar.value
    ? 'flex w-full flex-col gap-1.5 sm:w-auto sm:flex-1'
    : 'flex flex-1 flex-wrap items-center gap-2');
const actionsClass = computed(() => miniToolbar.value
    ? 'flex w-full flex-wrap items-center gap-1.5 sm:ml-auto sm:w-auto sm:gap-2'
    : 'ml-auto flex items-center gap-2');
const compactBadgeClass = computed(() => miniToolbar.value ? 'badge-sm text-[11px]' : '');
const compactSelectClass = computed(() => miniToolbar.value ? 'select-bordered select-xs min-w-[7.5rem] flex-1 sm:flex-none' : 'select-bordered select-xs');
const compactMetaClass = computed(() => miniToolbar.value ? 'w-full text-[11px] opacity-70 sm:w-auto sm:text-xs' : 'text-xs opacity-70');
const compactMetaWarningClass = computed(() => miniToolbar.value ? 'w-full text-[11px] text-warning sm:w-auto sm:text-xs' : 'text-xs text-warning');
const __VLS_defaults = {
    compact: false,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.show) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.wrapperClass) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.panelClass) },
    });
    if (__VLS_ctx.protoTabs.length > 1) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: (__VLS_ctx.protoRowClass) },
            'data-proto-tabs': true,
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: (__VLS_ctx.protoTabsWrapClass) },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tabs tabs-boxed tabs-sm inline-flex whitespace-nowrap" },
        });
        /** @type {__VLS_StyleScopedClasses['tabs']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabs-boxed']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabs-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        for (const [t2] of __VLS_vFor((__VLS_ctx.protoTabsVisible))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!(__VLS_ctx.protoTabs.length > 1))
                            return;
                        __VLS_ctx.setProto(t2.key);
                        // @ts-ignore
                        [show, wrapperClass, panelClass, protoTabs, protoRowClass, protoTabsWrapClass, protoTabsVisible, setProto,];
                    } },
                key: (t2.key),
                ...{ class: "tab" },
                ...{ class: (__VLS_ctx.proxyProvidersProtoFilter === t2.key ? 'tab-active' : '') },
                title: (t2.key === 'all' ? __VLS_ctx.$t('all') : (t2.label + ': ' + t2.count)),
            });
            /** @type {__VLS_StyleScopedClasses['tab']} */ ;
            if (t2.key === 'all') {
                (__VLS_ctx.$t('all'));
            }
            else {
                (t2.label);
                (t2.count);
            }
            // @ts-ignore
            [proxyProvidersProtoFilter, $t, $t,];
        }
        if (!__VLS_ctx.miniToolbar) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[11px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('providerProtoTip'));
        }
        if (__VLS_ctx.manageableProtoTabs.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: (__VLS_ctx.miniToolbar ? 'flex justify-end' : 'ml-auto') },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                ...{ class: "dropdown dropdown-end" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown']} */ ;
            /** @type {__VLS_StyleScopedClasses['dropdown-end']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
                ...{ onClick: () => { } },
                ...{ class: "btn btn-ghost btn-xs" },
                title: (__VLS_ctx.$t('providerProtoManage')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "dropdown-content z-[999] mt-2 w-64 rounded-box !bg-base-100 !bg-opacity-100 opacity-100 p-2 shadow-2xl ring-1 ring-base-300 backdrop-blur-none" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-content']} */ ;
            /** @type {__VLS_StyleScopedClasses['z-[999]']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-64']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
            /** @type {__VLS_StyleScopedClasses['!bg-base-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['!bg-opacity-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-base-300']} */ ;
            /** @type {__VLS_StyleScopedClasses['backdrop-blur-none']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-xs font-medium mb-1" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
            (__VLS_ctx.$t('providerProtoManage'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[11px] opacity-70 mb-2" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
            (__VLS_ctx.$t('providerProtoTip'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2 mb-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.presetShowAllProtos) },
                type: "button",
                ...{ class: "btn btn-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('providerProtoShowAll'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.presetHideDirectReject) },
                type: "button",
                ...{ class: "btn btn-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('providerProtoHideDirectReject'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "max-h-64 overflow-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['max-h-64']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            for (const [t2] of __VLS_vFor((__VLS_ctx.manageableProtoTabs))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (t2.key),
                    ...{ class: "flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-base-300" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-base-300']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: (...[$event]) => {
                            if (!(__VLS_ctx.show))
                                return;
                            if (!(__VLS_ctx.protoTabs.length > 1))
                                return;
                            if (!(__VLS_ctx.manageableProtoTabs.length))
                                return;
                            __VLS_ctx.toggleProtoHidden(String(t2.key));
                            // @ts-ignore
                            [$t, $t, $t, $t, $t, $t, miniToolbar, miniToolbar, manageableProtoTabs, manageableProtoTabs, presetShowAllProtos, presetHideDirectReject, toggleProtoHidden,];
                        } },
                    type: "checkbox",
                    ...{ class: "checkbox checkbox-xs" },
                    checked: (!__VLS_ctx.hiddenProtoSet.has(String(t2.key))),
                });
                /** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
                /** @type {__VLS_StyleScopedClasses['checkbox-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                (t2.label);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "ml-auto text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (t2.count);
                // @ts-ignore
                [hiddenProtoSet,];
            }
            if (!__VLS_ctx.manageableProtoTabs.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-xs opacity-60 px-2 py-1" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                (__VLS_ctx.$t('noData'));
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "w-full" },
    });
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.healthSectionClass) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.$t('providerHealth'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.setFilter('');
                // @ts-ignore
                [$t, $t, manageableProtoTabs, healthSectionClass, setFilter,];
            } },
        ...{ class: "badge badge-neutral cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.providerHealthFilter === '' ? 'badge-outline' : '']) },
        title: (__VLS_ctx.$t('providerHealthAll')),
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerHealthAll'));
    (__VLS_ctx.counts.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.setFilter('expired');
                // @ts-ignore
                [$t, $t, setFilter, compactBadgeClass, providerHealthFilter, counts,];
            } },
        ...{ class: "badge badge-error cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.providerHealthFilter === 'expired' ? '' : 'badge-outline']) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerHealthExpired'));
    (__VLS_ctx.counts.expired);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.setFilter('nearExpiry');
                // @ts-ignore
                [$t, setFilter, compactBadgeClass, providerHealthFilter, counts,];
            } },
        ...{ class: "badge badge-warning cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.providerHealthFilter === 'nearExpiry' ? '' : 'badge-outline']) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerHealthNearExpiry'));
    (__VLS_ctx.counts.nearExpiry);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.setFilter('offline');
                // @ts-ignore
                [$t, setFilter, compactBadgeClass, providerHealthFilter, counts,];
            } },
        ...{ class: "badge badge-error cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.providerHealthFilter === 'offline' ? '' : 'badge-outline']) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerHealthOffline'));
    (__VLS_ctx.counts.offline);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.setFilter('degraded');
                // @ts-ignore
                [$t, setFilter, compactBadgeClass, providerHealthFilter, counts,];
            } },
        ...{ class: "badge badge-warning cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.providerHealthFilter === 'degraded' ? '' : 'badge-outline']) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerHealthDegraded'));
    (__VLS_ctx.counts.degraded);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.setFilter('healthy');
                // @ts-ignore
                [$t, setFilter, compactBadgeClass, providerHealthFilter, counts,];
            } },
        ...{ class: "badge badge-success cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.providerHealthFilter === 'healthy' ? '' : 'badge-outline']) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerHealthHealthy'));
    (__VLS_ctx.counts.healthy);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.actionsClass) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.hideUnusedProxyProviders = !__VLS_ctx.hideUnusedProxyProviders;
                // @ts-ignore
                [$t, compactBadgeClass, providerHealthFilter, counts, actionsClass, hideUnusedProxyProviders, hideUnusedProxyProviders,];
            } },
        ...{ class: "badge badge-neutral cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.hideUnusedProxyProviders ? '' : 'badge-outline']) },
        title: (__VLS_ctx.$t('providerHideUnusedTip')),
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerHideUnused'));
    if (__VLS_ctx.hiddenUnusedCount > 0) {
        (__VLS_ctx.$t('providerHiddenCount', { n: __VLS_ctx.hiddenUnusedCount }));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.showOnlyActiveProxyProviders = !__VLS_ctx.showOnlyActiveProxyProviders;
                // @ts-ignore
                [$t, $t, $t, compactBadgeClass, hideUnusedProxyProviders, hiddenUnusedCount, hiddenUnusedCount, showOnlyActiveProxyProviders, showOnlyActiveProxyProviders,];
            } },
        ...{ class: "badge badge-neutral cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.showOnlyActiveProxyProviders ? '' : 'badge-outline']) },
        title: (__VLS_ctx.$t('providerOnlyActiveTip')),
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerOnlyActive'));
    (__VLS_ctx.activeProvidersCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.showOnlyTrafficProxyProviders = !__VLS_ctx.showOnlyTrafficProxyProviders;
                // @ts-ignore
                [$t, $t, compactBadgeClass, showOnlyActiveProxyProviders, activeProvidersCount, showOnlyTrafficProxyProviders, showOnlyTrafficProxyProviders,];
            } },
        ...{ class: "badge badge-neutral cursor-pointer" },
        ...{ class: ([__VLS_ctx.compactBadgeClass, __VLS_ctx.showOnlyTrafficProxyProviders ? '' : 'badge-outline']) },
        title: (__VLS_ctx.$t('providerOnlyTrafficTip')),
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-neutral']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    (__VLS_ctx.$t('providerOnlyTraffic'));
    (__VLS_ctx.trafficProvidersCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select" },
        ...{ class: (__VLS_ctx.compactSelectClass) },
        value: (__VLS_ctx.proxyProvidersSortMode),
        title: (__VLS_ctx.$t('sortBy')),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "health",
    });
    (__VLS_ctx.$t('providerSortHealth'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "traffic",
    });
    (__VLS_ctx.$t('providerSortTraffic'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "activity",
    });
    (__VLS_ctx.$t('providerSortActivity'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "name",
    });
    (__VLS_ctx.$t('providerSortName'));
    if (__VLS_ctx.agentProvidersAvailable) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: (__VLS_ctx.compactMetaClass) },
            title: (__VLS_ctx.$t('lastCheck')),
        });
        (__VLS_ctx.$t('updated'));
        (__VLS_ctx.lastAgentUpdate);
    }
    if (__VLS_ctx.providerSslRefreshingText) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "badge badge-info badge-outline" },
            ...{ class: (__VLS_ctx.compactBadgeClass) },
            title: (__VLS_ctx.$t('providerSslRefreshingTip')),
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        (__VLS_ctx.providerSslRefreshingText);
    }
    else if (__VLS_ctx.agentProvidersError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: (__VLS_ctx.compactMetaWarningClass) },
            title: (__VLS_ctx.agentProvidersError),
        });
        (__VLS_ctx.$t('providerHealthAgentOffline'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refresh) },
        ...{ class: "btn btn-ghost btn-xs" },
        ...{ class: (__VLS_ctx.miniToolbar ? 'ml-auto sm:ml-0' : '') },
        disabled: (__VLS_ctx.agentProvidersLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    if (__VLS_ctx.agentProvidersLoading) {
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
}
// @ts-ignore
[$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, miniToolbar, compactBadgeClass, compactBadgeClass, showOnlyTrafficProxyProviders, trafficProvidersCount, compactSelectClass, proxyProvidersSortMode, agentProvidersAvailable, compactMetaClass, lastAgentUpdate, providerSslRefreshingText, providerSslRefreshingText, agentProvidersError, agentProvidersError, compactMetaWarningClass, refresh, agentProvidersLoading, agentProvidersLoading,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
