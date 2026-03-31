/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ALL_THEME, DEFAULT_THEME } from '@/constant';
import { applyCustomThemes } from '@/helper';
import { customThemes, darkTheme, defaultTheme } from '@/store/settings';
import { v4 as uuid } from 'uuid';
import { computed, nextTick, reactive, ref } from 'vue';
import DialogWrapper from '../common/DialogWrapper.vue';
import TextInput from '../common/TextInput.vue';
const model = defineModel('value', {
    default: false,
});
const applyFrom = ref(ALL_THEME[0]);
const customTheme = reactive({ ...(customThemes.value[0] || DEFAULT_THEME) });
const colors = computed(() => {
    return Object.keys(customTheme).filter((key) => key.startsWith('--color-'));
});
const radiusKey = computed(() => {
    return Object.keys(customTheme).filter((key) => key.startsWith('--radius-'));
});
const sizeKey = computed(() => {
    return Object.keys(customTheme).filter((key) => key.startsWith('--size-'));
});
const depth = computed({
    get: () => customTheme['--depth'] === '1',
    set: (value) => {
        customTheme['--depth'] = value ? '1' : '0';
    },
});
const noise = computed({
    get: () => customTheme['--noise'] === '1',
    set: (value) => {
        customTheme['--noise'] = value ? '1' : '0';
    },
});
const dark = computed({
    get: () => customTheme['color-scheme'] === 'dark',
    set: (value) => {
        customTheme['color-scheme'] = value ? 'dark' : 'light';
    },
});
const handlerCustomThemeSave = async () => {
    customThemes.value = [
        {
            ...customTheme,
            id: uuid(),
        },
    ];
    defaultTheme.value = '';
    darkTheme.value = '';
    await nextTick();
    defaultTheme.value = customTheme.name;
    darkTheme.value = customTheme.name;
    applyCustomThemes();
};
const resetCustomTheme = () => {
    const themeElement = document.createElement('div');
    themeElement.dataset.theme = applyFrom.value;
    themeElement.style.display = 'none';
    document.body.appendChild(themeElement);
    const styles = getComputedStyle(themeElement);
    Object.keys(DEFAULT_THEME).forEach((key) => {
        const value = styles.getPropertyValue(key).trim();
        if (value) {
            customTheme[key] = value;
        }
    });
    themeElement.remove();
    handlerCustomThemeSave();
};
const __VLS_defaultModels = {
    'value': false,
};
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
const __VLS_0 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.model),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.model),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-4 gap-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
for (const [color] of __VLS_vFor((__VLS_ctx.colors))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (color),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex cursor-pointer flex-col items-center gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex h-6 items-center justify-center text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (color.replace('--color-', ''));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "border-base-content h-6 w-6 rounded border-2" },
        ...{ style: (`background-color: ${__VLS_ctx.customTheme[color]};`) },
    });
    /** @type {__VLS_StyleScopedClasses['border-base-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "h-1 w-1 opacity-0" },
        key: (color),
        type: "color",
    });
    (__VLS_ctx.customTheme[color]);
    /** @type {__VLS_StyleScopedClasses['h-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
    // @ts-ignore
    [model, colors, customTheme, customTheme, customTheme, customTheme,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
for (const [radius] of __VLS_vFor((__VLS_ctx.radiusKey))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (radius),
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (radius.replace('--radius-', ''));
    const __VLS_7 = TextInput;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ class: "w-20" },
        modelValue: __VLS_ctx.customTheme[radius],
    }));
    const __VLS_9 = __VLS_8({
        ...{ class: "w-20" },
        modelValue: __VLS_ctx.customTheme[radius],
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
    // @ts-ignore
    [customTheme, customTheme, radiusKey,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
for (const [size] of __VLS_vFor((__VLS_ctx.sizeKey))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (size),
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (size.replace('--size-', ''));
    const __VLS_12 = TextInput;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ class: "w-20" },
        modelValue: __VLS_ctx.customTheme[size],
    }));
    const __VLS_14 = __VLS_13({
        ...{ class: "w-20" },
        modelValue: __VLS_ctx.customTheme[size],
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
    // @ts-ignore
    [customTheme, customTheme, sizeKey,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_17 = TextInput;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    ...{ class: "w-20" },
    modelValue: (__VLS_ctx.customTheme['--border']),
}));
const __VLS_19 = __VLS_18({
    ...{ class: "w-20" },
    modelValue: (__VLS_ctx.customTheme['--border']),
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 pb-12 md:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-12']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.depth);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.noise);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.dark);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "bg-base-100 border-base-200 absolute right-0 bottom-0 left-0 flex gap-2 border-t p-2 pt-2" },
});
/** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['right-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm w-26" },
    value: (__VLS_ctx.applyFrom),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-26']} */ ;
for (const [opt] of __VLS_vFor((__VLS_ctx.ALL_THEME))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (opt);
    // @ts-ignore
    [customTheme, depth, noise, dark, applyFrom, ALL_THEME,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetCustomTheme) },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('reset'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "btn btn-sm" },
    href: "https://daisyui.com/theme-generator/",
    target: "_blank",
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('moreDetails'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.handlerCustomThemeSave) },
    ...{ class: "btn btn-sm btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
(__VLS_ctx.$t('save'));
// @ts-ignore
[resetCustomTheme, $t, $t, $t, handlerCustomThemeSave,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
