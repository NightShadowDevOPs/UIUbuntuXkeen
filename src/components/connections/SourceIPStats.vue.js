/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { getIPLabelFromMap, getPrimarySourceIpRule } from '@/helper/sourceip';
import { prettyBytesHelper } from '@/helper/utils';
import { connections, sourceIPFilter } from '@/store/connections';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TextInput from '../common/TextInput.vue';
const { t } = useI18n();
const search = ref('');
const ruleKindBadge = (kind) => {
    if (!kind)
        return '';
    if (kind === 'cidr')
        return t('sourceIpRuleKindCidr');
    if (kind === 'regex')
        return t('sourceIpRuleKindRegex');
    if (kind === 'suffix')
        return t('sourceIpRuleKindSuffix');
    return t('sourceIpRuleKindExact');
};
const stats = computed(() => {
    const map = new Map();
    for (const c of connections.value) {
        const ip = c.metadata.sourceIP || '';
        if (!ip)
            continue;
        const prev = map.get(ip) || { ip, count: 0, dlSpeed: 0, ulSpeed: 0 };
        prev.count += 1;
        prev.dlSpeed += c.downloadSpeed || 0;
        prev.ulSpeed += c.uploadSpeed || 0;
        map.set(ip, prev);
    }
    const list = Array.from(map.values())
        .sort((a, b) => (b.dlSpeed + b.ulSpeed) - (a.dlSpeed + a.ulSpeed))
        .slice(0, 60)
        .map((x) => {
        const label = String(getIPLabelFromMap(x.ip) || '').trim();
        const primaryRule = getPrimarySourceIpRule(x.ip);
        const display = label && label !== x.ip ? `${label} (${x.ip})` : x.ip;
        return {
            ...x,
            display,
            kindBadge: label && label !== x.ip ? ruleKindBadge(primaryRule?.kind) : '',
        };
    });
    return list;
});
const selectedCount = computed(() => sourceIPFilter.value?.length || 0);
const isSelected = (ip) => {
    return Array.isArray(sourceIPFilter.value) && sourceIPFilter.value.includes(ip);
};
const toggle = (ip) => {
    const cur = sourceIPFilter.value;
    if (cur === null) {
        sourceIPFilter.value = [ip];
        return;
    }
    const next = cur.includes(ip) ? cur.filter((x) => x !== ip) : [...cur, ip];
    sourceIPFilter.value = next.length ? next : null;
};
const clearSelection = () => {
    sourceIPFilter.value = null;
};
const filteredStats = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q)
        return stats.value;
    return stats.value.filter((x) => x.display.toLowerCase().includes(q) || x.ip.includes(q));
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card p-2" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-medium" },
});
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
(__VLS_ctx.$t('allSourceIP'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.stats.length);
if (__VLS_ctx.selectedCount) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-primary badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.selectedCount);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_0 = TextInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.search),
    ...{ class: "w-40" },
    placeholder: (__VLS_ctx.$t('search')),
    clearable: (true),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.search),
    ...{ class: "w-40" },
    placeholder: (__VLS_ctx.$t('search')),
    clearable: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['w-40']} */ ;
if (__VLS_ctx.sourceIPFilter !== null) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearSelection) },
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('reset'));
}
if (__VLS_ctx.filteredStats.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.filteredStats))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.filteredStats.length))
                        return;
                    __VLS_ctx.toggle(item.ip);
                    // @ts-ignore
                    [$t, $t, $t, stats, selectedCount, selectedCount, search, sourceIPFilter, clearSelection, filteredStats, filteredStats, toggle,];
                } },
            key: (item.ip),
            ...{ class: "rounded-field flex cursor-pointer items-center gap-2 px-2 py-1 text-xs transition" },
            ...{ class: (__VLS_ctx.isSelected(item.ip) ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300') },
            title: (item.ip),
        });
        /** @type {__VLS_StyleScopedClasses['rounded-field']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "max-w-40 truncate" },
        });
        /** @type {__VLS_StyleScopedClasses['max-w-40']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (item.display);
        if (item.kindBadge) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-xs badge-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (item.kindBadge);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (item.count);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-80 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.prettyBytesHelper(item.dlSpeed));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-80 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.prettyBytesHelper(item.ulSpeed));
        // @ts-ignore
        [isSelected, prettyBytesHelper, prettyBytesHelper,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 text-sm opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('noContent'));
}
// @ts-ignore
[$t,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
