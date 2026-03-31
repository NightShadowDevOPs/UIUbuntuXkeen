/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { updateRuleProviderAPI } from '@/api';
import { useBounceOnVisible } from '@/composables/bouncein';
import { NOT_CONNECTED } from '@/constant';
import { getColorForLatency } from '@/helper';
import { fromNow, prettyBytesHelper } from '@/helper/utils';
import { useTooltip } from '@/helper/tooltip';
import { getLatencyByName, getNowProxyNodeName, proxyMap } from '@/store/proxies';
import { fetchRules, getRuleHitCount, ruleProviderList } from '@/store/rules';
import { displayLatencyInRule, displayNowNodeInRule } from '@/store/settings';
import { ArrowPathIcon, ArrowRightCircleIcon, ChevronDownIcon, QuestionMarkCircleIcon, } from '@heroicons/vue/24/outline';
import { twMerge } from 'tailwind-merge';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ProxyName from '../proxies/ProxyName.vue';
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue';
const props = defineProps();
const expanded = ref(false);
function toggleExpanded(event) {
    if (!event) {
        expanded.value = !expanded.value;
        return;
    }
    const target = event.target;
    if (!target) {
        expanded.value = !expanded.value;
        return;
    }
    // Не разворачиваем карточку, если клик/тап пришёл по интерактивному элементу.
    if (target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea')) {
        return;
    }
    expanded.value = !expanded.value;
}
const { t } = useI18n();
const { showTip } = useTooltip();
const proxyNode = computed(() => proxyMap.value[props.rule.proxy]);
const latency = computed(() => getLatencyByName(props.rule.proxy, props.rule.proxy));
const latencyColor = computed(() => getColorForLatency(Number(latency.value)));
const hits = computed(() => getRuleHitCount(props.rule.type, props.rule.payload));
const size = computed(() => {
    if (props.rule.type === 'RuleSet') {
        return ruleProviderList.value.find((provider) => provider.name === props.rule.payload)
            ?.ruleCount;
    }
    return props.rule.size;
});
const isUpdating = ref(false);
const isUpdateableRuleSet = computed(() => {
    if (props.rule.type !== 'RuleSet') {
        return false;
    }
    const provider = ruleProviderList.value.find((provider) => provider.name === props.rule.payload);
    if (!provider) {
        return false;
    }
    return provider.vehicleType !== 'Inline';
});
const updateRuleProviderClickHandler = async () => {
    if (isUpdating.value)
        return;
    isUpdating.value = true;
    await updateRuleProviderAPI(props.rule.payload);
    fetchRules();
    isUpdating.value = false;
};
const showMMDBSizeTip = (e) => {
    showTip(e, t('mmdbSizeTip'));
};
const ruleTextForTopology = computed(() => {
    const type = String(props.rule.type || '').trim();
    const payload = String(props.rule.payload || '').trim();
    return payload ? `${type}: ${payload}` : type;
});
const ruleSetProviderInfo = computed(() => {
    if (props.rule.type !== 'RuleSet')
        return null;
    const provider = ruleProviderList.value.find((p) => p.name === props.rule.payload);
    if (!provider)
        return null;
    return {
        name: provider.name,
        updatedAt: provider.updatedAt,
        updatedFromNow: fromNow(provider.updatedAt),
        vehicleType: provider.vehicleType,
        behavior: provider.behavior,
        ruleCount: provider.ruleCount,
    };
});
useBounceOnVisible();
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
    ...{ onClick: (__VLS_ctx.toggleExpanded) },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.toggleExpanded();
            // @ts-ignore
            [toggleExpanded, toggleExpanded,];
        } },
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.toggleExpanded();
            // @ts-ignore
            [toggleExpanded,];
        } },
    ...{ class: "card hover:bg-base-200 gap-1 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-base-300" },
    ...{ class: (__VLS_ctx.expanded ? 'bg-base-200' : '') },
    'data-nav-kind': "rule",
    'data-rule-type': (__VLS_ctx.rule.type),
    'data-rule-payload': (String(__VLS_ctx.rule.payload || '')),
    tabindex: "0",
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-base-200']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-base-300']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-2 min-h-5 leading-5" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['min-h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-70 text-xs" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
(__VLS_ctx.index);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm font-medium whitespace-nowrap" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
(__VLS_ctx.rule.type);
if (__VLS_ctx.rule.payload) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-main min-w-0 font-mono text-xs" },
        ...{ class: (__VLS_ctx.expanded ? 'whitespace-pre-wrap break-all' : 'truncate') },
        title: (String(__VLS_ctx.rule.payload)),
    });
    /** @type {__VLS_StyleScopedClasses['text-main']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.rule.payload);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base-content/50 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-1 shrink-0" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
if (typeof __VLS_ctx.size === 'number' && __VLS_ctx.size !== -1) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-xs" },
        title: (__VLS_ctx.$t('size')),
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.size);
    if (__VLS_ctx.size === 0) {
        let __VLS_0;
        /** @ts-ignore @type {typeof __VLS_components.QuestionMarkCircleIcon} */
        QuestionMarkCircleIcon;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            ...{ 'onMouseenter': {} },
            ...{ class: "ml-1 inline-block h-4 w-4" },
        }));
        const __VLS_2 = __VLS_1({
            ...{ 'onMouseenter': {} },
            ...{ class: "ml-1 inline-block h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        let __VLS_5;
        const __VLS_6 = ({ mouseenter: {} },
            { onMouseenter: (__VLS_ctx.showMMDBSizeTip) });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        var __VLS_3;
        var __VLS_4;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-xs" },
    title: (__VLS_ctx.$t('ruleHitsTip')),
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
(__VLS_ctx.$t('hits'));
(__VLS_ctx.hits);
if (__VLS_ctx.isUpdateableRuleSet) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.updateRuleProviderClickHandler) },
        ...{ class: (__VLS_ctx.twMerge('btn btn-circle btn-ghost btn-xs', __VLS_ctx.isUpdating ? 'animate-spin' : '')) },
        title: (__VLS_ctx.$t('update')),
    });
    let __VLS_7;
    /** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
    ArrowPathIcon;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_9 = __VLS_8({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
const __VLS_12 = TopologyActionButtons;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
    stage: ('R'),
    value: (__VLS_ctx.ruleTextForTopology),
    grouped: (true),
}));
const __VLS_14 = __VLS_13({
    stage: ('R'),
    value: (__VLS_ctx.ruleTextForTopology),
    grouped: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.expanded = !__VLS_ctx.expanded;
            // @ts-ignore
            [expanded, expanded, expanded, expanded, rule, rule, rule, rule, rule, rule, index, size, size, size, size, $t, $t, $t, $t, showMMDBSizeTip, hits, isUpdateableRuleSet, updateRuleProviderClickHandler, twMerge, isUpdating, ruleTextForTopology,];
        } },
    ...{ class: "btn btn-circle btn-ghost btn-xs" },
    title: (__VLS_ctx.expanded ? 'Свернуть' : 'Развернуть'),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
let __VLS_17;
/** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
ChevronDownIcon;
// @ts-ignore
const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
    ...{ class: "h-4 w-4 transition-transform" },
    ...{ class: (__VLS_ctx.expanded ? 'rotate-180' : '') },
}));
const __VLS_19 = __VLS_18({
    ...{ class: "h-4 w-4 transition-transform" },
    ...{ class: (__VLS_ctx.expanded ? 'rotate-180' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_18));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-1 min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
const __VLS_22 = ProxyName;
// @ts-ignore
const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
    name: (__VLS_ctx.rule.proxy),
    ...{ class: "badge badge-sm gap-0" },
}));
const __VLS_24 = __VLS_23({
    name: (__VLS_ctx.rule.proxy),
    ...{ class: "badge badge-sm gap-0" },
}, ...__VLS_functionalComponentArgsRest(__VLS_23));
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
if (__VLS_ctx.proxyNode?.now && __VLS_ctx.displayNowNodeInRule) {
    let __VLS_27;
    /** @ts-ignore @type {typeof __VLS_components.ArrowRightCircleIcon} */
    ArrowRightCircleIcon;
    // @ts-ignore
    const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_29 = __VLS_28({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_28));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    const __VLS_32 = ProxyName;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
        name: (__VLS_ctx.getNowProxyNodeName(__VLS_ctx.rule.proxy)),
        ...{ class: "badge badge-sm gap-0" },
    }));
    const __VLS_34 = __VLS_33({
        name: (__VLS_ctx.getNowProxyNodeName(__VLS_ctx.rule.proxy)),
        ...{ class: "badge badge-sm gap-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-0']} */ ;
}
if (__VLS_ctx.latency !== __VLS_ctx.NOT_CONNECTED && __VLS_ctx.displayLatencyInRule) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: (__VLS_ctx.latencyColor) },
        ...{ class: "ml-1 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.latency);
}
if (__VLS_ctx.ruleSetProviderInfo) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-base-content/60 text-xs shrink-0" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    (__VLS_ctx.$t('updated'));
    (__VLS_ctx.ruleSetProviderInfo.updatedFromNow);
}
if (__VLS_ctx.expanded) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 pt-2 border-t border-base-300/40 text-xs text-base-content/70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-300/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base-content/70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-x-4 gap-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-x-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base-content/50" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1 font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.rule.type);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base-content/50" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
    (__VLS_ctx.$t('proxy'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1 font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.rule.proxy);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base-content/50" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
    (__VLS_ctx.$t('hits'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1 font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.hits);
    if (typeof __VLS_ctx.rule.size === 'number' && __VLS_ctx.rule.size > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-base-content/50" },
        });
        /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
        (__VLS_ctx.$t('size'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.prettyBytesHelper(__VLS_ctx.rule.size));
    }
    if (__VLS_ctx.ruleSetProviderInfo) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-base-content/50" },
        });
        /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.ruleSetProviderInfo.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-base-content/50" },
        });
        /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.ruleSetProviderInfo.behavior);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-base-content/50" },
        });
        /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.ruleSetProviderInfo.ruleCount);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-base-content/50" },
        });
        /** @type {__VLS_StyleScopedClasses['text-base-content/50']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.ruleSetProviderInfo.vehicleType);
    }
}
// @ts-ignore
[expanded, expanded, expanded, rule, rule, rule, rule, rule, rule, rule, $t, $t, $t, $t, hits, proxyNode, displayNowNodeInRule, getNowProxyNodeName, latency, latency, NOT_CONNECTED, displayLatencyInRule, latencyColor, ruleSetProviderInfo, ruleSetProviderInfo, ruleSetProviderInfo, ruleSetProviderInfo, ruleSetProviderInfo, ruleSetProviderInfo, ruleSetProviderInfo, prettyBytesHelper,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
