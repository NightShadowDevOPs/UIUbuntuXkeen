/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { PROXY_TYPE } from '@/constant';
import { useTooltip } from '@/helper/tooltip';
import { getNowProxyNodeName, proxyMap } from '@/store/proxies';
import { displayFinalOutbound } from '@/store/settings';
import { ArrowRightCircleIcon, CheckCircleIcon, LockClosedIcon } from '@heroicons/vue/24/outline';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ProxyName from './ProxyName.vue';
const props = defineProps();
const proxyGroup = computed(() => proxyMap.value[props.name]);
const { showTip } = useTooltip();
const { t } = useI18n();
const isFixed = computed(() => {
    return proxyGroup.value.fixed === proxyGroup.value.now;
});
const tipForFixed = (e) => {
    if (!isFixed.value) {
        return;
    }
    showTip(e, t('tipForFixed'), {
        delay: [500, 0],
    });
};
const finalOutbound = computed(() => {
    const now = getNowProxyNodeName(proxyGroup.value.now);
    if (now === proxyGroup.value.now) {
        return '';
    }
    return now;
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
if (__VLS_ctx.proxyGroup.now) {
    let __VLS_0;
    /** @ts-ignore @type {typeof __VLS_components.Component} */
    Component;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onMouseenter': {} },
        ...{ class: "h-4 w-4 shrink-0 outline-none" },
        is: (__VLS_ctx.isFixed ? __VLS_ctx.LockClosedIcon : __VLS_ctx.ArrowRightCircleIcon),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onMouseenter': {} },
        ...{ class: "h-4 w-4 shrink-0 outline-none" },
        is: (__VLS_ctx.isFixed ? __VLS_ctx.LockClosedIcon : __VLS_ctx.ArrowRightCircleIcon),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ mouseenter: {} },
        { onMouseenter: (__VLS_ctx.tipForFixed) });
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['outline-none']} */ ;
    var __VLS_3;
    var __VLS_4;
    const __VLS_7 = ProxyName;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        name: (__VLS_ctx.proxyGroup.now),
        ...{ class: "text-base-content/80 text-xs md:text-sm" },
    }));
    const __VLS_9 = __VLS_8({
        name: (__VLS_ctx.proxyGroup.now),
        ...{ class: "text-base-content/80 text-xs md:text-sm" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    /** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:text-sm']} */ ;
    if (__VLS_ctx.finalOutbound && __VLS_ctx.displayFinalOutbound) {
        let __VLS_12;
        /** @ts-ignore @type {typeof __VLS_components.ArrowRightCircleIcon} */
        ArrowRightCircleIcon;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_14 = __VLS_13({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        const __VLS_17 = ProxyName;
        // @ts-ignore
        const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
            name: (__VLS_ctx.finalOutbound),
            ...{ class: "text-base-content/80 text-xs md:text-sm" },
        }));
        const __VLS_19 = __VLS_18({
            name: (__VLS_ctx.finalOutbound),
            ...{ class: "text-base-content/80 text-xs md:text-sm" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_18));
        /** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:text-sm']} */ ;
    }
}
else if (__VLS_ctx.proxyGroup.type.toLowerCase() === __VLS_ctx.PROXY_TYPE.LoadBalance) {
    let __VLS_22;
    /** @ts-ignore @type {typeof __VLS_components.CheckCircleIcon} */
    CheckCircleIcon;
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
        ...{ class: "h-4 w-4 shrink-0" },
    }));
    const __VLS_24 = __VLS_23({
        ...{ class: "h-4 w-4 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base-content/80 text-xs md:text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:text-sm']} */ ;
    (__VLS_ctx.$t('loadBalance'));
}
// @ts-ignore
[proxyGroup, proxyGroup, proxyGroup, isFixed, LockClosedIcon, ArrowRightCircleIcon, tipForFixed, finalOutbound, finalOutbound, displayFinalOutbound, PROXY_TYPE, $t,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
