/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { CONNECTIONS_TABLE_ACCESSOR_KEY, DETAILED_CARD_STYLE, SIMPLE_CARD_STYLE } from '@/constant';
import { connectionCardLines } from '@/store/settings';
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { ref } from 'vue';
import Draggable from 'vuedraggable';
const restOfColumns = ref([]);
const setRestOfColumns = () => {
    restOfColumns.value = Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY).filter((key) => !connectionCardLines.value.flat().includes(key));
};
setRestOfColumns();
const addLine = () => {
    connectionCardLines.value = [
        ...connectionCardLines.value,
        restOfColumns.value[0] ? [restOfColumns.value[0]] : [],
    ];
    setRestOfColumns();
};
const removeLine = (index) => {
    connectionCardLines.value.splice(index, 1);
    setRestOfColumns();
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('customCardLines'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            ((__VLS_ctx.connectionCardLines = __VLS_ctx.SIMPLE_CARD_STYLE), __VLS_ctx.setRestOfColumns());
            // @ts-ignore
            [$t, connectionCardLines, SIMPLE_CARD_STYLE, setRestOfColumns,];
        } },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('simpleCardPreset'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            ((__VLS_ctx.connectionCardLines = __VLS_ctx.DETAILED_CARD_STYLE), __VLS_ctx.setRestOfColumns());
            // @ts-ignore
            [$t, connectionCardLines, setRestOfColumns, DETAILED_CARD_STYLE,];
        } },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('detailedCardPreset'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.addLine) },
    ...{ class: "btn btn-circle btn-neutral btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-neutral']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.PlusIcon} */
PlusIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative flex flex-col rounded-sm" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
for (const [_, index] of __VLS_vFor((__VLS_ctx.connectionCardLines))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (index),
        ...{ class: (`flex items-center gap-2 p-2 ${index % 2 === 0 ? 'bg-base-200' : 'bg-base-300'}`) },
    });
    if (__VLS_ctx.connectionCardLines.length > 1) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.connectionCardLines.length > 1))
                        return;
                    __VLS_ctx.removeLine(index);
                    // @ts-ignore
                    [$t, connectionCardLines, connectionCardLines, addLine, removeLine,];
                } },
            ...{ class: "btn btn-circle btn-neutral btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-neutral']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        let __VLS_5;
        /** @ts-ignore @type {typeof __VLS_components.TrashIcon} */
        TrashIcon;
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
    let __VLS_10;
    /** @ts-ignore @type {typeof __VLS_components.Draggable | typeof __VLS_components.Draggable} */
    Draggable;
    // @ts-ignore
    const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
        ...{ class: "flex flex-1 flex-wrap items-center gap-2" },
        modelValue: (__VLS_ctx.connectionCardLines[index]),
        animation: (150),
        group: "list",
        ghostClass: "ghost",
        itemKey: ((id) => id),
    }));
    const __VLS_12 = __VLS_11({
        ...{ class: "flex flex-1 flex-wrap items-center gap-2" },
        modelValue: (__VLS_ctx.connectionCardLines[index]),
        animation: (150),
        group: "list",
        ghostClass: "ghost",
        itemKey: ((id) => id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_11));
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    const { default: __VLS_15 } = __VLS_13.slots;
    {
        const { item: __VLS_16 } = __VLS_13.slots;
        const [{ element }] = __VLS_vSlot(__VLS_16);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bg-neutral text-neutral-content flex h-8 cursor-move items-center rounded-sm px-2 select-none" },
        });
        /** @type {__VLS_StyleScopedClasses['bg-neutral']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-neutral-content']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-move']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
        (__VLS_ctx.$t(element));
        // @ts-ignore
        [$t, connectionCardLines,];
    }
    // @ts-ignore
    [];
    var __VLS_13;
    // @ts-ignore
    [];
}
let __VLS_17;
/** @ts-ignore @type {typeof __VLS_components.Draggable | typeof __VLS_components.Draggable} */
Draggable;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    ...{ class: "flex flex-1 flex-wrap gap-2 p-2" },
    modelValue: (__VLS_ctx.restOfColumns),
    animation: (150),
    group: "list",
    ghostClass: "ghost",
    itemKey: ((id) => id),
}));
const __VLS_19 = __VLS_18({
    ...{ class: "flex flex-1 flex-wrap gap-2 p-2" },
    modelValue: (__VLS_ctx.restOfColumns),
    animation: (150),
    group: "list",
    ghostClass: "ghost",
    itemKey: ((id) => id),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
const { default: __VLS_22 } = __VLS_20.slots;
{
    const { item: __VLS_23 } = __VLS_20.slots;
    const [{ element }] = __VLS_vSlot(__VLS_23);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-base-200 text-base-content flex h-8 cursor-move items-center rounded-sm px-2 select-none" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-move']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
    (__VLS_ctx.$t(element));
    // @ts-ignore
    [$t, restOfColumns,];
}
// @ts-ignore
[];
var __VLS_20;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
