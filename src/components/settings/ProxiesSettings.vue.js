/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { isSingBox } from '@/api';
import { PROXY_CARD_SIZE, PROXY_COUNT_MODE, PROXY_PREVIEW_TYPE } from '@/constant';
import { useTooltip } from '@/helper/tooltip';
import { getMinCardWidth } from '@/helper/utils';
import { proxyMap } from '@/store/proxies';
import { customGlobalNode, displayGlobalByMode, independentLatencyTest, IPv6test, lowLatency, mediumLatency, minProxyCardWidth, proxyCardSize, proxyCountMode, proxyGroupIconMargin, proxyGroupIconSize, proxyPreviewType, speedtestTimeout, speedtestUrl, truncateProxyName, hideUnusedProxyProviders, proxyProviderCardOpacity, twoColumnProxyGroup, } from '@/store/settings';
import { autoSortProxyProvidersByHealth } from '@/store/providerHealth';
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import TextInput from '../common/TextInput.vue';
import IconSettings from './IconSettings.vue';
const { showTip } = useTooltip();
const { t } = useI18n();
const independentLatencyTestTip = (e) => {
    return showTip(e, t('independentLatencyTestTip'));
};
const handlerProxyCardSizeChange = () => {
    minProxyCardWidth.value = getMinCardWidth(proxyCardSize.value);
};
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
(__VLS_ctx.$t('proxies'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex w-full items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('speedtestUrl'));
const __VLS_0 = TextInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "w-36 flex-1 sm:max-w-80" },
    modelValue: (__VLS_ctx.speedtestUrl),
    clearable: (true),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "w-36 flex-1 sm:max-w-80" },
    modelValue: (__VLS_ctx.speedtestUrl),
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['w-36']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:max-w-80']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex w-full items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('speedtestTimeout'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "input input-sm w-20" },
});
(__VLS_ctx.speedtestTimeout);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('lowLatencyDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "input input-sm w-20" },
});
(__VLS_ctx.lowLatency);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('mediumLatencyDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "input input-sm w-20" },
});
(__VLS_ctx.mediumLatency);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex w-full items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('independentLatencyTest'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.independentLatencyTest);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
QuestionMarkCircleIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4" },
}));
const __VLS_7 = __VLS_6({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = ({ mouseenter: {} },
    { onMouseenter: (__VLS_ctx.independentLatencyTestTip) });
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
var __VLS_8;
var __VLS_9;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('ipv6Test'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.IPv6test);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('twoColumnProxyGroup'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.twoColumnProxyGroup);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('proxyPreviewType'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm min-w-24" },
    value: (__VLS_ctx.proxyPreviewType),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-24']} */ ;
for (const [opt] of __VLS_vFor((Object.values(__VLS_ctx.PROXY_PREVIEW_TYPE)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (__VLS_ctx.$t(opt));
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, speedtestUrl, speedtestTimeout, lowLatency, mediumLatency, independentLatencyTest, independentLatencyTestTip, IPv6test, twoColumnProxyGroup, proxyPreviewType, PROXY_PREVIEW_TYPE,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('proxyCountMode'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm min-w-24" },
    value: (__VLS_ctx.proxyCountMode),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-24']} */ ;
for (const [opt] of __VLS_vFor((Object.values(__VLS_ctx.PROXY_COUNT_MODE)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (__VLS_ctx.$t(opt));
    // @ts-ignore
    [$t, $t, proxyCountMode, PROXY_COUNT_MODE,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('proxyCardSize'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.handlerProxyCardSizeChange) },
    ...{ class: "select select-sm min-w-24" },
    value: (__VLS_ctx.proxyCardSize),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-24']} */ ;
for (const [opt] of __VLS_vFor((Object.values(__VLS_ctx.PROXY_CARD_SIZE)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (__VLS_ctx.$t(opt));
    // @ts-ignore
    [$t, $t, handlerProxyCardSizeChange, proxyCardSize, PROXY_CARD_SIZE,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('displayGlobalByMode'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.displayGlobalByMode);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
if (__VLS_ctx.displayGlobalByMode && __VLS_ctx.isSingBox) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('customGlobalNode'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm min-w-24" },
        value: (__VLS_ctx.customGlobalNode),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-24']} */ ;
    for (const [opt] of __VLS_vFor((Object.keys(__VLS_ctx.proxyMap)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (opt),
            value: (opt),
        });
        (opt);
        // @ts-ignore
        [$t, $t, displayGlobalByMode, displayGlobalByMode, isSingBox, customGlobalNode, proxyMap,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('truncateProxyName'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.truncateProxyName);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('hideUnusedProxyProviders'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.hideUnusedProxyProviders);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('autoSortProxyProvidersByHealth'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.autoSortProxyProvidersByHealth);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2 lg:col-span-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ ;
(__VLS_ctx.$t('proxyProviderCardOpacity'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "range",
    min: "45",
    max: "100",
    ...{ class: "range max-w-64" },
});
(__VLS_ctx.proxyProviderCardOpacity);
/** @type {__VLS_StyleScopedClasses['range']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-64']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "w-12 text-right text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.proxyProviderCardOpacity);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-60 lg:col-span-2" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:col-span-2']} */ ;
(__VLS_ctx.$t('proxyProviderCardOpacityTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('proxyGroupIconSize'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "input input-sm w-20" },
});
(__VLS_ctx.proxyGroupIconSize);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('proxyGroupIconMargin'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    ...{ class: "input input-sm w-20" },
});
(__VLS_ctx.proxyGroupIconMargin);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
const __VLS_12 = IconSettings;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({}));
const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
// @ts-ignore
[$t, $t, $t, $t, $t, $t, $t, truncateProxyName, hideUnusedProxyProviders, autoSortProxyProvidersByHealth, proxyProviderCardOpacity, proxyProviderCardOpacity, proxyGroupIconSize, proxyGroupIconMargin,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
