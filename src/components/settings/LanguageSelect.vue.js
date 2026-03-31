/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { LANG } from '@/constant';
import { i18n } from '@/i18n';
import { language } from '@/store/settings';
const langLabelMap = {
    [LANG.EN_US]: 'English',
    [LANG.ZH_CN]: '简体中文',
    [LANG.RU_RU]: 'Русский',
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
(__VLS_ctx.$t('language'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (() => (__VLS_ctx.i18n.global.locale = __VLS_ctx.language)) },
    ...{ class: "select select-sm w-48" },
    value: (__VLS_ctx.language),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-48']} */ ;
for (const [opt] of __VLS_vFor((Object.values(__VLS_ctx.LANG)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (__VLS_ctx.langLabelMap[opt] || opt);
    // @ts-ignore
    [$t, i18n, language, language, LANG, langLabelMap,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
