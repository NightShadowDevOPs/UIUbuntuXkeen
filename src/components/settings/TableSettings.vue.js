/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { CONNECTIONS_TABLE_ACCESSOR_KEY } from '@/constant';
import { connectionTableColumns } from '@/store/settings';
import { ref } from 'vue';
import Draggable from 'vuedraggable';
const restOfColumns = ref(Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY).filter((key) => !connectionTableColumns.value.includes(key)));
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
(__VLS_ctx.$t('customTableColumns'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex gap-4 rounded-sm" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.Draggable | typeof __VLS_components.Draggable} */
Draggable;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "bg-base-200 flex flex-1 flex-col gap-2 p-4" },
    modelValue: (__VLS_ctx.connectionTableColumns),
    group: "list",
    animation: (150),
    itemKey: ((id) => id),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "bg-base-200 flex flex-1 flex-col gap-2 p-4" },
    modelValue: (__VLS_ctx.connectionTableColumns),
    group: "list",
    animation: (150),
    itemKey: ((id) => id),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
{
    const { item: __VLS_6 } = __VLS_3.slots;
    const [{ element }] = __VLS_vSlot(__VLS_6);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-neutral text-neutral-content flex h-8 cursor-move items-center justify-center rounded-sm px-2 select-none" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-neutral']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-neutral-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-move']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
    (__VLS_ctx.$t(element));
    // @ts-ignore
    [$t, $t, connectionTableColumns,];
}
// @ts-ignore
[];
var __VLS_3;
let __VLS_7;
/** @ts-ignore @type {typeof __VLS_components.Draggable | typeof __VLS_components.Draggable} */
Draggable;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    ...{ class: "flex flex-1 flex-col gap-2 p-4" },
    modelValue: (__VLS_ctx.restOfColumns),
    group: "list",
    animation: (150),
    itemKey: ((id) => id),
}));
const __VLS_9 = __VLS_8({
    ...{ class: "flex flex-1 flex-col gap-2 p-4" },
    modelValue: (__VLS_ctx.restOfColumns),
    group: "list",
    animation: (150),
    itemKey: ((id) => id),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
const { default: __VLS_12 } = __VLS_10.slots;
{
    const { item: __VLS_13 } = __VLS_10.slots;
    const [{ element }] = __VLS_vSlot(__VLS_13);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-base-200 text-base-content flex h-8 cursor-move items-center justify-center rounded-sm px-2 select-none" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-move']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
    (__VLS_ctx.$t(element));
    // @ts-ignore
    [$t, restOfColumns,];
}
// @ts-ignore
[];
var __VLS_10;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
