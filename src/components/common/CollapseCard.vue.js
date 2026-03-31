/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { collapsedBus } from '@/composables/bus';
import { SCROLLABLE_PARENT_CLASS } from '@/helper/utils';
import { collapseGroupMap } from '@/store/settings';
import { computed, onUnmounted, ref } from 'vue';
const props = defineProps();
const showCollapse = computed({
    get() {
        return collapseGroupMap.value[props.name];
    },
    set(value) {
        if (value) {
            showFullContent.value = false;
            showContent.value = true;
        }
        collapseGroupMap.value[props.name] = value;
    },
});
const showContent = ref(showCollapse.value);
const showFullContent = ref(showCollapse.value);
const handlerTransitionEnd = () => {
    if (showCollapse.value) {
        showFullContent.value = true;
    }
    else {
        showContent.value = false;
    }
};
const busHandler = ({ open }) => {
    showCollapse.value = open;
};
collapsedBus.on(busHandler);
onUnmounted(() => {
    collapsedBus.off(busHandler);
});
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
    ...{ class: (`collapse ${__VLS_ctx.showCollapse ? 'collapse-open' : 'collapse-close'}`) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showCollapse = !__VLS_ctx.showCollapse;
            // @ts-ignore
            [showCollapse, showCollapse, showCollapse,];
        } },
    ...{ class: "collapse-title cursor-pointer overflow-visible pr-4 select-none" },
});
/** @type {__VLS_StyleScopedClasses['collapse-title']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-visible']} */ ;
/** @type {__VLS_StyleScopedClasses['pr-4']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
var __VLS_0 = {
    open: (__VLS_ctx.showCollapse),
};
if (!__VLS_ctx.showCollapse) {
    var __VLS_2 = {
        open: (__VLS_ctx.showCollapse),
    };
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onTransitionend: (__VLS_ctx.handlerTransitionEnd) },
    ...{ class: "collapse-content max-sm:px-2" },
});
/** @type {__VLS_StyleScopedClasses['collapse-content']} */ ;
/** @type {__VLS_StyleScopedClasses['max-sm:px-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "max-h-108 overflow-y-auto" },
    ...{ class: ([__VLS_ctx.SCROLLABLE_PARENT_CLASS, !__VLS_ctx.showCollapse && 'opacity-0']) },
});
/** @type {__VLS_StyleScopedClasses['max-h-108']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
if (__VLS_ctx.showContent) {
    var __VLS_4 = {
        showFullContent: (__VLS_ctx.showFullContent),
    };
}
// @ts-ignore
var __VLS_1 = __VLS_0, __VLS_3 = __VLS_2, __VLS_5 = __VLS_4;
// @ts-ignore
[showCollapse, showCollapse, showCollapse, showCollapse, handlerTransitionEnd, SCROLLABLE_PARENT_CLASS, showContent, showFullContent,];
const __VLS_base = (await import('vue')).defineComponent({
    __typeProps: {},
});
const __VLS_export = {};
export default {};
