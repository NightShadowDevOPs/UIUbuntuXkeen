/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useCalculateMaxProxies } from '@/composables/calculateMaxProxies';
import { handlerProxySelect, proxyProviederList } from '@/store/proxies';
import { computed } from 'vue';
import ProxyNodeCard from './ProxyNodeCard.vue';
import ProxyNodeGrid from './ProxyNodeGrid.vue';
const props = defineProps();
const groupedProxies = computed(() => {
    const groupdProixes = {};
    const providerKeys = [];
    for (const proxy of props.renderProxies) {
        const providerName = proxyProviederList.value.find((group) => group.proxies.find((node) => node.name === proxy))
            ?.name ?? '';
        if (groupdProixes[providerName]) {
            groupdProixes[providerName].push(proxy);
        }
        else {
            if (providerName === '') {
                providerKeys.unshift('');
            }
            else {
                providerKeys.push(providerName);
            }
            groupdProixes[providerName] = [proxy];
        }
    }
    return providerKeys.map((providerName) => [providerName, groupdProixes[providerName]]);
});
const { maxProxies } = useCalculateMaxProxies();
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
    ...{ class: "flex flex-col gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
for (const [[providerName, proxies], index] of __VLS_vFor((__VLS_ctx.groupedProxies))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (index),
    });
    if (providerName !== '') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "my-2 text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['my-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (providerName);
    }
    const __VLS_0 = ProxyNodeGrid || ProxyNodeGrid;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
    const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
    const { default: __VLS_5 } = __VLS_3.slots;
    for (const [node] of __VLS_vFor((__VLS_ctx.showFullContent ? proxies : proxies.slice(0, __VLS_ctx.maxProxies)))) {
        const __VLS_6 = ProxyNodeCard;
        // @ts-ignore
        const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
            ...{ 'onClick': {} },
            key: (node),
            name: (node),
            groupName: (__VLS_ctx.name),
            active: (node === __VLS_ctx.now),
        }));
        const __VLS_8 = __VLS_7({
            ...{ 'onClick': {} },
            key: (node),
            name: (node),
            groupName: (__VLS_ctx.name),
            active: (node === __VLS_ctx.now),
        }, ...__VLS_functionalComponentArgsRest(__VLS_7));
        let __VLS_11;
        const __VLS_12 = ({ click: {} },
            { onClick: (...[$event]) => {
                    __VLS_ctx.handlerProxySelect(__VLS_ctx.name, node);
                    // @ts-ignore
                    [groupedProxies, showFullContent, maxProxies, name, name, now, handlerProxySelect,];
                } });
        var __VLS_9;
        var __VLS_10;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_3;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
