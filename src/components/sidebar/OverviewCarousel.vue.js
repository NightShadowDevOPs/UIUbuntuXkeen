/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import ConnectionsCharts from '@/components/overview/ConnectionsCharts.vue';
import MemoryCharts from '@/components/overview/MemoryCharts.vue';
import SpeedCharts from '@/components/overview/SpeedCharts.vue';
import { numberOfChartsInSidebar } from '@/store/settings';
const classNameMap = {
    1: 'max-h-28',
    2: 'max-h-56',
    3: 'max-h-84',
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card scrollbar-hidden flex-2 overflow-y-auto text-sm" },
    ...{ class: (__VLS_ctx.classNameMap[__VLS_ctx.numberOfChartsInSidebar]) },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['scrollbar-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
const __VLS_0 = SpeedCharts;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-28 shrink-0" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-28 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-28']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
const __VLS_5 = MemoryCharts;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ class: "h-28 shrink-0" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-28 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['h-28']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
const __VLS_10 = ConnectionsCharts;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "h-28 shrink-0" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-28 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['h-28']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
// @ts-ignore
[classNameMap, numberOfChartsInSidebar,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
