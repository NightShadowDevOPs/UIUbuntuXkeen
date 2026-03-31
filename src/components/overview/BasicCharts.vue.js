/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { font, theme } from '@/store/settings';
import { PauseCircleIcon, PlayCircleIcon } from '@heroicons/vue/24/outline';
import { useElementSize } from '@vueuse/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { debounce } from 'lodash';
import { computed, onMounted, ref, watch } from 'vue';
echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);
const props = defineProps();
const colorRef = ref();
const chart = ref();
const isPaused = ref(false);
const colorSet = {
    primary30: '',
    primary60: '',
    info30: '',
    info60: '',
    baseContent10: '',
    baseContent: '',
    base70: '',
};
let fontFamily = '';
const updateColorSet = () => {
    const colorStyle = getComputedStyle(colorRef.value);
    colorSet.baseContent = colorStyle.getPropertyValue('--color-base-content').trim();
    colorSet.base70 = colorStyle.backgroundColor;
    colorSet.baseContent10 = colorStyle.color;
    colorSet.primary30 = colorStyle.borderTopColor;
    colorSet.primary60 = colorStyle.borderBottomColor;
    colorSet.info30 = colorStyle.borderLeftColor;
    colorSet.info60 = colorStyle.borderRightColor;
};
const updateFontFamily = () => {
    const baseColorStyle = getComputedStyle(colorRef.value);
    fontFamily = baseColorStyle.fontFamily;
};
const options = computed(() => {
    return {
        legend: {
            bottom: 0,
            data: props.data.map((item) => item.name),
            textStyle: {
                color: colorSet.baseContent,
                fontFamily,
            },
        },
        grid: {
            left: 60,
            top: 15,
            right: 8,
            bottom: 25,
        },
        tooltip: {
            show: true,
            trigger: 'axis',
            backgroundColor: colorSet.base70,
            borderColor: colorSet.base70,
            confine: true,
            padding: [0, 5],
            textStyle: {
                color: colorSet.baseContent,
                fontFamily,
            },
            formatter: props.toolTipFormatter,
        },
        xAxis: {
            type: 'category',
            axisLine: { show: false },
            axisLabel: { show: false },
            splitLine: { show: false },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            splitNumber: 4,
            max: (value) => {
                return Math.max(value.max, props.min);
            },
            axisLine: { show: false },
            splitLine: {
                show: true,
                lineStyle: {
                    type: 'dashed',
                    color: colorSet.baseContent10,
                },
            },
            axisLabel: {
                align: 'left',
                padding: [0, 0, 0, -45],
                formatter: props.labelFormatter,
                color: colorSet.baseContent,
                fontFamily,
            },
        },
        series: props.data.map((item, index) => {
            const seriesColor = index === props.data.length - 1 ? colorSet.primary60 : colorSet.info60;
            const areaColor = index === props.data.length - 1 ? colorSet.primary30 : colorSet.info30;
            return {
                name: item.name,
                symbol: 'none',
                emphasis: {
                    disabled: true,
                },
                lineStyle: {
                    width: 1,
                },
                data: item.data,
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        {
                            offset: 0,
                            color: seriesColor,
                        },
                        {
                            offset: 1,
                            color: areaColor,
                        },
                    ]),
                },
                type: 'line',
                color: seriesColor,
                smooth: true,
            };
        }),
    };
});
onMounted(() => {
    updateColorSet();
    updateFontFamily();
    watch(theme, updateColorSet);
    watch(font, updateFontFamily);
    const myChart = echarts.init(chart.value);
    myChart.setOption(options.value);
    watch(options, () => {
        if (isPaused.value) {
            return;
        }
        myChart?.setOption(options.value);
    });
    const { width } = useElementSize(chart);
    const resize = debounce(() => {
        myChart.resize();
    }, 100);
    watch(width, resize);
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
    ...{ class: "relative h-28 w-full overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['h-28']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "chart",
    ...{ class: "h-full w-full" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "border-b-primary/30 border-t-primary/60 border-l-info/30 border-r-info/60 text-base-content/10 bg-base-100/70 hidden" },
    ref: "colorRef",
});
/** @type {__VLS_StyleScopedClasses['border-b-primary/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-primary/60']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-info/30']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r-info/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.isPaused = !__VLS_ctx.isPaused;
            // @ts-ignore
            [isPaused, isPaused,];
        } },
    ...{ class: "btn btn-ghost btn-xs absolute right-1 bottom-0" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
const __VLS_0 = (!__VLS_ctx.isPaused ? __VLS_ctx.PauseCircleIcon : __VLS_ctx.PlayCircleIcon);
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
// @ts-ignore
[isPaused, PauseCircleIcon, PlayCircleIcon,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
