/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { renderConnections } from '@/store/connections';
import { connectionCardLines } from '@/store/settings';
import { computed } from 'vue';
import VirtualScroller from '../common/VirtualScroller.vue';
import ConnectionCard from './ConnectionCard';
import SourceIPStats from './SourceIPStats.vue';
const size = computed(() => {
    return connectionCardLines.value.length * 28 + 4;
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
const __VLS_0 = SourceIPStats;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "mb-2" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "mb-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
if (!__VLS_ctx.renderConnections.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card m-2 flex-row p-2 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['m-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.$t('noContent'));
}
else {
    const __VLS_5 = VirtualScroller || VirtualScroller;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        data: (__VLS_ctx.renderConnections),
        size: (__VLS_ctx.size),
    }));
    const __VLS_7 = __VLS_6({
        data: (__VLS_ctx.renderConnections),
        size: (__VLS_ctx.size),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    const { default: __VLS_10 } = __VLS_8.slots;
    {
        const { default: __VLS_11 } = __VLS_8.slots;
        const [{ item }] = __VLS_vSlot(__VLS_11, (_) => []);
        let __VLS_12;
        /** @ts-ignore @type {typeof __VLS_components.ConnectionCard} */
        ConnectionCard;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
            ...{ class: "mb-1" },
            conn: (item),
        }));
        const __VLS_14 = __VLS_13({
            ...{ class: "mb-1" },
            conn: (item),
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        // @ts-ignore
        [renderConnections, renderConnections, $t, size,];
        __VLS_8.slots['' /* empty slot name completion */];
    }
    // @ts-ignore
    [];
    var __VLS_8;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
