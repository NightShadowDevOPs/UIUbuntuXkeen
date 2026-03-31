/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { autoConnectionCheck, autoIPCheck, displayProxiesRelationship, numberOfChartsInSidebar, showIPAndConnectionInfo, showStatisticsWhenSidebarCollapsed, twoIpTokensText, proxiesRelationshipColorMode, proxiesRelationshipSourceMode, proxiesRelationshipTopN, proxiesRelationshipTopNChain, proxiesRelationshipWeightMode, proxiesRelationshipUseSources, } from '@/store/settings';
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-title px-4 pt-4" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
(__VLS_ctx.$t('overview'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body grid grid-cols-1 gap-2 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('showIPAndConnectionInfo'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.showIPAndConnectionInfo);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
if (__VLS_ctx.showIPAndConnectionInfo) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('autoIPCheckWhenStart'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "toggle" },
        type: "checkbox",
    });
    (__VLS_ctx.autoIPCheck);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('autoConnectionCheckWhenStart'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "toggle" },
        type: "checkbox",
    });
    (__VLS_ctx.autoConnectionCheck);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('twoIpTokens'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea, __VLS_intrinsics.textarea)({
        ...{ class: "textarea textarea-sm" },
        value: (__VLS_ctx.twoIpTokensText),
        placeholder: (__VLS_ctx.$t('optional')),
        rows: "3",
    });
    /** @type {__VLS_StyleScopedClasses['textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['textarea-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('twoIpTokensTip'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('displayProxiesRelationship'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.displayProxiesRelationship);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
if (__VLS_ctx.displayProxiesRelationship) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('proxiesRelationshipSources'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "toggle" },
        type: "checkbox",
    });
    (__VLS_ctx.proxiesRelationshipUseSources);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
}
if (__VLS_ctx.displayProxiesRelationship) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('proxiesRelationshipWeight'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm min-w-28" },
        value: (__VLS_ctx.proxiesRelationshipWeightMode),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-28']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "traffic",
    });
    (__VLS_ctx.$t('traffic'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "count",
    });
    (__VLS_ctx.$t('count'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('proxiesRelationshipColor'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm min-w-28" },
        value: (__VLS_ctx.proxiesRelationshipColorMode),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-28']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "proxy",
    });
    (__VLS_ctx.$t('proxies'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "provider",
    });
    (__VLS_ctx.$t('provider'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "rule",
    });
    (__VLS_ctx.$t('rule'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "none",
    });
    (__VLS_ctx.$t('none'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('proxiesRelationshipSourceMode'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm min-w-28" },
        value: (__VLS_ctx.proxiesRelationshipSourceMode),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-28']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "auto",
    });
    (__VLS_ctx.$t('auto'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "rulePayload",
    });
    (__VLS_ctx.$t('rulePayload'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "host",
    });
    (__VLS_ctx.$t('host'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "destinationIP",
    });
    (__VLS_ctx.$t('destination'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('proxiesRelationshipTopN'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "range range-xs" },
        type: "range",
        min: "10",
        max: "100",
        step: "5",
    });
    (__VLS_ctx.proxiesRelationshipTopN);
    /** @type {__VLS_StyleScopedClasses['range']} */ ;
    /** @type {__VLS_StyleScopedClasses['range-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-70 w-10 text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    (__VLS_ctx.proxiesRelationshipTopN);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('proxiesRelationshipTopNChain'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "range range-xs" },
        type: "range",
        min: "10",
        max: "60",
        step: "2",
    });
    (__VLS_ctx.proxiesRelationshipTopNChain);
    /** @type {__VLS_StyleScopedClasses['range']} */ ;
    /** @type {__VLS_StyleScopedClasses['range-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-70 w-10 text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    (__VLS_ctx.proxiesRelationshipTopNChain);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 max-md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
(__VLS_ctx.$t('showStatisticsWhenSidebarCollapsed'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "toggle" },
    type: "checkbox",
});
(__VLS_ctx.showStatisticsWhenSidebarCollapsed);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 max-md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
(__VLS_ctx.$t('numberOfChartsInSidebar'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm min-w-24" },
    value: (__VLS_ctx.numberOfChartsInSidebar),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-24']} */ ;
for (const [opt] of __VLS_vFor(([1, 2, 3]))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (opt);
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, showIPAndConnectionInfo, showIPAndConnectionInfo, autoIPCheck, autoConnectionCheck, twoIpTokensText, displayProxiesRelationship, displayProxiesRelationship, displayProxiesRelationship, proxiesRelationshipUseSources, proxiesRelationshipWeightMode, proxiesRelationshipColorMode, proxiesRelationshipSourceMode, proxiesRelationshipTopN, proxiesRelationshipTopN, proxiesRelationshipTopNChain, proxiesRelationshipTopNChain, showStatisticsWhenSidebarCollapsed, numberOfChartsInSidebar,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
