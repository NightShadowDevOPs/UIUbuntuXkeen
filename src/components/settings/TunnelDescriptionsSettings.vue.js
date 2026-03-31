/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ROUTE_NAME } from '@/constant';
import { COMMON_TUNNEL_INTERFACE_SUGGESTIONS, ifaceBaseDisplayName, inferTunnelKindFromName, normalizeTunnelDescription, normalizeTunnelInterfaceName } from '@/helper/tunnelDescriptions';
import { tunnelInterfaceDescriptionMap } from '@/store/settings';
import { usersDbSyncEnabled } from '@/store/usersDbSync';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
const router = useRouter();
const { t } = useI18n();
const tunnelDescriptionDrafts = ref({});
const newTunnelInterfaceName = ref('');
const newTunnelInterfaceDescription = ref('');
const tunnelDescriptionEntries = computed(() => {
    return Array.from(new Set(Object.keys(tunnelInterfaceDescriptionMap.value || {}).map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean)))
        .map((name) => ({
        name,
        kind: inferTunnelKindFromName(name),
        description: normalizeTunnelDescription((tunnelInterfaceDescriptionMap.value || {})[name] || ''),
    }))
        .sort((a, b) => a.name.localeCompare(b.name));
});
const tunnelDescriptionSuggestions = computed(() => {
    const names = [
        ...Object.keys(tunnelInterfaceDescriptionMap.value || {}),
        ...COMMON_TUNNEL_INTERFACE_SUGGESTIONS,
    ];
    return Array.from(new Set(names.map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean)))
        .filter((name) => !tunnelDescriptionEntries.value.some((entry) => entry.name === name))
        .slice(0, 8);
});
const canAddTunnelDescription = computed(() => normalizeTunnelInterfaceName(newTunnelInterfaceName.value).length > 0);
const tunnelDescriptionStorageBadge = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedBadge') : t('routerTrafficTunnelDescriptionsStorageLocalBadge'));
const tunnelDescriptionStorageHint = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedHint') : t('routerTrafficTunnelDescriptionsStorageHint'));
const prefillTunnelDescriptionName = (name) => {
    const key = normalizeTunnelInterfaceName(name);
    if (!key)
        return;
    newTunnelInterfaceName.value = key;
};
watch(tunnelDescriptionEntries, (entries) => {
    const next = { ...tunnelDescriptionDrafts.value };
    for (const entry of entries) {
        if (!(entry.name in next))
            next[entry.name] = entry.description;
    }
    tunnelDescriptionDrafts.value = next;
}, { immediate: true, deep: true });
const saveTunnelDescription = (name) => {
    const key = normalizeTunnelInterfaceName(name);
    if (!key)
        return;
    const next = { ...(tunnelInterfaceDescriptionMap.value || {}) };
    const description = normalizeTunnelDescription(tunnelDescriptionDrafts.value[key] || '');
    if (description)
        next[key] = description;
    else
        delete next[key];
    tunnelInterfaceDescriptionMap.value = next;
    tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description };
};
const clearTunnelDescription = (name) => {
    const key = normalizeTunnelInterfaceName(name);
    if (!key)
        return;
    const next = { ...(tunnelInterfaceDescriptionMap.value || {}) };
    delete next[key];
    tunnelInterfaceDescriptionMap.value = next;
    tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: '' };
};
const addTunnelDescriptionEntry = () => {
    const key = normalizeTunnelInterfaceName(newTunnelInterfaceName.value);
    if (!key)
        return;
    const description = normalizeTunnelDescription(newTunnelInterfaceDescription.value);
    tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description };
    const next = { ...(tunnelInterfaceDescriptionMap.value || {}) };
    if (description)
        next[key] = description;
    else
        delete next[key];
    tunnelInterfaceDescriptionMap.value = next;
    newTunnelInterfaceName.value = '';
    newTunnelInterfaceDescription.value = '';
};
const openRouterTraffic = () => {
    router.push({ name: ROUTE_NAME.router });
};
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
(__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-4" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-content/10 bg-base-200/20 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-1" },
});
/** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('routerTrafficTunnelDescriptions'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-[11px] opacity-55" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-55']} */ ;
(__VLS_ctx.tunnelDescriptionStorageHint);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost badge-sm" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
(__VLS_ctx.tunnelDescriptionEntries.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-outline badge-sm" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
(__VLS_ctx.tunnelDescriptionStorageBadge);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openRouterTraffic) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('open'));
(__VLS_ctx.$t('router'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
if (!__VLS_ctx.tunnelDescriptionEntries.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-dashed border-base-content/10 bg-base-100/30 px-3 py-3 text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsEmpty'));
}
for (const [entry] of __VLS_vFor((__VLS_ctx.tunnelDescriptionEntries))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (`settings-tunnel-desc-${entry.name}`),
        ...{ class: "grid gap-2 rounded-lg border border-base-content/10 bg-base-100/40 p-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto]" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "truncate text-sm font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.ifaceBaseDisplayName(entry.name, entry.kind));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "truncate font-mono text-[11px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (entry.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-xs uppercase" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    (entry.kind || 'vpn');
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.tunnelDescriptionDrafts[entry.name]),
        ...{ class: "input input-sm w-full" },
        type: "text",
        placeholder: (__VLS_ctx.$t('routerTrafficTunnelDescriptionPlaceholder')),
    });
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.saveTunnelDescription(entry.name);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, tunnelDescriptionStorageHint, tunnelDescriptionEntries, tunnelDescriptionEntries, tunnelDescriptionEntries, tunnelDescriptionStorageBadge, openRouterTraffic, ifaceBaseDisplayName, tunnelDescriptionDrafts, saveTunnelDescription,];
            } },
        type: "button",
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('save'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.clearTunnelDescription(entry.name);
                // @ts-ignore
                [$t, clearTunnelDescription,];
            } },
        type: "button",
        ...{ class: "btn btn-ghost btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('clear'));
    // @ts-ignore
    [$t,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl border border-base-content/10 bg-base-200/15 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/15']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-2 text-sm font-medium" },
});
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
(__VLS_ctx.$t('add'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-3 text-xs opacity-65" },
});
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-65']} */ ;
(__VLS_ctx.$t('routerTrafficTunnelDescriptionsHint'));
if (__VLS_ctx.tunnelDescriptionSuggestions.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-3 flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    for (const [name] of __VLS_vFor((__VLS_ctx.tunnelDescriptionSuggestions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tunnelDescriptionSuggestions.length))
                        return;
                    __VLS_ctx.prefillTunnelDescriptionName(name);
                    // @ts-ignore
                    [$t, $t, tunnelDescriptionSuggestions, tunnelDescriptionSuggestions, prefillTunnelDescriptionName,];
                } },
            key: (`settings-tunnel-desc-suggest-${name}`),
            type: "button",
            ...{ class: "btn btn-ghost btn-xs font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (name);
        // @ts-ignore
        [];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.newTunnelInterfaceName),
    ...{ class: "input input-sm w-full font-mono" },
    type: "text",
    placeholder: (__VLS_ctx.$t('routerTrafficTunnelInterfacePlaceholder')),
});
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.newTunnelInterfaceDescription),
    ...{ class: "input input-sm w-full" },
    type: "text",
    placeholder: (__VLS_ctx.$t('routerTrafficTunnelDescriptionPlaceholder')),
});
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.addTunnelDescriptionEntry) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.canAddTunnelDescription),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('add'));
// @ts-ignore
[$t, $t, $t, newTunnelInterfaceName, newTunnelInterfaceDescription, addTunnelDescriptionEntry, canAddTunnelDescription,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
