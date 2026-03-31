/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { getToolTipForParams } from '@/helper';
import { prettyBytesHelper } from '@/helper/utils';
import { memoryHistory } from '@/store/overview';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BasicCharts from './BasicCharts.vue';
const { t } = useI18n();
const chartsData = computed(() => {
    return [
        {
            name: t('memoryUsage'),
            data: memoryHistory.value,
        },
    ];
});
const labelFormatter = (value) => {
    return `${prettyBytesHelper(value, {
        maximumFractionDigits: 0,
        binary: true,
    })}`;
};
const tooltipFormatter = (value) => {
    return getToolTipForParams(value[0], {
        binary: true,
        suffix: '',
    });
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = BasicCharts;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    data: (__VLS_ctx.chartsData),
    labelFormatter: (__VLS_ctx.labelFormatter),
    toolTipFormatter: (__VLS_ctx.tooltipFormatter),
    min: (100 * 1024 * 1024),
}));
const __VLS_2 = __VLS_1({
    data: (__VLS_ctx.chartsData),
    labelFormatter: (__VLS_ctx.labelFormatter),
    toolTipFormatter: (__VLS_ctx.tooltipFormatter),
    min: (100 * 1024 * 1024),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
var __VLS_3;
// @ts-ignore
[chartsData, labelFormatter, tooltipFormatter,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
