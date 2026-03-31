/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import DOMPurify from 'dompurify';
import { computed } from 'vue';
const props = withDefaults(defineProps(), {
    size: 16,
    margin: 4,
});
const style = computed(() => {
    return {
        width: `${props.size}px`,
        height: `${props.size}px`,
        marginRight: `${props.margin}px`,
    };
});
const DOM_STARTS_WITH = 'data:image/svg+xml,';
const isDom = computed(() => {
    return props.icon.startsWith(DOM_STARTS_WITH);
});
const pureDom = computed(() => {
    if (!isDom.value)
        return;
    return DOMPurify.sanitize(props.icon.replace(DOM_STARTS_WITH, ''));
});
const __VLS_defaults = {
    size: 16,
    margin: 4,
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
if (__VLS_ctx.isDom) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: (['inline-block', __VLS_ctx.fill || 'fill-primary']) },
        ...{ style: (__VLS_ctx.style) },
    });
    __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.pureDom) }, null, null);
    /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ style: (__VLS_ctx.style) },
        src: (__VLS_ctx.icon),
    });
}
// @ts-ignore
[isDom, fill, style, style, pureDom, icon,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
