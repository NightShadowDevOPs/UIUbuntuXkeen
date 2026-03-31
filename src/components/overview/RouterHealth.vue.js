/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { fetchVersionSilentAPI } from '@/api';
import { prettyBytesHelper, fromNow as fromNowFn } from '@/helper/utils';
import { activeConnections, lastConnectionsTick } from '@/store/connections';
import { downloadSpeed, lastMemoryTick, lastTrafficTick, memory, uploadSpeed } from '@/store/overview';
import { BoltIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted, onUnmounted, ref } from 'vue';
const apiOk = ref(true);
const apiLatencyMs = ref(null);
const lastCheckAt = ref(0);
const isLoading = ref(false);
const prettyBytes = (b) => prettyBytesHelper(b);
const fromNow = (ts) => fromNowFn(new Date(ts).toISOString());
const ageLabel = (tick) => {
    if (!tick)
        return '—';
    const s = Math.floor((Date.now() - tick) / 1000);
    return s <= 0 ? '0s' : `${s}s`;
};
const wsOk = computed(() => {
    const now = Date.now();
    const memOk = lastMemoryTick.value && now - lastMemoryTick.value < 8000;
    const netOk = lastTrafficTick.value && now - lastTrafficTick.value < 8000;
    const connOk = lastConnectionsTick.value && now - lastConnectionsTick.value < 8000;
    return memOk && netOk && connOk;
});
let timer;
const check = async () => {
    if (isLoading.value)
        return;
    isLoading.value = true;
    try {
        const t0 = performance.now();
        await fetchVersionSilentAPI();
        const t1 = performance.now();
        apiOk.value = true;
        apiLatencyMs.value = Math.max(1, Math.round(t1 - t0));
    }
    catch {
        apiOk.value = false;
        apiLatencyMs.value = null;
    }
    finally {
        lastCheckAt.value = Date.now();
        isLoading.value = false;
    }
};
onMounted(() => {
    check();
    timer = setInterval(check, 30_000);
});
onUnmounted(() => {
    clearInterval(timer);
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
    ...{ class: "flex items-center justify-between pr-12" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-12']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-medium" },
});
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
(__VLS_ctx.$t('routerHealth'));
if (__VLS_ctx.lastCheckAt) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('lastCheck'));
    (__VLS_ctx.fromNow(__VLS_ctx.lastCheckAt));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-[auto_1fr]']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm" },
    ...{ class: (__VLS_ctx.apiOk ? 'badge-success' : 'badge-error') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
(__VLS_ctx.apiOk ? 'OK' : 'DOWN');
if (__VLS_ctx.apiOk && __VLS_ctx.apiLatencyMs) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.apiLatencyMs);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm" },
    ...{ class: (__VLS_ctx.wsOk ? 'badge-success' : 'badge-warning') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
(__VLS_ctx.wsOk ? 'OK' : 'STALE');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.ageLabel(__VLS_ctx.lastMemoryTick));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.ageLabel(__VLS_ctx.lastTrafficTick));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.ageLabel(__VLS_ctx.lastConnectionsTick));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('connections'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.activeConnections.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('memoryUsage'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.memory || 0));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('traffic'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.uploadSpeed || 0));
(__VLS_ctx.prettyBytes(__VLS_ctx.downloadSpeed || 0));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.check) },
    ...{ class: "btn btn-circle btn-sm absolute right-2 top-2" },
    ...{ class: (__VLS_ctx.isLoading && 'loading') },
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
[$t, $t, $t, $t, $t, lastCheckAt, lastCheckAt, fromNow, apiOk, apiOk, apiOk, apiLatencyMs, apiLatencyMs, wsOk, wsOk, ageLabel, ageLabel, ageLabel, lastMemoryTick, lastTrafficTick, lastConnectionsTick, activeConnections, prettyBytes, prettyBytes, prettyBytes, memory, uploadSpeed, downloadSpeed, check, isLoading,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
