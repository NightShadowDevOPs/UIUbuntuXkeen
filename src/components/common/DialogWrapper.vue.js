/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { blurIntensity } from '@/store/settings';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { ref, watch } from 'vue';
const modalRef = ref();
const isOpen = defineModel();
const __VLS_props = defineProps();
watch(isOpen, (value) => {
    if (value) {
        modalRef.value?.showModal();
    }
    else {
        modalRef.value?.close();
    }
});
let __VLS_modelEmit;
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.dialog, __VLS_intrinsics.dialog)({
    ...{ onClose: (...[$event]) => {
            __VLS_ctx.isOpen = false;
            // @ts-ignore
            [isOpen,];
        } },
    ref: "modalRef",
    ...{ class: "modal" },
});
/** @type {__VLS_StyleScopedClasses['modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    method: "dialog",
    ...{ class: "modal-backdrop w-screen transition-[backdrop-filter]" },
    ...{ class: (__VLS_ctx.isOpen ? 'backdrop-blur-sm' : 'backdrop-blur-none') },
});
/** @type {__VLS_StyleScopedClasses['modal-backdrop']} */ ;
/** @type {__VLS_StyleScopedClasses['w-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-[backdrop-filter]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ class: "!outline-none" },
});
/** @type {__VLS_StyleScopedClasses['!outline-none']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "modal-box relative max-h-[90dvh] overflow-hidden p-0 max-md:max-h-[70dvh]" },
    ...{ class: (__VLS_ctx.blurIntensity < 5 && 'backdrop-blur-sm!') },
});
/** @type {__VLS_StyleScopedClasses['modal-box']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[90dvh]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
/** @type {__VLS_StyleScopedClasses['max-md:max-h-[70dvh]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    method: "dialog",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ class: "btn btn-circle btn-ghost btn-xs absolute top-1 right-1 z-10" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-1']} */ ;
/** @type {__VLS_StyleScopedClasses['right-1']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.XMarkIcon} */
XMarkIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
if (__VLS_ctx.isOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: (['max-h-[90dvh] overflow-y-auto max-md:max-h-[70dvh]', __VLS_ctx.noPadding ? 'p-0' : 'p-4']) },
    });
    /** @type {__VLS_StyleScopedClasses['max-h-[90dvh]']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-md:max-h-[70dvh]']} */ ;
    var __VLS_5 = {};
}
// @ts-ignore
var __VLS_6 = __VLS_5;
// @ts-ignore
[isOpen, isOpen, blurIntensity, noPadding,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
const __VLS_export = {};
export default {};
