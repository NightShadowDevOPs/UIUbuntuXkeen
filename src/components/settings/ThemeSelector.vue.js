/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ALL_THEME } from '@/constant';
import { useTooltip } from '@/helper/tooltip';
import { customThemes } from '@/store/settings';
import { computed } from 'vue';
const theme = defineModel('value', {
    type: String,
    required: true,
});
const themes = computed(() => {
    if (customThemes.value.length) {
        return [...ALL_THEME, ...customThemes.value.map((theme) => theme.name)];
    }
    return ALL_THEME;
});
const { showTip, hideTip } = useTooltip();
const handlerDropdown = (e) => {
    const themeCotainer = document.createElement('div');
    themeCotainer.className = 'card h-96 w-48 overflow-y-auto overscroll-contain shadow-2xl';
    for (const themeName of themes.value) {
        const item = document.createElement('div');
        const primary = document.createElement('div');
        const label = document.createElement('span');
        item.dataset.theme = themeName;
        item.className = 'flex cursor-pointer items-center gap-2 p-2 bg-base-100 hover:bg-base-200';
        primary.className = 'h-3 w-5 shadow rounded-field bg-primary';
        label.textContent = themeName;
        item.append(primary);
        item.append(label);
        item.addEventListener('click', () => {
            theme.value = themeName;
            hideTip();
        });
        themeCotainer.append(item);
    }
    showTip(e, themeCotainer, {
        theme: 'transparent',
        placement: 'bottom-start',
        trigger: 'click',
        appendTo: document.body,
        interactive: true,
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
    ...{ onClick: (__VLS_ctx.handlerDropdown) },
    ...{ class: "join-item input input-sm inline w-48 p-0" },
});
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['inline']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
/** @type {__VLS_StyleScopedClasses['p-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-full w-full cursor-pointer items-center indent-4" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['indent-4']} */ ;
(__VLS_ctx.theme);
// @ts-ignore
[handlerDropdown, theme,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
