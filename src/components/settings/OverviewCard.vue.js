/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import ConnectionsCharts from '@/components/overview/ConnectionsCharts.vue';
import ConnectionStatus from '@/components/overview/ConnectionStatus.vue';
import IPCheck from '@/components/overview/IPCheck.vue';
import MemoryCharts from '@/components/overview/MemoryCharts.vue';
import SpeedCharts from '@/components/overview/SpeedCharts.vue';
import StatisticsStats from '@/components/overview/StatisticsStats.vue';
import { isSidebarCollapsed, showIPAndConnectionInfo } from '@/store/settings';
import { onMounted, ref } from 'vue';
const isMounted = ref(false);
onMounted(() => {
    requestAnimationFrame(() => {
        isMounted.value = true;
    });
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-title px-4 pt-4" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
(__VLS_ctx.$t('overview'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: ([
            'card-body grid grid-cols-1 gap-2',
            __VLS_ctx.isSidebarCollapsed
                ? ['md:grid-cols-2', __VLS_ctx.showIPAndConnectionInfo ? 'lg:grid-cols-3' : 'xl:grid-cols-4']
                : ['lg:grid-cols-2', __VLS_ctx.showIPAndConnectionInfo ? 'xl:grid-cols-3' : '2xl:grid-cols-4'],
        ]) },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_0 = StatisticsStats;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    type: "settings",
}));
const __VLS_2 = __VLS_1({
    type: "settings",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.showIPAndConnectionInfo) {
    const __VLS_5 = IPCheck;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
    const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
    const __VLS_10 = ConnectionStatus;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
    const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
}
const __VLS_15 = SpeedCharts;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({}));
const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
const __VLS_20 = MemoryCharts;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({}));
const __VLS_22 = __VLS_21({}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const __VLS_25 = ConnectionsCharts;
// @ts-ignore
const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({}));
const __VLS_27 = __VLS_26({}, ...__VLS_functionalComponentArgsRest(__VLS_26));
// @ts-ignore
[$t, isSidebarCollapsed, showIPAndConnectionInfo, showIPAndConnectionInfo, showIPAndConnectionInfo,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
