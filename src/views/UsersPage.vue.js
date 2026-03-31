/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import SourceIPInput from '@/components/settings/SourceIPInput.vue';
import CollapseCard from '@/components/common/CollapseCard.vue';
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue';
import { agentLanHostsAPI } from '@/api/agent';
import { showNotification } from '@/helper/notification';
import { i18n } from '@/i18n';
import { disableSwipe } from '@/composables/swipe';
import { ROUTE_NAME } from '@/constant';
import { cleanupExpiredPendingPageFocus, clearPendingPageFocus, flashNavHighlight, getPendingPageFocusForRoute } from '@/helper/navFocus';
import { getSourceIpRuleKind, matchesSourceIpRule } from '@/helper/sourceip';
import { connections } from '@/store/connections';
import { collapseGroupMap, sourceIPLabelList } from '@/store/settings';
import { usersDbSyncActive, usersDbSyncedIdSet } from '@/store/usersDbSync';
import { ArrowDownTrayIcon, ChevronDownIcon, ChevronUpDownIcon, CloudIcon, LockClosedIcon, PlusIcon, TagIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { v4 as uuid } from 'uuid';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import Draggable from 'vuedraggable';
import { useRouter } from 'vue-router';
import { getUserLimitState } from '@/composables/userLimits';
const t = i18n.global.t;
const router = useRouter();
const goTraffic = () => router.push({ name: ROUTE_NAME.traffic });
const newLabelForIP = ref({
    key: '',
    label: '',
});
const handlerLabelAdd = () => {
    if (!newLabelForIP.value.key || !newLabelForIP.value.label) {
        return;
    }
    sourceIPLabelList.value.push({
        ...newLabelForIP.value,
        id: uuid(),
    });
    newLabelForIP.value = {
        key: '',
        label: '',
    };
};
const handlerLabelRemove = (id) => {
    const idx = sourceIPLabelList.value.findIndex((item) => item.id === id);
    if (idx >= 0)
        sourceIPLabelList.value.splice(idx, 1);
};
const handlerLabelUpdate = (sourceIP) => {
    const index = sourceIPLabelList.value.findIndex((item) => item.id === sourceIP.id);
    if (index < 0)
        return;
    sourceIPLabelList.value[index] = {
        ...sourceIPLabelList.value[index],
        ...sourceIP,
    };
};
const isBlockedUser = (sourceIP) => {
    const user = (sourceIP.label || sourceIP.key || '').toString().trim();
    if (!user)
        return false;
    return getUserLimitState(user).blocked;
};
const liveSourceIps = computed(() => {
    return Array.from(new Set((connections.value || [])
        .map((conn) => String(conn?.metadata?.sourceIP || '').trim())
        .filter(Boolean))).sort((a, b) => a.localeCompare(b));
});
const ruleKindLabel = (key) => {
    const kind = getSourceIpRuleKind(String(key || '').trim());
    if (kind === 'cidr')
        return t('sourceIpRuleKindCidr');
    if (kind === 'regex')
        return t('sourceIpRuleKindRegex');
    if (kind === 'suffix')
        return t('sourceIpRuleKindSuffix');
    return t('sourceIpRuleKindExact');
};
const ruleKindBadgeClass = (key) => {
    const kind = getSourceIpRuleKind(String(key || '').trim());
    if (kind === 'cidr')
        return 'badge-info';
    if (kind === 'regex')
        return 'badge-warning';
    if (kind === 'suffix')
        return 'badge-secondary';
    return 'badge-neutral';
};
const sourceIpLiveMatches = (key) => {
    const raw = String(key || '').trim();
    if (!raw)
        return [];
    return liveSourceIps.value.filter((ip) => matchesSourceIpRule(raw, ip));
};
const sourceIpLiveMatchesCount = (key) => sourceIpLiveMatches(key).length;
const sourceIpLiveMatchesTitle = (key) => {
    const items = sourceIpLiveMatches(key);
    if (!items.length)
        return t('sourceIpLiveMatchesNone');
    return t('sourceIpLiveMatchesTitle', { count: items.length, ips: items.slice(0, 6).join(', ') });
};
const importLoading = ref(false);
const importError = ref('');
const overwriteExisting = ref(false);
const importItems = ref([]);
const IMPORT_COLLAPSE_NAME = 'usersImportLanHosts';
const importLastFetchAt = ref(0);
const MAPPING_COLLAPSE_NAME = 'usersSourceIpMapping';
if (collapseGroupMap.value[MAPPING_COLLAPSE_NAME] === undefined) {
    // Keep the mapping visible by default (same behavior as before),
    // while allowing users to collapse it when the list grows.
    collapseGroupMap.value[MAPPING_COLLAPSE_NAME] = true;
}
// --- Cross-page navigation focus (Topology -> Users) ---
const findUserEl = (ip) => {
    const v = String(ip || '').trim();
    if (!v)
        return null;
    const items = Array.from(document.querySelectorAll('[data-nav-kind="user"]'));
    return (items.find((el) => String(el.dataset?.navValue || '').trim() === v) ||
        null);
};
let focusApplied = false;
const tryApplyPendingFocus = async () => {
    if (focusApplied)
        return;
    const pf = getPendingPageFocusForRoute(ROUTE_NAME.users);
    if (!pf || pf.kind !== 'user')
        return;
    const ip = String(pf.value || '').trim();
    if (!ip)
        return;
    // Ensure mapping accordion is open.
    collapseGroupMap.value[MAPPING_COLLAPSE_NAME] = true;
    const start = performance.now();
    const loop = async () => {
        await nextTick();
        const el = findUserEl(ip);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            flashNavHighlight(el);
            clearPendingPageFocus();
            focusApplied = true;
            return;
        }
        if (performance.now() - start < 2400)
            requestAnimationFrame(() => loop());
    };
    loop();
};
onMounted(() => {
    cleanupExpiredPendingPageFocus();
    tryApplyPendingFocus();
});
watch(sourceIPLabelList, () => {
    tryApplyPendingFocus();
});
const fetchImportItems = async () => {
    // Avoid re-fetch spam when user quickly toggles the panel.
    const now = Date.now();
    if (importLoading.value)
        return;
    if (importItems.value.length && now - importLastFetchAt.value < 3000)
        return;
    importLastFetchAt.value = now;
    importLoading.value = true;
    importError.value = '';
    importItems.value = [];
    const res = await agentLanHostsAPI();
    importLoading.value = false;
    if (!res?.ok) {
        importError.value = res?.error || 'offline';
        return;
    }
    buildImportItems(res.items || []);
};
const normalizeName = (s) => (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
const buildImportItems = (raw) => {
    const byIp = new Map();
    for (const it of raw || []) {
        const ip = String(it?.ip || '').trim();
        if (!ip)
            continue;
        const hostname = String(it?.hostname || '').trim();
        const mac = String(it?.mac || '').trim();
        const source = String(it?.source || '').trim();
        // Prefer items with a hostname.
        if (!byIp.has(ip)) {
            byIp.set(ip, { ip, hostname, mac, source });
        }
        else {
            const cur = byIp.get(ip);
            if (!cur.hostname && hostname)
                byIp.set(ip, { ip, hostname, mac: mac || cur.mac, source: source || cur.source });
        }
    }
    const out = [];
    for (const v of Array.from(byIp.values())) {
        const ip = v.ip;
        const hostname = v.hostname;
        const existing = sourceIPLabelList.value.find((x) => String(x.key || '').trim() === ip) || null;
        const currentLabel = existing ? String(existing.label || '').trim() : '';
        let status = 'add';
        let selected = false;
        if (!hostname) {
            status = 'nohost';
            selected = false;
        }
        else if (!existing) {
            status = 'add';
            selected = true;
        }
        else {
            const curN = normalizeName(currentLabel);
            const hostN = normalizeName(hostname);
            const keyN = normalizeName(existing.key || '');
            if (curN && curN === hostN) {
                status = 'same';
                selected = false;
            }
            else if (!curN || curN === keyN) {
                status = 'fill';
                selected = true;
            }
            else {
                status = overwriteExisting.value ? 'overwrite' : 'skip';
                selected = overwriteExisting.value;
            }
        }
        out.push({
            ip,
            hostname,
            mac: v.mac,
            source: v.source,
            status,
            selected,
            currentLabel: currentLabel ? `${t('user')}: ${currentLabel}` : '',
        });
    }
    out.sort((a, b) => {
        const ah = normalizeName(a.hostname);
        const bh = normalizeName(b.hostname);
        if (ah && bh && ah !== bh)
            return ah.localeCompare(bh);
        return a.ip.localeCompare(b.ip);
    });
    importItems.value = out;
};
watch(overwriteExisting, () => {
    // Recompute statuses for items with existing custom labels.
    importItems.value = importItems.value.map((it) => {
        if (it.status === 'skip' || it.status === 'overwrite') {
            const existing = sourceIPLabelList.value.find((x) => String(x.key || '').trim() === it.ip) || null;
            const currentLabel = existing ? String(existing.label || '').trim() : '';
            const curN = normalizeName(currentLabel);
            const hostN = normalizeName(it.hostname);
            const keyN = existing ? normalizeName(existing.key || '') : '';
            if (!existing)
                return { ...it, status: 'add', selected: true };
            if (curN && curN === hostN)
                return { ...it, status: 'same', selected: false };
            if (!curN || curN === keyN)
                return { ...it, status: 'fill', selected: true };
            return overwriteExisting.value
                ? { ...it, status: 'overwrite', selected: true }
                : { ...it, status: 'skip', selected: false };
        }
        return it;
    });
});
const selectedCount = computed(() => importItems.value.filter((x) => x.selected).length);
const statusText = (s) => {
    switch (s) {
        case 'add':
            return t('importLanHostsStatusAdd');
        case 'fill':
            return t('importLanHostsStatusFill');
        case 'overwrite':
            return t('importLanHostsStatusOverwrite');
        case 'skip':
            return t('importLanHostsStatusSkip');
        case 'same':
            return t('importLanHostsStatusSame');
        default:
            return '—';
    }
};
const closeImportPanel = () => {
    collapseGroupMap.value[IMPORT_COLLAPSE_NAME] = false;
};
const openImportPanel = async () => {
    collapseGroupMap.value[IMPORT_COLLAPSE_NAME] = true;
    await fetchImportItems();
};
const toggleImportPanel = async () => {
    const isOpen = !!collapseGroupMap.value[IMPORT_COLLAPSE_NAME];
    if (isOpen) {
        closeImportPanel();
        return;
    }
    await openImportPanel();
};
watch(() => !!collapseGroupMap.value[IMPORT_COLLAPSE_NAME], (open) => {
    if (open && !importItems.value.length && !importLoading.value && !importError.value) {
        void fetchImportItems();
    }
});
const applyImport = () => {
    let added = 0;
    let updated = 0;
    for (const it of importItems.value) {
        if (!it.selected)
            continue;
        if (!it.hostname)
            continue;
        const existing = sourceIPLabelList.value.find((x) => String(x.key || '').trim() === it.ip) || null;
        if (!existing) {
            sourceIPLabelList.value.push({ id: uuid(), key: it.ip, label: it.hostname });
            added++;
            continue;
        }
        const cur = String(existing.label || '').trim();
        const curN = normalizeName(cur);
        const keyN = normalizeName(existing.key || '');
        const hostN = normalizeName(it.hostname);
        if (curN && curN === hostN)
            continue;
        if (overwriteExisting.value || !curN || curN === keyN) {
            existing.label = it.hostname;
            updated++;
        }
    }
    showNotification({
        content: 'importLanHostsDone',
        params: { added: String(added), updated: String(updated) },
        type: 'alert-success',
    });
    closeImportPanel();
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 overflow-x-hidden p-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-base-content/80" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/80']} */ ;
(__VLS_ctx.$t('legacyWorkspaceUsersNotice'));
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
(__VLS_ctx.t('users'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-3" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.t('usersTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleImportPanel) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.importLoading),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.ArrowDownTrayIcon} */
ArrowDownTrayIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
(__VLS_ctx.t('importLanHosts'));
const __VLS_5 = CollapseCard || CollapseCard;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    name: "usersImportLanHosts",
}));
const __VLS_7 = __VLS_6({
    name: "usersImportLanHosts",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
const { default: __VLS_10 } = __VLS_8.slots;
{
    const { title: __VLS_11 } = __VLS_8.slots;
    const [{ open }] = __VLS_vSlot(__VLS_11);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_12;
    /** @ts-ignore @type {typeof __VLS_components.ArrowDownTrayIcon} */
    ArrowDownTrayIcon;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_14 = __VLS_13({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.t('importLanHostsTitle'));
    if (__VLS_ctx.importLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-sm']} */ ;
    }
    let __VLS_17;
    /** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
    ChevronDownIcon;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
        ...{ class: "h-4 w-4 opacity-60 transition-transform" },
        ...{ class: (open ? 'rotate-180' : '') },
    }));
    const __VLS_19 = __VLS_18({
        ...{ class: "h-4 w-4 opacity-60 transition-transform" },
        ...{ class: (open ? 'rotate-180' : '') },
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
    // @ts-ignore
    [$t, t, t, t, t, toggleImportPanel, importLoading, importLoading,];
}
{
    const { preview: __VLS_22 } = __VLS_8.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.t('importLanHostsTip'));
    // @ts-ignore
    [t,];
}
{
    const { content: __VLS_23 } = __VLS_8.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-3 pt-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.t('importLanHostsTip'));
    if (__VLS_ctx.importLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2 text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.t('update'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        if (__VLS_ctx.importError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "alert alert-error p-2 text-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['alert']} */ ;
            /** @type {__VLS_StyleScopedClasses['alert-error']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.importError);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "label cursor-pointer justify-start gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['label']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                type: "checkbox",
                ...{ class: "checkbox checkbox-sm" },
            });
            (__VLS_ctx.overwriteExisting);
            /** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
            /** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "label-text" },
            });
            /** @type {__VLS_StyleScopedClasses['label-text']} */ ;
            (__VLS_ctx.t('importLanHostsOverwrite'));
            if (!__VLS_ctx.importItems.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-sm opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.t('importLanHostsNone'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "overflow-x-auto" },
                });
                /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                    ...{ class: "table table-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['table']} */ ;
                /** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "w-10" },
                });
                /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
                (__VLS_ctx.t('importLanHostsHost'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
                (__VLS_ctx.t('importLanHostsIp'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "max-md:hidden" },
                });
                /** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
                (__VLS_ctx.t('importLanHostsMac'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "max-md:hidden" },
                });
                /** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
                (__VLS_ctx.t('importLanHostsSource'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                    ...{ class: "w-24" },
                });
                /** @type {__VLS_StyleScopedClasses['w-24']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
                for (const [it] of __VLS_vFor((__VLS_ctx.importItems))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                        key: (it.ip),
                        ...{ class: "hover" },
                    });
                    /** @type {__VLS_StyleScopedClasses['hover']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        type: "checkbox",
                        ...{ class: "checkbox checkbox-sm" },
                        disabled: (it.status === 'same' || it.status === 'nohost'),
                    });
                    (it.selected);
                    /** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
                    /** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "font-medium" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-col" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (it.hostname || '—');
                    if (it.currentLabel) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "text-xs opacity-60" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                        (it.currentLabel);
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "font-mono text-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    (it.ip);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "font-mono text-xs max-md:hidden" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
                    (it.mac || '—');
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                        ...{ class: "text-xs max-md:hidden" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
                    (it.source || '—');
                    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-sm" },
                        ...{ class: (it.status === 'add'
                                ? 'badge-success'
                                : it.status === 'fill'
                                    ? 'badge-info'
                                    : it.status === 'overwrite'
                                        ? 'badge-warning'
                                        : it.status === 'skip'
                                            ? 'badge-ghost'
                                            : 'badge-neutral') },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (__VLS_ctx.statusText(it.status));
                    // @ts-ignore
                    [t, t, t, t, t, t, t, t, importLoading, importError, importError, overwriteExisting, importItems, importItems, statusText,];
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 flex items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-sm opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.selectedCount);
            (__VLS_ctx.importItems.length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.closeImportPanel) },
                type: "button",
                ...{ class: "btn btn-sm btn-ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.t('close'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.applyImport) },
                type: "button",
                ...{ class: "btn btn-sm btn-primary" },
                disabled: (__VLS_ctx.selectedCount === 0),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
            (__VLS_ctx.t('importLanHostsApply'));
        }
    }
    // @ts-ignore
    [t, t, importItems, selectedCount, selectedCount, closeImportPanel, applyImport,];
}
// @ts-ignore
[];
var __VLS_8;
const __VLS_24 = CollapseCard || CollapseCard;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    name: "usersSourceIpMapping",
}));
const __VLS_26 = __VLS_25({
    name: "usersSourceIpMapping",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
const { default: __VLS_29 } = __VLS_27.slots;
{
    const { title: __VLS_30 } = __VLS_27.slots;
    const [{ open }] = __VLS_vSlot(__VLS_30);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_31;
    /** @ts-ignore @type {typeof __VLS_components.TagIcon} */
    TagIcon;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_33 = __VLS_32({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.t('sourceIPLabels'));
    if (__VLS_ctx.sourceIPLabelList.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.sourceIPLabelList.length);
    }
    let __VLS_36;
    /** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
    ChevronDownIcon;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        ...{ class: "h-4 w-4 opacity-60 transition-transform" },
        ...{ class: (open ? 'rotate-180' : '') },
    }));
    const __VLS_38 = __VLS_37({
        ...{ class: "h-4 w-4 opacity-60 transition-transform" },
        ...{ class: (open ? 'rotate-180' : '') },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
    // @ts-ignore
    [t, sourceIPLabelList, sourceIPLabelList,];
}
{
    const { preview: __VLS_41 } = __VLS_27.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.t('usersTip'));
    // @ts-ignore
    [t,];
}
{
    const { content: __VLS_42 } = __VLS_27.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-2 pt-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-1']} */ ;
    if (__VLS_ctx.sourceIPLabelList.length) {
        let __VLS_43;
        /** @ts-ignore @type {typeof __VLS_components.Draggable | typeof __VLS_components.Draggable} */
        Draggable;
        // @ts-ignore
        const __VLS_44 = __VLS_asFunctionalComponent1(__VLS_43, new __VLS_43({
            ...{ 'onStart': {} },
            ...{ 'onEnd': {} },
            ...{ class: "flex flex-1 flex-col gap-2" },
            modelValue: (__VLS_ctx.sourceIPLabelList),
            group: "list",
            animation: (150),
            handle: ('.drag-handle'),
            filter: ('.no-drag'),
            preventOnFilter: (false),
            itemKey: ('id'),
        }));
        const __VLS_45 = __VLS_44({
            ...{ 'onStart': {} },
            ...{ 'onEnd': {} },
            ...{ class: "flex flex-1 flex-col gap-2" },
            modelValue: (__VLS_ctx.sourceIPLabelList),
            group: "list",
            animation: (150),
            handle: ('.drag-handle'),
            filter: ('.no-drag'),
            preventOnFilter: (false),
            itemKey: ('id'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_44));
        let __VLS_48;
        const __VLS_49 = ({ start: {} },
            { onStart: (...[$event]) => {
                    if (!(__VLS_ctx.sourceIPLabelList.length))
                        return;
                    __VLS_ctx.disableSwipe = true;
                    // @ts-ignore
                    [sourceIPLabelList, sourceIPLabelList, disableSwipe,];
                } });
        const __VLS_50 = ({ end: {} },
            { onEnd: (...[$event]) => {
                    if (!(__VLS_ctx.sourceIPLabelList.length))
                        return;
                    __VLS_ctx.disableSwipe = false;
                    // @ts-ignore
                    [disableSwipe,];
                } });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        const { default: __VLS_51 } = __VLS_46.slots;
        {
            const { item: __VLS_52 } = __VLS_46.slots;
            const [{ element: sourceIP }] = __VLS_vSlot(__VLS_52);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                'data-nav-kind': "user",
                'data-nav-value': (String(sourceIP.key || '')),
            });
            const __VLS_53 = SourceIPInput || SourceIPInput;
            // @ts-ignore
            const __VLS_54 = __VLS_asFunctionalComponent1(__VLS_53, new __VLS_53({
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (sourceIP),
            }));
            const __VLS_55 = __VLS_54({
                ...{ 'onUpdate:modelValue': {} },
                modelValue: (sourceIP),
            }, ...__VLS_functionalComponentArgsRest(__VLS_54));
            let __VLS_58;
            const __VLS_59 = ({ 'update:modelValue': {} },
                { 'onUpdate:modelValue': (__VLS_ctx.handlerLabelUpdate) });
            const { default: __VLS_60 } = __VLS_56.slots;
            {
                const { prefix: __VLS_61 } = __VLS_56.slots;
                let __VLS_62;
                /** @ts-ignore @type {typeof __VLS_components.ChevronUpDownIcon} */
                ChevronUpDownIcon;
                // @ts-ignore
                const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
                    ...{ class: "drag-handle h-4 w-4 shrink-0 cursor-grab" },
                }));
                const __VLS_64 = __VLS_63({
                    ...{ class: "drag-handle h-4 w-4 shrink-0 cursor-grab" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_63));
                /** @type {__VLS_StyleScopedClasses['drag-handle']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-grab']} */ ;
                if (__VLS_ctx.isBlockedUser(sourceIP)) {
                    let __VLS_67;
                    /** @ts-ignore @type {typeof __VLS_components.LockClosedIcon} */
                    LockClosedIcon;
                    // @ts-ignore
                    const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
                        ...{ class: "no-drag h-4 w-4 text-error" },
                        title: (__VLS_ctx.t('userBlockedTip')),
                    }));
                    const __VLS_69 = __VLS_68({
                        ...{ class: "no-drag h-4 w-4 text-error" },
                        title: (__VLS_ctx.t('userBlockedTip')),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_68));
                    /** @type {__VLS_StyleScopedClasses['no-drag']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
                }
                if (__VLS_ctx.usersDbSyncActive && __VLS_ctx.usersDbSyncedIdSet.has(sourceIP.id)) {
                    let __VLS_72;
                    /** @ts-ignore @type {typeof __VLS_components.CloudIcon} */
                    CloudIcon;
                    // @ts-ignore
                    const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({
                        ...{ class: "no-drag h-4 w-4 text-success" },
                        title: (__VLS_ctx.t('usersDbSyncedUserTip')),
                    }));
                    const __VLS_74 = __VLS_73({
                        ...{ class: "no-drag h-4 w-4 text-success" },
                        title: (__VLS_ctx.t('usersDbSyncedUserTip')),
                    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
                    /** @type {__VLS_StyleScopedClasses['no-drag']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-success']} */ ;
                }
                // @ts-ignore
                [t, t, handlerLabelUpdate, isBlockedUser, usersDbSyncActive, usersDbSyncedIdSet,];
            }
            {
                const { default: __VLS_77 } = __VLS_56.slots;
                const __VLS_78 = TopologyActionButtons;
                // @ts-ignore
                const __VLS_79 = __VLS_asFunctionalComponent1(__VLS_78, new __VLS_78({
                    stage: ('C'),
                    value: (String(sourceIP.key || '').trim()),
                    grouped: (false),
                    containerClass: "no-drag",
                    buttonClass: "no-drag",
                }));
                const __VLS_80 = __VLS_79({
                    stage: ('C'),
                    value: (String(sourceIP.key || '').trim()),
                    grouped: (false),
                    containerClass: "no-drag",
                    buttonClass: "no-drag",
                }, ...__VLS_functionalComponentArgsRest(__VLS_79));
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.sourceIPLabelList.length))
                                return;
                            __VLS_ctx.handlerLabelRemove(sourceIP.id);
                            // @ts-ignore
                            [handlerLabelRemove,];
                        } },
                    ...{ onPointerdown: () => { } },
                    ...{ onMousedown: () => { } },
                    ...{ onTouchstart: () => { } },
                    type: "button",
                    ...{ class: "no-drag btn btn-circle btn-ghost btn-sm" },
                    title: (__VLS_ctx.t('delete')),
                });
                /** @type {__VLS_StyleScopedClasses['no-drag']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
                let __VLS_83;
                /** @ts-ignore @type {typeof __VLS_components.TrashIcon} */
                TrashIcon;
                // @ts-ignore
                const __VLS_84 = __VLS_asFunctionalComponent1(__VLS_83, new __VLS_83({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_85 = __VLS_84({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                // @ts-ignore
                [t,];
            }
            // @ts-ignore
            [];
            var __VLS_56;
            var __VLS_57;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "ml-10 flex flex-wrap items-center gap-1 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-10']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-xs" },
                ...{ class: (__VLS_ctx.ruleKindBadgeClass(sourceIP.key)) },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (__VLS_ctx.ruleKindLabel(sourceIP.key));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-xs badge-ghost" },
                title: (__VLS_ctx.sourceIpLiveMatchesTitle(sourceIP.key)),
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            (__VLS_ctx.t('sourceIpLiveMatchesShort', { count: __VLS_ctx.sourceIpLiveMatchesCount(sourceIP.key) }));
            // @ts-ignore
            [t, ruleKindBadgeClass, ruleKindLabel, sourceIpLiveMatchesTitle, sourceIpLiveMatchesCount,];
        }
        // @ts-ignore
        [];
        var __VLS_46;
        var __VLS_47;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.t('usersEmpty'));
    }
    const __VLS_88 = SourceIPInput || SourceIPInput;
    // @ts-ignore
    const __VLS_89 = __VLS_asFunctionalComponent1(__VLS_88, new __VLS_88({
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.newLabelForIP),
    }));
    const __VLS_90 = __VLS_89({
        ...{ 'onKeydown': {} },
        modelValue: (__VLS_ctx.newLabelForIP),
    }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    let __VLS_93;
    const __VLS_94 = ({ keydown: {} },
        { onKeydown: (__VLS_ctx.handlerLabelAdd) });
    const { default: __VLS_95 } = __VLS_91.slots;
    {
        const { prefix: __VLS_96 } = __VLS_91.slots;
        let __VLS_97;
        /** @ts-ignore @type {typeof __VLS_components.TagIcon} */
        TagIcon;
        // @ts-ignore
        const __VLS_98 = __VLS_asFunctionalComponent1(__VLS_97, new __VLS_97({
            ...{ class: "h-4 w-4 shrink-0" },
        }));
        const __VLS_99 = __VLS_98({
            ...{ class: "h-4 w-4 shrink-0" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_98));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        // @ts-ignore
        [t, newLabelForIP, handlerLabelAdd,];
    }
    {
        const { default: __VLS_102 } = __VLS_91.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.handlerLabelAdd) },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "no-drag btn btn-circle btn-sm" },
            title: (__VLS_ctx.t('add')),
        });
        /** @type {__VLS_StyleScopedClasses['no-drag']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        let __VLS_103;
        /** @ts-ignore @type {typeof __VLS_components.PlusIcon} */
        PlusIcon;
        // @ts-ignore
        const __VLS_104 = __VLS_asFunctionalComponent1(__VLS_103, new __VLS_103({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_105 = __VLS_104({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_104));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        // @ts-ignore
        [t, handlerLabelAdd,];
    }
    // @ts-ignore
    [];
    var __VLS_91;
    var __VLS_92;
    if (__VLS_ctx.newLabelForIP.key) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ml-10 flex flex-wrap items-center gap-1 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-10']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-xs" },
            ...{ class: (__VLS_ctx.ruleKindBadgeClass(__VLS_ctx.newLabelForIP.key)) },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.ruleKindLabel(__VLS_ctx.newLabelForIP.key));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-xs badge-ghost" },
            title: (__VLS_ctx.sourceIpLiveMatchesTitle(__VLS_ctx.newLabelForIP.key)),
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        (__VLS_ctx.t('sourceIpLiveMatchesShort', { count: __VLS_ctx.sourceIpLiveMatchesCount(__VLS_ctx.newLabelForIP.key) }));
    }
    // @ts-ignore
    [t, ruleKindBadgeClass, ruleKindLabel, sourceIpLiveMatchesTitle, sourceIpLiveMatchesCount, newLabelForIP, newLabelForIP, newLabelForIP, newLabelForIP, newLabelForIP,];
}
// @ts-ignore
[];
var __VLS_27;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-2" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.t('traffic'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.t('trafficMovedToTrafficSectionTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goTraffic) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.t('open'));
(__VLS_ctx.t('traffic'));
// @ts-ignore
[t, t, t, t, goTraffic,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
