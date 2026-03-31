/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { CONNECTION_TAB_TYPE } from '@/constant';
import { connections, connectionTabShow, renderConnections } from '@/store/connections';
import { twMerge } from 'tailwind-merge';
import { computed } from 'vue';
const __VLS_props = defineProps({
    horizental: {
        type: Boolean,
        default: true,
    },
});
const connectionsCount = computed(() => {
    if (renderConnections.value.length !== connections.value.length) {
        return `${renderConnections.value.length} / ${connections.value.length}`;
    }
    return connections.value.length;
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
    ...{ class: "tabs-box tabs tabs-xs" },
});
/** @type {__VLS_StyleScopedClasses['tabs-box']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs-xs']} */ ;
for (const [tab] of __VLS_vFor((Object.values(__VLS_ctx.CONNECTION_TAB_TYPE)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (() => (__VLS_ctx.connectionTabShow = tab)) },
        key: (tab),
        role: "tab",
        ...{ class: (__VLS_ctx.twMerge('tab', __VLS_ctx.connectionTabShow === tab && 'tab-active', !__VLS_ctx.horizental && 'flex-1')) },
    });
    (__VLS_ctx.$t(tab));
    if (__VLS_ctx.connectionTabShow === tab) {
        (__VLS_ctx.connectionsCount);
    }
    // @ts-ignore
    [CONNECTION_TAB_TYPE, connectionTabShow, connectionTabShow, connectionTabShow, twMerge, horizental, $t, connectionsCount,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    props: {
        horizental: {
            type: Boolean,
            default: true,
        },
    },
});
export default {};
