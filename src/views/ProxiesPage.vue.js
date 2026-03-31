/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import ProxyGroup from '@/components/proxies/ProxyGroup.vue';
import ProxyGroupForMobile from '@/components/proxies/ProxyGroupForMobile.vue';
import ProxyProvider from '@/components/proxies/ProxyProvider.vue';
import ProxyProvidersHealthSummary from '@/components/proxies/ProxyProvidersHealthSummary.vue';
import { renderGroups } from '@/composables/proxies';
import { PROXY_TAB_TYPE, ROUTE_NAME } from '@/constant';
import { cleanupExpiredPendingPageFocus, clearPendingPageFocus, flashNavHighlight, getPendingPageFocusForRoute } from '@/helper/navFocus';
import { isMiddleScreen } from '@/helper/utils';
import { fetchProxies, proxyGroupList, proxyMap, proxiesTabShow } from '@/store/proxies';
import { collapseGroupMap, twoColumnProxyGroup, hideUnusedProxyProviders } from '@/store/settings';
import { providerHealthFilter, proxyProvidersProtoFilter, showOnlyActiveProxyProviders, showOnlyTrafficProxyProviders } from '@/store/providerHealth';
import { useElementSize, useSessionStorage } from '@vueuse/core';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
const proxiesRef = ref();
const { width } = useElementSize(proxiesRef);
const scrollStatus = useSessionStorage('cache/proxies-scroll-status', {
    [PROXY_TAB_TYPE.PROVIDER]: 0,
    [PROXY_TAB_TYPE.PROXIES]: 0,
});
const handleScroll = () => {
    scrollStatus.value[proxiesTabShow.value] = proxiesRef.value.scrollTop;
};
const isProviderToolbarCompact = computed(() => {
    return proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER && Number(scrollStatus.value[PROXY_TAB_TYPE.PROVIDER] || 0) > 12;
});
const waitTickUntilReady = (startTime = performance.now()) => {
    if (performance.now() - startTime > 300 ||
        proxiesRef.value.scrollHeight > scrollStatus.value[proxiesTabShow.value]) {
        proxiesRef.value.scrollTop = scrollStatus.value[proxiesTabShow.value];
    }
    else {
        requestAnimationFrame(() => {
            waitTickUntilReady(startTime);
        });
    }
};
watch(proxiesTabShow, () => nextTick(() => {
    waitTickUntilReady();
}));
onMounted(() => {
    waitTickUntilReady();
});
const isSmallScreen = computed(() => {
    return width.value < 640 && isMiddleScreen.value;
});
const isWidthEnough = computed(() => {
    return width.value > 720;
});
const renderComponent = computed(() => {
    if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
        return ProxyProvider;
    }
    if (isSmallScreen.value && displayTwoColumns.value) {
        return ProxyGroupForMobile;
    }
    return ProxyGroup;
});
const isProviderTab = computed(() => proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER);
const displayTwoColumns = computed(() => {
    // Two-column layout is used for proxy groups only.
    // Proxy-provider cards stay in a single vertical column so their heights can change
    // without reflowing adjacent cards during live refreshes.
    if (isProviderTab.value)
        return false;
    if (renderGroups.value.length < 2 || !twoColumnProxyGroup.value) {
        return false;
    }
    return (isWidthEnough.value || (isSmallScreen.value && proxiesTabShow.value === PROXY_TAB_TYPE.PROXIES));
});
const filterContent = (all, target) => {
    return all.filter((_, index) => index % 2 === target);
};
fetchProxies();
const resetProviderFilters = () => {
    providerHealthFilter.value = '';
    proxyProvidersProtoFilter.value = 'all';
    showOnlyActiveProxyProviders.value = false;
    showOnlyTrafficProxyProviders.value = false;
    hideUnusedProxyProviders.value = false;
};
// --- Cross-page navigation focus (Topology -> Proxies) ---
const findNavEl = (kind, value) => {
    const items = Array.from(document.querySelectorAll(`[data-nav-kind="${kind}"]`));
    return (items.find((el) => String(el.dataset?.navValue || '').trim() === String(value || '').trim()) ||
        null);
};
const findGroupForProxy = (proxyName) => {
    const name = String(proxyName || '').trim();
    if (!name)
        return '';
    for (const g of proxyGroupList.value || []) {
        const all = proxyMap.value?.[g]?.all || [];
        if (Array.isArray(all) && all.includes(name))
            return g;
    }
    return '';
};
let focusApplied = false;
const tryApplyPendingFocus = async () => {
    if (focusApplied)
        return;
    const pf = getPendingPageFocusForRoute(ROUTE_NAME.proxies);
    if (!pf)
        return;
    const v = String(pf.value || '').trim();
    if (!v)
        return;
    // Ensure correct tab and open the relevant card/group for better UX.
    if (pf.kind === 'provider') {
        if (proxiesTabShow.value !== PROXY_TAB_TYPE.PROVIDER)
            proxiesTabShow.value = PROXY_TAB_TYPE.PROVIDER;
        collapseGroupMap.value[v] = true;
    }
    else {
        if (proxiesTabShow.value !== PROXY_TAB_TYPE.PROXIES)
            proxiesTabShow.value = PROXY_TAB_TYPE.PROXIES;
    }
    // For a specific proxy node, open the group containing it (best-effort).
    let groupForNode = '';
    if (pf.kind === 'proxy') {
        groupForNode = findGroupForProxy(v);
        if (groupForNode)
            collapseGroupMap.value[groupForNode] = true;
    }
    if (pf.kind === 'proxyGroup') {
        collapseGroupMap.value[v] = true;
    }
    const start = performance.now();
    const loop = async () => {
        await nextTick();
        let el = null;
        if (pf.kind === 'provider')
            el = findNavEl('proxy-provider', v);
        else if (pf.kind === 'proxyGroup')
            el = findNavEl('proxy-group', v);
        else if (pf.kind === 'proxy') {
            el = findNavEl('proxy-node', v);
            if (!el && groupForNode)
                el = findNavEl('proxy-group', groupForNode);
        }
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            flashNavHighlight(el);
            clearPendingPageFocus();
            focusApplied = true;
            return;
        }
        if (performance.now() - start < 2400) {
            requestAnimationFrame(() => loop());
        }
    };
    loop();
};
onMounted(() => {
    cleanupExpiredPendingPageFocus();
    tryApplyPendingFocus();
});
watch([renderGroups, proxiesTabShow], () => {
    tryApplyPendingFocus();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onScroll: (__VLS_ctx.handleScroll) },
    ...{ class: "max-sm:scrollbar-hidden h-full overflow-y-scroll p-2 sm:pr-1" },
    ref: "proxiesRef",
});
/** @type {__VLS_StyleScopedClasses['max-sm:scrollbar-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:pr-1']} */ ;
const __VLS_0 = ProxyProvidersHealthSummary;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    compact: (__VLS_ctx.isProviderToolbarCompact),
}));
const __VLS_2 = __VLS_1({
    compact: (__VLS_ctx.isProviderToolbarCompact),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.proxiesTabShow === __VLS_ctx.PROXY_TAB_TYPE.PROVIDER && __VLS_ctx.renderGroups.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-6 rounded-xl border border-base-content/10 bg-base-200/40 p-4 text-sm opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('providerNoMatches'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.resetProviderFilters) },
        type: "button",
        ...{ class: "btn btn-sm mt-3" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    (__VLS_ctx.$t('resetFilters'));
}
if (__VLS_ctx.displayTwoColumns) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-2 gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    for (const [idx] of __VLS_vFor(([0, 1]))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (idx),
            ...{ class: "flex flex-1 flex-col gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [name] of __VLS_vFor((__VLS_ctx.filterContent(__VLS_ctx.renderGroups, idx)))) {
            const __VLS_5 = (__VLS_ctx.renderComponent);
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
                key: (name),
                name: (name),
            }));
            const __VLS_7 = __VLS_6({
                key: (name),
                name: (name),
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            // @ts-ignore
            [handleScroll, isProviderToolbarCompact, proxiesTabShow, PROXY_TAB_TYPE, renderGroups, renderGroups, $t, $t, resetProviderFilters, displayTwoColumns, filterContent, renderComponent,];
        }
        // @ts-ignore
        [];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-1 gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    for (const [name] of __VLS_vFor((__VLS_ctx.renderGroups))) {
        const __VLS_10 = (__VLS_ctx.renderComponent);
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            key: (name),
            name: (name),
        }));
        const __VLS_12 = __VLS_11({
            key: (name),
            name: (name),
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        // @ts-ignore
        [renderGroups, renderComponent,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
