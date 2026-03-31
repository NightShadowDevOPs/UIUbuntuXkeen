/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { isSingBox } from '@/api';
import { backgroundImage } from '@/helper/indexeddb';
import { proxyGroupList, proxyMap } from '@/store/proxies';
import { blurIntensity, dashboardTransparent, font, theme } from '@/store/settings';
import { activeUuid } from '@/store/setup';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from '@heroicons/vue/24/outline';
import { useElementSize } from '@vueuse/core';
import { TreeChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { debounce } from 'lodash';
import { twMerge } from 'tailwind-merge';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
echarts.use([TreeChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);
const isFullScreen = ref(false);
const colorRef = ref();
const chart = ref();
const fullScreenChart = ref();
const fullChartStyle = computed(() => {
    return `backdrop-filter: blur(${blurIntensity.value}px);`;
});
const colorSet = {
    baseContent10: '',
    baseContent30: '',
    baseContent: '',
    base70: '',
};
let fontFamily = '';
const updateColorSet = () => {
    const colorStyle = getComputedStyle(colorRef.value);
    colorSet.baseContent = colorStyle.getPropertyValue('--color-base-content').trim();
    colorSet.baseContent10 = colorStyle.color;
    colorSet.baseContent30 = colorStyle.borderColor;
    colorSet.base70 = colorStyle.backgroundColor;
};
const updateFontFamily = () => {
    const baseColorStyle = getComputedStyle(colorRef.value);
    fontFamily = baseColorStyle.fontFamily;
};
const forEachAllProxies = (data, depth) => {
    const children = proxyMap.value[data.name];
    if (children) {
        data.children = [];
        children.all?.forEach((proxy, index) => {
            const childData = {
                name: proxy,
                value: proxy,
                collapsed: isFullScreen.value ? index % 2 === 0 : index !== 0,
            };
            data.children?.push(childData);
            forEachAllProxies(childData, depth + 1);
        });
    }
    if (data.children && data.children.length > 15) {
        data.collapsed = true;
    }
};
const treeData = computed(() => {
    const rootName = isSingBox.value ? 'SingBox' : 'Mihomo';
    const data = {
        name: rootName,
        children: [],
        collapsed: false,
    };
    const maxLeafs = isFullScreen.value ? 10 : 3;
    const every = Math.max(Math.floor(proxyGroupList.value.length / maxLeafs), 1);
    proxyGroupList.value.forEach((groupName, index) => {
        const childrenData = {
            name: groupName,
            collapsed: index % every !== 0,
        };
        const depth = 0;
        forEachAllProxies(childrenData, depth);
        data.children.push(childrenData);
    });
    return [data];
});
const options = computed(() => {
    return {
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: (params) => {
                const name = params.name;
                if (params.treeAncestors.length <= 2)
                    return name;
                const treeAncestors = params.treeAncestors;
                treeAncestors.splice(0, 2);
                return treeAncestors.map((item) => item.name).join(' > ');
            },
            backgroundColor: colorSet.base70,
            borderColor: colorSet.base70,
            confine: true,
            padding: [0, 5],
            textStyle: {
                color: colorSet.baseContent,
                fontFamily,
            },
        },
        series: [
            {
                type: 'tree',
                data: treeData.value,
                roam: true,
                top: '5%',
                left: '5%',
                bottom: '5%',
                right: '5%',
                symbolSize: 7,
                label: {
                    position: 'left',
                    verticalAlign: 'middle',
                    align: 'right',
                    fontSize: 9,
                    color: colorSet.baseContent,
                    fontFamily,
                },
                itemStyle: {
                    color: colorSet.baseContent30,
                },
                lineStyle: {
                    color: colorSet.baseContent10,
                },
                leaves: {
                    label: {
                        position: 'right',
                        verticalAlign: 'middle',
                        align: 'left',
                    },
                },
                emphasis: {
                    focus: 'descendant',
                },
                expandAndCollapse: true,
                animationThreshold: 99999999999,
                animationDuration: 550,
                animationDurationUpdate: 750,
                progressive: true,
                progressiveThreshold: 500,
                progressiveStep: 100,
                renderer: 'canvas',
                silent: false,
                animationEasing: 'cubicOut',
            },
        ],
    };
});
onMounted(() => {
    updateColorSet();
    updateFontFamily();
    watch(theme, updateColorSet);
    watch(font, updateFontFamily);
    const myChart = echarts.init(chart.value);
    const fullScreenMyChart = ref();
    myChart.setOption(options.value);
    watch([activeUuid, options, isFullScreen], () => {
        myChart?.clear();
        myChart?.setOption(options.value);
        if (isFullScreen.value) {
            nextTick(() => {
                if (!fullScreenMyChart.value) {
                    fullScreenMyChart.value = echarts.init(fullScreenChart.value);
                }
                fullScreenMyChart.value?.clear();
                fullScreenMyChart.value?.setOption(options.value);
            });
        }
        else {
            fullScreenMyChart.value?.dispose();
            fullScreenMyChart.value = undefined;
        }
    });
    const { width } = useElementSize(chart);
    const resize = debounce(() => {
        myChart.resize();
        fullScreenMyChart.value?.resize();
    }, 100);
    watch(width, resize);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousemove: () => { } },
    ...{ onTouchmove: () => { } },
    ...{ class: (__VLS_ctx.twMerge('relative h-96 w-full overflow-hidden')) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "chart",
    ...{ class: "h-full w-full" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "border-base-content/30 text-base-content/10 bg-base-100/70 hidden" },
    ref: "colorRef",
});
/** @type {__VLS_StyleScopedClasses['border-base-content/30']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.isFullScreen = !__VLS_ctx.isFullScreen;
            // @ts-ignore
            [twMerge, isFullScreen, isFullScreen,];
        } },
    ...{ class: "" },
    ...{ class: (__VLS_ctx.twMerge('btn btn-ghost btn-circle btn-sm absolute right-1 bottom-1', __VLS_ctx.isFullScreen ? 'fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]' : '')) },
});
/** @type {__VLS_StyleScopedClasses['']} */ ;
const __VLS_0 = (__VLS_ctx.isFullScreen ? __VLS_ctx.ArrowsPointingInIcon : __VLS_ctx.ArrowsPointingOutIcon);
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    to: "body",
}));
const __VLS_7 = __VLS_6({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const { default: __VLS_10 } = __VLS_8.slots;
if (__VLS_ctx.isFullScreen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-base-100 custom-background fixed inset-0 z-[9999] h-screen w-screen bg-cover bg-center" },
        ...{ class: (`blur-intensity-${__VLS_ctx.blurIntensity} custom-background-${__VLS_ctx.dashboardTransparent}`) },
        ...{ style: (__VLS_ctx.backgroundImage) },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['custom-background']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[9999]']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-cover']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ref: "fullScreenChart",
        ...{ class: "bg-base-100 h-full w-full" },
        ...{ style: (__VLS_ctx.fullChartStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isFullScreen))
                    return;
                __VLS_ctx.isFullScreen = false;
                // @ts-ignore
                [twMerge, isFullScreen, isFullScreen, isFullScreen, isFullScreen, ArrowsPointingInIcon, ArrowsPointingOutIcon, blurIntensity, dashboardTransparent, backgroundImage, fullChartStyle,];
            } },
        ...{ class: "btn btn-ghost btn-circle btn-sm fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-[env(safe-area-inset-bottom)]']} */ ;
    let __VLS_11;
    /** @ts-ignore @type {typeof __VLS_components.ArrowsPointingInIcon} */
    ArrowsPointingInIcon;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_13 = __VLS_12({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
// @ts-ignore
[];
var __VLS_8;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
