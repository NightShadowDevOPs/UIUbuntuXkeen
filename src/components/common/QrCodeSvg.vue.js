/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import qrcode from 'qrcode-generator';
import { computed } from 'vue';
const props = withDefaults(defineProps(), {
    size: 220,
});
const boxStyle = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }));
const svgMarkup = computed(() => {
    const value = String(props.text || '').trim();
    if (!value)
        return '';
    try {
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();
        return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }
    catch {
        return '';
    }
});
const __VLS_defaults = {
    size: 220,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "inline-flex rounded-2xl bg-white p-3 shadow-sm" },
});
/** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
if (__VLS_ctx.svgMarkup) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ style: (__VLS_ctx.boxStyle) },
        ...{ class: "size-full" },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.svgMarkup) }, null, null);
    /** @type {__VLS_StyleScopedClasses['size-full']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ style: (__VLS_ctx.boxStyle) },
        ...{ class: "grid place-items-center text-center text-xs text-neutral-content/60" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['place-items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-neutral-content/60']} */ ;
}
// @ts-ignore
[svgMarkup, svgMarkup, boxStyle, boxStyle,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
