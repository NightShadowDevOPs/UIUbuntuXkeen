/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useBounceOnVisible } from '@/composables/bouncein';
import { LOG_LEVEL } from '@/constant';
import { computed } from 'vue';
const props = defineProps();
const seqWithPadding = computed(() => {
    return props.log.seq.toString().padStart(2, '0');
});
const textColorMapForType = {
    [LOG_LEVEL.Trace]: 'text-success',
    [LOG_LEVEL.Debug]: 'text-accent',
    [LOG_LEVEL.Info]: 'text-info',
    [LOG_LEVEL.Warning]: 'text-warning',
    [LOG_LEVEL.Error]: 'text-error',
    [LOG_LEVEL.Fatal]: 'text-error',
    [LOG_LEVEL.Panic]: 'text-error',
};
useBounceOnVisible();
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
    ...{ class: "card hover:bg-base-200 mb-1 block p-2 text-sm break-all" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['block']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "inline-block text-left" },
    ...{ style: ({ minWidth: `${(__VLS_ctx.seqWithPadding.length + 1) * 0.62}em` }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
(__VLS_ctx.seqWithPadding);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm text-main ml-2 inline-block min-w-14" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-main']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-14']} */ ;
(__VLS_ctx.log.time);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm ml-2 inline-block min-w-17 text-center" },
    ...{ class: (__VLS_ctx.textColorMapForType[__VLS_ctx.log.type]) },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-17']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
(__VLS_ctx.log.type);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "max-md:mt-2 max-md:block md:ml-2" },
});
/** @type {__VLS_StyleScopedClasses['max-md:mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-md:block']} */ ;
/** @type {__VLS_StyleScopedClasses['md:ml-2']} */ ;
(__VLS_ctx.log.payload);
// @ts-ignore
[seqWithPadding, seqWithPadding, log, log, log, log, textColorMapForType, textColorMapForType,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
