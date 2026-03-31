/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useTooltip } from '@/helper/tooltip';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { createApp, defineComponent, h } from 'vue';
const emits = defineEmits();
const props = defineProps();
const inputValue = defineModel();
const clearInput = () => {
    inputValue.value = '';
};
const { showTip, hideTip } = useTooltip();
const handlerSearchInputClick = (e) => {
    if (!props.menus?.length) {
        return;
    }
    const PopContent = defineComponent({
        props: {
            menus: {
                type: Array,
                default: () => [],
            },
            menusDeleteable: {
                type: Boolean,
                default: false,
            },
        },
        setup(props) {
            return () => h('div', { class: 'max-h-64 overflow-y-auto overflow-x-hidden scrollbar-hidden min-w-24' }, props.menus.map((item) => h('div', { class: 'cursor-pointer p-1 flex gap-2 items-center' }, [
                h('span', {
                    class: 'flex-1 transition-transform hover:scale-105 hover:text-primary',
                    onClick: () => {
                        inputValue.value = item;
                        hideTip();
                    },
                }, item),
                props.menusDeleteable &&
                    h(XMarkIcon, {
                        class: 'h-3 w-3 transition-transform hover:scale-125',
                        onClick: () => {
                            emits('update:menus', props.menus.filter((menu) => menu !== item));
                            hideTip();
                        },
                    }),
            ])));
        },
    });
    const mountEl = document.createElement('div');
    const app = createApp(PopContent, { menus: props.menus, menusDeleteable: props.menusDeleteable });
    app.mount(mountEl);
    showTip(e, mountEl, {
        theme: 'base',
        placement: 'bottom-start',
        trigger: 'click',
        interactive: true,
        appendTo: document.body,
        arrow: false,
    });
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
if (__VLS_ctx.beforeClose && __VLS_ctx.clearable) {
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.XMarkIcon} */
    XMarkIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onClick': {} },
        ...{ class: "absolute top-2 right-2 z-10 h-4 w-3 cursor-pointer hover:scale-125" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClick': {} },
        ...{ class: "absolute top-2 right-2 z-10 h-4 w-3 cursor-pointer hover:scale-125" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ click: {} },
        { onClick: (__VLS_ctx.clearInput) });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:scale-125']} */ ;
    var __VLS_3;
    var __VLS_4;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onClick: (__VLS_ctx.handlerSearchInputClick) },
    ...{ onInput: (...[$event]) => {
            (__VLS_ctx.emits('input', __VLS_ctx.inputValue || ''), __VLS_ctx.hideTip());
            // @ts-ignore
            [beforeClose, clearable, clearInput, handlerSearchInputClick, emits, inputValue, hideTip,];
        } },
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.emits('change', __VLS_ctx.inputValue || '');
            // @ts-ignore
            [emits, inputValue,];
        } },
    value: (__VLS_ctx.inputValue),
    type: "text",
    ...{ class: (['input input-sm join-item w-full', { 'pr-6': __VLS_ctx.clearable }]) },
    placeholder: (__VLS_ctx.placeholder || ''),
    name: (__VLS_ctx.name || ''),
    autocomplete: (__VLS_ctx.autocomplete || ''),
});
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-6']} */ ;
if (!__VLS_ctx.beforeClose && __VLS_ctx.clearable) {
    let __VLS_7;
    /** @ts-ignore @type {typeof __VLS_components.XMarkIcon} */
    XMarkIcon;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onClick': {} },
        ...{ class: "absolute top-2 right-2 z-10 h-4 w-3 cursor-pointer hover:scale-125" },
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        ...{ class: "absolute top-2 right-2 z-10 h-4 w-3 cursor-pointer hover:scale-125" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = ({ click: {} },
        { onClick: (__VLS_ctx.clearInput) });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:scale-125']} */ ;
    var __VLS_10;
    var __VLS_11;
}
// @ts-ignore
[beforeClose, clearable, clearable, clearInput, inputValue, placeholder, name, autocomplete,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
