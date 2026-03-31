/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import CommonSidebar from '@/components/sidebar/CommonCtrl.vue';
import { APP_DISPLAY_NAME, APP_RUNTIME_FLAVOR } from '@/config/project';
import { useUiBuild } from '@/composables/uiBuild';
import { zashboardVersion } from '@/api';
import { ROUTE_ICON_MAP, ROUTE_NAME } from '@/constant';
import { navSections } from '@/helper';
import { useTooltip } from '@/helper/tooltip';
import router from '@/router';
import { isSidebarCollapsed, showStatisticsWhenSidebarCollapsed } from '@/store/settings';
import { globalSearchOpen } from '@/store/globalSearch';
import { ArrowLeftCircleIcon, ArrowRightCircleIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { twMerge } from 'tailwind-merge';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import OverviewCarousel from './OverviewCarousel.vue';
import VerticalInfos from './VerticalInfos.vue';
const { showTip } = useTooltip();
const { t } = useI18n();
const mouseenterHandler = (e, r) => {
    if (!isSidebarCollapsed.value)
        return;
    const label = r === 'globalSearch' ? t('globalSearch') : t(r);
    showTip(e, label, {
        placement: 'right',
    });
};
const route = useRoute();
const { isFreshUiBuildAvailable, isUiBuildChecking, uiBuildCheckError, checkFreshUiBuild, hardRefreshUiCache } = useUiBuild();
const sidebarBuildLabelKey = computed(() => {
    if (isUiBuildChecking.value)
        return 'uiSidebarBuildChecking';
    if (uiBuildCheckError.value)
        return 'uiSidebarBuildCheckFailed';
    if (isFreshUiBuildAvailable.value)
        return 'uiSidebarBuildUpdateReady';
    return 'uiSidebarBuildCurrent';
});
const sidebarBuildHint = computed(() => {
    if (isUiBuildChecking.value)
        return t('uiSidebarBuildHintChecking');
    if (uiBuildCheckError.value)
        return uiBuildCheckError.value;
    if (isFreshUiBuildAvailable.value)
        return t('uiSidebarBuildHintUpdateReady');
    return t('uiSidebarBuildHintCurrent');
});
const sidebarBuildCardClass = computed(() => {
    if (isUiBuildChecking.value)
        return 'border-base-300/70 bg-base-100/60 text-base-content';
    if (uiBuildCheckError.value)
        return 'border-error/40 bg-error/10 text-error-content';
    if (isFreshUiBuildAvailable.value)
        return 'border-warning/40 bg-warning/15 text-base-content';
    return 'border-success/30 bg-success/10 text-base-content';
});
const sidebarBuildDotClass = computed(() => {
    if (isUiBuildChecking.value)
        return 'bg-base-content/60';
    if (uiBuildCheckError.value)
        return 'bg-error';
    if (isFreshUiBuildAvailable.value)
        return 'bg-warning';
    return 'bg-success';
});
const activeNavClass = 'menu-active bg-primary/90 text-primary-content shadow-md ring-1 ring-primary/40 font-semibold';
const inactiveNavClass = 'hover:bg-base-300/70 hover:text-base-content';
const openGlobalSearch = () => {
    globalSearchOpen.value = true;
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar bg-base-200 text-base-content scrollbar-hidden h-full overflow-x-hidden p-2 transition-all" },
    ...{ class: (__VLS_ctx.isSidebarCollapsed ? 'w-18 px-0' : 'w-64') },
});
/** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
/** @type {__VLS_StyleScopedClasses['scrollbar-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: (__VLS_ctx.twMerge('flex h-full flex-col gap-2', __VLS_ctx.isSidebarCollapsed ? 'w-18 px-0' : 'w-60')) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "menu w-full flex-1" },
});
/** @type {__VLS_StyleScopedClasses['menu']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
    ...{ onMouseenter: ((e) => __VLS_ctx.mouseenterHandler(e, 'globalSearch')) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openGlobalSearch) },
    type: "button",
    ...{ class: ([
            __VLS_ctx.globalSearchOpen ? __VLS_ctx.activeNavClass : __VLS_ctx.inactiveNavClass,
            __VLS_ctx.isSidebarCollapsed && 'justify-center',
            'w-full py-2 rounded-xl transition-all',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.MagnifyingGlassIcon} */
MagnifyingGlassIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-5 w-5" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
if (!__VLS_ctx.isSidebarCollapsed) {
    (__VLS_ctx.$t('globalSearch'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-auto text-[10px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
}
for (const [section] of __VLS_vFor((__VLS_ctx.navSections))) {
    (section.key);
    if (!__VLS_ctx.isSidebarCollapsed) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ class: "menu-title px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/45" },
        });
        /** @type {__VLS_StyleScopedClasses['menu-title']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['pb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-base-content/45']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t(section.key));
    }
    for (const [r] of __VLS_vFor((section.routes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            ...{ onMouseenter: ((e) => __VLS_ctx.mouseenterHandler(e, r)) },
            key: (r),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            ...{ onClick: (() => __VLS_ctx.router.push({ name: r })) },
            ...{ class: ([
                    r === __VLS_ctx.route.name ? __VLS_ctx.activeNavClass : __VLS_ctx.inactiveNavClass,
                    __VLS_ctx.isSidebarCollapsed && 'justify-center',
                    'py-2 rounded-xl transition-all',
                ]) },
        });
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
        const __VLS_5 = (__VLS_ctx.ROUTE_ICON_MAP[r]);
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            ...{ class: "h-5 w-5" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "h-5 w-5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        if (!__VLS_ctx.isSidebarCollapsed) {
            (__VLS_ctx.$t(r));
        }
        // @ts-ignore
        [isSidebarCollapsed, isSidebarCollapsed, isSidebarCollapsed, isSidebarCollapsed, isSidebarCollapsed, isSidebarCollapsed, isSidebarCollapsed, twMerge, mouseenterHandler, mouseenterHandler, openGlobalSearch, globalSearchOpen, activeNavClass, activeNavClass, inactiveNavClass, inactiveNavClass, $t, $t, $t, navSections, router, route, ROUTE_ICON_MAP,];
    }
    // @ts-ignore
    [];
}
if (__VLS_ctx.isSidebarCollapsed) {
    if (__VLS_ctx.showStatisticsWhenSidebarCollapsed) {
        const __VLS_10 = VerticalInfos;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
        const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex w-full items-center justify-center" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.isSidebarCollapsed))
                        return;
                    if (!!(__VLS_ctx.showStatisticsWhenSidebarCollapsed))
                        return;
                    __VLS_ctx.isSidebarCollapsed = false;
                    // @ts-ignore
                    [isSidebarCollapsed, isSidebarCollapsed, showStatisticsWhenSidebarCollapsed,];
                } },
            ...{ class: "btn btn-circle btn-sm bg-base-300" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-300']} */ ;
        let __VLS_15;
        /** @ts-ignore @type {typeof __VLS_components.ArrowRightCircleIcon} */
        ArrowRightCircleIcon;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            ...{ class: "h-5 w-5" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "h-5 w-5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    }
}
else {
    if (__VLS_ctx.route.name !== __VLS_ctx.ROUTE_NAME.overview) {
        const __VLS_20 = OverviewCarousel;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({}));
        const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    const __VLS_25 = CommonSidebar;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({}));
    const __VLS_27 = __VLS_26({}, ...__VLS_functionalComponentArgsRest(__VLS_26));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex w-full items-center justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.isSidebarCollapsed))
                    return;
                __VLS_ctx.isSidebarCollapsed = true;
                // @ts-ignore
                [isSidebarCollapsed, route, ROUTE_NAME,];
            } },
        ...{ class: "btn btn-ghost btn-sm w-full justify-start bg-base-100/40" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
    let __VLS_30;
    /** @ts-ignore @type {typeof __VLS_components.ArrowLeftCircleIcon} */
    ArrowLeftCircleIcon;
    // @ts-ignore
    const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
        ...{ class: "h-5 w-5" },
    }));
    const __VLS_32 = __VLS_31({
        ...{ class: "h-5 w-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_31));
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.$t('collapseMenu'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "px-2 pb-2" },
    ...{ class: (__VLS_ctx.isSidebarCollapsed ? 'space-y-1' : 'space-y-2') },
});
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "px-1 text-[11px] font-semibold text-base-content/85" },
    ...{ class: (__VLS_ctx.isSidebarCollapsed ? 'text-center' : '') },
});
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/85']} */ ;
(__VLS_ctx.APP_DISPLAY_NAME);
(__VLS_ctx.zashboardVersion);
(__VLS_ctx.APP_RUNTIME_FLAVOR);
if (!__VLS_ctx.isSidebarCollapsed) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-2xl border px-2.5 py-2 text-xs shadow-sm" },
        ...{ class: (__VLS_ctx.sidebarBuildCardClass) },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "inline-flex h-2.5 w-2.5 rounded-full" },
        ...{ class: (__VLS_ctx.sidebarBuildDotClass) },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t(__VLS_ctx.sidebarBuildLabelKey));
    if (__VLS_ctx.isFreshUiBuildAvailable) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-auto badge badge-warning badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-[11px] opacity-75" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
    (__VLS_ctx.sidebarBuildHint);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    if (__VLS_ctx.isFreshUiBuildAvailable) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.hardRefreshUiCache) },
            ...{ class: "btn btn-warning btn-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('uiHardRefresh'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.checkFreshUiBuild) },
            ...{ class: "btn btn-ghost btn-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('uiCheckFreshness'));
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.isSidebarCollapsed))
                    return;
                __VLS_ctx.isFreshUiBuildAvailable ? __VLS_ctx.hardRefreshUiCache() : __VLS_ctx.checkFreshUiBuild();
                // @ts-ignore
                [isSidebarCollapsed, isSidebarCollapsed, isSidebarCollapsed, $t, $t, $t, $t, APP_DISPLAY_NAME, zashboardVersion, APP_RUNTIME_FLAVOR, sidebarBuildCardClass, sidebarBuildDotClass, sidebarBuildLabelKey, isFreshUiBuildAvailable, isFreshUiBuildAvailable, isFreshUiBuildAvailable, sidebarBuildHint, hardRefreshUiCache, hardRefreshUiCache, checkFreshUiBuild, checkFreshUiBuild,];
            } },
        ...{ class: "btn btn-circle btn-xs" },
        ...{ class: (__VLS_ctx.isFreshUiBuildAvailable ? 'btn-warning' : __VLS_ctx.isUiBuildChecking ? 'btn-ghost animate-pulse' : 'btn-ghost') },
        title: (__VLS_ctx.$t(__VLS_ctx.sidebarBuildLabelKey)),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "inline-flex h-2.5 w-2.5 rounded-full" },
        ...{ class: (__VLS_ctx.sidebarBuildDotClass) },
    });
    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
}
// @ts-ignore
[$t, sidebarBuildDotClass, sidebarBuildLabelKey, isFreshUiBuildAvailable, isUiBuildChecking,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
