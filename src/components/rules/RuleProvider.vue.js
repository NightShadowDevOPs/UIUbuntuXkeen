/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { updateRuleProviderAPI } from '@/api';
import { useBounceOnVisible } from '@/composables/bouncein';
import { fromNow } from '@/helper/utils';
import { fetchRules } from '@/store/rules';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import { twMerge } from 'tailwind-merge';
import { ref } from 'vue';
const isUpdating = ref(false);
const props = defineProps();
const updateRuleProviderClickHandler = async () => {
    if (isUpdating.value)
        return;
    isUpdating.value = true;
    await updateRuleProviderAPI(props.ruleProvider.name);
    fetchRules();
    isUpdating.value = false;
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
    ...{ class: "card hover:bg-base-200 w-full gap-3 p-2 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-5 items-center gap-2 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.index);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-main" },
});
/** @type {__VLS_StyleScopedClasses['text-main']} */ ;
(__VLS_ctx.ruleProvider.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-base-content/80 text-xs" },
});
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
(__VLS_ctx.ruleProvider.ruleCount);
if (__VLS_ctx.ruleProvider.vehicleType !== 'Inline') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.updateRuleProviderClickHandler) },
        ...{ class: (__VLS_ctx.twMerge('btn btn-circle btn-xs btn-ghost', __VLS_ctx.isUpdating ? 'animate-spin' : '')) },
    });
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
    ArrowPathIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base-content/80 flex h-4 items-center gap-2 text-xs" },
});
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm min-w-16" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-16']} */ ;
(__VLS_ctx.ruleProvider.behavior);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm min-w-12" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-12']} */ ;
(__VLS_ctx.ruleProvider.vehicleType);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('updated'));
(__VLS_ctx.fromNow(__VLS_ctx.ruleProvider.updatedAt));
// @ts-ignore
[index, ruleProvider, ruleProvider, ruleProvider, ruleProvider, ruleProvider, ruleProvider, updateRuleProviderClickHandler, twMerge, isUpdating, $t, fromNow,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
