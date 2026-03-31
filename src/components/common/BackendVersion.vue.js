/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { isSingBox, version } from '@/api';
import MetacubexLogo from '@/assets/metacubex.jpg';
import SingBoxLogo from '@/assets/sing-box.svg';
import { checkTruncation } from '@/helper/tooltip';
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-1 overflow-hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    src: (__VLS_ctx.isSingBox ? __VLS_ctx.SingBoxLogo : __VLS_ctx.MetacubexLogo),
    ...{ class: "h-4 w-4 rounded-xs" },
});
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ onMouseenter: (__VLS_ctx.checkTruncation) },
    ...{ class: "truncate" },
});
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
(__VLS_ctx.version);
// @ts-ignore
[isSingBox, SingBoxLogo, MetacubexLogo, checkTruncation, version,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
