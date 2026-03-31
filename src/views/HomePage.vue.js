/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { isBackendAvailable } from '@/api';
import DialogWrapper from '@/components/common/DialogWrapper.vue';
import GlobalSearchModal from '@/components/common/GlobalSearchModal.vue';
import PageTitleBar from '@/components/common/PageTitleBar.vue';
import ConnectionCtrl from '@/components/sidebar/ConnectionCtrl.tsx';
import LogsCtrl from '@/components/sidebar/LogsCtrl.tsx';
import ProxiesCtrl from '@/components/sidebar/ProxiesCtrl.tsx';
import RulesCtrl from '@/components/sidebar/RulesCtrl.tsx';
import SideBar from '@/components/sidebar/SideBar.vue';
import { useSettings } from '@/composables/settings';
import { initUserTrafficRecorder } from '@/composables/userTraffic';
import { initUserLimitsEnforcer } from '@/composables/userLimits';
import { useSwipeRouter } from '@/composables/swipe';
import { PROXY_TAB_TYPE, ROUTE_ICON_MAP, ROUTE_NAME, RULE_TAB_TYPE } from '@/constant';
import { renderRoutes } from '@/helper';
import { showNotification } from '@/helper/notification';
import { getLabelFromBackend, isMiddleScreen } from '@/helper/utils';
import { fetchConfigs } from '@/store/config';
import { initConnections } from '@/store/connections';
import { initLogs } from '@/store/logs';
import { initSatistic } from '@/store/overview';
import { fetchProxies, fetchProxyProvidersOnly, proxiesTabShow } from '@/store/proxies';
import { fetchRules, rulesTabShow } from '@/store/rules';
import { activeBackend, activeUuid, backendList } from '@/store/setup';
import { useDocumentVisibility, useElementSize } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import { globalSearchOpen } from '@/store/globalSearch';
const ctrlsMap = {
    [ROUTE_NAME.connections]: ConnectionCtrl,
    [ROUTE_NAME.logs]: LogsCtrl,
    [ROUTE_NAME.proxies]: ProxiesCtrl,
    [ROUTE_NAME.proxyProviders]: ProxiesCtrl,
    [ROUTE_NAME.rules]: RulesCtrl,
};
const styleForSafeArea = {
    height: 'calc(var(--spacing) * 14 + env(safe-area-inset-bottom))',
    'padding-bottom': 'env(safe-area-inset-bottom)',
};
const router = useRouter();
const { swiperRef } = useSwipeRouter();
// Global search keyboard shortcut (Ctrl+K / Cmd+K)
const globalSearchKeydown = (e) => {
    if (e.key.toLowerCase() !== 'k')
        return;
    if (!(e.ctrlKey || e.metaKey))
        return;
    // Avoid hijacking inside text inputs.
    const t = e.target;
    const tag = String(t?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || t?.isContentEditable)
        return;
    e.preventDefault();
    globalSearchOpen.value = true;
};
onMounted(() => {
    document.addEventListener('keydown', globalSearchKeydown);
});
onUnmounted(() => {
    document.removeEventListener('keydown', globalSearchKeydown);
});
const ctrlsBarRef = ref();
const { width: ctrlsBarWidth } = useElementSize(ctrlsBarRef);
const isLargeCtrlsBar = computed(() => {
    return ctrlsBarWidth.value > 720;
});
watch(activeUuid, () => {
    if (!activeUuid.value)
        return;
    rulesTabShow.value = RULE_TAB_TYPE.RULES;
    proxiesTabShow.value = PROXY_TAB_TYPE.PROXIES;
    fetchConfigs();
    fetchProxies();
    fetchRules();
    initConnections();
    initUserTrafficRecorder();
    initUserLimitsEnforcer();
    initLogs();
    initSatistic();
}, {
    immediate: true,
});
const autoSwitchBackendDialog = ref(false);
const autoSwitchBackend = async () => {
    const otherEnds = backendList.value.filter((end) => end.uuid !== activeUuid.value);
    autoSwitchBackendDialog.value = false;
    const avaliable = await Promise.race(otherEnds.map((end) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                reject();
            }, 10000);
            isBackendAvailable(end).then((res) => {
                if (res) {
                    resolve(end);
                }
            });
        });
    }));
    if (avaliable) {
        activeUuid.value = avaliable.uuid;
        showNotification({
            content: 'backendSwitchTo',
            params: {
                backend: getLabelFromBackend(avaliable),
            },
        });
    }
};
const documentVisible = useDocumentVisibility();
watch(documentVisible, async () => {
    if (!activeBackend.value ||
        backendList.value.length < 2 ||
        documentVisible.value !== 'visible') {
        return;
    }
    try {
        const activeBackendUuid = activeBackend.value.uuid;
        const isAvailable = await isBackendAvailable(activeBackend.value);
        if (activeBackendUuid !== activeUuid.value) {
            return;
        }
        if (!isAvailable) {
            autoSwitchBackendDialog.value = true;
        }
    }
    catch {
        autoSwitchBackendDialog.value = true;
    }
}, {
    immediate: true,
});
let lastVisibleProxiesRefresh = 0;
watch(documentVisible, () => {
    if (documentVisible.value !== 'visible')
        return;
    // Avoid aggressive full refresh when switching browser tabs.
    // The Providers tab should refresh "softly" (only providers), without remounting the whole page.
    const now = Date.now();
    if (now - lastVisibleProxiesRefresh < 4000)
        return;
    lastVisibleProxiesRefresh = now;
    // Only refresh proxies data when user is on the Proxies page.
    const routeName = router.currentRoute.value?.name;
    if (routeName !== ROUTE_NAME.proxies && routeName !== ROUTE_NAME.proxyProviders)
        return;
    if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
        fetchProxyProvidersOnly();
    }
    else {
        fetchProxies();
    }
});
const { checkUIUpdate } = useSettings();
checkUIUpdate();
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "bg-base-200/50 home-page flex size-full" },
});
/** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['home-page']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['size-full']} */ ;
if (!__VLS_ctx.isMiddleScreen) {
    const __VLS_0 = SideBar;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.RouterView | typeof __VLS_components.RouterView} */
