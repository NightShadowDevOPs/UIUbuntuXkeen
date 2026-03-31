/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { NOT_CONNECTED, PROXY_PREVIEW_TYPE } from '@/constant';
import { getColorForLatency } from '@/helper';
import { useTooltip } from '@/helper/tooltip';
import { activeConnections } from '@/store/connections';
import { getLatencyByName, getNowProxyNodeName } from '@/store/proxies';
import { lowLatency, mediumLatency, proxyPreviewType } from '@/store/settings';
import { useElementSize } from '@vueuse/core';
import { BoltIcon, FunnelIcon, NoSymbolIcon, PauseCircleIcon, PlayCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const __VLS_emit = defineEmits();
const props = defineProps();
const { t } = useI18n();
const { showTip } = useTooltip();
const previewRef = ref(null);
const { width } = useElementSize(previewRef);
const widthEnough = computed(() => {
    return width.value > 20 * props.nodes.length;
});
const makeTippy = (e, node) => {
    const tag = document.createElement('div');
    const name = document.createElement('div');
    name.textContent = node.name;
    tag.append(name);
    if (node.latency !== NOT_CONNECTED) {
        const latency = document.createElement('div');
        latency.textContent = `${node.latency}ms`;
        latency.classList.add(getColorForLatency(node.latency));
        tag.append(latency);
    }
    tag.classList.add('flex', 'items-center', 'gap-2');
    showTip(e, tag);
};
const showSquares = computed(() => {
    return proxyPreviewType.value === PROXY_PREVIEW_TYPE.SQUARES;
});
const showDots = computed(() => {
    return (proxyPreviewType.value === PROXY_PREVIEW_TYPE.DOTS ||
        (proxyPreviewType.value === PROXY_PREVIEW_TYPE.AUTO && widthEnough.value));
});
const enableTopologyFilter = computed(() => !!props.enableTopologyFilter);
const nodesLatency = computed(() => props.nodes.map((name) => {
    return {
        latency: getLatencyByName(name, props.groupName),
        name: name,
    };
}));
/**
 * "now" in Mihomo can be a group (e.g. selector -> loadbalance group),
 * while the preview often shows concrete proxies.
 * To highlight the actually used proxy, we:
 * 1) prefer a proxy found in active connections chain for this group
 * 2) fallback to resolved now node name
 * 3) fallback to now itself
 */
const highlightNodeName = computed(() => {
    const now = props.now || '';
    // direct match
    if (now && props.nodes.includes(now))
        return now;
    // try to infer the real hop from active connections
    if (props.groupName) {
        const best = activeConnections.value
            .filter((c) => Array.isArray(c.chains) && c.chains.includes(props.groupName))
            .map((c) => {
            const chains = c.chains;
            const leaf = chains?.[chains.length - 1] || '';
            const total = (Number(c.download) || 0) + (Number(c.upload) || 0);
            return { leaf, total };
        })
            .filter((x) => x.leaf && props.nodes.includes(x.leaf))
            .sort((a, b) => b.total - a.total)[0];
        if (best?.leaf)
            return best.leaf;
    }
    // resolve through now-chains (selector -> urltest -> proxy)
    if (now) {
        const resolved = getNowProxyNodeName(now);
        if (resolved && props.nodes.includes(resolved))
            return resolved;
    }
    return now;
});
const getBgColor = (latency) => {
    if (latency === NOT_CONNECTED) {
        return 'bg-base-content/60';
    }
    else if (latency < lowLatency.value) {
        return 'bg-low-latency';
    }
    else if (latency < mediumLatency.value) {
        return 'bg-medium-latency';
    }
    else {
        return 'bg-high-latency';
    }
};
const iconForLatency = (latency) => {
    if (latency === NOT_CONNECTED)
        return XMarkIcon;
    if (latency < lowLatency.value)
        return BoltIcon;
    if (latency < mediumLatency.value)
        return PlayCircleIcon;
    return PauseCircleIcon;
};
const goodsCounts = computed(() => {
    return nodesLatency.value.filter((node) => node.latency < lowLatency.value && node.latency > NOT_CONNECTED).length;
});
const mediumCounts = computed(() => {
    return nodesLatency.value.filter((node) => node.latency >= lowLatency.value && node.latency < mediumLatency.value).length;
});
const badCounts = computed(() => {
    return nodesLatency.value.filter((node) => node.latency >= mediumLatency.value).length;
});
const notConnectedCounts = computed(() => {
    return nodesLatency.value.filter((node) => node.latency === NOT_CONNECTED).length;
});
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "previewRef",
    ...{ class: "flex flex-wrap" },
    ...{ class: ([(__VLS_ctx.showDots || __VLS_ctx.showSquares) ? 'gap-1 pt-3' : 'gap-2 pt-4 pb-1']) },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
if (__VLS_ctx.showDots || __VLS_ctx.showSquares) {
    for (const [node] of __VLS_vFor((__VLS_ctx.nodesLatency))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onMouseenter: ((e) => __VLS_ctx.makeTippy(e, node)) },
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.showDots || __VLS_ctx.showSquares))
                        return;
                    __VLS_ctx.$emit('nodeclick', node.name);
                    // @ts-ignore
                    [showDots, showDots, showSquares, showSquares, nodesLatency, makeTippy, $emit,];
                } },
            key: (node.name),
            ...{ class: "relative group flex h-5 w-5 items-center justify-center transition hover:scale-110" },
            ...{ class: ([
                    __VLS_ctx.showSquares ? 'rounded-md' : 'rounded-full',
                    __VLS_ctx.getBgColor(node.latency),
                    __VLS_ctx.highlightNodeName === node.name
                        ? 'ring-4 ring-warning ring-offset-2 ring-offset-base-100'
                        : '',
                ]) },
            ref: "dotsRef",
        });
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['group']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:scale-110']} */ ;
        const __VLS_0 = (__VLS_ctx.iconForLatency(node.latency));
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            ...{ class: "h-3.5 w-3.5 text-white/90" },
        }));
        const __VLS_2 = __VLS_1({
            ...{ class: "h-3.5 w-3.5 text-white/90" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white/90']} */ ;
        if (__VLS_ctx.enableTopologyFilter) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "absolute left-1/2 top-full z-50 hidden -translate-x-1/2 pt-1 group-hover:block" },
            });
            /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
            /** @type {__VLS_StyleScopedClasses['left-1/2']} */ ;
            /** @type {__VLS_StyleScopedClasses['top-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['z-50']} */ ;
            /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
            /** @type {__VLS_StyleScopedClasses['-translate-x-1/2']} */ ;
            /** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['group-hover:block']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-0.5 rounded-md bg-base-200/95 p-0.5 ring-1 ring-base-300 shadow" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-200/95']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-base-300']} */ ;
            /** @type {__VLS_StyleScopedClasses['shadow']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showDots || __VLS_ctx.showSquares))
                            return;
                        if (!(__VLS_ctx.enableTopologyFilter))
                            return;
                        __VLS_ctx.$emit('nodefilter', { name: node.name, mode: 'only' });
                        // @ts-ignore
                        [showSquares, $emit, getBgColor, highlightNodeName, iconForLatency, enableTopologyFilter,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs h-5 min-h-0 w-5 px-0" },
                title: (__VLS_ctx.t('topologyOnlyThis')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-0']} */ ;
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
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showDots || __VLS_ctx.showSquares))
                            return;
                        if (!(__VLS_ctx.enableTopologyFilter))
                            return;
                        __VLS_ctx.$emit('nodefilter', { name: node.name, mode: 'exclude' });
                        // @ts-ignore
                        [$emit, t,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs h-5 min-h-0 w-5 px-0" },
                title: (__VLS_ctx.t('topologyExcludeThis')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-0']} */ ;
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
        }
        if (__VLS_ctx.highlightNodeName === node.name) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-warning ring-2 ring-base-100 shadow" },
            });
            /** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
            /** @type {__VLS_StyleScopedClasses['-top-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['-right-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-warning']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-base-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['shadow']} */ ;
        }
        // @ts-ignore
        [highlightNodeName, t,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-1 items-center justify-center overflow-hidden rounded-2xl *:h-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['*:h-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.getBgColor(__VLS_ctx.lowLatency - 1)) },
        ...{ style: ({
                width: `${(__VLS_ctx.goodsCounts * 100) / __VLS_ctx.nodes.length}%`, // cant use tw class, otherwise dynamic classname won't be generated
            }) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.getBgColor(__VLS_ctx.mediumLatency - 1)) },
        ...{ style: ({
                width: `${(__VLS_ctx.mediumCounts * 100) / __VLS_ctx.nodes.length}%`,
            }) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.getBgColor(__VLS_ctx.mediumLatency + 1)) },
        ...{ style: ({
                width: `${(__VLS_ctx.badCounts * 100) / __VLS_ctx.nodes.length}%`,
            }) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.getBgColor(__VLS_ctx.NOT_CONNECTED)) },
        ...{ style: ({
                width: `${(__VLS_ctx.notConnectedCounts * 100) / __VLS_ctx.nodes.length}%`,
            }) },
    });
}
// @ts-ignore
[getBgColor, getBgColor, getBgColor, getBgColor, lowLatency, goodsCounts, nodes, nodes, nodes, nodes, mediumLatency, mediumLatency, mediumCounts, badCounts, NOT_CONNECTED, notConnectedCounts,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
