/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { NOT_CONNECTED } from '@/constant';
import { getColorForLatency } from '@/helper';
import { useTooltip } from '@/helper/tooltip';
import { getHistoryByName, getLatencyByName } from '@/store/proxies';
import { BoltIcon } from '@heroicons/vue/24/outline';
import { CountUp } from 'countup.js';
import dayjs from 'dayjs';
import { twMerge } from 'tailwind-merge';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
const { showTip } = useTooltip();
const handlerHistoryTip = (e) => {
    const history = getHistoryByName(props.name ?? '', props.groupName);
    if (!history.length)
        return;
    const historyList = document.createElement('div');
    historyList.classList.add('flex', 'flex-col', 'gap-1');
    for (const item of history) {
        const itemDiv = document.createElement('div');
        const time = document.createElement('div');
        const latency = document.createElement('div');
        time.textContent = dayjs(item.time).format('YYYY-MM-DD HH:mm:ss');
        latency.textContent = item.delay + 'ms';
        latency.className = getColorForLatency(item.delay);
        itemDiv.classList.add('flex', 'items-center', 'gap-2');
        itemDiv.append(time, latency);
        historyList.append(itemDiv);
    }
    showTip(e, historyList, {
        delay: [1000, 0],
        trigger: 'mouseenter',
        touch: false,
    });
};
const props = defineProps();
const latencyRef = ref();
const latency = computed(() => getLatencyByName(props.name ?? '', props.groupName));
let countUp = null;
onMounted(() => {
    watch(latency, (value, OldValue) => {
        if (!countUp) {
            nextTick(() => {
                countUp = new CountUp(latencyRef.value, latency.value, {
                    duration: 1,
                    separator: '',
                    enableScrollSpy: false,
                    startVal: OldValue,
                });
                countUp?.update(value);
            });
        }
        else {
            countUp?.update(value);
        }
    });
});
onUnmounted(() => {
    countUp = null;
});
const color = computed(() => {
    return getColorForLatency(latency.value);
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
    ...{ onMouseenter: (__VLS_ctx.handlerHistoryTip) },
    ...{ class: (__VLS_ctx.twMerge('latency-tag bg-base-100 flex h-5 w-10 items-center justify-center rounded-xl text-xs select-none md:hover:shadow-sm', __VLS_ctx.color)) },
});
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-dots loading-xs text-base-content/80" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-dots']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
}
else if (__VLS_ctx.latency === __VLS_ctx.NOT_CONNECTED || !__VLS_ctx.latency) {
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
    BoltIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "text-base-content h-3 w-3" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "text-base-content h-3 w-3" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "latencyRef",
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.latency !== __VLS_ctx.NOT_CONNECTED && !__VLS_ctx.loading) }, null, null);
(__VLS_ctx.latency);
// @ts-ignore
[handlerHistoryTip, twMerge, color, loading, loading, latency, latency, latency, latency, NOT_CONNECTED, NOT_CONNECTED,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
