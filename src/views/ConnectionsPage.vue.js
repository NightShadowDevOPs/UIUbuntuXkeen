/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import ConnectionCardList from '@/components/connections/ConnectionCardList.vue';
import ConnectionDetails from '@/components/connections/ConnectionDetails.vue';
import ConnectionTable from '@/components/connections/ConnectionTable.vue';
import { useConnectionCard } from '@/store/settings';
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "size-full overflow-x-hidden" },
});
/** @type {__VLS_StyleScopedClasses['size-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
if (__VLS_ctx.useConnectionCard) {
    const __VLS_0 = ConnectionCardList;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "overflow-x-hidden p-2" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "overflow-x-hidden p-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
}
else {
    const __VLS_5 = ConnectionTable;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
    const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
const __VLS_10 = ConnectionDetails;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({}));
const __VLS_12 = __VLS_11({}, ...__VLS_functionalComponentArgsRest(__VLS_11));
// @ts-ignore
[useConnectionCard,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