RouterView;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
{
    const { default: __VLS_10 } = __VLS_8.slots;
    const [{ Component, route }] = __VLS_vSlot(__VLS_10);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-1 flex-col overflow-hidden" },
        ref: "swiperRef",
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    const __VLS_11 = PageTitleBar;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
        routeName: route.name,
    }));
    const __VLS_13 = __VLS_12({
        routeName: route.name,
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    if (__VLS_ctx.ctrlsMap[route.name]) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bg-base-100 ctrls-bar w-full" },
            ref: "ctrlsBarRef",
        });
        /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
        /** @type {__VLS_StyleScopedClasses['ctrls-bar']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        const __VLS_16 = (__VLS_ctx.ctrlsMap[route.name]);
        // @ts-ignore
        const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
            isLargeCtrlsBar: (__VLS_ctx.isLargeCtrlsBar),
        }));
        const __VLS_18 = __VLS_17({
            isLargeCtrlsBar: (__VLS_ctx.isLargeCtrlsBar),
        }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "relative h-0 flex-1" },
    });
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "absolute flex h-full w-full flex-col overflow-y-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
    if (__VLS_ctx.isMiddleScreen) {
        let __VLS_21;
        /** @ts-ignore @type {typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
        Transition;
        // @ts-ignore
        const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
            name: (route.meta.transition || 'fade'),
        }));
        const __VLS_23 = __VLS_22({
            name: (route.meta.transition || 'fade'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_22));
        const { default: __VLS_26 } = __VLS_24.slots;
        let __VLS_27;
        /** @ts-ignore @type {typeof __VLS_components.Component} */
        Component;
        // @ts-ignore
        const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
            is: (Component),
        }));
        const __VLS_29 = __VLS_28({
            is: (Component),
        }, ...__VLS_functionalComponentArgsRest(__VLS_28));
        // @ts-ignore
        [isMiddleScreen, isMiddleScreen, ctrlsMap, ctrlsMap, isLargeCtrlsBar,];
        var __VLS_24;
    }
    else {
        let __VLS_32;
        /** @ts-ignore @type {typeof __VLS_components.Component} */
        Component;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
            is: (Component),
        }));
        const __VLS_34 = __VLS_33({
            is: (Component),
        }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    }
    if (__VLS_ctx.isMiddleScreen) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "nav-bar shrink-0" },
            ...{ style: (__VLS_ctx.styleForSafeArea) },
        });
        /** @type {__VLS_StyleScopedClasses['nav-bar']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "dock dock-sm bg-base-200 z-30" },
            ...{ style: (__VLS_ctx.styleForSafeArea) },
        });
        /** @type {__VLS_StyleScopedClasses['dock']} */ ;
        /** @type {__VLS_StyleScopedClasses['dock-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-30']} */ ;
        for (const [r] of __VLS_vFor((__VLS_ctx.renderRoutes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.isMiddleScreen))
                            return;
                        __VLS_ctx.router.push({ name: r });
                        // @ts-ignore
                        [isMiddleScreen, styleForSafeArea, styleForSafeArea, renderRoutes, router,];
                    } },
                key: (r),
                ...{ class: (r === route.name && 'dock-active') },
            });
            const __VLS_37 = (__VLS_ctx.ROUTE_ICON_MAP[r]);
            // @ts-ignore
            const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
                ...{ class: "size-5" },
            }));
            const __VLS_39 = __VLS_38({
                ...{ class: "size-5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_38));
            /** @type {__VLS_StyleScopedClasses['size-5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "dock-label" },
            });
            /** @type {__VLS_StyleScopedClasses['dock-label']} */ ;
            (__VLS_ctx.$t(r));
            // @ts-ignore
            [ROUTE_ICON_MAP, $t,];
        }
    }
    // @ts-ignore
    [];
    __VLS_8.slots['' /* empty slot name completion */];
}
var __VLS_8;
const __VLS_42 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
    modelValue: (__VLS_ctx.autoSwitchBackendDialog),
}));
const __VLS_44 = __VLS_43({
    modelValue: (__VLS_ctx.autoSwitchBackendDialog),
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
const { default: __VLS_47 } = __VLS_45.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-lg font-bold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
(__VLS_ctx.$t('currentBackendUnavailable'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.autoSwitchBackendDialog = false;
            // @ts-ignore
            [$t, autoSwitchBackendDialog, autoSwitchBackendDialog,];
        } },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('cancel'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.autoSwitchBackend) },
    ...{ class: "btn btn-primary btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('confirm'));
// @ts-ignore
[$t, $t, autoSwitchBackend,];
var __VLS_45;
const __VLS_48 = GlobalSearchModal;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent1(__VLS_48, new __VLS_48({}));
const __VLS_50 = __VLS_49({}, ...__VLS_functionalComponentArgsRest(__VLS_49));
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
