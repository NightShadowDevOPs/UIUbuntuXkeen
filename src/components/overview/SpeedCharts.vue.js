/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { getToolTipForParams } from '@/helper';
import { prettyBytesHelper } from '@/helper/utils';
import { downloadSpeedHistory, uploadSpeedHistory } from '@/store/overview';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BasicCharts from './BasicCharts.vue';
const chartRef = ref();
const { t } = useI18n();
const chartsData = computed(() => {
    return [
        {
            name: t('ulSpeed'),
            data: uploadSpeedHistory.value,
        },
        {
            name: t('dlSpeed'),
            data: downloadSpeedHistory.value,
        },
    ];
});
const labelFormatter = (value) => {
    return `${prettyBytesHelper(value, {
        maximumFractionDigits: 0,
        binary: false,
    })}/s`;
};
const tooltipFormatter = (value) => {
    return value
        .map((item) => {
        return getToolTipForParams(item, {
            binary: false,
            suffix: '/s',
        });
    })
        .join('');
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
    ref: "chartRef",
    data: (__VLS_ctx.chartsData),
    labelFormatter: (__VLS_ctx.labelFormatter),
    toolTipFormatter: (__VLS_ctx.tooltipFormatter),
    min: (60 * 1000),
}));
const __VLS_2 = __VLS_1({
    ref: "chartRef",
    data: (__VLS_ctx.chartsData),
    labelFormatter: (__VLS_ctx.labelFormatter),
    toolTipFormatter: (__VLS_ctx.tooltipFormatter),
    min: (60 * 1000),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
var __VLS_3;
// @ts-ignore
var __VLS_6 = __VLS_5;
// @ts-ignore
[chartsData, labelFormatter, tooltipFormatter,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
