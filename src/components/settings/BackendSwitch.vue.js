/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ROUTE_NAME } from '@/constant';
import { getLabelFromBackend } from '@/helper/utils';
import router from '@/router';
import { activeBackend, activeUuid, backendList } from '@/store/setup';
import { PencilIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { computed, ref } from 'vue';
import EditBackendModal from './EditBackendModal.vue';
const __VLS_props = withDefaults(defineProps(), {
    disableEditBackend: false,
});
const opts = computed(() => {
    return backendList.value.map((b) => {
        return {
            label: getLabelFromBackend(b),
            value: b.uuid,
        };
    });
});
const showEditModal = ref(false);
const addBackend = () => {
    activeUuid.value = null;
    router.push({ name: ROUTE_NAME.setup });
};
const editBackend = () => {
    if (!activeBackend.value)
        return;
    showEditModal.value = true;
};
const __VLS_defaults = {
    disableEditBackend: false,
};
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
    ...{ class: "join flex" },
});
/** @type {__VLS_StyleScopedClasses['join']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "join-item select select-sm w-46 max-w-60 flex-1" },
    value: (__VLS_ctx.activeUuid),
});
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-46']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-60']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
for (const [opt] of __VLS_vFor((__VLS_ctx.opts))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt.value),
        value: (opt.value),
    });
    (opt.label);
    // @ts-ignore
    [activeUuid, opts,];
}
if (!__VLS_ctx.disableEditBackend) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.editBackend) },
        ...{ class: "btn join-item btn-sm" },
        disabled: (!__VLS_ctx.activeBackend),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.PencilIcon} */
    PencilIcon;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.addBackend) },
    ...{ class: "btn join-item btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.PlusIcon} */
PlusIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ class: "h-4 w-4" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
const __VLS_10 = EditBackendModal;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.showEditModal),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.showEditModal),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
// @ts-ignore
[disableEditBackend, editBackend, activeBackend, addBackend, showEditModal,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
