/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useCalculateMaxProxies } from '@/composables/calculateMaxProxies';
import { handlerProxySelect } from '@/store/proxies';
import { computed } from 'vue';
import ProxyNodeCard from './ProxyNodeCard.vue';
import ProxyNodeGrid from './ProxyNodeGrid.vue';
const props = defineProps();
const { maxProxies } = useCalculateMaxProxies();
const proxies = computed(() => props.showFullContent ? props.renderProxies : props.renderProxies.slice(0, maxProxies.value));
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = ProxyNodeGrid || ProxyNodeGrid;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
for (const [node] of __VLS_vFor((__VLS_ctx.proxies))) {
    const __VLS_7 = ProxyNodeCard;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onClick': {} },
        key: (node),
        name: (node),
        groupName: (__VLS_ctx.name),
        active: (node === __VLS_ctx.now),
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        key: (node),
        name: (node),
        groupName: (__VLS_ctx.name),
        active: (node === __VLS_ctx.now),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = ({ click: {} },
        { onClick: (...[$event]) => {
                __VLS_ctx.handlerProxySelect(__VLS_ctx.name, node);
                // @ts-ignore
                [proxies, name, name, now, handlerProxySelect,];
            } });
    var __VLS_10;
    var __VLS_11;
    // @ts-ignore
    [];
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
