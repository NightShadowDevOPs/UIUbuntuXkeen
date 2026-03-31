/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { prettyBytesHelper } from '@/helper/utils';
import { showNotification } from '@/helper/notification';
import { userLimitProfiles } from '@/store/userLimitProfiles';
import { userLimitSnapshots } from '@/store/userLimitSnapshots';
import { createSnapshotNow, exportLimitsBundle, importLimitsBundle, resetProfilesToDefault, restoreSnapshot } from '@/composables/userLimitProfiles';
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
const profiles = computed(() => userLimitProfiles.value || []);
const snapshots = computed(() => userLimitSnapshots.value || []);
const snapshotsSorted = computed(() => [...snapshots.value].sort((a, b) => b.createdAt - a.createdAt));
const selectedId = ref('unlimited');
const selected = computed(() => profiles.value.find((p) => p.id === selectedId.value) || null);
const draft = ref({
    name: '',
    enabled: true,
    trafficValue: 0,
    trafficUnit: 'GB',
    trafficPeriod: '30d',
    bandwidthMbps: 0,
});
const loadDraft = (p) => {
    if (!p)
        return;
    draft.value.name = p.name;
    draft.value.enabled = !!p.enabled;
    draft.value.trafficUnit = (p.trafficLimitUnit || 'GB');
    draft.value.trafficPeriod = (p.trafficPeriod || '30d');
    // show value in chosen unit
    const b = p.trafficLimitBytes || 0;
    if (!b)
        draft.value.trafficValue = 0;
    else if (draft.value.trafficUnit === 'GB')
        draft.value.trafficValue = +(b / (1024 ** 3)).toFixed(2);
    else
        draft.value.trafficValue = +(b / (1024 ** 2)).toFixed(1);
    const bl = p.bandwidthLimitBps || 0;
    draft.value.bandwidthMbps = bl ? +((bl * 8) / (1024 ** 2)).toFixed(1) : 0;
};
watch(selected, () => loadDraft(selected.value), { immediate: true });
const selectProfile = (id) => {
    selectedId.value = id;
};
const fmtBytes = (b) => prettyBytesHelper(b);
const fmtMbps = (bps) => `${((bps * 8) / (1024 ** 2)).toFixed(1)} Mbps`;
const fmtTime = (ts) => dayjs(ts).format('YYYY-MM-DD HH:mm:ss');
const revertDraft = () => loadDraft(selected.value);
const saveDraft = () => {
    const p = selected.value;
    if (!p)
        return;
    const trafficBytes = (() => {
        const v = Number(draft.value.trafficValue || 0);
        if (!Number.isFinite(v) || v <= 0)
            return 0;
        if (draft.value.trafficUnit === 'GB')
            return Math.round(v * (1024 ** 3));
        return Math.round(v * (1024 ** 2));
    })();
    const bandwidthBps = (() => {
        const v = Number(draft.value.bandwidthMbps || 0);
        if (!Number.isFinite(v) || v <= 0)
            return 0;
        return Math.round((v * 1024 * 1024) / 8);
    })();
    const next = {
        ...p,
        name: (draft.value.name || '').trim() || p.name,
        enabled: !!draft.value.enabled,
        trafficLimitBytes: trafficBytes,
        trafficLimitUnit: draft.value.trafficUnit,
        trafficPeriod: draft.value.trafficPeriod,
        bandwidthLimitBps: bandwidthBps,
    };
    userLimitProfiles.value = profiles.value.map((x) => (x.id === p.id ? next : x));
    showNotification({ content: 'saved', type: 'alert-success', timeout: 1400 });
};
const addProfile = () => {
    const id = `p_${Math.random().toString(16).slice(2, 8)}`;
    const p = {
        id,
        name: 'New profile',
        enabled: true,
        trafficLimitBytes: 0,
        trafficLimitUnit: 'GB',
        trafficPeriod: '30d',
        bandwidthLimitBps: 0,
    };
    userLimitProfiles.value = [...profiles.value, p];
    selectedId.value = id;
};
const deleteProfile = () => {
    const p = selected.value;
    if (!p)
        return;
    if (p.id === 'unlimited')
        return;
    userLimitProfiles.value = profiles.value.filter((x) => x.id !== p.id);
    selectedId.value = 'unlimited';
};
const resetDefaults = () => {
    resetProfilesToDefault();
    selectedId.value = 'unlimited';
    showNotification({ content: 'resetToDefaults', type: 'alert-success', timeout: 1600 });
};
const createSnapshot = () => {
    createSnapshotNow('Manual snapshot');
    showNotification({ content: 'snapshotCreated', type: 'alert-success', timeout: 1500 });
};
const restore = async (id) => {
    await restoreSnapshot(id);
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1500 });
};
const clearSnapshots = () => {
    userLimitSnapshots.value = [];
};
// Export / import
const exportBundle = () => exportLimitsBundle();
const pickedRaw = ref(null);
const fileInput = ref(null);
const onPickFile = async () => {
    const f = fileInput.value?.files?.[0];
    if (!f) {
        pickedRaw.value = null;
        return;
    }
    try {
        const text = await f.text();
        pickedRaw.value = JSON.parse(text);
        showNotification({ content: 'fileLoaded', type: 'alert-success', timeout: 1200 });
    }
    catch {
        pickedRaw.value = null;
        showNotification({ content: 'invalidFile', type: 'alert-error', timeout: 2000 });
    }
};
const importBundle = async (mode) => {
    if (!pickedRaw.value)
        return;
    try {
        await importLimitsBundle(pickedRaw.value, mode);
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
};
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-full flex-col gap-2 overflow-x-hidden overflow-y-auto p-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
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
(__VLS_ctx.$t('legacyWorkspacePoliciesNotice'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('limitProfiles'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.addProfile) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('add'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetDefaults) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('resetToDefaults'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-3 lg:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('name'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.$t('trafficLimit'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.$t('bandwidthLimit'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.$t('status'));
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [p] of __VLS_vFor((__VLS_ctx.profiles))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectProfile(p.id);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, addProfile, resetDefaults, profiles, selectProfile,];
            } },
        key: (p.id),
        ...{ class: "cursor-pointer" },
        ...{ class: (__VLS_ctx.selectedId === p.id ? 'bg-base-200/70' : '') },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "truncate inline-block max-w-[280px]" },
        title: (p.name),
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[280px]']} */ ;
    (p.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono whitespace-nowrap" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    if (p.trafficLimitBytes && p.trafficLimitBytes > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.fmtBytes(p.trafficLimitBytes));
        (p.trafficPeriod || '30d');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono whitespace-nowrap" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    if (p.bandwidthLimitBps && p.bandwidthLimitBps > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.fmtMbps(p.bandwidthLimitBps));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    if (p.enabled) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-success" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    }
    // @ts-ignore
    [selectedId, fmtBytes, fmtMbps,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
if (!__VLS_ctx.selected) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('selectProfileToEdit'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('edit'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.deleteProfile) },
        type: "button",
        ...{ class: "btn btn-sm btn-ghost" },
        disabled: (__VLS_ctx.selectedId === 'unlimited'),
        title: (__VLS_ctx.selectedId === 'unlimited' ? __VLS_ctx.$t('cannotDeleteDefault') : ''),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('delete'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('name'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-sm" },
    });
    (__VLS_ctx.draft.name);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('enabled'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        ...{ class: "toggle toggle-sm" },
    });
    (__VLS_ctx.draft.enabled);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
    /** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-1 gap-2 sm:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('trafficLimit'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-sm flex-1" },
        type: "number",
        min: "0",
        step: "0.1",
    });
    (__VLS_ctx.draft.trafficValue);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm w-20" },
        value: (__VLS_ctx.draft.trafficUnit),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "GB",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "MB",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('period'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm" },
        value: (__VLS_ctx.draft.trafficPeriod),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "1d",
    });
    (__VLS_ctx.$t('last24h'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "30d",
    });
    (__VLS_ctx.$t('last30d'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "month",
    });
    (__VLS_ctx.$t('thisMonth'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('bandwidthLimit'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-sm" },
        type: "number",
        min: "0",
        step: "0.1",
    });
    (__VLS_ctx.draft.bandwidthMbps);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-end gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.revertDraft) },
        type: "button",
        ...{ class: "btn btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('revert'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveDraft) },
        type: "button",
        ...{ class: "btn btn-primary btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('save'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('profilesTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('snapshots'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.createSnapshot) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('createSnapshot'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearSnapshots) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (!__VLS_ctx.snapshots.length),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('clear'));
if (!__VLS_ctx.snapshots.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('noSnapshotsYet'));
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
        ...{ style: {} },
    });
    (__VLS_ctx.$t('time'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    (__VLS_ctx.$t('label'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
        ...{ class: "text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    (__VLS_ctx.$t('actions'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [s] of __VLS_vFor((__VLS_ctx.snapshotsSorted))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (s.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "font-mono text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.fmtTime(s.createdAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        (s.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "text-right" },
        });
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.snapshots.length))
                        return;
                    __VLS_ctx.restore(s.id);
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, selectedId, selectedId, selected, deleteProfile, draft, draft, draft, draft, draft, draft, revertDraft, saveDraft, createSnapshot, clearSnapshots, snapshots, snapshots, snapshotsSorted, fmtTime, restore,];
                } },
            type: "button",
            ...{ class: "btn btn-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('restore'));
        // @ts-ignore
        [$t,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('exportImport'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportBundle) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('export'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onChange: (__VLS_ctx.onPickFile) },
    ref: "fileInput",
    type: "file",
    accept: "application/json",
    ...{ class: "file-input file-input-sm" },
});
/** @type {__VLS_StyleScopedClasses['file-input']} */ ;
/** @type {__VLS_StyleScopedClasses['file-input-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.importBundle('merge');
            // @ts-ignore
            [$t, $t, exportBundle, onPickFile, importBundle,];
        } },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.pickedRaw),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('importMerge'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.importBundle('replace');
            // @ts-ignore
            [$t, importBundle, pickedRaw,];
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-warning" },
    disabled: (!__VLS_ctx.pickedRaw),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
(__VLS_ctx.$t('importReplace'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('exportImportTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
// @ts-ignore
[$t, $t, pickedRaw,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
