/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useBounceOnVisible } from '@/composables/bouncein';
import { useRenderProxies } from '@/composables/renderProxies';
import { isHiddenGroup } from '@/helper';
import { prettyBytesHelper } from '@/helper/utils';
import { activeConnections } from '@/store/connections';
import { handlerProxySelect, hiddenGroupMap, proxyGroupLatencyTest, proxyMap, } from '@/store/proxies';
import { ROUTE_NAME } from '@/constant';
import { useRouter } from 'vue-router';
import { groupProxiesByProvider, manageHiddenGroup, proxyGroupIconMargin, proxyGroupIconSize, } from '@/store/settings';
import { EyeIcon, EyeSlashIcon, FunnelIcon, NoSymbolIcon } from '@heroicons/vue/24/outline';
import { twMerge } from 'tailwind-merge';
import { computed, ref } from 'vue';
import CollapseCard from '../common/CollapseCard.vue';
import LatencyTag from './LatencyTag.vue';
import ProxiesByProvider from './ProxiesByProvider.vue';
import ProxiesContent from './ProxiesContent.vue';
import ProxyGroupNow from './ProxyGroupNow.vue';
import ProxyName from './ProxyName.vue';
import ProxyPreview from './ProxyPreview.vue';
const props = defineProps();
const router = useRouter();
const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1';
const openTopologyWithGroup = async (mode) => {
    const payload = {
        ts: Date.now(),
        mode,
        focus: { stage: 'G', kind: 'value', value: props.name },
    };
    try {
        localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload));
    }
    catch {
        // ignore
    }
    await router.push({ name: ROUTE_NAME.overview });
};
const openTopologyWithProxy = async (p) => {
    const payload = {
        ts: Date.now(),
        mode: p.mode,
        focus: { stage: 'S', kind: 'value', value: p.name },
    };
    try {
        localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload));
    }
    catch {
        // ignore
    }
    await router.push({ name: ROUTE_NAME.overview });
};
const proxyGroup = computed(() => proxyMap.value[props.name]);
const allProxies = computed(() => proxyGroup.value.all ?? []);
const { proxiesCount, renderProxies } = useRenderProxies(allProxies, props.name);
const isLatencyTesting = ref(false);
const handlerLatencyTest = async () => {
    if (isLatencyTesting.value)
        return;
    isLatencyTesting.value = true;
    try {
        await proxyGroupLatencyTest(props.name);
        isLatencyTesting.value = false;
    }
    catch {
        isLatencyTesting.value = false;
    }
};
const speedTotal = computed(() => {
    const speed = activeConnections.value
        .filter((conn) => conn.chains.includes(props.name))
        .reduce((total, conn) => total + (conn.downloadSpeed || 0) + (conn.uploadSpeed || 0), 0);
    return speed;
});
const trafficTotal = computed(() => {
    const total = activeConnections.value
        .filter((conn) => conn.chains.includes(props.name))
        .reduce((sum, conn) => sum + (conn.download || 0) + (conn.upload || 0), 0);
    return total;
});
const hiddenGroup = computed({
    get: () => isHiddenGroup(props.name),
    set: (value) => {
        hiddenGroupMap.value[props.name] = value;
    },
});
const handlerGroupToggle = () => {
    hiddenGroup.value = !hiddenGroup.value;
};
useBounceOnVisible();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    'data-nav-kind': "proxy-group",
    'data-nav-value': (__VLS_ctx.name),
});
const __VLS_0 = CollapseCard || CollapseCard;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    name: (__VLS_ctx.proxyGroup.name),
}));
const __VLS_2 = __VLS_1({
    name: (__VLS_ctx.proxyGroup.name),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
{
    const { title: __VLS_6 } = __VLS_3.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onContextmenu: (__VLS_ctx.handlerLatencyTest) },
        ...{ class: "relative flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-1 items-center gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    const __VLS_7 = ProxyName;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        name: (__VLS_ctx.name),
        iconSize: (__VLS_ctx.proxyGroupIconSize),
        iconMargin: (__VLS_ctx.proxyGroupIconMargin),
    }));
    const __VLS_9 = __VLS_8({
        name: (__VLS_ctx.name),
        iconSize: (__VLS_ctx.proxyGroupIconSize),
        iconMargin: (__VLS_ctx.proxyGroupIconMargin),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base-content/60 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.proxyGroup.type);
    (__VLS_ctx.proxiesCount);
    if (__VLS_ctx.manageHiddenGroup) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.handlerGroupToggle) },
            ...{ class: "btn btn-circle btn-xs z-10 ml-1" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        if (!__VLS_ctx.hiddenGroup) {
            let __VLS_12;
            /** @ts-ignore @type {typeof __VLS_components.EyeIcon} */
            EyeIcon;
            // @ts-ignore
            const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
                ...{ class: "h-3 w-3" },
            }));
            const __VLS_14 = __VLS_13({
                ...{ class: "h-3 w-3" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_13));
            /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
        }
        else {
            let __VLS_17;
            /** @ts-ignore @type {typeof __VLS_components.EyeSlashIcon} */
            EyeSlashIcon;
            // @ts-ignore
            const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
                ...{ class: "h-3 w-3" },
            }));
            const __VLS_19 = __VLS_18({
                ...{ class: "h-3 w-3" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_18));
            /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
        }
    }
    const __VLS_22 = LatencyTag;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
        ...{ 'onClick': {} },
        ...{ class: (__VLS_ctx.twMerge('bg-base-200/50 hover:bg-base-200 z-10')) },
        loading: (__VLS_ctx.isLatencyTesting),
        name: (__VLS_ctx.proxyGroup.now),
        groupName: (__VLS_ctx.proxyGroup.name),
    }));
    const __VLS_24 = __VLS_23({
        ...{ 'onClick': {} },
        ...{ class: (__VLS_ctx.twMerge('bg-base-200/50 hover:bg-base-200 z-10')) },
        loading: (__VLS_ctx.isLatencyTesting),
        name: (__VLS_ctx.proxyGroup.now),
        groupName: (__VLS_ctx.proxyGroup.name),
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    let __VLS_27;
    const __VLS_28 = ({ click: {} },
        { onClick: (__VLS_ctx.handlerLatencyTest) });
    var __VLS_25;
    var __VLS_26;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "z-10 flex items-center gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openTopologyWithGroup('only');
                // @ts-ignore
                [name, name, proxyGroup, proxyGroup, proxyGroup, proxyGroup, handlerLatencyTest, handlerLatencyTest, proxyGroupIconSize, proxyGroupIconMargin, proxiesCount, manageHiddenGroup, handlerGroupToggle, hiddenGroup, twMerge, isLatencyTesting, openTopologyWithGroup,];
            } },
        ...{ class: "btn btn-ghost btn-circle btn-xs" },
        title: "Топология: только этот прокси",
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    let __VLS_29;
    /** @ts-ignore @type {typeof __VLS_components.FunnelIcon} */
    FunnelIcon;
    // @ts-ignore
    const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
        ...{ class: "h-3 w-3" },
    }));
    const __VLS_31 = __VLS_30({
        ...{ class: "h-3 w-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_30));
    /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openTopologyWithGroup('exclude');
                // @ts-ignore
                [openTopologyWithGroup,];
            } },
        ...{ class: "btn btn-ghost btn-circle btn-xs" },
        title: "Топология: исключить этот прокси",
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    let __VLS_34;
    /** @ts-ignore @type {typeof __VLS_components.NoSymbolIcon} */
    NoSymbolIcon;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        ...{ class: "h-3 w-3" },
    }));
    const __VLS_36 = __VLS_35({
        ...{ class: "h-3 w-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onContextmenu: (__VLS_ctx.handlerLatencyTest) },
        ...{ class: "text-base-content/80 mt-1.5 flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-1 items-center gap-1 truncate text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    const __VLS_39 = ProxyGroupNow;
    // @ts-ignore
    const __VLS_40 = __VLS_asFunctionalComponent1(__VLS_39, new __VLS_39({
        name: (__VLS_ctx.name),
    }));
    const __VLS_41 = __VLS_40({
        name: (__VLS_ctx.name),
    }, ...__VLS_functionalComponentArgsRest(__VLS_40));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-24 shrink-0 text-right text-xs font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-24']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.prettyBytesHelper(__VLS_ctx.trafficTotal));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.prettyBytesHelper(__VLS_ctx.speedTotal));
    // @ts-ignore
    [name, handlerLatencyTest, prettyBytesHelper, prettyBytesHelper, trafficTotal, speedTotal,];
}
{
    const { preview: __VLS_44 } = __VLS_3.slots;
    const __VLS_45 = ProxyPreview;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
        ...{ 'onNodeclick': {} },
        ...{ 'onNodefilter': {} },
        nodes: (__VLS_ctx.renderProxies),
        now: (__VLS_ctx.proxyGroup.now),
        groupName: (__VLS_ctx.proxyGroup.name),
        enableTopologyFilter: (true),
    }));
    const __VLS_47 = __VLS_46({
        ...{ 'onNodeclick': {} },
        ...{ 'onNodefilter': {} },
        nodes: (__VLS_ctx.renderProxies),
        now: (__VLS_ctx.proxyGroup.now),
        groupName: (__VLS_ctx.proxyGroup.name),
        enableTopologyFilter: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    let __VLS_50;
    const __VLS_51 = ({ nodeclick: {} },
        { onNodeclick: (...[$event]) => {
                __VLS_ctx.handlerProxySelect(__VLS_ctx.name, $event);
                // @ts-ignore
                [name, proxyGroup, proxyGroup, renderProxies, handlerProxySelect,];
            } });
    const __VLS_52 = ({ nodefilter: {} },
        { onNodefilter: (__VLS_ctx.openTopologyWithProxy) });
    var __VLS_48;
    var __VLS_49;
    // @ts-ignore
    [openTopologyWithProxy,];
}
{
    const { content: __VLS_53 } = __VLS_3.slots;
    const [{ showFullContent }] = __VLS_vSlot(__VLS_53);
    let __VLS_54;
    /** @ts-ignore @type {typeof __VLS_components.Component} */
    Component;
    // @ts-ignore
    const __VLS_55 = __VLS_asFunctionalComponent1(__VLS_54, new __VLS_54({
        is: (__VLS_ctx.groupProxiesByProvider ? ProxiesByProvider : ProxiesContent),
        name: (__VLS_ctx.name),
        now: (__VLS_ctx.proxyGroup.now),
        renderProxies: (__VLS_ctx.renderProxies),
        showFullContent: (showFullContent),
    }));
    const __VLS_56 = __VLS_55({
        is: (__VLS_ctx.groupProxiesByProvider ? ProxiesByProvider : ProxiesContent),
        name: (__VLS_ctx.name),
        now: (__VLS_ctx.proxyGroup.now),
        renderProxies: (__VLS_ctx.renderProxies),
        showFullContent: (showFullContent),
    }, ...__VLS_functionalComponentArgsRest(__VLS_55));
    // @ts-ignore
    [name, proxyGroup, renderProxies, groupProxiesByProvider,];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
