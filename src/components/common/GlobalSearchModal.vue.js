/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import DialogWrapper from '@/components/common/DialogWrapper.vue';
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue';
import { ROUTE_NAME } from '@/constant';
import { isProxyGroup } from '@/helper';
import { navigateToTopology } from '@/helper/topologyNav';
import { setPendingPageFocus } from '@/helper/navFocus';
import router from '@/router';
import { proxyGroupList, proxyMap, proxyProviederList } from '@/store/proxies';
import { rules } from '@/store/rules';
import { sourceIPLabelList } from '@/store/settings';
import { globalSearchOpen } from '@/store/globalSearch';
import { MagnifyingGlassIcon, ServerStackIcon, Squares2X2Icon, CircleStackIcon, AdjustmentsHorizontalIcon, UsersIcon } from '@heroicons/vue/24/outline';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
const q = ref('');
const selectedIdx = ref(0);
const inputRef = ref(null);
const { t } = useI18n();
const normalize = (s) => String(s || '').toLowerCase();
const terms = computed(() => q.value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean));
const matchAll = (text, ts) => {
    if (!ts.length)
        return true;
    const t = normalize(text);
    return ts.every((x) => t.includes(x));
};
const providerItems = computed(() => {
    const ts = terms.value;
    const providers = (proxyProviederList.value || []);
    const out = [];
    for (const p of providers) {
        const name = String(p?.name || '').trim();
        if (!name)
            continue;
        if (!matchAll(name, ts))
            continue;
        out.push({
            key: `provider:${name}`,
            group: 'providers',
            title: name,
            subtitle: t('globalSearchItemProxyProvider'),
            icon: ServerStackIcon,
            routeName: ROUTE_NAME.proxyProviders,
            focusKind: 'provider',
            focusValue: name,
        });
        if (out.length >= 30)
            break;
    }
    return out;
});
const proxyGroupItems = computed(() => {
    const ts = terms.value;
    const out = [];
    for (const name of proxyGroupList.value || []) {
        const n = String(name || '').trim();
        if (!n)
            continue;
        if (!matchAll(n, ts))
            continue;
        out.push({
            key: `proxyGroup:${n}`,
            group: 'proxyGroups',
            title: n,
            subtitle: t('globalSearchItemProxyGroup'),
            icon: Squares2X2Icon,
            routeName: ROUTE_NAME.proxies,
            focusKind: 'proxyGroup',
            focusValue: n,
        });
        if (out.length >= 40)
            break;
    }
    return out;
});
const proxyNodeItems = computed(() => {
    const ts = terms.value;
    const out = [];
    const entries = Object.entries(proxyMap.value || {});
    for (const [name, proxy] of entries) {
        const n = String(name || '').trim();
        if (!n)
            continue;
        // Skip groups; we render groups separately.
        if (proxy && isProxyGroup(proxy))
            continue;
        if (!matchAll(n, ts))
            continue;
        out.push({
            key: `proxy:${n}`,
            group: 'proxies',
            title: n,
            subtitle: String(proxy?.type || t('globalSearchItemProxy')),
            icon: CircleStackIcon,
            routeName: ROUTE_NAME.proxies,
            focusKind: 'proxy',
            focusValue: n,
        });
        if (out.length >= 50)
            break;
    }
    return out;
});
const ruleItems = computed(() => {
    const ts = terms.value;
    const out = [];
    for (const r of (rules.value || [])) {
        const type = String(r?.type || '').trim();
        const payload = String(r?.payload || '').trim();
        const proxy = String(r?.proxy || '').trim();
        const title = payload ? `${type}: ${payload}` : type;
        const hay = `${type} ${payload} ${proxy}`;
        if (!matchAll(hay, ts))
            continue;
        out.push({
            key: `rule:${type}:${payload}`,
            group: 'rules',
            title,
            subtitle: proxy ? `→ ${proxy}` : undefined,
            icon: AdjustmentsHorizontalIcon,
            routeName: ROUTE_NAME.rules,
            focusKind: 'rule',
            focusValue: title,
        });
        if (out.length >= 60)
            break;
    }
    return out;
});
const userItems = computed(() => {
    const ts = terms.value;
    const out = [];
    for (const u of (sourceIPLabelList.value || [])) {
        const ip = String(u?.key || '').trim();
        const label = String(u?.label || '').trim();
        const scope = String(u?.scope || '').trim();
        const title = label ? `${label}` : ip;
        const subtitle = label ? `${ip}${scope ? ` • ${scope}` : ''}` : (scope ? scope : undefined);
        const hay = `${ip} ${label} ${scope}`;
        if (!matchAll(hay, ts))
            continue;
        if (!ip)
            continue;
        out.push({
            key: `user:${ip}`,
            group: 'users',
            title,
            subtitle,
            icon: UsersIcon,
            routeName: ROUTE_NAME.users,
            focusKind: 'user',
            focusValue: ip,
        });
        if (out.length >= 50)
            break;
    }
    return out;
});
const groupedResults = computed(() => {
    const groups = [];
    const add = (key, title, items, offset) => {
        if (!items.length)
            return offset;
        groups.push({ key, title, items, offset });
        return offset + items.length;
    };
    let offset = 0;
    offset = add('providers', t('globalSearchGroupProviders'), providerItems.value, offset);
    offset = add('proxyGroups', t('globalSearchGroupProxyGroups'), proxyGroupItems.value, offset);
    offset = add('proxies', t('globalSearchGroupProxies'), proxyNodeItems.value, offset);
    offset = add('rules', t('globalSearchGroupRules'), ruleItems.value, offset);
    offset = add('users', t('globalSearchGroupUsers'), userItems.value, offset);
    return groups;
});
const flatResults = computed(() => {
    const out = [];
    for (const g of groupedResults.value)
        out.push(...g.items);
    return out;
});
const closeSearch = () => {
    globalSearchOpen.value = false;
};
const isSelected = (idx) => idx === selectedIdx.value;
const openItem = async (it) => {
    globalSearchOpen.value = false;
    // Set focus *before* navigation so the destination page can pick it up.
    setPendingPageFocus(it.routeName, it.focusKind, it.focusValue);
    await router.push({ name: it.routeName });
};
const stageForItem = (it) => {
    if (it.group === 'providers')
        return 'P';
    if (it.group === 'proxyGroups')
        return 'G';
    if (it.group === 'rules')
        return 'R';
    if (it.group === 'users')
        return 'C';
    return 'S';
};
const openItemInTopology = async (it) => {
    closeSearch();
    const stage = stageForItem(it);
    await navigateToTopology(router, { stage, value: String(it.focusValue || '').trim() }, 'only');
};
const clampSelection = () => {
    const len = flatResults.value.length;
    if (len <= 0) {
        selectedIdx.value = 0;
        return;
    }
    if (selectedIdx.value < 0)
        selectedIdx.value = 0;
    if (selectedIdx.value >= len)
        selectedIdx.value = len - 1;
};
const handleKeydown = (e) => {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx.value += 1;
        clampSelection();
        return;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx.value -= 1;
        clampSelection();
        return;
    }
    if (e.key === 'Enter') {
        const it = flatResults.value[selectedIdx.value];
        if (it) {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                openItemInTopology(it);
            }
            else {
                openItem(it);
            }
        }
        return;
    }
};
watch(globalSearchOpen, async (open) => {
    if (!open) {
        q.value = '';
        selectedIdx.value = 0;
        return;
    }
    await nextTick();
    inputRef.value?.focus();
}, { immediate: true });
watch([q, flatResults], () => {
    selectedIdx.value = 0;
    clampSelection();
});
// Allow closing the dialog by clicking outside or pressing Escape (native <dialog> handles Escape).
// We still keep a safety handler for when focus is inside elements.
const escHandler = (e) => {
    if (!globalSearchOpen.value)
        return;
    if (e.key === 'Escape') {
        globalSearchOpen.value = false;
    }
};
onMounted(() => {
    document.addEventListener('keydown', escHandler);
});
onUnmounted(() => {
    document.removeEventListener('keydown', escHandler);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.globalSearchOpen),
    noPadding: (true),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.globalSearchOpen),
    noPadding: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "p-3" },
});
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_7;
/** @ts-ignore @type {typeof __VLS_components.MagnifyingGlassIcon} */
MagnifyingGlassIcon;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    ...{ class: "h-5 w-5 opacity-70" },
}));
const __VLS_9 = __VLS_8({
    ...{ class: "h-5 w-5 opacity-70" },
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onKeydown: (__VLS_ctx.handleKeydown) },
    ref: "inputRef",
    value: (__VLS_ctx.q),
    type: "text",
    ...{ class: "input input-sm w-full" },
    placeholder: (__VLS_ctx.$t('globalSearchPlaceholder')),
});
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('globalSearchHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "max-h-[60dvh] overflow-y-auto px-2 pb-2" },
});
/** @type {__VLS_StyleScopedClasses['max-h-[60dvh]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-2']} */ ;
if (!__VLS_ctx.flatResults.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.q.trim() ? __VLS_ctx.$t('noResults') : __VLS_ctx.$t('startTypingToSearch'));
}
else {
    for (const [group, gi] of __VLS_vFor((__VLS_ctx.groupedResults))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (group.key),
            ...{ class: "mb-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "px-2 py-1 text-[11px] font-semibold uppercase opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (group.title);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (group.items.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [it, ii] of __VLS_vFor((group.items))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onMouseenter: (...[$event]) => {
                        if (!!(!__VLS_ctx.flatResults.length))
                            return;
                        __VLS_ctx.selectedIdx = group.offset + ii;
                        // @ts-ignore
                        [globalSearchOpen, handleKeydown, q, q, $t, $t, $t, $t, flatResults, groupedResults, selectedIdx,];
                    } },
                key: (it.key),
                ...{ class: "flex gap-1" },
                ...{ class: (__VLS_ctx.isSelected(group.offset + ii) ? 'bg-base-200 ring-1 ring-base-300 rounded-xl' : '') },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.flatResults.length))
                            return;
                        __VLS_ctx.openItem(it);
                        // @ts-ignore
                        [isSelected, openItem,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-sm justify-start h-auto flex-1 rounded-xl px-2 py-2 text-left" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2 min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            const __VLS_12 = (it.icon);
            // @ts-ignore
            const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
                ...{ class: "h-4 w-4 shrink-0 opacity-70" },
            }));
            const __VLS_14 = __VLS_13({
                ...{ class: "h-4 w-4 shrink-0 opacity-70" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_13));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "truncate font-medium" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (it.title);
            if (it.subtitle) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "truncate text-xs opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (it.subtitle);
            }
            const __VLS_17 = TopologyActionButtons;
            // @ts-ignore
            const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
                ...{ 'onBeforeNavigate': {} },
                stage: (__VLS_ctx.stageForItem(it)),
                value: (String(it.focusValue || '').trim()),
                grouped: (true),
            }));
            const __VLS_19 = __VLS_18({
                ...{ 'onBeforeNavigate': {} },
                stage: (__VLS_ctx.stageForItem(it)),
                value: (String(it.focusValue || '').trim()),
                grouped: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_18));
            let __VLS_22;
            const __VLS_23 = ({ beforeNavigate: {} },
                { onBeforeNavigate: (__VLS_ctx.closeSearch) });
            var __VLS_20;
            var __VLS_21;
            // @ts-ignore
            [stageForItem, closeSearch,];
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
