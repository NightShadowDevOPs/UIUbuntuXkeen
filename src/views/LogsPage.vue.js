/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import VirtualScroller from '@/components/common/VirtualScroller.vue';
import LogsCard from '@/components/logs/LogsCard.vue';
import { isMiddleScreen } from '@/helper/utils';
import { logFilter, logTypeFilter, logs } from '@/store/logs';
import { computed } from 'vue';
const renderLogs = computed(() => {
    let renderLogs = logs.value;
    if (logFilter.value || logTypeFilter.value) {
        const regex = new RegExp(logFilter.value, 'i');
        renderLogs = logs.value.filter((log) => {
            if (logFilter.value && ![log.payload, log.time, log.type].some((i) => regex.test(i))) {
                return false;
            }
            if (logTypeFilter.value &&
                !(log.payload.includes(logTypeFilter.value) || log.type === logTypeFilter.value)) {
                return false;
            }
            return true;
        });
    }
    return renderLogs;
});
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
if (!__VLS_ctx.renderLogs.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card m-2 flex-row p-2 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['m-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    (__VLS_ctx.$t('noContent'));
}
else {
    const __VLS_0 = VirtualScroller || VirtualScroller;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        data: (__VLS_ctx.renderLogs),
        size: (__VLS_ctx.isMiddleScreen ? 96 : 64),
        ...{ class: "p-2" },
    }));
    const __VLS_2 = __VLS_1({
        data: (__VLS_ctx.renderLogs),
        size: (__VLS_ctx.isMiddleScreen ? 96 : 64),
        ...{ class: "p-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    const { default: __VLS_5 } = __VLS_3.slots;
    {
        const { default: __VLS_6 } = __VLS_3.slots;
        const [{ item }] = __VLS_vSlot(__VLS_6, (_) => []);
        const __VLS_7 = LogsCard || LogsCard;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            log: (item),
        }));
        const __VLS_9 = __VLS_8({
            log: (item),
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        // @ts-ignore
        [renderLogs, renderLogs, $t, isMiddleScreen,];
        __VLS_3.slots['' /* empty slot name completion */];
    }
    // @ts-ignore
    [];
    var __VLS_3;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
