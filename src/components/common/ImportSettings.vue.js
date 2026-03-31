/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { autoImportSettings, DEFAULT_SETTINGS_URL, importSettingsFromUrl, importSettingsUrl, } from '@/helper/autoImportSettings';
import { showNotification } from '@/helper/notification';
import { useTooltip } from '@/helper/tooltip';
import { ArrowDownTrayIcon, ArrowUpCircleIcon, QuestionMarkCircleIcon, } from '@heroicons/vue/24/outline';
import { ref } from 'vue';
import DialogWrapper from './DialogWrapper.vue';
import TextInput from './TextInput.vue';
const inputRef = ref();
const importDialogShow = ref(false);
const { showTip } = useTooltip();
const handlerJsonUpload = () => {
    showNotification({
        content: 'importing',
    });
    const file = inputRef.value?.files?.[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = async () => {
        const settings = JSON.parse(reader.result);
        for (const key in settings) {
            localStorage.setItem(key, settings[key]);
        }
        location.reload();
    };
    reader.readAsText(file);
};
const importSettingsFromFile = () => {
    inputRef.value?.click();
};
const importSettingsFromUrlHandler = async () => {
    importDialogShow.value = false;
    await importSettingsFromUrl(true);
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.importDialogShow = true;
            // @ts-ignore
            [importDialogShow,];
        } },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('importSettings'));
const __VLS_0 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.importDialogShow),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.importDialogShow),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "my-4 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('importFromFile'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.importSettingsFromFile) },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('importFromFile'));
let __VLS_6;
/** @ts-ignore @type {typeof __VLS_components.ArrowUpCircleIcon} */
ArrowUpCircleIcon;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    ...{ class: "h-4 w-4" },
}));
const __VLS_8 = __VLS_7({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "my-4 flex items-center gap-2 max-sm:flex-col max-sm:items-start" },
});
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-sm:flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['max-sm:items-start']} */ ;
(__VLS_ctx.$t('importFromUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "join" },
});
/** @type {__VLS_StyleScopedClasses['join']} */ ;
const __VLS_11 = TextInput;
// @ts-ignore
const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
    modelValue: (__VLS_ctx.importSettingsUrl),
    ...{ class: "max-w-60" },
}));
const __VLS_13 = __VLS_12({
    modelValue: (__VLS_ctx.importSettingsUrl),
    ...{ class: "max-w-60" },
}, ...__VLS_functionalComponentArgsRest(__VLS_12));
/** @type {__VLS_StyleScopedClasses['max-w-60']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.importSettingsFromUrlHandler();
            // @ts-ignore
            [importDialogShow, $t, $t, $t, $t, importSettingsFromFile, importSettingsUrl, importSettingsFromUrlHandler,];
        } },
    ...{ class: "btn btn-sm join-item" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
let __VLS_16;
/** @ts-ignore @type {typeof __VLS_components.ArrowDownTrayIcon} */
ArrowDownTrayIcon;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
    ...{ class: "h-4 w-4" },
}));
const __VLS_18 = __VLS_17({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
if (__VLS_ctx.importSettingsUrl === __VLS_ctx.DEFAULT_SETTINGS_URL) {
    let __VLS_21;
    /** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
    QuestionMarkCircleIcon;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        ...{ 'onMouseenter': {} },
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onMouseenter': {} },
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = ({ mouseenter: {} },
        { onMouseenter: (...[$event]) => {
                if (!(__VLS_ctx.importSettingsUrl === __VLS_ctx.DEFAULT_SETTINGS_URL))
                    return;
                __VLS_ctx.showTip($event, __VLS_ctx.$t('importFromBackendTip'), {
                    appendTo: 'parent',
                });
                // @ts-ignore
                [$t, importSettingsUrl, DEFAULT_SETTINGS_URL, showTip,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    var __VLS_24;
    var __VLS_25;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.importSettingsUrl === __VLS_ctx.DEFAULT_SETTINGS_URL))
                    return;
                __VLS_ctx.importSettingsUrl = __VLS_ctx.DEFAULT_SETTINGS_URL;
                // @ts-ignore
                [importSettingsUrl, DEFAULT_SETTINGS_URL,];
            } },
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('reset'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "my-4 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex cursor-pointer items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('autoImportFromUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-sm" },
});
(__VLS_ctx.autoImportSettings);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
let __VLS_28;
/** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
QuestionMarkCircleIcon;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4" },
}));
const __VLS_30 = __VLS_29({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_33;
const __VLS_34 = ({ mouseenter: {} },
    { onMouseenter: (...[$event]) => {
            __VLS_ctx.showTip($event, __VLS_ctx.$t('autoImportFromUrlTip'), {
                appendTo: 'parent',
            });
            // @ts-ignore
            [$t, $t, $t, showTip, autoImportSettings,];
        } });
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
var __VLS_31;
var __VLS_32;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.handlerJsonUpload) },
    ref: "inputRef",
    type: "file",
    accept: ".json",
    ...{ class: "hidden" },
});
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
// @ts-ignore
[handlerJsonUpload,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
