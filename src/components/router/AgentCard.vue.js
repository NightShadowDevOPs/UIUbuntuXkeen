/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { agentBackupCloudDeleteAPI, agentBackupCloudDownloadAPI, agentBackupCloudListAPI, agentBackupCloudStatusAPI, agentBackupCronGetAPI, agentBackupCronSetAPI, agentBackupDeleteAPI, agentBackupListAPI, agentBackupLogAPI, agentBackupStartAPI, agentBackupStatusAPI, agentRestoreLogAPI, agentRestoreStartAPI, agentRestoreStatusAPI, agentStatusAPI, } from '@/api/agent';
import { agentBackupAutoEnabled, agentBackupAutoTime, agentEnabled, agentEnforceBandwidth, agentToken, agentUrl, } from '@/store/agent';
import { prettyBytesHelper } from '@/helper/utils';
import { showNotification } from '@/helper/notification';
import dayjs from 'dayjs';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
const status = ref({ ok: false });
// Aliases for template readability (these are persisted refs via useStorage).
const backupAutoEnabled = agentBackupAutoEnabled;
const backupAutoTime = agentBackupAutoTime;
// Cron state from router.
const cronStatus = ref({ ok: false, enabled: false });
const cronApplying = ref(false);
const cronBootstrapApplied = useStorage('config/agent-backup-cron-bootstrap-v1', {});
const agentCronKey = computed(() => String(agentUrl.value || '').trim().replace(/\/+$/g, ''));
// Convert HH:MM -> "M H * * *". Fallback to 04:00.
const cronSchedule = computed(() => {
    const raw = String(backupAutoTime.value || '04:00').trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})$/);
    const hh = m ? Number(m[1]) : 4;
    const mm = m ? Number(m[2]) : 0;
    const H = Number.isFinite(hh) ? Math.min(23, Math.max(0, Math.floor(hh))) : 4;
    const M = Number.isFinite(mm) ? Math.min(59, Math.max(0, Math.floor(mm))) : 0;
    return `${M} ${H} * * *`;
});
// Human-copyable cron line.
const cronLine = computed(() => {
    const s = cronSchedule.value;
    if (!s)
        return '';
    return `${s} /opt/zash-agent/backup.sh >/opt/zash-agent/var/backup.cron.log 2>&1 # zash-backup`;
});
const cronStateBadgeText = computed(() => {
    if (cronApplying.value)
        return '…';
    if (cronStatus.value?.ok && cronStatus.value?.enabled)
        return 'on';
    if (cronStatus.value?.ok && cronStatus.value?.enabled === false)
        return 'off';
    if (cronStatus.value?.error)
        return 'error';
    return '?';
});
const cronStateBadgeClass = computed(() => {
    if (cronApplying.value)
        return 'badge-info';
    if (cronStatus.value?.ok && cronStatus.value?.enabled)
        return 'badge-success';
    if (cronStatus.value?.ok && cronStatus.value?.enabled === false)
        return 'badge-ghost';
    if (cronStatus.value?.error)
        return 'badge-error';
    return 'badge-warning';
});
const backup = ref({ ok: true, running: false });
const backupLog = ref('');
const backupLoading = ref(false);
const cloudStatus = ref({ ok: true, rcloneInstalled: false, remote: '', path: '' });
const cloudLoading = ref(false);
const backupList = ref([]);
const backupDir = ref('');
const backupListLoading = ref(false);
const cloudList = ref([]);
const cloudListLoading = ref(false);
const deletingLocalBackup = ref('');
const deletingCloudBackup = ref('');
const downloadingCloudBackup = ref('');
const backupArchiveView = ref('all');
const backupArchiveQuery = useStorage('config/agent-backup-archive-query-v1', '');
const backupArchiveSort = useStorage('config/agent-backup-archive-sort-v1', 'timeDesc');
const backupTargetRemote = useStorage('config/agent-backup-target-remote-v1', '');
const restore = ref({ ok: true, running: false });
const restoreLog = ref('');
const restoreLoading = ref(false);
const restoreSelected = ref('latest');
const restoreScope = ref('all');
const restoreIncludeEnv = ref(false);
const restoreSource = ref('local');
const restoreCloudRemote = ref('');
const { t } = useI18n();
const versionCmp = (a, b) => {
    const as = (a || '').match(/\d+/g)?.map((x) => parseInt(x, 10)) || [];
    const bs = (b || '').match(/\d+/g)?.map((x) => parseInt(x, 10)) || [];
    const n = Math.max(as.length, bs.length);
    for (let i = 0; i < n; i++) {
        const av = as[i] ?? 0;
        const bv = bs[i] ?? 0;
        if (av < bv)
            return -1;
        if (av > bv)
            return 1;
    }
    return 0;
};
const needsUpdate = computed(() => {
    if (!status.value?.ok || !status.value?.version || !status.value?.serverVersion)
        return false;
    return versionCmp(status.value.version, status.value.serverVersion) < 0;
});
const isAhead = computed(() => {
    if (!status.value?.ok || !status.value?.version || !status.value?.serverVersion)
        return false;
    return versionCmp(status.value.version, status.value.serverVersion) > 0;
});
const configuredCloudRemotes = computed(() => {
    const raw = Array.isArray(cloudStatus.value?.remotes) ? cloudStatus.value.remotes : [];
    const items = raw
        .map((it) => ({ name: String(it?.name || '').trim(), exists: !!it?.exists }))
        .filter((it) => !!it.name);
    if (items.length)
        return items;
    const remote = String(cloudStatus.value?.remote || '').trim();
    return remote ? [{ name: remote, exists: !!cloudStatus.value?.remoteExists }] : [];
});
const readyCloudRemotes = computed(() => configuredCloudRemotes.value.filter((it) => it.exists).map((it) => it.name));
const backupTargetLabel = computed(() => {
    const remote = String(backupTargetRemote.value || '').trim();
    return remote || '';
});
const cloudRemoteLabel = computed(() => {
    const path = String(cloudStatus.value?.path || '').trim();
    const names = configuredCloudRemotes.value.map((it) => it.name);
    if (!names.length)
        return '—';
    const joined = names.join(', ');
    return path ? `${joined}:${path}` : joined;
});
const cloudKeepLabel = computed(() => {
    const local = String(cloudStatus.value?.localKeepDays || '').trim() || '—';
    const cloud = String(cloudStatus.value?.keepDays || '').trim() || '—';
    return `${local} / ${cloud} d`;
});
const cloudArchiveCountByRemote = computed(() => {
    const counts = {};
    for (const item of cloudList.value || []) {
        const remote = cloudItemRemote(item);
        if (!remote)
            continue;
        counts[remote] = (counts[remote] || 0) + 1;
    }
    return counts;
});
const lastBackupUploadResults = computed(() => {
    const raw = Array.isArray(backup.value?.uploadResults) ? backup.value.uploadResults : [];
    return raw
        .map((it) => ({
        remote: String(it?.remote || '').trim(),
        ok: !!it?.ok,
        error: String(it?.error || '').trim(),
    }))
        .filter((it) => !!it.remote);
});
const backupUploadOkCount = computed(() => Number(backup.value?.uploadOkCount || 0));
const backupUploadFailCount = computed(() => Number(backup.value?.uploadFailCount || 0));
const remoteArchiveCount = (remote) => Number(cloudArchiveCountByRemote.value[String(remote || '').trim()] || 0);
const remoteIsReady = (remote) => configuredCloudRemotes.value.some((it) => it.name === remote && it.exists);
const remoteStatusBadgeClass = (remote) => (remoteIsReady(remote) ? 'badge-success' : 'badge-warning');
const uploadStatusBadgeClass = (ok) => (ok ? 'badge-success' : 'badge-error');
const uniqueRemoteNames = (item) => {
    const names = (Array.isArray(item?.cloudCopies) ? item.cloudCopies : [])
        .map((it) => cloudItemRemote(it))
        .filter((name) => Boolean(name));
    return Array.from(new Set(names));
};
const selectedCloudArchiveCopies = computed(() => {
    const selected = String(restoreSelected.value || '').trim();
    if (!selected || selected === 'latest')
        return [];
    const item = (unifiedArchives.value || []).find((it) => String(it?.name || '') === selected);
    return item && Array.isArray(item.cloudCopies) ? item.cloudCopies : [];
});
const currentBackupName = computed(() => {
    const f = String(backup.value?.file || '').trim();
    if (!f)
        return '';
    const parts = f.split('/');
    return parts[parts.length - 1] || '';
});
const isCurrentBackup = (name) => String(name || '').split('/').pop() === currentBackupName.value;
const isUploadedBackup = (name) => isCurrentBackup(name) && !!backup.value?.uploaded;
const hasLocalBackup = (name) => {
    const n = String(name || '').split('/').pop() || '';
    return backupList.value.some((item) => String(item?.name || '') === n);
};
const cloudItemName = (item) => String(item?.Name || item?.Path || '').split('/').pop() || '';
const cloudItemRemote = (item) => String(item?.Remote || '').trim();
const cloudItemKey = (item) => `${cloudItemRemote(item)}::${cloudItemName(item)}`;
const cloudBackupNames = computed(() => {
    const names = new Set();
    for (const item of cloudList.value || []) {
        const remote = cloudItemRemote(item);
        if (restoreCloudRemote.value && remote && remote !== restoreCloudRemote.value)
            continue;
        const name = cloudItemName(item);
        if (name)
            names.add(name);
    }
    return Array.from(names.values());
});
const restoreItems = computed(() => (restoreSource.value === 'cloud'
    ? cloudBackupNames.value
    : backupList.value.map((item) => String(item?.name || '')).filter(Boolean)));
