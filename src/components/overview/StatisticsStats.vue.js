/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { STATISTICS_TYPE, statisticsMap } from '@/composables/statistics';
import { computed } from 'vue';
const props = defineProps();
const classMap = {
    overview: {
        list: 'grid grid-cols-3 gap-2 lg:grid-cols-9',
        item: 'flex h-12 flex-col items-start justify-center rounded-lg bg-base-200/50 px-3 py-2 lg:gap-2 lg:h-24 lg:items-center',
        label: 'text-sm lg:text-lg lg:font-bold max-lg:text-base-content/70',
        value: 'text-lg lg:text-xl',
    },
    settings: {
        list: 'grid w-full grid-cols-3 gap-1 rounded-lg bg-base-200/50 p-3',
        item: 'flex flex-col items-start',
        label: 'text-xs text-base-content/70',
        value: 'text-sm',
    },
    ctrl: {
        list: 'grid w-full grid-cols-2 gap-2 rounded-lg bg-base-200/50 p-2',
        item: 'flex items-start flex-col',
        label: 'text-xs text-base-content/70',
        value: 'text-sm',
    },
};
const orderMap = {
    overview: [
        STATISTICS_TYPE.TOTAL_PROXIES,
        STATISTICS_TYPE.TOTAL_PROVIDERS,
        STATISTICS_TYPE.TOTAL_RULES,
        STATISTICS_TYPE.CONNECTIONS,
        STATISTICS_TYPE.MEMORY_USAGE,
        STATISTICS_TYPE.DOWNLOAD,
        STATISTICS_TYPE.DL_SPEED,
        STATISTICS_TYPE.UPLOAD,
        STATISTICS_TYPE.UL_SPEED,
    ],
    settings: [
        STATISTICS_TYPE.TOTAL_PROXIES,
        STATISTICS_TYPE.TOTAL_PROVIDERS,
        STATISTICS_TYPE.TOTAL_RULES,
        STATISTICS_TYPE.CONNECTIONS,
        STATISTICS_TYPE.DOWNLOAD,
        STATISTICS_TYPE.DL_SPEED,
        STATISTICS_TYPE.MEMORY_USAGE,
        STATISTICS_TYPE.UPLOAD,
        STATISTICS_TYPE.UL_SPEED,
    ],
    ctrl: [
        STATISTICS_TYPE.TOTAL_PROXIES,
        STATISTICS_TYPE.TOTAL_PROVIDERS,
        STATISTICS_TYPE.TOTAL_RULES,
        STATISTICS_TYPE.CONNECTIONS,
        STATISTICS_TYPE.MEMORY_USAGE,
        STATISTICS_TYPE.DOWNLOAD,
        STATISTICS_TYPE.DL_SPEED,
        STATISTICS_TYPE.UPLOAD,
        STATISTICS_TYPE.UL_SPEED,
    ],
};
const className = computed(() => classMap[props.type]);
const order = computed(() => orderMap[props.type]);
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
    ...{ class: (__VLS_ctx.className.list) },
});
for (const [stat] of __VLS_vFor((__VLS_ctx.order))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (stat),
        ...{ class: (__VLS_ctx.className.item) },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.className.label) },
    });
    (__VLS_ctx.$t(stat));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (__VLS_ctx.className.value) },
    });
    (__VLS_ctx.statisticsMap[stat]);
    // @ts-ignore
    [className, className, className, className, order, $t, statisticsMap,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
