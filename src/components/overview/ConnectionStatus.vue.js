/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { get2ipLatencyAPI, getBaiduLatencyAPI, getCloudflareLatencyAPI, getGithubLatencyAPI, getLatencyFromTargetAPI, getYouTubeLatencyAPI, getYandexLatencyAPI, } from '@/api/latency';
import { baiduLatency, cloudflareLatency, customPingLatency, githubLatency, twoipLatency, yandexLatency, youtubeLatency, } from '@/composables/overview';
import { getColorForLatency } from '@/helper';
import { autoConnectionCheck, customPingTarget } from '@/store/settings';
import { BoltIcon } from '@heroicons/vue/24/outline';
import { onMounted } from 'vue';
const setMs = (refValue, ms) => {
    refValue.value = ms ? ms.toFixed(0) : '0';
};
const getLatency = async () => {
    getBaiduLatencyAPI().then((res) => setMs(baiduLatency, res));
    getCloudflareLatencyAPI().then((res) => setMs(cloudflareLatency, res));
    getGithubLatencyAPI().then((res) => setMs(githubLatency, res));
    getYouTubeLatencyAPI().then((res) => setMs(youtubeLatency, res));
    getYandexLatencyAPI().then((res) => setMs(yandexLatency, res));
    get2ipLatencyAPI().then((res) => setMs(twoipLatency, res));
};
const pingCustom = async () => {
    const target = (customPingTarget.value || '').trim();
    if (!target)
        return;
    customPingLatency.value = '';
    getLatencyFromTargetAPI(target).then((res) => setMs(customPingLatency, res));
};
onMounted(() => {
    if (autoConnectionCheck.value &&
        [baiduLatency, cloudflareLatency, githubLatency, youtubeLatency, yandexLatency, twoipLatency].some((item) => item.value === '')) {
        getLatency();
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "bg-base-200/50 relative rounded-lg p-2 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['bg-base-200/50']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-1 pr-12" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-12']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inline-block w-24" },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.getColorForLatency(Number(__VLS_ctx.baiduLatency))) },
});
(__VLS_ctx.baiduLatency);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inline-block w-24" },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.getColorForLatency(Number(__VLS_ctx.cloudflareLatency))) },
});
(__VLS_ctx.cloudflareLatency);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inline-block w-24" },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.getColorForLatency(Number(__VLS_ctx.githubLatency))) },
});
(__VLS_ctx.githubLatency);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inline-block w-24" },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.getColorForLatency(Number(__VLS_ctx.youtubeLatency))) },
});
(__VLS_ctx.youtubeLatency);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inline-block w-24" },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.getColorForLatency(Number(__VLS_ctx.yandexLatency))) },
});
(__VLS_ctx.yandexLatency);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inline-block w-24" },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['w-24']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.getColorForLatency(Number(__VLS_ctx.twoipLatency))) },
});
(__VLS_ctx.twoipLatency);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "input input-sm flex-1" },
    placeholder: (__VLS_ctx.$t('pingTargetPlaceholder')),
});
(__VLS_ctx.customPingTarget);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.pingCustom) },
    ...{ class: "btn btn-sm whitespace-nowrap min-w-16" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-16']} */ ;
(__VLS_ctx.$t('ping'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono min-w-[80px] text-right" },
    ...{ class: (__VLS_ctx.getColorForLatency(Number(__VLS_ctx.customPingLatency))) },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[80px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.customPingLatency ? __VLS_ctx.customPingLatency + 'ms' : '');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.getLatency) },
    ...{ class: "btn btn-circle btn-sm absolute right-2 top-2" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-2']} */ ;
/** @type {__VLS_StyleScopedClasses['top-2']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
BoltIcon;
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
[getColorForLatency, getColorForLatency, getColorForLatency, getColorForLatency, getColorForLatency, getColorForLatency, getColorForLatency, baiduLatency, baiduLatency, cloudflareLatency, cloudflareLatency, githubLatency, githubLatency, youtubeLatency, youtubeLatency, yandexLatency, yandexLatency, twoipLatency, twoipLatency, $t, $t, customPingTarget, pingCustom, customPingLatency, customPingLatency, customPingLatency, getLatency,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