const cloudItemTs = (item) => {
    const raw = String(item?.ModTime || '').trim();
    if (!raw)
        return 0;
    const d = dayjs(raw);
    return d.isValid() ? d.valueOf() : 0;
};
const unifiedArchives = computed(() => {
    const map = new Map();
    for (const item of backupList.value || []) {
        const name = String(item?.name || '').trim();
        if (!name)
            continue;
        const rec = map.get(name) || { name, hasLocal: false, hasCloud: false, local: null, cloud: null, cloudCopies: [] };
        rec.local = item;
        rec.hasLocal = true;
        map.set(name, rec);
    }
    for (const item of cloudList.value || []) {
        const name = cloudItemName(item);
        if (!name)
            continue;
        const rec = map.get(name) || { name, hasLocal: false, hasCloud: false, local: null, cloud: null, cloudCopies: [] };
        rec.cloudCopies = Array.isArray(rec.cloudCopies) ? rec.cloudCopies : [];
        rec.cloudCopies.push(item);
        rec.cloud = rec.cloud || item;
        rec.hasCloud = true;
        map.set(name, rec);
    }
    return Array.from(map.values())
        .map((rec) => {
        const localTs = Number(rec?.local?.mtime || 0) > 0 ? Number(rec.local.mtime) * 1000 : 0;
        const cloudCopies = Array.isArray(rec?.cloudCopies) ? rec.cloudCopies : [];
        const cloudTs = cloudCopies.reduce((max, item) => Math.max(max, cloudItemTs(item)), 0);
        const sortTs = Math.max(localTs, cloudTs);
        const displayTime = sortTs > 0 ? dayjs(sortTs).format('YYYY-MM-DD HH:mm:ss') : '—';
        const localSize = Number(rec?.local?.size || 0);
        const cloudSize = cloudCopies.reduce((max, item) => Math.max(max, Number(item?.Size || 0)), 0);
        const cloudRemotes = cloudCopies.map((item) => cloudItemRemote(item)).filter(Boolean);
        return {
            ...rec,
            cloudCopies,
            cloudRemotes,
            sortTs,
            displayTime,
            displaySize: Math.max(localSize, cloudSize, 0),
        };
    })
        .sort((a, b) => {
        if ((b.sortTs || 0) !== (a.sortTs || 0))
            return (b.sortTs || 0) - (a.sortTs || 0);
        return String(a.name || '').localeCompare(String(b.name || ''));
    });
});
const preferredCloudCopy = (item) => {
    const copies = Array.isArray(item?.cloudCopies) ? item.cloudCopies : [];
    if (!copies.length)
        return null;
    if (restoreCloudRemote.value) {
        const exact = copies.find((it) => cloudItemRemote(it) === restoreCloudRemote.value);
        if (exact)
            return exact;
    }
    const ready = readyCloudRemotes.value;
    if (ready.length) {
        const found = copies.find((it) => ready.includes(cloudItemRemote(it)));
        if (found)
            return found;
    }
    return copies[0];
};
const filteredUnifiedArchives = computed(() => {
    const mode = backupArchiveView.value || 'all';
    const query = String(backupArchiveQuery.value || '').trim().toLowerCase();
    const sort = backupArchiveSort.value || 'timeDesc';
    return (unifiedArchives.value || [])
        .filter((item) => {
        if (mode === 'current' && !isCurrentBackup(item?.name || ''))
            return false;
        if (mode === 'local' && (!item.hasLocal || item.hasCloud))
            return false;
        if (mode === 'cloud' && (!item.hasCloud || item.hasLocal))
            return false;
        if (mode === 'both' && (!item.hasLocal || !item.hasCloud))
            return false;
        if (!query)
            return true;
        return String(item?.name || '').toLowerCase().includes(query);
    })
        .slice()
        .sort((a, b) => {
        const aTs = Number(a?.sortTs || 0);
        const bTs = Number(b?.sortTs || 0);
        const aSize = Number(a?.displaySize || 0);
        const bSize = Number(b?.displaySize || 0);
        const aName = String(a?.name || '');
        const bName = String(b?.name || '');
        if (sort === 'timeAsc') {
            if (aTs !== bTs)
                return aTs - bTs;
        }
        else if (sort === 'sizeDesc') {
            if (aSize !== bSize)
                return bSize - aSize;
        }
        else if (sort === 'sizeAsc') {
            if (aSize !== bSize)
                return aSize - bSize;
        }
        else if (sort === 'nameAsc') {
            const cmp = aName.localeCompare(bName);
            if (cmp !== 0)
                return cmp;
        }
        else if (sort === 'nameDesc') {
            const cmp = bName.localeCompare(aName);
            if (cmp !== 0)
                return cmp;
        }
        else {
            if (aTs !== bTs)
                return bTs - aTs;
        }
        if (bTs !== aTs)
            return bTs - aTs;
        if (bSize !== aSize)
            return bSize - aSize;
        return aName.localeCompare(bName);
    });
});
const formatBackupSize = (size) => {
    const n = Number(size);
    if (!Number.isFinite(n) || n <= 0)
        return '0 B';
    return prettyBytesHelper(n, { binary: true });
};
const formatBackupTime = (mtime) => {
    const n = Number(mtime);
    if (!Number.isFinite(n) || n <= 0)
        return '—';
    return dayjs(n * 1000).format('YYYY-MM-DD HH:mm:ss');
};
const formatCloudTime = (value) => {
    if (!value)
        return '—';
    const d = dayjs(value);
    return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(value);
};
const restoreProgressPct = computed(() => {
    const n = Number(restore.value?.progressPct);
    if (!Number.isFinite(n))
        return null;
    return Math.min(100, Math.max(0, Math.round(n)));
});
const restoreBytesLabel = computed(() => {
    const done = Number(restore.value?.bytesDone);
    const total = Number(restore.value?.bytesTotal);
    if (Number.isFinite(total) && total > 0) {
        const left = Number.isFinite(done) && done >= 0 ? formatBackupSize(done) : '0 B';
        return `${left} / ${formatBackupSize(total)}`;
    }
    if (Number.isFinite(done) && done > 0)
        return formatBackupSize(done);
    return '';
});
const restoreStageLabel = computed(() => {
    const stage = String(restore.value?.stage || '').trim();
    const map = {
        queued: t('agentRestoreStageQueued'),
        'resolve-cloud': t('agentRestoreStageResolveCloud'),
        downloading: t('agentRestoreStageDownloading'),
        downloaded: t('agentRestoreStageDownloaded'),
        preparing: t('agentRestoreStagePreparing'),
        restoring: t('agentRestoreStageRestoring'),
        done: t('agentRestoreStageDone'),
        failed: t('agentRestoreStageFailed'),
    };
    return map[stage] || restore.value?.detail || stage || '—';
});
const selectBackupForRestore = (name) => {
    restoreSource.value = 'local';
    restoreSelected.value = name;
    showNotification({ content: 'agentBackupUseForRestoreDone', type: 'alert-success', timeout: 1400 });
};
const selectCloudBackupForRestore = (name, remote = '') => {
    restoreSource.value = 'cloud';
    restoreCloudRemote.value = String(remote || '').trim();
    restoreSelected.value = String(name || '').split('/').pop() || 'latest';
    showNotification({ content: 'agentBackupUseForRestoreDone', type: 'alert-success', timeout: 1400 });
};
const selectUnifiedArchiveForRestore = (item) => {
    if (item?.hasLocal) {
        selectBackupForRestore(item.name);
        return;
    }
    if (item?.hasCloud) {
        const copy = preferredCloudCopy(item);
        selectCloudBackupForRestore(item.name, cloudItemRemote(copy));
    }
};
const refreshUnifiedArchives = async () => {
    await refreshBackupList();
    await refreshCloud();
    await refreshCloudHistory();
};
const onUnifiedHistoryToggle = async (e) => {
    if (e?.target?.open) {
        await refreshUnifiedArchives();
    }
};
const refreshCloud = async () => {
    if (!agentEnabled.value || !status.value?.ok) {
        cloudStatus.value = { ok: true, rcloneInstalled: false, remote: '', path: '' };
        return;
    }
    cloudLoading.value = true;
    cloudStatus.value = await agentBackupCloudStatusAPI();
    if (!cloudStatus.value?.cloudReady)
        cloudList.value = [];
    syncRestoreSource();
    cloudLoading.value = false;
};
const refreshCloudHistory = async () => {
    if (!agentEnabled.value || !status.value?.ok || !cloudStatus.value?.cloudReady) {
        cloudList.value = [];
        return;
    }
    cloudListLoading.value = true;
    const res = await agentBackupCloudListAPI();
    if (res?.ok && Array.isArray(res.items)) {
        cloudList.value = res.items || [];
    }
    else {
        cloudList.value = [];
    }
    syncRestoreSource();
    cloudListLoading.value = false;
};
const onCloudHistoryToggle = async (e) => {
    if (e?.target?.open) {
        await refreshCloud();
        await refreshBackupList();
        await refreshCloudHistory();
    }
};
const deleteLocalBackup = async (name) => {
    const file = String(name || '').trim();
    if (!file || !agentEnabled.value || !status.value?.ok)
        return;
    if (backup.value?.running || restore.value?.running)
        return;
    const ok = window.confirm(String(t('agentBackupDeleteConfirm', { name: file })));
    if (!ok)
        return;
    deletingLocalBackup.value = file;
    const res = await agentBackupDeleteAPI(file);
    if (res?.ok) {
        showNotification({ content: 'agentBackupDeleteDone', type: 'alert-success', timeout: 1800 });
        await refreshBackupList();
    }
    else {
        showNotification({ content: 'agentBackupDeleteFail', type: 'alert-error', timeout: 2200 });
    }
    deletingLocalBackup.value = '';
};
const deleteCloudBackup = async (name, remote = '') => {
    const file = String(name || '').split('/').pop() || '';
    const remoteName = String(remote || '').trim();
    if (!file || !agentEnabled.value || !status.value?.ok || !cloudStatus.value?.cloudReady)
        return;
    if (backup.value?.running || restore.value?.running)
        return;
    const ok = window.confirm(String(t('agentBackupCloudDeleteConfirm', { name: remoteName ? `${file} [${remoteName}]` : file })));
    if (!ok)
        return;
    deletingCloudBackup.value = remoteName ? `${remoteName}::${file}` : file;
    const res = await agentBackupCloudDeleteAPI(file, remoteName);
    if (res?.ok) {
        showNotification({ content: 'agentBackupCloudDeleteDone', type: 'alert-success', timeout: 1800 });
        await refreshCloudHistory();
    }
    else {
        showNotification({ content: 'agentBackupCloudDeleteFail', type: 'alert-error', timeout: 2200 });
    }
    deletingCloudBackup.value = '';
};
const downloadCloudBackupToLocal = async (name, remote = '') => {
    const file = String(name || '').split('/').pop() || '';
    const remoteName = String(remote || '').trim();
    if (!file || !agentEnabled.value || !status.value?.ok || !cloudStatus.value?.cloudReady)
        return;
    if (backup.value?.running || restore.value?.running)
        return;
    downloadingCloudBackup.value = remoteName ? `${remoteName}::${file}` : file;
    const res = await agentBackupCloudDownloadAPI(file, remoteName);
    if (res?.ok) {
        showNotification({ content: res?.existed ? 'agentBackupDownloadToLocalExists' : 'agentBackupDownloadToLocalDone', type: 'alert-success', timeout: 2000 });
        await refreshBackupList();
        await refreshCloudHistory();
    }
    else {
        showNotification({
            content: 'agentBackupDownloadToLocalFail',
            params: { error: String(res?.error || 'failed') },
            type: 'alert-error',
            timeout: 2600,
        });
    }
    downloadingCloudBackup.value = '';
};
const syncRestoreSource = () => {
    if (restoreSource.value === 'cloud' && !cloudStatus.value?.cloudReady) {
        restoreSource.value = 'local';
        restoreCloudRemote.value = '';
    }
    const ready = readyCloudRemotes.value;
    if (restoreSource.value === 'cloud') {
        if (restoreCloudRemote.value && ready.length && !ready.includes(restoreCloudRemote.value)) {
            restoreCloudRemote.value = '';
        }
        if (!restoreCloudRemote.value && ready.length === 1) {
            restoreCloudRemote.value = ready[0];
        }
    }
    if (backupTargetRemote.value && ready.length && !ready.includes(backupTargetRemote.value)) {
        backupTargetRemote.value = '';
    }
    if (restoreSelected.value !== 'latest' && !restoreItems.value.includes(restoreSelected.value)) {
        restoreSelected.value = 'latest';
    }
};
const refreshCron = async () => {
    if (!agentEnabled.value) {
        cronStatus.value = { ok: false, enabled: false };
        return;
    }
    if (!status.value?.ok) {
        cronStatus.value = { ok: false, enabled: false };
        return;
    }
    const res = await agentBackupCronGetAPI();
    cronStatus.value = res;
    // Best-effort sync from router schedule -> UI fields.
    // IMPORTANT: do not blindly overwrite local auto-backup preference with false
    // when the router simply has no cron yet; otherwise the default 04:00 bootstrap
    // will never be applied on first run.
    if (res?.ok) {
        if (res.enabled === true)
            backupAutoEnabled.value = true;
        if (typeof res.schedule === 'string' && res.schedule.trim()) {
            const parts = res.schedule.trim().split(/\s+/);
            if (parts.length >= 2) {
                const mm = Number(parts[0]);
                const hh = Number(parts[1]);
                if (Number.isFinite(mm) && Number.isFinite(hh)) {
                    const H = Math.min(23, Math.max(0, Math.floor(hh)));
                    const M = Math.min(59, Math.max(0, Math.floor(mm)));
                    backupAutoTime.value = `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
                }
            }
        }
    }
};
const applyCron = async () => {
    if (!agentEnabled.value || !status.value?.ok)
        return;
    cronApplying.value = true;
    const res = await agentBackupCronSetAPI(!!backupAutoEnabled.value, cronSchedule.value);
    await refreshCron();
    cronApplying.value = false;
    if (res?.ok) {
        showNotification({ content: 'agentBackupCronApplyDone', type: 'alert-success', timeout: 1800 });
    }
    else {
        showNotification({
            content: 'agentBackupCronApplyFail',
            params: { error: String(res?.error || 'failed') },
            type: 'alert-error',
            timeout: 2600,
        });
    }
};
const removeCron = async () => {
    if (!agentEnabled.value || !status.value?.ok)
        return;
    cronApplying.value = true;
    backupAutoEnabled.value = false;
    const res = await agentBackupCronSetAPI(false, cronSchedule.value);
    await refreshCron();
    cronApplying.value = false;
    if (res?.ok) {
        showNotification({ content: 'agentBackupCronDeleteDone', type: 'alert-success', timeout: 1800 });
    }
    else {
        showNotification({
            content: 'agentBackupCronDeleteFail',
            params: { error: String(res?.error || 'failed') },
            type: 'alert-error',
            timeout: 2600,
        });
    }
};
const copyCron = async () => {
    try {
        await navigator.clipboard.writeText(cronLine.value);
        showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 });
    }
    catch {
        // ignore
    }
};
const onCronToggle = async (e) => {
    if (e?.target?.open) {
        await refreshCron();
    }
};
const shouldBootstrapCron = () => {
    if (backupAutoEnabled.value)
        return true;
    if (typeof localStorage === 'undefined')
        return false;
    const stored = localStorage.getItem('config/agent-backup-auto-enabled-v1');
    const defaultTime = String(backupAutoTime.value || '04:00').trim() === '04:00';
    const noHistory = (backupList.value?.length || 0) === 0
        && !String(backup.value?.startedAt || backup.value?.finishedAt || '').trim();
    return stored === 'false' && defaultTime && noHistory;
};
const ensureCronBootstrap = async () => {
    const key = agentCronKey.value;
    if (!key || !agentEnabled.value || !status.value?.ok)
        return;
    if (!shouldBootstrapCron())
        return;
    if (!cronStatus.value?.ok)
        return;
    if (cronStatus.value?.enabled)
        return;
    if ((cronBootstrapApplied.value || {})[key])
        return;
    cronApplying.value = true;
    const res = await agentBackupCronSetAPI(true, cronSchedule.value);
    cronApplying.value = false;
    if (res?.ok && res?.enabled) {
        cronBootstrapApplied.value = {
            ...(cronBootstrapApplied.value || {}),
            [key]: Date.now(),
        };
        await refreshCron();
    }
};
const refreshBackupList = async () => {
    if (!agentEnabled.value || !status.value?.ok) {
        backupDir.value = '';
        backupList.value = [];
        return;
    }
    backupListLoading.value = true;
    const res = await agentBackupListAPI();
    if (res?.ok && Array.isArray(res.items)) {
        backupDir.value = String(res.dir || '');
        backupList.value = res.items || [];
    }
    else {
        backupDir.value = String(res?.dir || '');
        backupList.value = [];
    }
    syncRestoreSource();
    backupListLoading.value = false;
};
const onBackupHistoryToggle = async (e) => {
    if (e?.target?.open) {
        await refreshBackupList();
    }
};
const refreshRestore = async () => {
    if (!agentEnabled.value) {
        restore.value = { ok: false };
        return;
    }
    if (!status.value?.ok) {
        restore.value = { ok: true, running: false };
        return;
    }
    restoreLoading.value = true;
    restore.value = await agentRestoreStatusAPI();
    restoreLoading.value = false;
    syncRestoreSource();
};
const loadRestoreLog = async () => {
    if (!agentEnabled.value || !status.value?.ok)
        return;
    const res = await agentRestoreLogAPI(200);
    if (res?.ok && res?.contentB64) {
        try {
            restoreLog.value = atob(res.contentB64);
        }
        catch {
            restoreLog.value = '';
        }
    }
    else {
        restoreLog.value = res?.error ? String(res.error) : '';
    }
};
const onRestoreLogToggle = async (e) => {
    if (e?.target?.open) {
        await loadRestoreLog();
    }
};
const onRestoreToggle = async (e) => {
    if (e?.target?.open) {
        await refreshBackupList();
        await refreshCloud();
        await refreshCloudHistory();
        await refreshRestore();
    }
};
const runRestore = async () => {
    if (!agentEnabled.value || !status.value?.ok)
        return;
    const file = restoreSelected.value || 'latest';
    const scope = restoreScope.value || 'all';
    const includeEnv = !!restoreIncludeEnv.value;
    const source = restoreSource.value === 'cloud' ? 'cloud' : 'local';
    const ok = window.confirm(String(t('agentRestoreConfirm')));
    if (!ok)
        return;
    restoreLoading.value = true;
    const res = await agentRestoreStartAPI(file, scope, includeEnv, source, source === 'cloud' ? restoreCloudRemote.value : '');
    if (!res?.ok) {
        showNotification({ content: 'agentRestoreFail', type: 'alert-error', timeout: 2200 });
    }
    await refreshRestore();
    if (restore.value?.running) {
        await loadRestoreLog();
    }
    restoreLoading.value = false;
};
const refreshBackup = async () => {
    if (!agentEnabled.value) {
        backup.value = { ok: false };
        return;
    }
    if (!status.value?.ok) {
        backup.value = { ok: true, running: false };
        return;
    }
    backupLoading.value = true;
    backup.value = await agentBackupStatusAPI();
    backupLoading.value = false;
};
const runBackup = async () => {
    if (!agentEnabled.value || !status.value?.ok)
        return;
    backupLoading.value = true;
    const selectedRemote = String(backupTargetRemote.value || '').trim();
    const res = await agentBackupStartAPI(selectedRemote || undefined);
    await refreshBackup();
    await refreshBackupList();
    await refreshCloudHistory();
    backupLoading.value = false;
    if (res?.ok) {
        showNotification({
            content: 'agentBackupRunStarted',
            params: selectedRemote ? { target: selectedRemote } : undefined,
            type: 'alert-success',
            timeout: 2000,
        });
    }
    else {
        showNotification({
            content: 'agentBackupRunFail',
            params: { error: String(res?.error || 'failed') },
            type: 'alert-error',
            timeout: 2600,
        });
    }
};
const loadBackupLog = async () => {
    if (!agentEnabled.value || !status.value?.ok)
        return;
    const res = await agentBackupLogAPI(200);
    if (res?.ok && res?.contentB64) {
        try {
            backupLog.value = atob(res.contentB64);
        }
        catch {
            backupLog.value = '';
        }
    }
    else {
        backupLog.value = res?.error ? String(res.error) : '';
    }
};
const onBackupLogToggle = async (e) => {
    if (e?.target?.open) {
        await loadBackupLog();
    }
};
const refreshStatus = async () => {
    if (!agentEnabled.value) {
        status.value = { ok: false };
        return false;
    }
    status.value = await agentStatusAPI();
    return !!status.value?.ok;
};
const refresh = async () => {
    const ok = await refreshStatus();
    if (!ok)
        return;
    await refreshCron();
    await refreshBackup();
    await refreshBackupList();
    await ensureCronBootstrap();
    await refreshCloud();
    await refreshRestore();
};
let liveTimer;
let statusTimer;
onMounted(() => {
    refresh();
    statusTimer = window.setInterval(() => {
        refreshStatus();
    }, 10_000);
    liveTimer = window.setInterval(() => {
        if (restore.value?.running) {
            refreshRestore();
        }
        if (backup.value?.running) {
            refreshBackup();
        }
    }, 2000);
});
watch([agentEnabled, agentUrl, agentToken], () => {
    refresh();
});
onUnmounted(() => {
    if (statusTimer) {
        window.clearInterval(statusTimer);
        statusTimer = undefined;
    }
    if (liveTimer) {
        window.clearInterval(liveTimer);
        liveTimer = undefined;
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
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
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('routerAgent'));
if (!__VLS_ctx.agentEnabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('disabled'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge" },
        ...{ class: (__VLS_ctx.status.ok ? 'badge-success' : 'badge-error') },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    (__VLS_ctx.status.ok ? __VLS_ctx.$t('online') : __VLS_ctx.$t('offline'));
}
if (__VLS_ctx.agentEnabled && __VLS_ctx.status.ok && __VLS_ctx.status.tc) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-success" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
}
if (__VLS_ctx.agentEnabled && __VLS_ctx.status.ok && !__VLS_ctx.status.tc) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-warning" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
}
if (__VLS_ctx.agentEnabled && __VLS_ctx.status.version) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.$t('agentVersion'));
    (__VLS_ctx.status.version);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refresh) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('test'));
if (__VLS_ctx.configuredCloudRemotes.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex items-center gap-2 text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('agentBackupTargets'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.backupTargetRemote),
        ...{ class: "select select-sm min-w-[180px]" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.backupLoading || __VLS_ctx.backup.running),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-[180px]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    (__VLS_ctx.$t('agentBackupTargetAll'));
    for (const [remote] of __VLS_vFor((__VLS_ctx.readyCloudRemotes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (`backup-target-${remote}`),
            value: (remote),
        });
        (remote);
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, $t, agentEnabled, agentEnabled, agentEnabled, agentEnabled, agentEnabled, status, status, status, status, status, status, status, status, status, refresh, configuredCloudRemotes, backupTargetRemote, backupLoading, backup, readyCloudRemotes,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.runBackup) },
    type: "button",
    ...{ class: "btn btn-sm btn-outline" },
    disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.backupLoading || __VLS_ctx.backup.running),
    title: (__VLS_ctx.backupTargetLabel ? `${__VLS_ctx.$t('agentBackupNow')} · ${__VLS_ctx.backupTargetLabel}` : __VLS_ctx.$t('agentBackupNow')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
if (__VLS_ctx.backupLoading || __VLS_ctx.backup.running) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.backupTargetLabel ? `${__VLS_ctx.$t('agentBackupNow')} · ${__VLS_ctx.backupTargetLabel}` : __VLS_ctx.$t('agentBackupNow'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 sm:grid-cols-2 gap-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('enable'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.agentEnabled);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
(__VLS_ctx.$t('enforceBandwidth'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
    disabled: (!__VLS_ctx.agentEnabled),
});
(__VLS_ctx.agentEnforceBandwidth);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 sm:grid-cols-2 gap-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
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
(__VLS_ctx.$t('agentUrl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "input input-sm" },
    placeholder: "http://192.168.1.1:9099",
    disabled: (!__VLS_ctx.agentEnabled),
});
(__VLS_ctx.agentUrl);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
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
(__VLS_ctx.$t('agentToken'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "input input-sm" },
    placeholder: "(optional)",
    disabled: (!__VLS_ctx.agentEnabled),
});
(__VLS_ctx.agentToken);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
if (__VLS_ctx.agentEnabled && __VLS_ctx.status.ok) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('agentDetected'));
    (__VLS_ctx.status.lan || 'br0');
    (__VLS_ctx.status.wan || 'eth4');
    if (__VLS_ctx.status.version || __VLS_ctx.status.serverVersion) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-0.5 flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        if (__VLS_ctx.status.version) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.status.version);
        }
        if (__VLS_ctx.status.serverVersion) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.status.serverVersion);
        }
        if (__VLS_ctx.needsUpdate) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-warning badge-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (__VLS_ctx.$t('agentUpdate'));
        }
        else if (__VLS_ctx.isAhead) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-info badge-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (__VLS_ctx.$t('agentAhead'));
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupLast'));
    if (__VLS_ctx.backup.running) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-info badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupRunning'));
    }
    else if (__VLS_ctx.backup.success) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-success badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupOk'));
    }
    else if (__VLS_ctx.backup.finishedAt || __VLS_ctx.backup.startedAt) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupFail'));
    }
    if (__VLS_ctx.backup.finishedAt || __VLS_ctx.backup.startedAt) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.backup.finishedAt || __VLS_ctx.backup.startedAt);
    }
    if (__VLS_ctx.backup.file) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.backup.file);
    }
    if (__VLS_ctx.backup.requestedRemotes) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupTargets'));
        (__VLS_ctx.backup.requestedRemotes);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshBackup) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.backupLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (__VLS_ctx.onBackupLogToggle) },
        ...{ class: "mt-1" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentBackupViewLog'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200/60 p-2 text-[11px]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-h-40']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    (__VLS_ctx.backupLog || '…');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 rounded-lg bg-base-200/70 p-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCloud'));
    if (__VLS_ctx.cloudStatus.cloudReady) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-success badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupCloudReady'));
    }
    else if (__VLS_ctx.cloudStatus.rcloneInstalled && __VLS_ctx.configuredCloudRemotes.length && !__VLS_ctx.cloudStatus.cloudReady) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupCloudMissingRemote'));
    }
    else if (!__VLS_ctx.cloudStatus.rcloneInstalled) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupCloudMissingRclone'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentBackupCloudNotReady'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshCloud) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.cloudLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCloudRemote'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.cloudRemoteLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCloudKeep'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.cloudKeepLabel);
    if (__VLS_ctx.configuredCloudRemotes.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sm:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('agentBackupCloudRemote'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 flex flex-wrap items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.configuredCloudRemotes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (it.name),
                ...{ class: "badge badge-sm" },
                ...{ class: (it.exists ? 'badge-success' : 'badge-warning') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (it.name);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, agentEnabled, agentEnabled, agentEnabled, agentEnabled, agentEnabled, agentEnabled, status, status, status, status, status, status, status, status, status, status, configuredCloudRemotes, configuredCloudRemotes, configuredCloudRemotes, backupLoading, backupLoading, backupLoading, backup, backup, backup, backup, backup, backup, backup, backup, backup, backup, backup, backup, backup, backup, runBackup, backupTargetLabel, backupTargetLabel, backupTargetLabel, backupTargetLabel, agentEnforceBandwidth, agentUrl, agentToken, needsUpdate, isAhead, refreshBackup, onBackupLogToggle, backupLog, cloudStatus, cloudStatus, cloudStatus, cloudStatus, refreshCloud, cloudLoading, cloudRemoteLabel, cloudKeepLabel,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.configuredCloudRemotes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (`status-${it.name}`),
                ...{ class: "rounded-lg border border-base-300/50 bg-base-100/60 px-2 py-1.5" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-300/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono text-[11px] sm:text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:text-xs']} */ ;
            (it.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-xs" },
                ...{ class: (__VLS_ctx.remoteStatusBadgeClass(it.name)) },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (it.exists ? __VLS_ctx.$t('agentBackupCloudReady') : __VLS_ctx.$t('agentBackupCloudMissingRemote'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.$t('agentBackupCloudCount'));
            (__VLS_ctx.remoteArchiveCount(it.name));
            if (__VLS_ctx.restoreSource === 'cloud' && __VLS_ctx.restoreCloudRemote === it.name) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-info badge-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            }
            // @ts-ignore
            [$t, $t, $t, configuredCloudRemotes, remoteStatusBadgeClass, remoteArchiveCount, restoreSource, restoreCloudRemote,];
        }
    }
    if (__VLS_ctx.lastBackupUploadResults.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sm:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('agentBackupCloudLastUpload'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 flex flex-wrap items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        if (__VLS_ctx.backupUploadOkCount > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-sm badge-success" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
            (__VLS_ctx.backupUploadOkCount);
        }
        if (__VLS_ctx.backupUploadFailCount > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-sm badge-error" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
            (__VLS_ctx.backupUploadFailCount);
        }
        for (const [it] of __VLS_vFor((__VLS_ctx.lastBackupUploadResults))) {
            (`upload-${it.remote}`);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-sm" },
                ...{ class: (__VLS_ctx.uploadStatusBadgeClass(it.ok)) },
                title: (it.error || ''),
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (it.remote);
            (it.ok ? __VLS_ctx.$t('agentBackupRemoteOk') : __VLS_ctx.$t('agentBackupRemoteFail'));
            if (!it.ok && it.error) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "w-full break-all text-[11px] text-error" },
                });
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
                (it.remote);
                (it.error);
            }
            // @ts-ignore
            [$t, $t, $t, lastBackupUploadResults, lastBackupUploadResults, backupUploadOkCount, backupUploadOkCount, backupUploadFailCount, backupUploadFailCount, uploadStatusBadgeClass,];
        }
    }
    if (__VLS_ctx.cloudStatus.configPath) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sm:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('agentBackupCloudConfig'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (__VLS_ctx.cloudStatus.configPath);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (__VLS_ctx.onUnifiedHistoryToggle) },
        ...{ class: "mt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentBackupUnifiedHistory'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 rounded-lg bg-base-200/60 p-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCount'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.unifiedArchives.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentRestoreSourceLocal'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.backupList.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentRestoreSourceCloud'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.cloudList.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshUnifiedArchives) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.backupListLoading || __VLS_ctx.cloudLoading || __VLS_ctx.cloudListLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                    return;
                __VLS_ctx.backupArchiveView = 'all';
                // @ts-ignore
                [$t, $t, $t, $t, $t, cloudStatus, cloudStatus, cloudLoading, onUnifiedHistoryToggle, unifiedArchives, backupList, cloudList, refreshUnifiedArchives, backupListLoading, cloudListLoading, backupArchiveView,];
            } },
        type: "button",
        ...{ class: "btn btn-xs" },
        ...{ class: (__VLS_ctx.backupArchiveView === 'all' ? '' : 'btn-outline') },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('all'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                    return;
                __VLS_ctx.backupArchiveView = 'current';
                // @ts-ignore
                [$t, backupArchiveView, backupArchiveView,];
            } },
        type: "button",
        ...{ class: "btn btn-xs" },
        ...{ class: (__VLS_ctx.backupArchiveView === 'current' ? '' : 'btn-outline') },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('agentBackupFilterCurrent'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                    return;
                __VLS_ctx.backupArchiveView = 'local';
                // @ts-ignore
                [$t, backupArchiveView, backupArchiveView,];
            } },
        type: "button",
        ...{ class: "btn btn-xs" },
        ...{ class: (__VLS_ctx.backupArchiveView === 'local' ? '' : 'btn-outline') },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('agentBackupFilterLocalOnly'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                    return;
                __VLS_ctx.backupArchiveView = 'cloud';
                // @ts-ignore
                [$t, backupArchiveView, backupArchiveView,];
            } },
        type: "button",
        ...{ class: "btn btn-xs" },
        ...{ class: (__VLS_ctx.backupArchiveView === 'cloud' ? '' : 'btn-outline') },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('agentBackupFilterCloudOnly'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                    return;
                __VLS_ctx.backupArchiveView = 'both';
                // @ts-ignore
                [$t, backupArchiveView, backupArchiveView,];
            } },
        type: "button",
        ...{ class: "btn btn-xs" },
        ...{ class: (__VLS_ctx.backupArchiveView === 'both' ? '' : 'btn-outline') },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('agentBackupFilterBoth'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_220px]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-[minmax(0,1fr)_220px]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex min-w-0 flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-[11px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('search'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-xs w-full" },
        placeholder: (__VLS_ctx.$t('agentBackupSearchPlaceholder')),
    });
    (__VLS_ctx.backupArchiveQuery);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-[11px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('sortBy'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.backupArchiveSort),
        ...{ class: "select select-xs w-full" },
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "timeDesc",
    });
    (__VLS_ctx.$t('agentBackupSortNewest'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "timeAsc",
    });
    (__VLS_ctx.$t('agentBackupSortOldest'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "sizeDesc",
    });
    (__VLS_ctx.$t('agentBackupSortLargest'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "sizeAsc",
    });
    (__VLS_ctx.$t('agentBackupSortSmallest'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "nameAsc",
    });
    (__VLS_ctx.$t('agentBackupSortNameAsc'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "nameDesc",
    });
    (__VLS_ctx.$t('agentBackupSortNameDesc'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 text-[11px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupShownCount', { shown: __VLS_ctx.filteredUnifiedArchives.length, total: __VLS_ctx.unifiedArchives.length }));
    if (__VLS_ctx.filteredUnifiedArchives.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 max-h-72 overflow-auto rounded-lg border border-base-300/50 bg-base-100/70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-h-72']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-300/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        for (const [item] of __VLS_vFor((__VLS_ctx.filteredUnifiedArchives))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (item.name),
                ...{ class: "flex flex-col gap-2 border-b border-base-300/50 px-3 py-2 last:border-b-0" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-300/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['last:border-b-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0 flex-1" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "truncate font-mono text-[11px] sm:text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:text-xs']} */ ;
            (item.name);
            if (__VLS_ctx.isCurrentBackup(item.name)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-info badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.$t('agentBackupCurrent'));
            }
            if (item.hasLocal && item.hasCloud) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-success badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.$t('agentBackupBothLocations'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-ghost badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (item.hasLocal ? __VLS_ctx.$t('agentRestoreSourceLocal') : __VLS_ctx.$t('agentRestoreSourceCloud'));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 flex flex-wrap items-center gap-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.formatBackupSize(item.displaySize));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (item.displayTime);
            if (item.hasLocal && item.hasCloud) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 flex flex-wrap items-center gap-3 text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.$t('agentRestoreSourceLocal'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.formatBackupTime(item.local?.mtime));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.$t('agentRestoreSourceCloud'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.formatCloudTime(__VLS_ctx.preferredCloudCopy(item)?.ModTime));
            }
            if (item.hasCloud) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 flex flex-wrap items-center gap-1 text-[11px] opacity-80" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                for (const [remote] of __VLS_vFor((__VLS_ctx.uniqueRemoteNames(item)))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        key: (remote),
                        ...{ class: "badge badge-sm" },
                        ...{ class: (__VLS_ctx.remoteStatusBadgeClass(remote)) },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                    (remote);
                    // @ts-ignore
                    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, remoteStatusBadgeClass, unifiedArchives, backupArchiveView, backupArchiveQuery, backupArchiveSort, filteredUnifiedArchives, filteredUnifiedArchives, filteredUnifiedArchives, isCurrentBackup, formatBackupSize, formatBackupTime, formatCloudTime, preferredCloudCopy, uniqueRemoteNames,];
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                            return;
                        if (!(__VLS_ctx.filteredUnifiedArchives.length))
                            return;
                        __VLS_ctx.selectUnifiedArchiveForRestore(item);
                        // @ts-ignore
                        [selectUnifiedArchiveForRestore,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('agentBackupUseForRestore'));
            if (item.hasLocal) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                                return;
                            if (!(__VLS_ctx.filteredUnifiedArchives.length))
                                return;
                            if (!(item.hasLocal))
                                return;
                            __VLS_ctx.selectBackupForRestore(item.name);
                            // @ts-ignore
                            [$t, agentEnabled, status, selectBackupForRestore,];
                        } },
                    type: "button",
                    ...{ class: "btn btn-ghost btn-xs" },
                    disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok),
                    title: (__VLS_ctx.$t('agentRestoreSourceLocal')),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('agentRestoreSourceLocal'));
            }
            if (item.hasCloud) {
                for (const [remote] of __VLS_vFor((__VLS_ctx.uniqueRemoteNames(item)))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                                    return;
                                if (!(__VLS_ctx.filteredUnifiedArchives.length))
                                    return;
                                if (!(item.hasCloud))
                                    return;
                                __VLS_ctx.selectCloudBackupForRestore(item.name, remote);
                                // @ts-ignore
                                [$t, $t, agentEnabled, status, uniqueRemoteNames, selectCloudBackupForRestore,];
                            } },
                        key: (`restore-${item.name}-${remote}`),
                        type: "button",
                        ...{ class: "btn btn-ghost btn-xs" },
                        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !__VLS_ctx.cloudStatus.cloudReady),
                        title: (`${__VLS_ctx.$t('agentRestoreSourceCloud')}: ${remote}`),
                    });
                    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                    (__VLS_ctx.$t('agentRestoreSourceCloud'));
                    (remote);
                    // @ts-ignore
                    [$t, $t, agentEnabled, status, cloudStatus,];
                }
            }
            if (item.hasLocal) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                                return;
                            if (!(__VLS_ctx.filteredUnifiedArchives.length))
                                return;
                            if (!(item.hasLocal))
                                return;
                            __VLS_ctx.deleteLocalBackup(item.name);
                            // @ts-ignore
                            [deleteLocalBackup,];
                        } },
                    type: "button",
                    ...{ class: "btn btn-ghost btn-xs text-error" },
                    disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !!__VLS_ctx.backup.running || !!__VLS_ctx.restore.running || __VLS_ctx.deletingLocalBackup === item.name),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
                if (__VLS_ctx.deletingLocalBackup === item.name) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "loading loading-spinner loading-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (__VLS_ctx.$t('delete'));
                    (__VLS_ctx.$t('agentRestoreSourceLocal'));
                }
            }
            if (item.hasCloud && !item.hasLocal) {
                for (const [remote] of __VLS_vFor((__VLS_ctx.uniqueRemoteNames(item)))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                                    return;
                                if (!(__VLS_ctx.filteredUnifiedArchives.length))
                                    return;
                                if (!(item.hasCloud && !item.hasLocal))
                                    return;
                                __VLS_ctx.downloadCloudBackupToLocal(item.name, remote);
                                // @ts-ignore
                                [$t, $t, agentEnabled, status, backup, uniqueRemoteNames, restore, deletingLocalBackup, deletingLocalBackup, downloadCloudBackupToLocal,];
                            } },
                        key: (`download-${item.name}-${remote}`),
                        type: "button",
                        ...{ class: "btn btn-ghost btn-xs" },
                        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !__VLS_ctx.cloudStatus.cloudReady || !!__VLS_ctx.backup.running || !!__VLS_ctx.restore.running || __VLS_ctx.downloadingCloudBackup === `${remote}::${item.name}`),
                    });
                    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                    if (__VLS_ctx.downloadingCloudBackup === `${remote}::${item.name}`) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "loading loading-spinner loading-xs" },
                        });
                        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                        /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
                    }
                    else {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                        (__VLS_ctx.$t('agentBackupDownloadToLocal'));
                        (remote);
                    }
                    // @ts-ignore
                    [$t, agentEnabled, status, backup, cloudStatus, restore, downloadingCloudBackup, downloadingCloudBackup,];
                }
            }
            if (item.hasCloud) {
                for (const [remote] of __VLS_vFor((__VLS_ctx.uniqueRemoteNames(item)))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                                    return;
                                if (!(__VLS_ctx.filteredUnifiedArchives.length))
                                    return;
                                if (!(item.hasCloud))
                                    return;
                                __VLS_ctx.deleteCloudBackup(item.name, remote);
                                // @ts-ignore
                                [uniqueRemoteNames, deleteCloudBackup,];
                            } },
                        key: (`delete-cloud-${item.name}-${remote}`),
                        type: "button",
                        ...{ class: "btn btn-ghost btn-xs text-error" },
                        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !__VLS_ctx.cloudStatus.cloudReady || !!__VLS_ctx.backup.running || !!__VLS_ctx.restore.running || __VLS_ctx.deletingCloudBackup === `${remote}::${item.name}`),
                    });
                    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
                    if (__VLS_ctx.deletingCloudBackup === `${remote}::${item.name}`) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "loading loading-spinner loading-xs" },
                        });
                        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                        /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
                    }
                    else {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                        (__VLS_ctx.$t('delete'));
                        (remote);
                    }
                    // @ts-ignore
                    [$t, agentEnabled, status, backup, cloudStatus, restore, deletingCloudBackup, deletingCloudBackup,];
                }
            }
            // @ts-ignore
            [];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('agentBackupNoItems'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (__VLS_ctx.onBackupHistoryToggle) },
        ...{ class: "mt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentBackupHistory'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 rounded-lg bg-base-200/60 p-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCount'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.backupList.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupFolder'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono break-all" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    (__VLS_ctx.backupDir || '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshBackupList) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.backupListLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    if (__VLS_ctx.backupList.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 max-h-56 overflow-auto rounded-lg border border-base-300/50 bg-base-100/70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-h-56']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-300/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        for (const [item] of __VLS_vFor((__VLS_ctx.backupList))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (item.name),
                ...{ class: "flex flex-col gap-1 border-b border-base-300/50 px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-300/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['last:border-b-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0 flex-1" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "truncate font-mono text-[11px] sm:text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:text-xs']} */ ;
            (item.name);
            if (__VLS_ctx.isCurrentBackup(item.name)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-info badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.$t('agentBackupCurrent'));
            }
            if (__VLS_ctx.isUploadedBackup(item.name)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-success badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.$t('agentBackupUploaded'));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 flex flex-wrap items-center gap-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.formatBackupSize(item.size));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.formatBackupTime(item.mtime));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                            return;
                        if (!(__VLS_ctx.backupList.length))
                            return;
                        __VLS_ctx.selectBackupForRestore(item.name);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, backupList, backupList, backupList, backupListLoading, isCurrentBackup, formatBackupSize, formatBackupTime, selectBackupForRestore, onBackupHistoryToggle, backupDir, refreshBackupList, isUploadedBackup,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('agentBackupUseForRestore'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                            return;
                        if (!(__VLS_ctx.backupList.length))
                            return;
                        __VLS_ctx.deleteLocalBackup(item.name);
                        // @ts-ignore
                        [$t, agentEnabled, status, deleteLocalBackup,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs text-error" },
                disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !!__VLS_ctx.backup.running || !!__VLS_ctx.restore.running || __VLS_ctx.deletingLocalBackup === item.name),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
            if (__VLS_ctx.deletingLocalBackup === item.name) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "loading loading-spinner loading-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.$t('delete'));
            }
            // @ts-ignore
            [$t, agentEnabled, status, backup, restore, deletingLocalBackup, deletingLocalBackup,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('agentBackupNoItems'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (__VLS_ctx.onCloudHistoryToggle) },
        ...{ class: "mt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentBackupCloudHistory'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 rounded-lg bg-base-200/60 p-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCloudCount'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.cloudList.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCloudRemote'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono break-all" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    (__VLS_ctx.cloudRemoteLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshCloudHistory) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.cloudListLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    if (__VLS_ctx.cloudList.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 max-h-56 overflow-auto rounded-lg border border-base-300/50 bg-base-100/70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-h-56']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-300/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
        for (const [item] of __VLS_vFor((__VLS_ctx.cloudList))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (__VLS_ctx.cloudItemKey(item)),
                ...{ class: "flex flex-col gap-1 border-b border-base-300/50 px-3 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-300/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['last:border-b-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0 flex-1" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "truncate font-mono text-[11px] sm:text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:text-xs']} */ ;
            (item.Name || item.Path || '—');
            if (__VLS_ctx.isCurrentBackup(item.Name || item.Path || '')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-info badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.$t('agentBackupCurrent'));
            }
            if (__VLS_ctx.hasLocalBackup(item.Name || item.Path || '')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-success badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.$t('agentBackupCloudAlsoLocal'));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 flex flex-wrap items-center gap-3 opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.formatBackupSize(item.Size));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.formatCloudTime(item.ModTime));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost badge-sm" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (__VLS_ctx.cloudItemRemote(item) || 'cloud');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                            return;
                        if (!(__VLS_ctx.cloudList.length))
                            return;
                        __VLS_ctx.selectCloudBackupForRestore(item.Name || item.Path || '', __VLS_ctx.cloudItemRemote(item));
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, cloudRemoteLabel, cloudList, cloudList, cloudList, cloudListLoading, isCurrentBackup, formatBackupSize, formatCloudTime, selectCloudBackupForRestore, onCloudHistoryToggle, refreshCloudHistory, cloudItemKey, hasLocalBackup, cloudItemRemote, cloudItemRemote,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !__VLS_ctx.cloudStatus.cloudReady),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('agentBackupUseForRestore'));
            if (!__VLS_ctx.hasLocalBackup(item.Name || item.Path || '')) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                                return;
                            if (!(__VLS_ctx.cloudList.length))
                                return;
                            if (!(!__VLS_ctx.hasLocalBackup(item.Name || item.Path || '')))
                                return;
                            __VLS_ctx.downloadCloudBackupToLocal(item.Name || item.Path || '', __VLS_ctx.cloudItemRemote(item));
                            // @ts-ignore
                            [$t, agentEnabled, status, cloudStatus, downloadCloudBackupToLocal, hasLocalBackup, cloudItemRemote,];
                        } },
                    type: "button",
                    ...{ class: "btn btn-ghost btn-xs" },
                    disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !__VLS_ctx.cloudStatus.cloudReady || !!__VLS_ctx.backup.running || !!__VLS_ctx.restore.running || __VLS_ctx.downloadingCloudBackup === `${__VLS_ctx.cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                if (__VLS_ctx.downloadingCloudBackup === `${__VLS_ctx.cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "loading loading-spinner loading-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (__VLS_ctx.$t('agentBackupDownloadToLocal'));
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.agentEnabled && __VLS_ctx.status.ok))
                            return;
                        if (!(__VLS_ctx.cloudList.length))
                            return;
                        __VLS_ctx.deleteCloudBackup(item.Name || item.Path || '', __VLS_ctx.cloudItemRemote(item));
                        // @ts-ignore
                        [$t, agentEnabled, status, backup, cloudStatus, restore, downloadingCloudBackup, downloadingCloudBackup, deleteCloudBackup, cloudItemRemote, cloudItemRemote, cloudItemRemote,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs text-error" },
                disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || !__VLS_ctx.cloudStatus.cloudReady || !!__VLS_ctx.backup.running || !!__VLS_ctx.restore.running || __VLS_ctx.deletingCloudBackup === `${__VLS_ctx.cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
            if (__VLS_ctx.deletingCloudBackup === `${__VLS_ctx.cloudItemRemote(item)}::${((item.Name || item.Path || '').split('/').pop() || '')}`) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "loading loading-spinner loading-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.$t('delete'));
            }
            // @ts-ignore
            [$t, agentEnabled, status, backup, cloudStatus, restore, deletingCloudBackup, deletingCloudBackup, cloudItemRemote, cloudItemRemote,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.cloudStatus.cloudReady ? __VLS_ctx.$t('agentBackupCloudNoItems') : __VLS_ctx.$t('agentBackupCloudNotReady'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (__VLS_ctx.onCronToggle) },
        ...{ class: "mt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentBackupSchedule'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentBackupAuto'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        ...{ class: "toggle toggle-sm" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok),
    });
    (__VLS_ctx.backupAutoEnabled);
    /** @type {__VLS_StyleScopedClasses['toggle']} */ ;
    /** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentBackupTime'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "time",
        ...{ class: "input input-sm w-28" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok),
    });
    (__VLS_ctx.backupAutoTime);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-28']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCron'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.cronSchedule);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copyCron) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (!__VLS_ctx.cronLine),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('copy'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 font-mono rounded-lg bg-base-200/60 p-2 text-[11px] break-all" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    (__VLS_ctx.cronLine);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyCron) },
        type: "button",
        ...{ class: "btn btn-xs" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.cronApplying),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    if (__VLS_ctx.cronApplying) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t('apply'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.removeCron) },
        type: "button",
        ...{ class: "btn btn-xs btn-outline" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.cronApplying),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
    (__VLS_ctx.$t('delete'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.runBackup) },
        type: "button",
        ...{ class: "btn btn-xs btn-outline" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.backupLoading || __VLS_ctx.backup.running || __VLS_ctx.cronApplying),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
    if (__VLS_ctx.backupLoading || __VLS_ctx.backup.running) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t('agentBackupNow'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshCron) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.cronApplying),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentBackupCronOnRouter'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-sm" },
        ...{ class: (__VLS_ctx.cronStateBadgeClass) },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.cronStateBadgeText);
    if (__VLS_ctx.cronStatus.ok && __VLS_ctx.cronStatus.schedule) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.cronStatus.schedule);
    }
    else if (__VLS_ctx.cronStatus.error) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-warning break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (__VLS_ctx.cronStatus.error);
    }
    if (__VLS_ctx.cronStatus.path || __VLS_ctx.cronStatus.line) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 flex flex-col gap-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        if (__VLS_ctx.cronStatus.path) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (__VLS_ctx.cronStatus.path);
        }
        if (__VLS_ctx.cronStatus.line) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (__VLS_ctx.cronStatus.line);
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (__VLS_ctx.onRestoreToggle) },
        ...{ class: "mt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentRestore'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentRestoreLast'));
    if (__VLS_ctx.restore.running) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-info badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentRestoreRunning'));
    }
    else if (__VLS_ctx.restore.success) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-success badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentRestoreOk'));
    }
    else if (__VLS_ctx.restore.finishedAt || __VLS_ctx.restore.startedAt) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('agentRestoreFail'));
    }
    if (__VLS_ctx.restore.finishedAt || __VLS_ctx.restore.startedAt) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.restore.finishedAt || __VLS_ctx.restore.startedAt);
    }
    if (__VLS_ctx.restore.source) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.restore.source === 'cloud' ? __VLS_ctx.$t('agentRestoreSourceCloud') : __VLS_ctx.$t('agentRestoreSourceLocal'));
    }
    if (__VLS_ctx.restore.file) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.restore.file);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshRestore) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.restoreLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    if (__VLS_ctx.restore.running || __VLS_ctx.restore.stage || __VLS_ctx.restore.detail) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-base-300/60 bg-base-200/40 p-2 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-300/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('agentRestoreStage'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.restoreStageLabel);
        if (__VLS_ctx.restoreProgressPct !== null) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.restoreProgressPct);
        }
        if (__VLS_ctx.restoreProgressPct !== null) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.progress, __VLS_intrinsics.progress)({
                ...{ class: "progress progress-info mt-2 w-full" },
                value: (__VLS_ctx.restoreProgressPct),
                max: "100",
            });
            /** @type {__VLS_StyleScopedClasses['progress']} */ ;
            /** @type {__VLS_StyleScopedClasses['progress-info']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 flex flex-wrap items-center justify-between gap-2 opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.restore.detail || ' ');
        if (__VLS_ctx.restoreBytesLabel) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.restoreBytesLabel);
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentRestoreSource'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm" },
        value: (__VLS_ctx.restoreSource),
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.restoreLoading || __VLS_ctx.restore.running),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "local",
    });
    (__VLS_ctx.$t('agentRestoreSourceLocal'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "cloud",
        disabled: (!__VLS_ctx.cloudStatus.cloudReady),
    });
    (__VLS_ctx.$t('agentRestoreSourceCloud'));
    if (__VLS_ctx.restoreSource === 'cloud' && __VLS_ctx.readyCloudRemotes.length > 1) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "flex flex-col gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.$t('agentBackupCloudRemote'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            ...{ class: "select select-sm" },
            value: (__VLS_ctx.restoreCloudRemote),
            disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.restoreLoading || __VLS_ctx.restore.running),
        });
        /** @type {__VLS_StyleScopedClasses['select']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "",
        });
        (__VLS_ctx.$t('agentRestoreCloudRemoteAuto'));
        for (const [remote] of __VLS_vFor((__VLS_ctx.readyCloudRemotes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                key: (remote),
                value: (remote),
            });
            (remote);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, agentEnabled, agentEnabled, agentEnabled, agentEnabled, agentEnabled, agentEnabled, agentEnabled, status, status, status, status, status, status, status, backupLoading, backupLoading, backup, backup, readyCloudRemotes, readyCloudRemotes, runBackup, cloudStatus, cloudStatus, restoreSource, restoreSource, restoreCloudRemote, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, restore, onCronToggle, backupAutoEnabled, backupAutoTime, cronSchedule, copyCron, cronLine, cronLine, applyCron, cronApplying, cronApplying, cronApplying, cronApplying, cronApplying, removeCron, refreshCron, cronStateBadgeClass, cronStateBadgeText, cronStatus, cronStatus, cronStatus, cronStatus, cronStatus, cronStatus, cronStatus, cronStatus, cronStatus, cronStatus, cronStatus, onRestoreToggle, refreshRestore, restoreLoading, restoreLoading, restoreLoading, restoreStageLabel, restoreProgressPct, restoreProgressPct, restoreProgressPct, restoreProgressPct, restoreBytesLabel, restoreBytesLabel,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentRestoreFrom'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm" },
        value: (__VLS_ctx.restoreSelected),
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.restoreLoading || __VLS_ctx.restore.running),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "latest",
    });
    (__VLS_ctx.$t('agentBackupLatest'));
    for (const [b] of __VLS_vFor((__VLS_ctx.restoreItems))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (b),
            value: (b),
        });
        (b);
        // @ts-ignore
        [$t, $t, agentEnabled, status, restore, restoreLoading, restoreSelected, restoreItems,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentRestoreScope'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm" },
        value: (__VLS_ctx.restoreScope),
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.restoreLoading || __VLS_ctx.restore.running),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "all",
    });
    (__VLS_ctx.$t('agentRestoreScopeAll'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "mihomo",
    });
    (__VLS_ctx.$t('agentRestoreScopeMihomo'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "agent",
    });
    (__VLS_ctx.$t('agentRestoreScopeAgent'));
    if (__VLS_ctx.restoreSource === 'cloud') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-base-300/60 bg-base-200/30 p-2 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-300/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('agentBackupCloudRemote'));
        for (const [remote] of __VLS_vFor((__VLS_ctx.readyCloudRemotes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (`ready-remote-${remote}`),
                ...{ class: "badge badge-sm" },
                ...{ class: (__VLS_ctx.restoreCloudRemote === remote ? 'badge-info' : 'badge-ghost') },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            (remote);
            // @ts-ignore
            [$t, $t, $t, $t, $t, agentEnabled, status, readyCloudRemotes, restoreSource, restoreCloudRemote, restore, restoreLoading, restoreScope,];
        }
        if (__VLS_ctx.restoreSelected !== 'latest' && __VLS_ctx.selectedCloudArchiveCopies.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('agentRestoreFrom'));
            for (const [copy] of __VLS_vFor((__VLS_ctx.selectedCloudArchiveCopies))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (`selected-copy-${__VLS_ctx.cloudItemKey(copy)}`),
                    ...{ class: "badge badge-sm" },
                    ...{ class: (__VLS_ctx.restoreCloudRemote && __VLS_ctx.restoreCloudRemote === __VLS_ctx.cloudItemRemote(copy) ? 'badge-info' : 'badge-ghost') },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.cloudItemRemote(copy));
                // @ts-ignore
                [$t, restoreCloudRemote, restoreCloudRemote, cloudItemKey, cloudItemRemote, cloudItemRemote, restoreSelected, selectedCloudArchiveCopies, selectedCloudArchiveCopies,];
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex items-center gap-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "checkbox",
        ...{ class: "checkbox checkbox-sm" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.restoreLoading || __VLS_ctx.restore.running),
    });
    (__VLS_ctx.restoreIncludeEnv);
    /** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentRestoreIncludeEnv'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.runRestore) },
        type: "button",
        ...{ class: "btn btn-xs btn-warning" },
        disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.status.ok || __VLS_ctx.restoreLoading || __VLS_ctx.restore.running),
        title: (__VLS_ctx.$t('agentRestoreNow')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-warning']} */ ;
    if (__VLS_ctx.restoreLoading || __VLS_ctx.restore.running) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "loading loading-spinner loading-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['loading']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
        /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.$t('agentRestoreNow'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 text-xs opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('agentRestoreTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ onToggle: (__VLS_ctx.onRestoreLogToggle) },
        ...{ class: "mt-1" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('agentRestoreViewLog'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200/60 p-2 text-[11px]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-h-40']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    (__VLS_ctx.restoreLog || '…');
}
else if (__VLS_ctx.agentEnabled && !__VLS_ctx.status.ok) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('agentOfflineTip'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('agentDisabledTip'));
}
// @ts-ignore
[$t, $t, $t, $t, $t, $t, $t, agentEnabled, agentEnabled, agentEnabled, status, status, status, restore, restore, restore, restoreLoading, restoreLoading, restoreLoading, restoreIncludeEnv, runRestore, onRestoreLogToggle, restoreLog,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
