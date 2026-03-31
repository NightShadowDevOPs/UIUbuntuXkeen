/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { proxyMap } from '@/store/proxies';
import { computed } from 'vue';
import ProxyIcon from './ProxyIcon.vue';
const props = withDefaults(defineProps(), {
    iconSize: 16,
    iconMargin: 4,
});
const icon = computed(() => {
    return proxyMap.value[props.name]?.icon;
});
const __VLS_defaults = {
    iconSize: 16,
    iconMargin: 4,
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
    ...{ class: "flex shrink-0 items-center" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
if (__VLS_ctx.icon) {
    const __VLS_0 = ProxyIcon;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        icon: (__VLS_ctx.icon),
        margin: (__VLS_ctx.iconMargin),
        size: (__VLS_ctx.iconSize),
    }));
    const __VLS_2 = __VLS_1({
        icon: (__VLS_ctx.icon),
        margin: (__VLS_ctx.iconMargin),
        size: (__VLS_ctx.iconSize),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
}
(__VLS_ctx.name);
// @ts-ignore
[icon, icon, iconMargin, iconSize, name,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
