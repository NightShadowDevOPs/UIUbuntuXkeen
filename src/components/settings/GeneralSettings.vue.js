/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { isSingBox } from '@/api';
import { IP_INFO_API } from '@/constant';
import { useTooltip } from '@/helper/tooltip';
import { autoDisconnectIdleUDP, autoDisconnectIdleUDPTime, disablePullToRefresh, displayAllFeatures, IPInfoAPI, scrollAnimationEffect, swipeInPages, swipeInTabs, } from '@/store/settings';
import { QuestionMarkCircleIcon } from '@heroicons/vue/24/outline';
const { showTip } = useTooltip();
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
(__VLS_ctx.$t('general'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-4" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('autoDisconnectIdleUDP'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.autoDisconnectIdleUDP);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
QuestionMarkCircleIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4 cursor-pointer" },
}));
const __VLS_2 = __VLS_1({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4 cursor-pointer" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ mouseenter: {} },
    { onMouseenter: (...[$event]) => {
            __VLS_ctx.showTip($event, __VLS_ctx.$t('autoDisconnectIdleUDPTip'));
            // @ts-ignore
            [$t, $t, $t, autoDisconnectIdleUDP, showTip,];
        } });
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
var __VLS_3;
var __VLS_4;
if (__VLS_ctx.autoDisconnectIdleUDP) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('autoDisconnectIdleUDPTime'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "number",
        ...{ class: "input input-sm w-20" },
    });
    (__VLS_ctx.autoDisconnectIdleUDPTime);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
(__VLS_ctx.$t('IPInfoAPI'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm min-w-24" },
    value: (__VLS_ctx.IPInfoAPI),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-24']} */ ;
for (const [opt] of __VLS_vFor((Object.values(__VLS_ctx.IP_INFO_API)))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (opt),
        value: (opt),
    });
    (opt);
    // @ts-ignore
    [$t, $t, autoDisconnectIdleUDP, autoDisconnectIdleUDPTime, IPInfoAPI, IP_INFO_API,];
}
let __VLS_7;
/** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
QuestionMarkCircleIcon;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4 cursor-pointer" },
}));
const __VLS_9 = __VLS_8({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4 cursor-pointer" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ mouseenter: {} },
    { onMouseenter: (...[$event]) => {
            __VLS_ctx.showTip($event, __VLS_ctx.$t('IPInfoAPITip'));
            // @ts-ignore
            [$t, showTip,];
        } });
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
var __VLS_10;
var __VLS_11;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
(__VLS_ctx.$t('scrollAnimationEffect'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.scrollAnimationEffect);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
(__VLS_ctx.$t('swipeInPages'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.swipeInPages);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
if (__VLS_ctx.swipeInPages) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2 md:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
    (__VLS_ctx.$t('swipeInTabs'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        ...{ class: "toggle" },
    });
    (__VLS_ctx.swipeInTabs);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 md:hidden" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:hidden']} */ ;
(__VLS_ctx.$t('disablePullToRefresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.disablePullToRefresh);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
let __VLS_14;
/** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
QuestionMarkCircleIcon;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4 cursor-pointer" },
}));
const __VLS_16 = __VLS_15({
    ...{ 'onMouseenter': {} },
    ...{ class: "h-4 w-4 cursor-pointer" },
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
let __VLS_19;
const __VLS_20 = ({ mouseenter: {} },
    { onMouseenter: (...[$event]) => {
            __VLS_ctx.showTip($event, __VLS_ctx.$t('disablePullToRefreshTip'));
            // @ts-ignore
            [$t, $t, $t, $t, $t, showTip, scrollAnimationEffect, swipeInPages, swipeInPages, swipeInTabs, disablePullToRefresh,];
        } });
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
var __VLS_17;
var __VLS_18;
if (__VLS_ctx.isSingBox) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    (__VLS_ctx.$t('displayAllFeatures'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        ...{ class: "toggle" },
    });
    (__VLS_ctx.displayAllFeatures);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
    let __VLS_21;
    /** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
    QuestionMarkCircleIcon;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        ...{ 'onMouseenter': {} },
        ...{ class: "h-4 w-4 cursor-pointer" },
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onMouseenter': {} },
        ...{ class: "h-4 w-4 cursor-pointer" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = ({ mouseenter: {} },
        { onMouseenter: (...[$event]) => {
                if (!(__VLS_ctx.isSingBox))
                    return;
                __VLS_ctx.showTip($event, __VLS_ctx.$t('displayAllFeaturesTip'));
                // @ts-ignore
                [$t, $t, showTip, isSingBox, displayAllFeatures,];
            } });
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    var __VLS_24;
    var __VLS_25;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
