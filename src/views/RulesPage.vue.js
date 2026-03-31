/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import VirtualScroller from '@/components/common/VirtualScroller.vue';
import RuleCard from '@/components/rules/RuleCard.vue';
import RulesTable from '@/components/rules/RulesTable.vue';
import RuleProvider from '@/components/rules/RuleProvider.vue';
import { RULE_TAB_TYPE } from '@/constant';
import { ROUTE_NAME } from '@/constant';
import { cleanupExpiredPendingPageFocus, clearPendingPageFocus, flashNavHighlight, getPendingPageFocusForRoute } from '@/helper/navFocus';
import { fetchRules, renderRules, renderRulesProvider, rules, rulesTabShow, rulesViewMode } from '@/store/rules';
import { nextTick, onMounted, ref, watch } from 'vue';
const vsRef = ref(null);
const parseRuleText = (s) => {
    const v = String(s || '').trim();
    const i = v.indexOf(': ');
    if (i <= 0)
        return { type: v, payload: '' };
    return { type: v.slice(0, i).trim(), payload: v.slice(i + 2).trim() };
};
const findRuleCardEl = (type, payload) => {
    const items = Array.from(document.querySelectorAll('[data-nav-kind="rule"]'));
    return (items.find((el) => {
        const dt = String(el.dataset?.ruleType || '').trim();
        const dp = String(el.dataset?.rulePayload || '').trim();
        return dt === type && dp === payload;
    }) || null);
};
let focusApplied = false;
const tryApplyPendingFocus = async () => {
    if (focusApplied)
        return;
    const pf = getPendingPageFocusForRoute(ROUTE_NAME.rules);
    if (!pf || pf.kind !== 'rule')
        return;
    const { type, payload } = parseRuleText(pf.value);
    if (!type)
        return;
    // Ensure we are on the Rules list (not Provider tab)
    if (rulesTabShow.value !== RULE_TAB_TYPE.RULES)
        rulesTabShow.value = RULE_TAB_TYPE.RULES;
    const idx = (renderRules.value || []).findIndex((r) => {
        const rt = String(r?.type || '').trim();
        const rp = String(r?.payload || '').trim();
        return rt === type && rp === payload;
    });
    if (idx < 0)
        return;
    // If the list is virtualized, scroll by index first.
    if ((renderRules.value?.length || 0) >= 200) {
        try {
            vsRef.value?.scrollToIndex?.(idx, 'center');
        }
        catch {
            // ignore
        }
    }
    const start = performance.now();
    const loop = async () => {
        await nextTick();
        const el = findRuleCardEl(type, payload);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            flashNavHighlight(el);
            clearPendingPageFocus();
            focusApplied = true;
            return;
        }
        if (performance.now() - start < 2200) {
            requestAnimationFrame(() => {
                loop();
            });
        }
    };
    loop();
};
fetchRules();
onMounted(() => {
    cleanupExpiredPendingPageFocus();
    tryApplyPendingFocus();
});
watch([renderRules, rulesTabShow], () => {
    tryApplyPendingFocus();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-1" },
    ...{ class: ([
            __VLS_ctx.rulesViewMode === 'table' ? 'overflow-x-visible' : 'overflow-x-hidden',
            __VLS_ctx.rulesViewMode !== 'table' && __VLS_ctx.renderRules.length < 200 ? 'p-2' : '',
        ]) },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
if (__VLS_ctx.rulesTabShow === __VLS_ctx.RULE_TAB_TYPE.PROVIDER) {
    for (const [ruleProvider, index] of __VLS_vFor((__VLS_ctx.renderRulesProvider))) {
        const __VLS_0 = RuleProvider;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            key: (ruleProvider.name),
            ruleProvider: (ruleProvider),
            index: (index + 1),
        }));
        const __VLS_2 = __VLS_1({
            key: (ruleProvider.name),
            ruleProvider: (ruleProvider),
            index: (index + 1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        // @ts-ignore
        [rulesViewMode, rulesViewMode, renderRules, rulesTabShow, RULE_TAB_TYPE, renderRulesProvider,];
    }
}
else if (__VLS_ctx.rulesViewMode === 'table') {
    const __VLS_5 = RulesTable;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ref: "vsRef",
        rules: (__VLS_ctx.renderRules),
    }));
    const __VLS_7 = __VLS_6({
        ref: "vsRef",
        rules: (__VLS_ctx.renderRules),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    var __VLS_10 = {};
    var __VLS_8;
}
else if (__VLS_ctx.renderRules.length < 200) {
    for (const [rule] of __VLS_vFor((__VLS_ctx.renderRules))) {
        const __VLS_12 = RuleCard;
        // @ts-ignore
        const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
            key: (rule.payload),
            rule: (rule),
            index: (__VLS_ctx.rules.indexOf(rule) + 1),
        }));
        const __VLS_14 = __VLS_13({
            key: (rule.payload),
            rule: (rule),
            index: (__VLS_ctx.rules.indexOf(rule) + 1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_13));
        // @ts-ignore
        [rulesViewMode, renderRules, renderRules, renderRules, rules,];
    }
}
else {
    const __VLS_17 = VirtualScroller || VirtualScroller;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
        ref: "vsRef",
        data: (__VLS_ctx.renderRules),
        size: (64),
        ...{ class: "p-2" },
    }));
    const __VLS_19 = __VLS_18({
        ref: "vsRef",
        data: (__VLS_ctx.renderRules),
        size: (64),
        ...{ class: "p-2" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    var __VLS_22 = {};
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    const { default: __VLS_24 } = __VLS_20.slots;
    {
        const { default: __VLS_25 } = __VLS_20.slots;
        const [{ item: rule }] = __VLS_vSlot(__VLS_25, (_) => []);
        const __VLS_26 = RuleCard;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
            ...{ class: "mb-1" },
            key: (rule.payload),
            rule: (rule),
            index: (__VLS_ctx.rules.indexOf(rule) + 1),
        }));
        const __VLS_28 = __VLS_27({
            ...{ class: "mb-1" },
            key: (rule.payload),
            rule: (rule),
            index: (__VLS_ctx.rules.indexOf(rule) + 1),
        }, ...__VLS_functionalComponentArgsRest(__VLS_27));
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        // @ts-ignore
        [renderRules, rules,];
        __VLS_20.slots['' /* empty slot name completion */];
    }
    // @ts-ignore
    [];
    var __VLS_20;
}
// @ts-ignore
var __VLS_11 = __VLS_10, __VLS_23 = __VLS_22;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
