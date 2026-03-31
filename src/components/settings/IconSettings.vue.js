/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { proxyGroupList } from '@/store/proxies';
import { iconReflectList } from '@/store/settings';
import { ArrowRightCircleIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon, } from '@heroicons/vue/24/outline';
import { useSessionStorage } from '@vueuse/core';
import { v4 as uuid } from 'uuid';
import { reactive } from 'vue';
import TextInput from '../common/TextInput.vue';
const dialogVisible = useSessionStorage('cache/icon-dialog-visible', false);
const newIconReflect = reactive({
    name: '',
    icon: '',
});
const addIconReflect = () => {
    if (!newIconReflect.name || !newIconReflect.icon)
        return;
    dialogVisible.value = true;
    iconReflectList.value.push({ ...newIconReflect, uuid: uuid() });
    newIconReflect.name = '';
    newIconReflect.icon = '';
};
const removeIconReflect = (uuid) => {
    const index = iconReflectList.value.findIndex((item) => item.uuid === uuid);
    iconReflectList.value.splice(index, 1);
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
(__VLS_ctx.$t('customIcon'));
if (__VLS_ctx.iconReflectList.length) {
    (__VLS_ctx.iconReflectList.length);
}
if (__VLS_ctx.iconReflectList.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.iconReflectList.length))
                    return;
                __VLS_ctx.dialogVisible = !__VLS_ctx.dialogVisible;
                // @ts-ignore
                [$t, iconReflectList, iconReflectList, iconReflectList, dialogVisible, dialogVisible,];
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
    ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
if (__VLS_ctx.dialogVisible) {
    for (const [iconReflect] of __VLS_vFor((__VLS_ctx.iconReflectList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (iconReflect.uuid),
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        const __VLS_10 = TextInput;
        // @ts-ignore
        const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
            ...{ class: "w-32" },
            modelValue: (iconReflect.name),
            placeholder: "Name",
        }));
        const __VLS_12 = __VLS_11({
            ...{ class: "w-32" },
            modelValue: (iconReflect.name),
            placeholder: "Name",
        }, ...__VLS_functionalComponentArgsRest(__VLS_11));
        /** @type {__VLS_StyleScopedClasses['w-32']} */ ;
        let __VLS_15;
        /** @ts-ignore @type {typeof __VLS_components.ArrowRightCircleIcon} */
        ArrowRightCircleIcon;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        const __VLS_20 = TextInput;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            modelValue: (iconReflect.icon),
            placeholder: "Icon URL",
        }));
        const __VLS_22 = __VLS_21({
            modelValue: (iconReflect.icon),
            placeholder: "Icon URL",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.dialogVisible))
                        return;
                    __VLS_ctx.removeIconReflect(iconReflect.uuid);
                    // @ts-ignore
                    [iconReflectList, dialogVisible, dialogVisible, dialogVisible, removeIconReflect,];
                } },
            ...{ class: "btn btn-sm btn-circle" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        let __VLS_25;
        /** @ts-ignore @type {typeof __VLS_components.TrashIcon} */
        TrashIcon;
        // @ts-ignore
        const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_27 = __VLS_26({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_26));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        // @ts-ignore
        [];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_30 = TextInput;
// @ts-ignore
const __VLS_31 = __VLS_asFunctionalComponent1(__VLS_30, new __VLS_30({
    ...{ class: "w-32" },
    modelValue: (__VLS_ctx.newIconReflect.name),
    placeholder: "Name",
    menus: (__VLS_ctx.proxyGroupList.filter((group) => !__VLS_ctx.iconReflectList.some((item) => item.name === group))),
}));
const __VLS_32 = __VLS_31({
    ...{ class: "w-32" },
    modelValue: (__VLS_ctx.newIconReflect.name),
    placeholder: "Name",
    menus: (__VLS_ctx.proxyGroupList.filter((group) => !__VLS_ctx.iconReflectList.some((item) => item.name === group))),
}, ...__VLS_functionalComponentArgsRest(__VLS_31));
/** @type {__VLS_StyleScopedClasses['w-32']} */ ;
let __VLS_35;
/** @ts-ignore @type {typeof __VLS_components.ArrowRightCircleIcon} */
ArrowRightCircleIcon;
// @ts-ignore
const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
    ...{ class: "h-4 w-4 shrink-0" },
}));
const __VLS_37 = __VLS_36({
    ...{ class: "h-4 w-4 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_36));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
const __VLS_40 = TextInput;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
    modelValue: (__VLS_ctx.newIconReflect.icon),
    placeholder: "Icon URL",
}));
const __VLS_42 = __VLS_41({
    modelValue: (__VLS_ctx.newIconReflect.icon),
    placeholder: "Icon URL",
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.addIconReflect) },
    ...{ class: "btn btn-sm btn-circle" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
let __VLS_45;
/** @ts-ignore @type {typeof __VLS_components.PlusIcon} */
PlusIcon;
// @ts-ignore
const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
    ...{ class: "h-4 w-4 shrink-0" },
}));
const __VLS_47 = __VLS_46({
    ...{ class: "h-4 w-4 shrink-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_46));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
// @ts-ignore
[iconReflectList, newIconReflect, newIconReflect, proxyGroupList, addIconReflect,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
