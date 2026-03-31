/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { fetchUbuntuSystemResourcesAPI, fetchUbuntuSystemStatusAPI, } from '@/api/ubuntuService';
import { fetchVersionSilentAPI } from '@/api';
import { agentStatusAPI } from '@/api/agent';
import { UBUNTU_PATHS } from '@/config/project';
import { isUbuntuServiceBackend } from '@/helper/backend';
import { prettyBytesHelper } from '@/helper/utils';
import { activeBackend } from '@/store/setup';
import { useI18n } from 'vue-i18n';
import dayjs from 'dayjs';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
const { t } = useI18n();
const loading = ref(false);
const status = ref({ ok: false });
const resources = ref({ ok: false });
const isUbuntuService = computed(() => isUbuntuServiceBackend(activeBackend.value));
const prettyBytes = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? prettyBytesHelper(n) : '—';
};
const pctText = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0)
        return '—';
    return `${Math.round(n)}%`;
};
const cpuPctText = computed(() => pctText(resources.value.cpuPct));
const memPctText = computed(() => pctText(resources.value.memUsedPct));
const diskPctText = computed(() => pctText(resources.value.diskUsedPct));
const load1Text = computed(() => resources.value.load1 || '—');
const load5Text = computed(() => resources.value.load5 || '—');
const load15Text = computed(() => resources.value.load15 || '—');
const uptimeText = computed(() => {
    const sec = Number(resources.value.uptimeSec || status.value.uptimeSec || 0);
    if (!Number.isFinite(sec) || sec <= 0)
        return '—';
    const total = Math.floor(sec);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0)
        return `${days}d ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});
const startedAtText = computed(() => {
    const sec = Number(status.value.startedAtSec || 0);
    if (!Number.isFinite(sec) || sec <= 0)
        return '—';
    return dayjs.unix(sec).format('YYYY-MM-DD HH:mm:ss');
});
const resourceSnapshotAtText = computed(() => {
    const sec = Number(resources.value.updatedAtSec || status.value.updatedAtSec || 0);
    if (!Number.isFinite(sec) || sec <= 0)
        return '';
    return `${t('lastUpdate')}: ${dayjs.unix(sec).format('HH:mm:ss')}`;
});
const mihomoBadgeClass = computed(() => {
    if (status.value.mihomoRunning)
        return 'badge-success';
    if (status.value.mihomoRunning === false)
        return 'badge-warning';
    return 'badge-ghost';
});
const mihomoBadgeText = computed(() => {
    if (status.value.mihomoRunning)
        return t('hostRuntimeMihomoRunning');
    if (status.value.mihomoRunning === false)
        return t('hostRuntimeMihomoStopped');
    return t('hostRuntimeMihomoUnknown');
});
const noticeText = computed(() => {
    if (!resources.value.ok && status.value.ok)
        return t('hostRuntimeResourcesPending');
    return '';
});
const errorText = computed(() => {
    const parts = [status.value.error, resources.value.error].map((item) => String(item || '').trim()).filter(Boolean);
    return parts.join(' · ');
});
const infoItems = computed(() => [
    { key: 'hostname', label: t('hostname'), value: status.value.hostname || resources.value.hostname || '—' },
    { key: 'serviceVersion', label: t('agentVersion'), value: status.value.serviceVersion || status.value.version || '—' },
    { key: 'mihomoVersion', label: t('mihomoVersion'), value: status.value.mihomoVersion || '—' },
    { key: 'serviceUnit', label: t('hostRuntimeServiceUnit'), value: status.value.serviceUnit || (isUbuntuService.value ? 'ultra-ui-ubuntu.service' : 'compatibility-bridge') },
    { key: 'platform', label: t('model'), value: resources.value.platform || status.value.platform || '—' },
    { key: 'kernel', label: t('kernel'), value: resources.value.kernel || status.value.kernel || '—' },
    { key: 'arch', label: t('architecture'), value: resources.value.arch || status.value.arch || '—' },
    { key: 'logPath', label: t('hostRuntimeCanonicalLog'), value: status.value.mihomoLogPath || UBUNTU_PATHS.mihomoLog },
    { key: 'serviceStatus', label: t('status'), value: status.value.serviceStatus || '—' },
]);
const refreshUbuntu = async () => {
    const [statusPayload, resourcePayload] = await Promise.allSettled([
        fetchUbuntuSystemStatusAPI(),
        fetchUbuntuSystemResourcesAPI(),
    ]);
    status.value = statusPayload.status === 'fulfilled' ? statusPayload.value : { ok: false, error: String(statusPayload.reason || 'status-failed') };
    resources.value = resourcePayload.status === 'fulfilled' ? resourcePayload.value : { ok: false, error: String(resourcePayload.reason || 'resources-failed') };
};
const refreshCompatibility = async () => {
    const [agentPayload, versionPayload] = await Promise.allSettled([
        agentStatusAPI(),
        fetchVersionSilentAPI(),
    ]);
    const agent = agentPayload.status === 'fulfilled' ? (agentPayload.value || {}) : { ok: false, error: String(agentPayload.reason || 'agent-offline') };
    const versionRes = versionPayload.status === 'fulfilled' ? versionPayload.value : null;
    const mihomoVersion = String(versionRes?.data?.version || agent.mihomoBinVersion || '').trim();
    const nowSec = Math.floor(Date.now() / 1000);
    const resourcesOk = Boolean(agent.ok && (agent.cpuPct !== undefined || agent.memTotal !== undefined || agent.storageTotal !== undefined));
    status.value = {
        ok: Boolean(agent.ok || mihomoVersion),
        hostname: agent.hostname,
        serviceVersion: agent.version || agent.serverVersion,
        version: agent.serverVersion || agent.version,
        mihomoVersion: mihomoVersion || undefined,
        mihomoRunning: Boolean(mihomoVersion),
        serviceStatus: agent.ok ? 'active' : mihomoVersion ? 'degraded' : 'offline',
        serviceUnit: 'compatibility-bridge',
        platform: agent.model,
        kernel: agent.kernel,
        arch: agent.arch,
        updatedAtSec: nowSec,
        mihomoLogPath: UBUNTU_PATHS.mihomoLog,
        error: agent.ok || mihomoVersion ? '' : String(agent.error || 'compatibility-bridge-offline'),
    };
    resources.value = {
        ok: resourcesOk,
        hostname: agent.hostname,
        cpuPct: Number.isFinite(Number(agent.cpuPct)) ? Number(agent.cpuPct) : undefined,
        load1: agent.load1,
        load5: agent.load5,
        load15: agent.load15,
        memTotalBytes: Number.isFinite(Number(agent.memTotal)) ? Number(agent.memTotal) : undefined,
        memUsedBytes: Number.isFinite(Number(agent.memUsed)) ? Number(agent.memUsed) : undefined,
        memAvailableBytes: Number.isFinite(Number(agent.memFree)) ? Number(agent.memFree) : undefined,
        memUsedPct: Number.isFinite(Number(agent.memUsedPct)) ? Number(agent.memUsedPct) : undefined,
        diskTotalBytes: Number.isFinite(Number(agent.storageTotal)) ? Number(agent.storageTotal) : undefined,
        diskUsedBytes: Number.isFinite(Number(agent.storageUsed)) ? Number(agent.storageUsed) : undefined,
        diskFreeBytes: Number.isFinite(Number(agent.storageFree)) ? Number(agent.storageFree) : undefined,
        diskUsedPct: Number.isFinite(Number(agent.storageTotal)) && Number(agent.storageTotal) > 0 && Number.isFinite(Number(agent.storageUsed))
            ? (Number(agent.storageUsed) / Number(agent.storageTotal)) * 100
            : undefined,
        diskPath: agent.storagePath,
        uptimeSec: Number.isFinite(Number(agent.uptimeSec)) ? Number(agent.uptimeSec) : 0,
        kernel: agent.kernel,
        arch: agent.arch,
        platform: agent.model,
        updatedAtSec: nowSec,
        error: resourcesOk ? '' : String(agent.error || ''),
    };
};
const refreshAll = async () => {
    loading.value = true;
    try {
        if (isUbuntuService.value) {
            await refreshUbuntu();
        }
        else {
            await refreshCompatibility();
        }
    }
    finally {
        loading.value = false;
    }
};
let timer = null;
onMounted(() => {
    refreshAll();
    timer = window.setInterval(() => {
        refreshAll();
    }, 15000);
});
onBeforeUnmount(() => {
    if (timer)
        window.clearInterval(timer);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-3 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.t('hostRuntimeCardTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.t('hostRuntimeCardTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge" },
    ...{ class: (__VLS_ctx.status.ok ? 'badge-success' : 'badge-warning') },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
(__VLS_ctx.status.ok ? __VLS_ctx.t('online') : __VLS_ctx.t('offline'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge" },
    ...{ class: (__VLS_ctx.mihomoBadgeClass) },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
(__VLS_ctx.mihomoBadgeText);
if (__VLS_ctx.resourceSnapshotAtText) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.resourceSnapshotAtText);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshAll) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.loading),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.t('refresh'));
}
if (__VLS_ctx.noticeText) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 px-3 py-2 text-sm opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.noticeText);
}
if (__VLS_ctx.errorText) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "alert alert-warning p-2 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['alert']} */ ;
    /** @type {__VLS_StyleScopedClasses['alert-warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.errorText);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/50 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs uppercase tracking-[0.12em] opacity-55" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-55']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-2xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.cpuPctText);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.t('loadAvg1m'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.load1Text);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-50" },
});
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
(__VLS_ctx.t('loadAvg5m'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.load5Text);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-50" },
});
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
(__VLS_ctx.t('loadAvg15m'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.load15Text);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/50 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs uppercase tracking-[0.12em] opacity-55" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-55']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-2xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.memPctText);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.resources.memUsedBytes));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-50" },
});
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.resources.memTotalBytes));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-50" },
});
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
(__VLS_ctx.t('freeMemory'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.resources.memAvailableBytes));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/50 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs uppercase tracking-[0.12em] opacity-55" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-55']} */ ;
(__VLS_ctx.t('storage'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-2xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.diskPctText);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.resources.diskUsedBytes));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-50" },
});
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.resources.diskTotalBytes));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-50" },
});
/** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
(__VLS_ctx.t('free'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.prettyBytes(__VLS_ctx.resources.diskFreeBytes));
if (__VLS_ctx.resources.diskPath) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-[11px] font-mono opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.resources.diskPath);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-100/50 p-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs uppercase tracking-[0.12em] opacity-55" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-55']} */ ;
(__VLS_ctx.t('uptime'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-2xl font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.uptimeText);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
if (__VLS_ctx.status.startedAtSec) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.t('startedAt'));
    (__VLS_ctx.startedAtText);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.t('hostRuntimeNoStartedAt'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.infoItems))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (item.key),
        ...{ class: "rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-[11px] uppercase tracking-wide opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (item.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 break-all font-mono text-xs sm:text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
    (item.value);
    // @ts-ignore
    [t, t, t, t, t, t, t, t, t, t, t, t, t, t, status, status, status, mihomoBadgeClass, mihomoBadgeText, resourceSnapshotAtText, resourceSnapshotAtText, refreshAll, loading, loading, noticeText, noticeText, errorText, errorText, cpuPctText, load1Text, load5Text, load15Text, memPctText, prettyBytes, prettyBytes, prettyBytes, prettyBytes, prettyBytes, prettyBytes, resources, resources, resources, resources, resources, resources, resources, resources, diskPctText, uptimeText, startedAtText, infoItems,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
