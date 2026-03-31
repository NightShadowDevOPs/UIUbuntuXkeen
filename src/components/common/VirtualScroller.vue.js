/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, nextTick, ref } from 'vue';
const parentRef = ref(null);
const props = withDefaults(defineProps(), {
    data: () => [],
    size: 64,
});
const virutalOptions = computed(() => {
    return {
        count: props.data.length,
        getScrollElement: () => parentRef.value,
        estimateSize: () => props.size,
        overscan: 24,
    };
});
const rowVirtualizer = useVirtualizer(virutalOptions);
const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems());
const totalSize = computed(() => rowVirtualizer.value.getTotalSize());
const measureElement = (el) => {
    if (!el) {
        return;
    }
    nextTick(() => {
        rowVirtualizer.value.measureElement(el);
    });
    return undefined;
};
const scrollToIndex = (index, align = 'center') => {
    try {
        ;
        rowVirtualizer.value?.scrollToIndex?.(index, { align });
    }
    catch {
        // ignore
    }
};
const __VLS_exposed = { scrollToIndex };
defineExpose(__VLS_exposed);
const __VLS_defaults = {
    data: () => [],
    size: 64,
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
    ref: "parentRef",
    ...{ class: "flex h-full w-full overflow-y-auto" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ style: ({
            height: `${__VLS_ctx.totalSize}px`,
        }) },
    ...{ class: "relative w-full" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "absolute top-0 left-0 w-full" },
    ...{ style: ({
            transform: `translateY(${__VLS_ctx.virtualRows[0]?.start ?? 0}px)`,
        }) },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['top-0']} */ ;
/** @type {__VLS_StyleScopedClasses['left-0']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
for (const [row] of __VLS_vFor((__VLS_ctx.virtualRows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (row.key.toString()),
        'data-index': (row.index),
        ref: ((ref) => __VLS_ctx.measureElement(ref)),
    });
    var __VLS_0 = {
        item: (__VLS_ctx.data[row.index]),
        index: (row.index),
    };
    // @ts-ignore
    [totalSize, virtualRows, virtualRows, measureElement, data,];
}
// @ts-ignore
var __VLS_1 = __VLS_0;
// @ts-ignore
[];
const __VLS_base = (await import('vue')).defineComponent({
    setup: () => (__VLS_exposed),
    __defaults: __VLS_defaults,
    __typeProps: {},
});
const __VLS_export = {};
export default {};
