/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { PROXY_CARD_SIZE, PROXY_SORT_TYPE, ROUTE_NAME } from '@/constant';
import { checkTruncation } from '@/helper/tooltip';
import { prettyBytesHelper, scrollIntoCenter } from '@/helper/utils';
import { i18n } from '@/i18n';
import router from '@/router';
import { activeConnections } from '@/store/connections';
import { getIPv6ByName, getTestUrl, proxyLatencyTest, proxyMap } from '@/store/proxies';
import { IPv6test, proxyCardSize, proxySortType, truncateProxyName } from '@/store/settings';
import { smartWeightsMap } from '@/store/smart';
import { FunnelIcon, NoSymbolIcon } from '@heroicons/vue/24/outline';
import { twMerge } from 'tailwind-merge';
import { computed, onMounted, ref } from 'vue';
import LatencyTag from './LatencyTag.vue';
import ProxyIcon from './ProxyIcon.vue';
const props = defineProps();
const cardRef = ref();
const node = computed(() => proxyMap.value[props.name]);
const isLatencyTesting = ref(false);
const typeFormatter = (type) => {
    type = type.toLowerCase();
    type = type.replace('shadowsocks', 'ss');
    type = type.replace('hysteria', 'hy');
    type = type.replace('wireguard', 'wg');
    return type;
};
const isSmallCard = computed(() => proxyCardSize.value === PROXY_CARD_SIZE.SMALL);
const typeDescription = computed(() => {
    const type = typeFormatter(node.value.type);
    const smartUsage = smartWeightsMap.value[props.groupName ?? '']?.[props.name];
    const smartDesc = smartUsage ? i18n.global.t(smartUsage) : '';
    const isV6 = IPv6test.value && getIPv6ByName(node.value.name) ? 'IPv6' : '';
    const isUDP = node.value.udp ? (node.value.xudp ? 'xudp' : 'udp') : '';
    return [type, isUDP, smartDesc, isV6].filter(Boolean).join(isSmallCard.value ? '/' : ' / ');
});
const trafficStat = computed(() => {
    const name = props.name;
    let bytes = 0;
    let speed = 0;
    let count = 0;
    for (const c of activeConnections.value) {
        const chains = c.chains || [];
        if (!Array.isArray(chains) || !chains.includes(name))
            continue;
        count += 1;
        bytes += (c.download || 0) + (c.upload || 0);
        speed += (c.downloadSpeed || 0) + (c.uploadSpeed || 0);
    }
    return { bytes, speed, count };
});
const trafficText = computed(() => {
    if (!trafficStat.value.count)
        return '';
    const b = prettyBytesHelper(trafficStat.value.bytes);
    const s = prettyBytesHelper(trafficStat.value.speed);
    return isSmallCard.value ? b : (b + ' · ' + s + '/s');
});
const latencyTipAnimationClass = ref([]);
const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1';
const openTopologyWithProxy = async (mode = 'only') => {
    const payload = {
        ts: Date.now(),
        mode: mode,
        focus: { stage: 'S', kind: 'value', value: props.name },
    };
    try {
        localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload));
    }
    catch {
        // ignore
    }
    await router.push({ name: ROUTE_NAME.overview });
};
const handlerLatencyTest = async () => {
    if (isLatencyTesting.value)
        return;
    isLatencyTesting.value = true;
    try {
        await proxyLatencyTest(props.name, getTestUrl(props.groupName));
        isLatencyTesting.value = false;
    }
    catch {
        isLatencyTesting.value = false;
    }
    if ([PROXY_SORT_TYPE.LATENCY_ASC, PROXY_SORT_TYPE.LATENCY_DESC].includes(proxySortType.value) &&
        cardRef.value) {
        const classList = ['bg-info/20!', 'transition-colors', 'duration-1500'];
        scrollIntoCenter(cardRef.value);
        latencyTipAnimationClass.value = classList;
        setTimeout(() => {
            latencyTipAnimationClass.value = [];
        }, 1500);
    }
};
onMounted(() => {
    if (props.active) {
        setTimeout(() => {
            scrollIntoCenter(cardRef.value);
        }, 300);
    }
});
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
    ...{ onContextmenu: (__VLS_ctx.handlerLatencyTest) },
    ref: "cardRef",
    'data-nav-kind': "proxy-node",
    'data-nav-value': (__VLS_ctx.name),
    'data-nav-group': (__VLS_ctx.groupName || ''),
    ...{ class: (__VLS_ctx.twMerge('bg-base-200 flex cursor-pointer flex-col items-start rounded-md', __VLS_ctx.active ? 'bg-primary text-primary-content sm:hover:bg-primary/95' : 'sm:hover:bg-base-300', __VLS_ctx.isSmallCard ? 'gap-1 p-1' : 'gap-2 p-2', __VLS_ctx.latencyTipAnimationClass)) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex w-full flex-1 items-center" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
if (__VLS_ctx.node?.icon) {
    const __VLS_0 = ProxyIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "shrink-0" },
        icon: (__VLS_ctx.node.icon),
        fill: (__VLS_ctx.active ? 'fill-primary-content' : 'fill-base-content'),
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "shrink-0" },
        icon: (__VLS_ctx.node.icon),
        fill: (__VLS_ctx.active ? 'fill-primary-content' : 'fill-base-content'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ onMouseenter: (__VLS_ctx.checkTruncation) },
    ...{ class: (__VLS_ctx.twMerge('text-sm', __VLS_ctx.truncateProxyName && 'truncate')) },
});
(__VLS_ctx.node.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-4 w-full items-center justify-between select-none" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ onMouseenter: (__VLS_ctx.checkTruncation) },
    ...{ class: (`truncate text-xs tracking-tight ${__VLS_ctx.active ? 'text-primary-content' : 'text-base-content/60'}`) },
});
(__VLS_ctx.typeDescription);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (() => __VLS_ctx.openTopologyWithProxy('only')) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs h-5 min-h-0 px-1" },
    title: (__VLS_ctx.i18n.global.t('topologyOnlyThis')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.FunnelIcon} */
FunnelIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ class: "h-3.5 w-3.5" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-3.5 w-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (() => __VLS_ctx.openTopologyWithProxy('exclude')) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs h-5 min-h-0 px-1" },
    title: (__VLS_ctx.i18n.global.t('topologyExcludeThis')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
let __VLS_10;
/** @ts-ignore @type {typeof __VLS_components.NoSymbolIcon} */
NoSymbolIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "h-3.5 w-3.5" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-3.5 w-3.5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
const __VLS_15 = LatencyTag;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    ...{ 'onClick': {} },
    ...{ class: ([__VLS_ctx.isSmallCard && 'h-4! w-8! rounded-md!', 'shrink-0', __VLS_ctx.active && 'hover:bg-base-300']) },
    name: (__VLS_ctx.node.name),
    loading: (__VLS_ctx.isLatencyTesting),
    groupName: (__VLS_ctx.groupName),
}));
const __VLS_17 = __VLS_16({
    ...{ 'onClick': {} },
    ...{ class: ([__VLS_ctx.isSmallCard && 'h-4! w-8! rounded-md!', 'shrink-0', __VLS_ctx.active && 'hover:bg-base-300']) },
    name: (__VLS_ctx.node.name),
    loading: (__VLS_ctx.isLatencyTesting),
    groupName: (__VLS_ctx.groupName),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
const __VLS_21 = ({ click: {} },
    { onClick: (__VLS_ctx.handlerLatencyTest) });
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
var __VLS_18;
var __VLS_19;
if (__VLS_ctx.trafficText) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.twMerge('w-full text-xs tracking-tight', __VLS_ctx.active ? 'text-primary-content/80' : 'text-base-content/60')) },
    });
    (__VLS_ctx.trafficText);
}
// @ts-ignore
[handlerLatencyTest, handlerLatencyTest, name, groupName, groupName, twMerge, twMerge, twMerge, active, active, active, active, active, isSmallCard, isSmallCard, latencyTipAnimationClass, node, node, node, node, checkTruncation, checkTruncation, truncateProxyName, typeDescription, openTopologyWithProxy, openTopologyWithProxy, i18n, i18n, isLatencyTesting, trafficText, trafficText,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
