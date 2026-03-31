/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { connectionsHistory, timeSaved } from '@/store/overview';
import dayjs from 'dayjs';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BasicCharts from './BasicCharts.vue';
const { t } = useI18n();
const chartsData = computed(() => {
    return [
        {
            name: t('connections'),
            data: connectionsHistory.value,
        },
    ];
});
const labelFormatter = (value) => {
    return `       ${value}`;
};
const tooltipFormatter = (value) => {
    return value
        .map((item) => {
        // fake data
        if (item.data.name < timeSaved + 1) {
            return;
        }
        return `
    <div class="flex items-center my-2 gap-1">
      <div class="w-4 h-4 rounded-full" style="background-color: ${item.color}"></div>
      ${item.seriesName}
      (${dayjs(item.data.name).format('HH:mm:ss')}): ${item.data.value}
    </div>`;
    })
        .join('\n');
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
    min: (100),
}));
const __VLS_2 = __VLS_1({
    data: (__VLS_ctx.chartsData),
    labelFormatter: (__VLS_ctx.labelFormatter),
    toolTipFormatter: (__VLS_ctx.tooltipFormatter),
    min: (100),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
var __VLS_3;
// @ts-ignore
[chartsData, labelFormatter, tooltipFormatter,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
