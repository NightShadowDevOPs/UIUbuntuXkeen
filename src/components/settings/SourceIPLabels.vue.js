/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { disableSwipe } from '@/composables/swipe';
import { sourceIPLabelList } from '@/store/settings';
import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon, PlusIcon, TagIcon, TrashIcon, } from '@heroicons/vue/24/outline';
import { useSessionStorage } from '@vueuse/core';
import { v4 as uuid } from 'uuid';
import { ref } from 'vue';
import Draggable from 'vuedraggable';
import SourceIPInput from './SourceIPInput.vue';
const dialogVisible = useSessionStorage('cache/sourceip-label-dialog-visible', false);
const newLabelForIP = ref({
    key: '',
    label: '',
});
const handlerLabelAdd = () => {
    if (!newLabelForIP.value.key || !newLabelForIP.value.label) {
        return;
    }
    dialogVisible.value = true;
    sourceIPLabelList.value.push({
        ...newLabelForIP.value,
        id: uuid(),
    });
    newLabelForIP.value = {
        key: '',
        label: '',
    };
};
const handlerLabelRemove = (id) => {
    sourceIPLabelList.value.splice(sourceIPLabelList.value.findIndex((item) => item.id === id), 1);
};
const handlerLabelUpdate = (sourceIP) => {
    const index = sourceIPLabelList.value.findIndex((item) => item.id === sourceIP.id);
    sourceIPLabelList.value[index] = {
        ...sourceIPLabelList.value[index],
        ...sourceIP,
    };
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('sourceIPLabels'));
if (__VLS_ctx.sourceIPLabelList.length) {
    (__VLS_ctx.sourceIPLabelList.length);
}
if (__VLS_ctx.sourceIPLabelList.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.sourceIPLabelList.length))
                    return;
                __VLS_ctx.dialogVisible = !__VLS_ctx.dialogVisible;
                // @ts-ignore
                [$t, sourceIPLabelList, sourceIPLabelList, sourceIPLabelList, dialogVisible, dialogVisible,];
            } },
        ...{ class: "btn btn-sm btn-circle" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    if (__VLS_ctx.dialogVisible) {
        let __VLS_0;
        /** @ts-ignore @type {typeof __VLS_components.ChevronUpIcon} */
        ChevronUpIcon;
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
    else {
        let __VLS_5;
        /** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
        ChevronDownIcon;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "transparent-collapse collapse rounded-none shadow-none" },
    ...{ class: (__VLS_ctx.dialogVisible ? 'collapse-open' : '') },
});
/** @type {__VLS_StyleScopedClasses['transparent-collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['collapse']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-none']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-none']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "collapse-content p-0" },
});
/** @type {__VLS_StyleScopedClasses['collapse-content']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
if (__VLS_ctx.dialogVisible) {
    let __VLS_10;
    /** @ts-ignore @type {typeof __VLS_components.Draggable | typeof __VLS_components.Draggable} */
    Draggable;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        ...{ 'onStart': {} },
        ...{ 'onEnd': {} },
        ...{ class: "flex flex-1 flex-col gap-2" },
        modelValue: (__VLS_ctx.sourceIPLabelList),
        group: "list",
        animation: (150),
        handle: ('.drag-handle'),
        itemKey: ('uuid'),
    }));
    const __VLS_12 = __VLS_11({
        ...{ 'onStart': {} },
        ...{ 'onEnd': {} },
        ...{ class: "flex flex-1 flex-col gap-2" },
        modelValue: (__VLS_ctx.sourceIPLabelList),
        group: "list",
        animation: (150),
        handle: ('.drag-handle'),
        itemKey: ('uuid'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    let __VLS_15;
    const __VLS_16 = ({ start: {} },
        { onStart: (...[$event]) => {
                if (!(__VLS_ctx.dialogVisible))
                    return;
                __VLS_ctx.disableSwipe = true;
                // @ts-ignore
                [sourceIPLabelList, dialogVisible, dialogVisible, dialogVisible, disableSwipe,];
            } });
    const __VLS_17 = ({ end: {} },
        { onEnd: (...[$event]) => {
                if (!(__VLS_ctx.dialogVisible))
                    return;
                __VLS_ctx.disableSwipe = false;
                // @ts-ignore
                [disableSwipe,];
            } });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const { default: __VLS_18 } = __VLS_13.slots;
    {
        const { item: __VLS_19 } = __VLS_13.slots;
        const [{ element: sourceIP }] = __VLS_vSlot(__VLS_19);
        const __VLS_20 = SourceIPInput || SourceIPInput;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (sourceIP),
        }));
        const __VLS_22 = __VLS_21({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (sourceIP),
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        let __VLS_25;
        const __VLS_26 = ({ 'update:modelValue': {} },
            { 'onUpdate:modelValue': (__VLS_ctx.handlerLabelUpdate) });
        const { default: __VLS_27 } = __VLS_23.slots;
        {
            const { prefix: __VLS_28 } = __VLS_23.slots;
            let __VLS_29;
            /** @ts-ignore @type {typeof __VLS_components.ChevronUpDownIcon} */
            ChevronUpDownIcon;
            // @ts-ignore
            const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
                ...{ class: "drag-handle h-4 w-4 shrink-0 cursor-grab" },
            }));
            const __VLS_31 = __VLS_30({
                ...{ class: "drag-handle h-4 w-4 shrink-0 cursor-grab" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_30));
            /** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-grab']} */ ;
            // @ts-ignore
            [handlerLabelUpdate,];
        }
        {
            const { default: __VLS_34 } = __VLS_23.slots;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (() => __VLS_ctx.handlerLabelRemove(sourceIP.id)) },
                ...{ class: "btn btn-circle btn-ghost btn-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            let __VLS_35;
            /** @ts-ignore @type {typeof __VLS_components.TrashIcon} */
            TrashIcon;
            // @ts-ignore
            const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_37 = __VLS_36({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_36));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            // @ts-ignore
            [handlerLabelRemove,];
        }
        // @ts-ignore
        [];
        var __VLS_23;
        var __VLS_24;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_13;
    var __VLS_14;
}
const __VLS_40 = SourceIPInput || SourceIPInput;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.newLabelForIP),
}));
const __VLS_42 = __VLS_41({
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.newLabelForIP),
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
let __VLS_45;
const __VLS_46 = ({ keydown: {} },
    { onKeydown: (__VLS_ctx.handlerLabelAdd) });
const { default: __VLS_47 } = __VLS_43.slots;
{
    const { prefix: __VLS_48 } = __VLS_43.slots;
    let __VLS_49;
    /** @ts-ignore @type {typeof __VLS_components.TagIcon} */
    TagIcon;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
        ...{ class: "h-4 w-4 shrink-0" },
    }));
    const __VLS_51 = __VLS_50({
        ...{ class: "h-4 w-4 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    // @ts-ignore
    [newLabelForIP, handlerLabelAdd,];
}
{
    const { default: __VLS_54 } = __VLS_43.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handlerLabelAdd) },
        ...{ class: "btn btn-circle btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    let __VLS_55;
    /** @ts-ignore @type {typeof __VLS_components.PlusIcon} */
    PlusIcon;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_57 = __VLS_56({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [handlerLabelAdd,];
}
// @ts-ignore
[];
var __VLS_43;
var __VLS_44;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
