/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import DialogWrapper from '@/components/common/DialogWrapper.vue';
import { agentLanHostsAPI, agentQosStatusAPI, agentRemoveHostQosAPI, agentSetHostQosAPI, agentStatusAPI } from '@/api/agent';
import { getExactIPLabelFromMap, getIPLabelFromMap, getPrimarySourceIpRule } from '@/helper/sourceip';
import { prettyBytesHelper } from '@/helper/utils';
import { showNotification } from '@/helper/notification';
import { activeConnections } from '@/store/connections';
import { sourceIPLabelList } from '@/store/settings';
import { mergeRouterHostQosAppliedProfiles, routerHostQosAppliedProfiles, setRouterHostQosAppliedProfile } from '@/store/routerHostQos';
import { autoDisconnectLimitedUsers, hardBlockLimitedUsers, userLimits } from '@/store/userLimits';
import { userLimitProfiles } from '@/store/userLimitProfiles';
import { agentEnabled, agentEnforceBandwidth, agentShaperStatus, bootstrapRouterAgentForLan, managedAgentShapers } from '@/store/agent';
import { clearUserLimit, getIpsForUser, getUserLimit, getUserLimitState, applyUserEnforcementNow, reapplyAgentShapingForUser, setUserLimit, } from '@/composables/userLimits';
import { applyProfileToUsers, disableLimitsForUsers, unblockResetUsers } from '@/composables/userLimitProfiles';
import { clearUserTrafficHistory, formatTraffic, getTrafficGrouped, getTrafficRange, getUserHourBucket, userTrafficStoreSize, } from '@/composables/userTraffic';
import dayjs from 'dayjs';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { usersDbPullNow } from '@/store/usersDbSync';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { v4 as uuidv4 } from 'uuid';
import { useTooltip } from '@/helper/tooltip';
import { AdjustmentsHorizontalIcon, ArrowPathIcon, BoltIcon, CheckIcon, CheckCircleIcon, CircleStackIcon, LockClosedIcon, PencilSquareIcon, QuestionMarkCircleIcon, TrashIcon, XMarkIcon, } from '@heroicons/vue/24/outline';
const editingUser = ref(null);
const editingName = ref('');
const profileOrder = ['critical', 'high', 'elevated', 'normal', 'low', 'background'];
const qosStatus = ref({ ok: false, supported: false, items: [] });
const qosDraftByUser = ref({});
const applyingQosUser = ref('');
let qosTimer;
const router = useRouter();
const { t } = useI18n();
const { showTip, hideTip } = useTooltip();
// --- Bulk actions (profiles / mass apply) ---
const selectedMap = ref({});
const selectedList = computed(() => Object.keys(selectedMap.value || {}).filter((u) => selectedMap.value[u]));
const clearSelection = () => {
    selectedMap.value = {};
};
const agentRuntimeReady = ref(false);
const agentLanHosts = ref([]);
const refreshAgentRuntime = async () => {
    try {
        const st = await agentStatusAPI();
        const ok = !!st?.ok;
        agentRuntimeReady.value = ok;
        if (!ok) {
            agentLanHosts.value = [];
            return false;
        }
        if (!agentEnabled.value)
            agentEnabled.value = true;
        if (!agentEnforceBandwidth.value)
            agentEnforceBandwidth.value = true;
        const hosts = await agentLanHostsAPI().catch(() => ({ ok: false, items: [] }));
        agentLanHosts.value = hosts?.ok && Array.isArray(hosts.items) ? hosts.items : [];
        return true;
    }
    catch {
        agentRuntimeReady.value = false;
        agentLanHosts.value = [];
        return false;
    }
};
const ensureAgentReady = async () => {
    bootstrapRouterAgentForLan();
    if (agentRuntimeReady.value && agentEnabled.value)
        return true;
    const ok = await refreshAgentRuntime();
    if (ok)
        await usersDbPullNow();
    return ok;
};
const qosMap = computed(() => {
    const out = {};
    for (const item of qosStatus.value.items || []) {
        if (item?.ip)
            out[item.ip] = item;
    }
    return out;
});
const normalizeMac = (value) => {
    const v = String(value || '').trim().toLowerCase().replace(/-/g, ':');
    return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(v) ? v : '';
};
const hasPersistedLimit = (user) => {
    if (isReservedPseudoTrafficUser(user))
        return false;
    const l = getUserLimit(user);
    return !!(l.enabled || l.disabled || (l.trafficLimitBytes || 0) > 0 || (l.bandwidthLimitBps || 0) > 0 || normalizeMac(l.mac || ''));
};
const lanHostMacByIp = computed(() => {
    const out = {};
    for (const host of agentLanHosts.value || []) {
        const ip = String(host?.ip || '').trim();
        const mac = normalizeMac(String(host?.mac || ''));
        if (!looksLikeIP(ip) || !mac)
            continue;
        out[ip] = mac;
    }
    return out;
});
const lanHostIpsByMac = computed(() => {
    const out = {};
    for (const host of agentLanHosts.value || []) {
        const ip = String(host?.ip || '').trim();
        const mac = normalizeMac(String(host?.mac || ''));
        if (!looksLikeIP(ip) || !mac)
            continue;
        (out[mac] ||= []).push(ip);
    }
    for (const mac of Object.keys(out))
        out[mac] = Array.from(new Set(out[mac])).sort((a, b) => a.localeCompare(b));
    return out;
});
const resolveMacsForIdentity = (user, ips, limitOwner = '') => {
    const out = new Set();
    const add = (value) => {
        const mac = normalizeMac(value);
        if (mac)
            out.add(mac);
    };
    add(getUserLimit(user).mac || '');
    if (limitOwner && limitOwner !== user)
        add(getUserLimit(limitOwner).mac || '');
    for (const ip of ips || [])
        add(lanHostMacByIp.value[ip] || '');
    const want = normalizeUserName(user);
    for (const host of agentLanHosts.value || []) {
        const ip = String(host?.ip || '').trim();
        const hostname = String(host?.hostname || '').trim();
        const display = String(getExactHostLabel(ip, hostname) || ip).trim();
        if (normalizeUserName(display) === want || normalizeUserName(ip) === want || normalizeUserName(hostname) === want) {
            add(String(host?.mac || ''));
        }
    }
    return Array.from(out).sort((a, b) => a.localeCompare(b));
};
const ipsForLimitOwner = (user, knownIps = [], knownMacs = []) => {
    if (isReservedPseudoTrafficUser(user))
        return [];
    const out = new Set();
    const addIp = (value) => {
        const ip = String(value || '').trim();
        if (looksLikeIP(ip))
            out.add(ip);
    };
    for (const ip of knownIps || [])
        addIp(ip);
    for (const ip of getIpsForUser(user) || [])
        addIp(ip);
    const macs = new Set((knownMacs || []).map((value) => normalizeMac(value)).filter(Boolean));
    const savedMac = normalizeMac(getUserLimit(user).mac || '');
    if (savedMac)
        macs.add(savedMac);
    for (const mac of macs) {
        for (const ip of lanHostIpsByMac.value[mac] || [])
            addIp(ip);
    }
    const want = normalizeUserName(user);
    for (const c of activeConnections.value || []) {
        const ip = String(c?.metadata?.sourceIP || '').trim();
        if (!looksLikeIP(ip))
            continue;
        const display = String(getExactHostLabel(ip) || ip).trim();
        if (normalizeUserName(display) === want || normalizeUserName(ip) === want)
            addIp(ip);
    }
    for (const host of agentLanHosts.value || []) {
        const ip = String(host?.ip || '').trim();
        const hostname = String(host?.hostname || '').trim();
        const display = String(getExactHostLabel(ip, hostname) || ip).trim();
        if (normalizeUserName(display) === want || normalizeUserName(ip) === want || normalizeUserName(hostname) === want)
            addIp(ip);
    }
    return Array.from(out).sort((a, b) => a.localeCompare(b));
};
const resolveLimitOwnerForRow = (user, ips, macs) => {
    if (isReservedPseudoTrafficUser(user))
        return { owner: user, reason: 'self' };
    if (hasPersistedLimit(user))
        return { owner: user, reason: 'persisted' };
    const want = normalizeUserName(user);
    const ipSet = new Set((ips || []).filter((ip) => looksLikeIP(ip)));
    const macSet = new Set((macs || []).map((value) => normalizeMac(value)).filter(Boolean));
    let byName = '';
    let byIp = '';
    let byIpMatch = '';
    for (const candidate of Object.keys(userLimits.value || {})) {
        if (!candidate || candidate === user)
            continue;
        if (isReservedPseudoTrafficUser(candidate))
            continue;
        if (!shouldIncludeTrafficUser(candidate))
            continue;
        if (!hasPersistedLimit(candidate))
            continue;
        if (!byName && normalizeUserName(candidate) === want)
            byName = candidate;
        const candidateMac = normalizeMac(getUserLimit(candidate).mac || '');
        if (candidateMac && macSet.has(candidateMac))
            return { owner: candidate, reason: 'mac', match: candidateMac };
        const candidateIps = new Set();
        if (looksLikeIP(candidate))
            candidateIps.add(candidate);
        for (const ip of getIpsForUser(candidate) || [])
            if (looksLikeIP(ip))
                candidateIps.add(ip);
        if (candidateMac) {
            for (const ip of lanHostIpsByMac.value[candidateMac] || [])
                if (looksLikeIP(ip))
                    candidateIps.add(ip);
        }
        for (const ip of candidateIps) {
            if (ipSet.has(ip)) {
                byIp = candidate;
                byIpMatch = ip;
                break;
            }
        }
        if (byIp)
            break;
    }
    if (byIp)
        return { owner: byIp, reason: 'ip', match: byIpMatch };
    if (byName)
        return { owner: byName, reason: 'name' };
    return { owner: user, reason: 'self' };
};
const rowLimitOwner = (row) => row.limitOwner || row.user;
const rowLimit = (row) => getUserLimit(rowLimitOwner(row));
const syncAppliedQosProfiles = () => {
    const next = {};
    for (const item of qosStatus.value.items || []) {
        if (item?.ip && item?.profile)
            next[item.ip] = item.profile;
    }
    mergeRouterHostQosAppliedProfiles(next);
};
const resolveRowQos = (ips) => {
    const profiles = Array.from(new Set(ips
        .map((ip) => qosMap.value[ip]?.profile || routerHostQosAppliedProfiles.value[ip])
        .filter(Boolean)));
    if (!profiles.length)
        return undefined;
    if (profiles.length === 1)
        return profiles[0];
    return 'mixed';
};
const ensureQosDrafts = () => {
    const next = { ...qosDraftByUser.value };
    for (const row of rows.value || []) {
        if (!next[row.user])
            next[row.user] = row.currentQos && row.currentQos !== 'mixed' ? row.currentQos : 'normal';
    }
    qosDraftByUser.value = next;
};
const effectiveIpsForRow = (row) => {
    const out = new Set();
    for (const ip of ipsForLimitOwner(row.user, row.ips, row.macs))
        out.add(ip);
    const owner = rowLimitOwner(row);
    if (owner && owner !== row.user) {
        for (const ip of ipsForLimitOwner(owner, row.ips, row.macs))
            out.add(ip);
    }
    return Array.from(out).sort((a, b) => a.localeCompare(b));
};
const rowHasEffectiveIps = (row) => effectiveIpsForRow(row).length > 0;
const resolveIpsForQosAction = async (row) => {
    let ips = effectiveIpsForRow(row);
    if (ips.length)
        return ips;
    await ensureAgentReady();
    await usersDbPullNow();
    await refreshAgentRuntime();
    ips = effectiveIpsForRow(row);
    if (ips.length)
        return ips;
    await refreshQosStatus();
    return effectiveIpsForRow(row);
};
const refreshQosStatus = async () => {
    const ready = await ensureAgentReady();
    if (!ready)
        return;
    const res = await agentQosStatusAPI();
    qosStatus.value = res.ok ? res : { ok: false, supported: false, items: [], error: res.error };
    if (res.ok)
        syncAppliedQosProfiles();
};
const profileLabel = (profile) => {
    if (profile === 'critical')
        return t('hostQosCritical');
    if (profile === 'high')
        return t('hostQosHigh');
    if (profile === 'elevated')
        return t('hostQosElevated');
    if (profile === 'low')
        return t('hostQosLow');
    if (profile === 'background')
        return t('hostQosBackground');
    return t('hostQosNormal');
};
const profileIcon = (profile) => {
    if (profile === 'critical')
        return '⏫';
    if (profile === 'high')
        return '⬆';
    if (profile === 'elevated')
        return '↗';
    if (profile === 'low')
        return '↘';
    if (profile === 'background')
        return '⬇';
    return '•';
};
const profileBadgeClass = (profile) => {
    if (profile === 'critical')
        return 'badge-error';
    if (profile === 'high')
        return 'badge-success';
    if (profile === 'elevated')
        return 'badge-accent';
    if (profile === 'low')
        return 'badge-warning';
    if (profile === 'background')
        return 'badge-ghost';
    return 'badge-info';
};
const limitProfiles = computed(() => userLimitProfiles.value || []);
const bulkProfileId = ref('');
const bulkBusy = ref(false);
const allSelected = computed(() => {
    const list = rows.value || [];
    if (!list.length)
        return false;
    return list.every((r) => !!selectedMap.value[r.user]);
});
const toggleSelectAll = () => {
    const list = rows.value || [];
    const want = !allSelected.value;
    const next = { ...(selectedMap.value || {}) };
    for (const r of list)
        next[r.user] = want;
    selectedMap.value = next;
};
const applyProfileBulk = async () => {
    const id = (bulkProfileId.value || '').trim();
    if (!id)
        return;
    const p = (limitProfiles.value || []).find((x) => x.id === id);
    if (!p)
        return;
    if (bulkBusy.value)
        return;
    bulkBusy.value = true;
    try {
        await applyProfileToUsers(selectedList.value, p);
        clearSelection();
    }
    finally {
        bulkBusy.value = false;
    }
};
const bulkUnblockReset = async () => {
    if (bulkBusy.value)
        return;
    bulkBusy.value = true;
    try {
        await unblockResetUsers(selectedList.value);
        clearSelection();
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        bulkBusy.value = false;
    }
};
const bulkDisableLimits = async () => {
    if (bulkBusy.value)
        return;
    bulkBusy.value = true;
    try {
        await disableLimitsForUsers(selectedList.value);
        clearSelection();
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        bulkBusy.value = false;
    }
};
const goPolicies = () => {
    router.push({ name: 'policies' });
};
const looksLikeIP = (s) => {
    const v = (s || '').trim();
    if (!v)
        return false;
    const v4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(v);
    const v6 = v.includes(':');
    return v4 || v6;
};
// Normalize user display strings to prevent duplicates (case/whitespace variations).
const normalizeUserName = (s) => {
    return (s || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
};
const isPatternSourceKey = (key) => {
    const raw = String(key || '').trim();
    if (!raw)
        return false;
    return raw.startsWith('/') || raw.includes('/');
};
const getExactHostLabel = (ip, hostname = '') => {
    const exact = String(getExactIPLabelFromMap(ip) || '').trim();
    if (exact && !isReservedPseudoTrafficUser(exact))
        return exact;
    const grouped = String(getIPLabelFromMap(ip) || '').trim();
    if (grouped && grouped !== ip && !isReservedPseudoTrafficUser(grouped))
        return grouped;
    const host = String(hostname || '').trim();
    if (host && !isReservedPseudoTrafficUser(host))
        return host;
    return ip;
};
const hasExactHostMappingForUser = (user) => {
    const want = normalizeUserName(user);
    if (!want || isReservedPseudoTrafficUser(user))
        return false;
    return sourceIPLabelList.value.some((it) => {
        const key = String(it.key || '').trim();
        if (!key || isPatternSourceKey(key))
            return false;
        const label = String(it.label || it.key || '').trim();
        return normalizeUserName(label) === want;
    });
};
const hasGroupedSourceMappingForUser = (user) => {
    const want = normalizeUserName(user);
    if (!want || isReservedPseudoTrafficUser(user))
        return false;
    return sourceIPLabelList.value.some((it) => {
        const key = String(it.key || '').trim();
        if (!key || !isPatternSourceKey(key))
            return false;
        const label = String(it.label || '').trim();
        return normalizeUserName(label) === want;
    });
};
const hasLanHostIdentityForUser = (user) => {
    const want = normalizeUserName(user);
    if (!want || isReservedPseudoTrafficUser(user))
        return false;
    return (agentLanHosts.value || []).some((host) => {
        const hostname = String(host?.hostname || '').trim();
        return !!hostname && normalizeUserName(hostname) === want;
    });
};
const hasSavedMacIdentityForUser = (user) => {
    if (!user || isReservedPseudoTrafficUser(user))
        return false;
    return !!normalizeMac(getUserLimit(user).mac || '');
};
const reservedPseudoTrafficLabels = new Set(['dhcp', 'arp', 'dnsmasq']);
const isReservedPseudoTrafficUser = (user) => {
    const want = normalizeUserName(user);
    if (!want)
        return false;
    return reservedPseudoTrafficLabels.has(want);
};
const hasResolvedIpsForUser = (user) => (getIpsForUser(user) || []).some((ip) => looksLikeIP(ip));
const isHostResolvableTrafficUser = (user) => {
    const value = String(user || '').trim();
    if (!value)
        return false;
    if (looksLikeIP(value))
        return true;
    if (hasExactHostMappingForUser(value))
        return true;
    if (hasGroupedSourceMappingForUser(value) && hasResolvedIpsForUser(value))
        return true;
    if (hasLanHostIdentityForUser(value))
        return true;
    if (hasSavedMacIdentityForUser(value))
        return true;
    return false;
};
const isSyntheticTrafficGroupUser = (user) => {
    const value = String(user || '').trim();
    if (!value || looksLikeIP(value))
        return false;
    if (isReservedPseudoTrafficUser(value) && !isHostResolvableTrafficUser(value))
        return true;
    if (!hasGroupedSourceMappingForUser(value))
        return false;
    return !hasExactHostMappingForUser(value) && !hasResolvedIpsForUser(value);
};
const shouldIncludeTrafficUser = (user) => {
    const value = String(user || '').trim();
    if (!value)
        return false;
    if (isReservedPseudoTrafficUser(value))
        return false;
    if (looksLikeIP(value))
        return true;
    if (isSyntheticTrafficGroupUser(value))
        return false;
    return isHostResolvableTrafficUser(value);
};
const primaryIdentityForRow = (row) => {
    if (row.limitOwner && hasPersistedLimit(row.limitOwner) && !isReservedPseudoTrafficUser(row.limitOwner)) {
        return `owner:${normalizeUserName(row.limitOwner)}`;
    }
    const firstMac = (row.macs || []).map((value) => normalizeMac(value)).find(Boolean);
    if (firstMac)
        return `mac:${firstMac}`;
    const firstIp = (row.ips || []).find((ip) => looksLikeIP(ip));
    if (firstIp)
        return `ip:${firstIp}`;
    return `user:${normalizeUserName(row.user)}`;
};
const pickBestDisplayForRow = (row) => {
    const candidates = [row.user, row.limitOwner, ...(row.ips || [])];
    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (!value)
            continue;
        if (isReservedPseudoTrafficUser(value))
            continue;
        if (looksLikeIP(value)) {
            const label = getExactHostLabel(value);
            if (label && !isReservedPseudoTrafficUser(label))
                return label;
            return value;
        }
        return value;
    }
    return row.user;
};
const hasMapping = (user) => {
    const u = (user || '').trim();
    if (!u)
        return false;
    return sourceIPLabelList.value.some((it) => (it.label || it.key) === u || it.key === u);
};
const startEdit = (user) => {
    editingUser.value = user;
    const mapped = sourceIPLabelList.value.find((it) => it.key === user) || null;
    editingName.value = (mapped?.label || user || '').toString();
};
const cancelEdit = () => {
    editingUser.value = null;
    editingName.value = '';
};
const saveEdit = () => {
    const oldUser = editingUser.value;
    const next = editingName.value.trim();
    if (!oldUser || !next)
        return;
    let changed = false;
    for (const it of sourceIPLabelList.value) {
        const u = it.label || it.key;
        if (u === oldUser || it.key === oldUser) {
            it.label = next;
            changed = true;
        }
    }
    if (!changed && looksLikeIP(oldUser)) {
        sourceIPLabelList.value.push({
            key: oldUser,
            label: next,
            id: uuidv4(),
        });
    }
    cancelEdit();
};
const removeUser = (user) => {
    const u = (user || '').trim();
    if (!u)
        return;
    for (let i = sourceIPLabelList.value.length - 1; i >= 0; i--) {
        const it = sourceIPLabelList.value[i];
        const name = it.label || it.key;
        if (name === u || it.key === u)
            sourceIPLabelList.value.splice(i, 1);
    }
};
const preset = ref('24h');
const topN = ref(30);
const sortKey = ref('total');
const sortDir = ref('desc');
const setSort = (k) => {
    if (sortKey.value === k) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    }
    else {
        sortKey.value = k;
        sortDir.value = k === 'user' || k === 'keys' ? 'asc' : 'desc';
    }
};
const customFrom = ref(dayjs().subtract(24, 'hour').format('YYYY-MM-DDTHH:mm'));
const customTo = ref(dayjs().format('YYYY-MM-DDTHH:mm'));
const range = computed(() => {
    const now = dayjs();
    if (preset.value === '1h')
        return { start: now.subtract(1, 'hour').valueOf(), end: now.valueOf() };
    if (preset.value === '24h')
        return { start: now.subtract(24, 'hour').valueOf(), end: now.valueOf() };
    if (preset.value === '7d')
        return { start: now.subtract(7, 'day').valueOf(), end: now.valueOf() };
    if (preset.value === '30d')
        return { start: now.subtract(30, 'day').valueOf(), end: now.valueOf() };
    const s = dayjs(customFrom.value);
    const e = dayjs(customTo.value);
    return {
        start: (s.isValid() ? s : now.subtract(24, 'hour')).valueOf(),
        end: (e.isValid() ? e : now).valueOf(),
    };
});
const knownKeysByUser = computed(() => {
    // Map normalized display user -> list of IP keys.
    const map = new Map();
    for (const item of sourceIPLabelList.value || []) {
        const display = String(item?.label || item?.key || '').trim();
        const ip = String(item?.key || '').trim();
        if (!display || !ip || isPatternSourceKey(ip))
            continue;
        const norm = normalizeUserName(display);
        const keys = map.get(norm) || [];
        if (!keys.includes(ip))
            keys.push(ip);
        map.set(norm, keys);
    }
    return map;
});
const canonicalUserByNorm = computed(() => {
    // Prefer explicit labels over raw IPs for display.
    const map = new Map();
    for (const item of sourceIPLabelList.value || []) {
        const ip = String(item?.key || '').trim();
        const label = String(item?.label || '').trim();
        const display = (label || ip).trim();
        if (!display || isPatternSourceKey(ip))
            continue;
        const norm = normalizeUserName(display);
        const prev = map.get(norm);
        if (!prev)
            map.set(norm, display);
        else if (label && looksLikeIP(prev))
            map.set(norm, display);
    }
    return map;
});
const rows = computed(() => {
    const { start, end } = range.value;
    // Traffic history buckets are primarily stored by stable keys (IP).
    const aggByKey = getTrafficRange(start, end);
    const normToIps = new Map();
    for (const [norm, ips] of knownKeysByUser.value.entries()) {
        normToIps.set(norm, new Set(ips));
    }
    const matchedTrafficIpsByNorm = new Map();
    for (const k of aggByKey.keys()) {
        const key = String(k || '').trim();
        if (!looksLikeIP(key))
            continue;
        const display = getExactHostLabel(key);
        const norm = normalizeUserName(display);
        if (!norm || norm === normalizeUserName(key))
            continue;
        const set = matchedTrafficIpsByNorm.get(norm) || new Set();
        set.add(key);
        matchedTrafficIpsByNorm.set(norm, set);
    }
    const trafficResolvableNorms = new Set(matchedTrafficIpsByNorm.keys());
    // Legacy buckets could still be stored under a label/synthetic key.
    const legacyKeysByNorm = new Map();
    for (const k of aggByKey.keys()) {
        const key = String(k || '').trim();
        if (!key)
            continue;
        if (looksLikeIP(key))
            continue;
        const norm = normalizeUserName(key);
        const set = legacyKeysByNorm.get(norm) || new Set();
        set.add(key);
        legacyKeysByNorm.set(norm, set);
    }
    const canonicalFor = (s) => {
        const raw = String(s || '').trim();
        if (!raw)
            return '';
        const norm = normalizeUserName(raw);
        return canonicalUserByNorm.value.get(norm) || raw;
    };
    const isTrafficResolvableUser = (user) => {
        const norm = normalizeUserName(user);
        return shouldIncludeTrafficUser(user) || trafficResolvableNorms.has(norm);
    };
    const addUser = (map, raw) => {
        const disp = canonicalFor(raw);
        if (!disp || !isTrafficResolvableUser(disp))
            return;
        const norm = normalizeUserName(disp);
        if (!map.has(norm))
            map.set(norm, disp);
    };
    const all = new Map();
    // From saved mapping.
    for (const [norm, ips] of normToIps.entries()) {
        const disp = canonicalUserByNorm.value.get(norm) || (ips.values().next().value || '');
        if (disp)
            all.set(norm, disp);
    }
    const displayUserForKey = (k) => {
        const key = String(k || '').trim();
        if (!key)
            return '';
        if (looksLikeIP(key))
            return getExactHostLabel(key);
        return key;
    };
    // From traffic buckets.
    for (const k of aggByKey.keys()) {
        addUser(all, displayUserForKey(String(k)));
    }
    // Also include users with saved limits (after applying profiles)
    for (const u of Object.keys(userLimits.value || {})) {
        if (!shouldIncludeTrafficUser(u))
            continue;
        addUser(all, u);
    }
    // Fallback: ensure active users are still visible even if traffic history is empty
    for (const c of activeConnections.value || []) {
        const ip = String(c?.metadata?.sourceIP || '').trim();
        const u = getExactHostLabel(ip);
        addUser(all, u);
    }
    // Also include users that have QoS applied on the router, even if they are idle
    // and browser local storage was cleared. This keeps the row visible and lets the
    // UI restore QoS state from agent qos_status instead of depending on cached pins.
    for (const item of qosStatus.value.items || []) {
        const ip = String(item?.ip || '').trim();
        if (!looksLikeIP(ip))
            continue;
        const u = getExactHostLabel(ip);
        addUser(all, u);
    }
    const rawList = Array.from(all.entries()).map(([norm, user]) => {
        const keysSet = new Set();
        // IP keys from mapping.
        for (const ip of normToIps.get(norm) || [])
            keysSet.add(ip);
        // Pattern-based mapping (CIDR / regex) resolved from recorded traffic buckets.
        for (const ip of matchedTrafficIpsByNorm.get(norm) || [])
            keysSet.add(ip);
        // If the displayed user is an IP itself, include it.
        if (looksLikeIP(user))
            keysSet.add(user);
        // Legacy buckets stored under a label/synthetic key.
        for (const lk of legacyKeysByNorm.get(norm) || [])
            keysSet.add(lk);
        let dl = 0;
        let ul = 0;
        for (const k of keysSet) {
            const t = aggByKey.get(k);
            dl += t?.dl || 0;
            ul += t?.ul || 0;
        }
        const liveIps = (activeConnections.value || [])
            .map((c) => String(c?.metadata?.sourceIP || '').trim())
            .filter((ip) => {
            if (!looksLikeIP(ip))
                return false;
            const display = getExactHostLabel(ip);
            return normalizeUserName(display) === norm || normalizeUserName(ip) === norm;
        });
        const baseIps = Array.from(new Set([
            ...Array.from(keysSet).filter((k) => looksLikeIP(k)),
            ...(getIpsForUser(user) || []),
            ...liveIps,
        ].filter((k) => looksLikeIP(k)))).sort((a, b) => a.localeCompare(b));
        const baseMacs = resolveMacsForIdentity(user, baseIps);
        const limitOwnerResolution = resolveLimitOwnerForRow(user, baseIps, baseMacs);
        const limitOwner = limitOwnerResolution.owner;
        const resolvedMacs = resolveMacsForIdentity(user, baseIps, limitOwner);
        const resolvedIps = Array.from(new Set([
            ...baseIps,
            ...ipsForLimitOwner(user, baseIps, resolvedMacs),
            ...(limitOwner !== user ? ipsForLimitOwner(limitOwner, baseIps, resolvedMacs) : []),
        ].filter((k) => looksLikeIP(k)))).sort((a, b) => a.localeCompare(b));
        const keys = resolvedIps.length ? resolvedIps.join(', ') : resolvedMacs.join(', ');
        const currentQos = resolveRowQos(resolvedIps);
        return {
            user,
            keys,
            dl,
            ul,
            ips: resolvedIps,
            macs: resolvedMacs,
            limitOwner,
            limitOwnerReason: limitOwnerResolution.reason,
            limitOwnerMatch: limitOwnerResolution.match,
            currentQos,
        };
    });
    const mergeQosState = (left, right) => {
        const values = Array.from(new Set([left, right].filter(Boolean)));
        if (!values.length)
            return undefined;
        if (values.includes('mixed'))
            return 'mixed';
        return values.length === 1 ? values[0] : 'mixed';
    };
    const list = Array.from(rawList.reduce((acc, row) => {
        const key = primaryIdentityForRow(row);
        const current = acc.get(key);
        if (!current) {
            acc.set(key, { ...row, ips: [...row.ips], macs: [...row.macs] });
            return acc;
        }
        current.dl += row.dl;
        current.ul += row.ul;
        current.ips = Array.from(new Set([...(current.ips || []), ...(row.ips || [])].filter((ip) => looksLikeIP(ip)))).sort((a, b) => a.localeCompare(b));
        current.macs = Array.from(new Set([...(current.macs || []), ...(row.macs || [])].map((value) => normalizeMac(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
        current.currentQos = mergeQosState(current.currentQos, row.currentQos);
        if (current.limitOwner === current.user && row.limitOwner !== row.user) {
            current.limitOwner = row.limitOwner;
            current.limitOwnerReason = row.limitOwnerReason;
            current.limitOwnerMatch = row.limitOwnerMatch;
        }
        else if (!current.limitOwnerMatch && row.limitOwnerMatch) {
            current.limitOwnerMatch = row.limitOwnerMatch;
        }
        if (!isSyntheticTrafficGroupUser(row.user)) {
            if (looksLikeIP(current.user) && !looksLikeIP(row.user))
                current.user = row.user;
            else if (current.user === current.limitOwner && row.user !== row.limitOwner && !looksLikeIP(row.user))
                current.user = row.user;
        }
        current.user = pickBestDisplayForRow(current);
        current.keys = current.ips.length ? current.ips.join(', ') : current.macs.join(', ');
        return acc;
    }, new Map()).values()).map((row) => ({
        ...row,
        user: pickBestDisplayForRow(row),
    })).filter((row) => isTrafficResolvableUser(row.user) && isTrafficResolvableUser(row.limitOwner || ''));
    const sorted = list.sort((a, b) => {
        const dir = sortDir.value === 'asc' ? 1 : -1;
        if (sortKey.value === 'user')
            return dir * a.user.localeCompare(b.user);
        if (sortKey.value === 'keys')
            return dir * a.keys.localeCompare(b.keys);
        if (sortKey.value === 'dl')
            return dir * (a.dl - b.dl);
        if (sortKey.value === 'ul')
            return dir * (a.ul - b.ul);
        const at = a.dl + a.ul;
        const bt = b.dl + b.ul;
        return dir * (at - bt);
    });
    if (topN.value > 0) {
        const pinnedUsers = new Set(Object.keys(userLimits.value || {}).filter((user) => Boolean(user) && shouldIncludeTrafficUser(user)));
        const sliced = sorted.slice(0, topN.value);
        const keep = new Set(sliced.map((row) => row.user));
        for (const row of sorted) {
            if (keep.has(row.user))
                continue;
            if (!pinnedUsers.has(row.user) && !pinnedUsers.has(row.limitOwner) && !row.currentQos)
                continue;
            sliced.push(row);
            keep.add(row.user);
        }
        return sliced;
    }
    return sorted;
});
watch(rows, () => {
    ensureQosDrafts();
}, { deep: true, immediate: true });
const applyUserQos = async (row) => {
    const ready = await ensureAgentReady();
    const ips = await resolveIpsForQosAction(row);
    if (!ready || !ips.length) {
        showNotification({ content: 'Не найден IP для применения QoS', type: 'alert-warning', timeout: 2200 });
        return;
    }
    const profile = qosDraftByUser.value[row.user] || 'normal';
    applyingQosUser.value = row.user;
    try {
        const results = await Promise.all(ips.map((ip) => agentSetHostQosAPI({ ip, profile })));
        const failed = results.find((it) => !it.ok);
        if (failed) {
            showNotification({ content: failed.error || 'QoS apply failed', type: 'alert-error', timeout: 2200 });
            return;
        }
        for (const ip of ips)
            setRouterHostQosAppliedProfile(ip, profile);
        await refreshQosStatus();
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
    }
    finally {
        applyingQosUser.value = '';
    }
};
const clearUserQos = async (row) => {
    const ready = await ensureAgentReady();
    const ips = await resolveIpsForQosAction(row);
    if (!ready || !ips.length) {
        showNotification({ content: 'Не найден IP для очистки QoS', type: 'alert-warning', timeout: 2200 });
        return;
    }
    applyingQosUser.value = row.user;
    try {
        const results = await Promise.all(ips.map((ip) => agentRemoveHostQosAPI(ip)));
        const failed = results.find((it) => !it.ok);
        if (failed) {
            showNotification({ content: failed.error || 'QoS clear failed', type: 'alert-error', timeout: 2200 });
            return;
        }
        for (const ip of ips)
            setRouterHostQosAppliedProfile(ip);
        await refreshQosStatus();
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
    }
    finally {
        applyingQosUser.value = '';
    }
};
onMounted(() => {
    bootstrapRouterAgentForLan();
    void (async () => {
        await ensureAgentReady();
        await usersDbPullNow();
        await refreshQosStatus();
    })();
    qosTimer = window.setInterval(() => {
        void refreshQosStatus();
    }, 12000);
});
onBeforeUnmount(() => {
    if (qosTimer)
        window.clearInterval(qosTimer);
});
const speed = (bps) => `${prettyBytesHelper(bps || 0)}/s`;
const format = (b) => formatTraffic(b);
const buckets = computed(() => userTrafficStoreSize.value);
const reportDialogOpen = ref(false);
const reportGroupBy = ref('day');
const reportUser = ref('');
const reportSkipEmpty = ref(true);
const reportUsers = computed(() => rows.value.map((row) => row.user).filter(Boolean).sort((a, b) => a.localeCompare(b)));
const reportRangeLabel = computed(() => {
    const start = dayjs(range.value.start);
    const end = dayjs(range.value.end);
    return `${start.format('YYYY-MM-DD HH:mm')} → ${end.format('YYYY-MM-DD HH:mm')}`;
});
const reportPreviewRows = computed(() => {
    const grouped = getTrafficGrouped(range.value.start, range.value.end, reportGroupBy.value);
    const out = [];
    for (const [period, users] of grouped.entries()) {
        for (const [key, bucket] of users.entries()) {
            const displayUser = key ? getExactHostLabel(key) : '';
            const user = displayUser || key || t('unknown');
            if (reportUser.value && user !== reportUser.value)
                continue;
            const dl = Number(bucket?.dl || 0);
            const ul = Number(bucket?.ul || 0);
            if (reportSkipEmpty.value && dl <= 0 && ul <= 0)
                continue;
            out.push({ period, user, dl, ul });
        }
    }
    return out.sort((a, b) => {
        const p = a.period.localeCompare(b.period);
        if (p !== 0)
            return p;
        return a.user.localeCompare(b.user);
    });
});
const reportRowsCount = computed(() => reportPreviewRows.value.length);
const reportPreviewLimited = computed(() => reportPreviewRows.value.length >= 500);
const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const downloadCsv = (filename, headers, rows) => {
    const text = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};
const exportTableCsv = () => {
    const tableRows = rows.value.map((row) => [row.user, row.keys, row.dl, row.ul, row.dl + row.ul]);
    downloadCsv('user-traffic-table.csv', ['user', 'keys', 'download', 'upload', 'total'], tableRows);
};
const exportReportCsv = () => {
    const dataRows = reportPreviewRows.value.map((row) => [row.period, row.user, row.dl, row.ul, row.dl + row.ul]);
    downloadCsv('user-traffic-report.csv', ['period', 'user', 'download', 'upload', 'total'], dataRows);
};
const bpsToMbps = (bps) => {
    const v = ((bps || 0) * 8) / 1_000_000;
    if (!Number.isFinite(v) || v <= 0)
        return '0';
    const r = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    return String(r).replace(/\.0$/, '');
};
const trafficIconTitle = (limitBytes, period, enabled) => {
    const on = enabled ? '' : ' (выкл)';
    return `Лимит трафика: ${format(limitBytes)} / ${periodLabel(period)}${on}`;
};
const bandwidthIconTitle = (bps, enabled) => {
    const on = enabled ? '' : ' (выкл)';
    return `Лимит канала: ${bpsToMbps(bps)} Mbps${on}`;
};
const clearHistory = () => {
    clearUserTrafficHistory();
};
// --- Limits aggregation for the table ---
const normalizeResetAt = (ts) => {
    // legacy fallback (when baseline fields are missing)
    const d = dayjs(ts);
    if (d.minute() === 0 && d.second() === 0 && d.millisecond() === 0)
        return ts;
    return d.add(1, 'hour').startOf('hour').valueOf();
};
const hasResetBaseline = (l) => {
    return !!l?.resetHourKey && Number.isFinite(l?.resetHourDl) && Number.isFinite(l?.resetHourUl);
};
const windowForLimit = (l) => {
    const now = dayjs();
    let start = now.subtract(30, 'day');
    if (l.trafficPeriod === '1d')
        start = now.subtract(24, 'hour');
    if (l.trafficPeriod === 'month')
        start = now.startOf('month');
    let startTs = start.valueOf();
    let useBaseline = false;
    if (l.resetAt && l.resetAt > startTs) {
        if (hasResetBaseline(l)) {
            startTs = l.resetAt;
            useBaseline = true;
        }
        else {
            startTs = normalizeResetAt(l.resetAt);
            useBaseline = false;
        }
    }
    const startHourTs = dayjs(startTs).startOf('hour').valueOf();
    return { startTs, startHourTs, endTs: now.valueOf(), useBaseline };
};
const periodLabel = (p) => {
    if (p === '1d')
        return '24h';
    if (p === 'month')
        return 'month';
    return '30d';
};
const speedByIp = computed(() => {
    const map = {};
    for (const c of activeConnections.value || []) {
        const ip = String(c?.metadata?.sourceIP || '').trim();
        if (!looksLikeIP(ip))
            continue;
        map[ip] = (map[ip] || 0) + Number(c?.downloadSpeed || 0) + Number(c?.uploadSpeed || 0);
    }
    return map;
});
const limitStates = computed(() => {
    const out = {};
    // Build windows per user appearing in the table.
    const windows = new Map();
    for (const row of rows.value) {
        const l = rowLimit(row);
        const hasTraffic = (l.trafficLimitBytes || 0) > 0;
        const hasBw = (l.bandwidthLimitBps || 0) > 0;
        if (!hasTraffic && !hasBw && !l.disabled)
            continue;
        const w = windowForLimit(l);
        const key = `${l.trafficPeriod}:${w.startHourTs}`;
        const item = windows.get(key) || { startHourTs: w.startHourTs, endTs: w.endTs, users: [] };
        item.users.push(row.user);
        windows.set(key, item);
    }
    const aggByKey = new Map();
    for (const [key, w] of windows.entries()) {
        aggByKey.set(key, getTrafficRange(w.startHourTs, w.endTs));
    }
    for (const row of rows.value) {
        const l = rowLimit(row);
        const w = windowForLimit(l);
        const key = `${l.trafficPeriod}:${w.startHourTs}`;
        const agg = aggByKey.get(key);
        const keys = new Set([rowLimitOwner(row), row.user]);
        for (const ip of effectiveIpsForRow(row))
            keys.add(ip);
        let dl = 0;
        let ul = 0;
        for (const k of keys) {
            const t = agg?.get(k);
            dl += t?.dl || 0;
            ul += t?.ul || 0;
        }
        if (w.useBaseline) {
            dl = Math.max(0, dl - (l.resetHourDl || 0));
            ul = Math.max(0, ul - (l.resetHourUl || 0));
        }
        const usage = dl + ul;
        const tl = l.trafficLimitBytes || 0;
        const sp = effectiveIpsForRow(row).reduce((sum, ip) => sum + (speedByIp.value[ip] || 0), 0);
        const bl = l.bandwidthLimitBps || 0;
        const trafficExceeded = l.enabled && tl > 0 && usage >= tl;
        const bandwidthExceeded = l.enabled && bl > 0 && sp >= bl;
        const bwViaAgent = !!agentEnabled.value && !!agentEnforceBandwidth.value;
        // Manual block works regardless of "enabled".
        const blocked = l.disabled || (l.enabled && (trafficExceeded || (!bwViaAgent && bandwidthExceeded)));
        const pct = tl > 0 ? Math.min(999, Math.floor((usage / tl) * 100)) : 0;
        out[row.user] = {
            enabled: !!l.enabled,
            usageBytes: usage,
            trafficLimitBytes: tl,
            bandwidthLimitBps: bl,
            speedBps: sp,
            blocked,
            percent: tl > 0 ? String(pct) : '0',
            periodLabel: periodLabel(l.trafficPeriod),
        };
    }
    return out;
});
const blockedActionBusy = ref(false);
const setResetBaselineNow = (user, extra = {}) => {
    const now = Date.now();
    const keys = new Set([user]);
    for (const ip of ipsForLimitOwner(user))
        keys.add(ip);
    let dl = 0;
    let ul = 0;
    for (const k of keys) {
        const b = getUserHourBucket(k, now);
        dl += b.dl || 0;
        ul += b.ul || 0;
    }
    setUserLimit(user, {
        ...extra,
        resetAt: now,
        resetHourKey: dayjs(now).format('YYYY-MM-DDTHH'),
        resetHourDl: dl,
        resetHourUl: ul,
    });
};
const applyNow = async () => {
    if (blockedActionBusy.value)
        return;
    blockedActionBusy.value = true;
    try {
        await applyUserEnforcementNow();
    }
    finally {
        blockedActionBusy.value = false;
    }
};
const blockedList = computed(() => {
    const out = [];
    const keys = Object.keys(userLimits.value || {});
    for (const user of keys) {
        if (!shouldIncludeTrafficUser(user))
            continue;
        const st = getUserLimitState(user);
        if (!st.blocked)
            continue;
        const ips = (getIpsForUser(user) || []).join(', ');
        out.push({
            user,
            ips,
            usageBytes: st.usageBytes || 0,
            trafficLimitBytes: st.limit.trafficLimitBytes || 0,
            bandwidthLimitBps: st.limit.bandwidthLimitBps || 0,
            limitEnabled: !!st.limit.enabled,
            periodLabel: periodLabel(st.limit.trafficPeriod),
            periodKey: st.limit.trafficPeriod,
            reasonManual: !!st.limit.disabled,
            reasonTraffic: !!st.trafficExceeded,
            reasonBandwidth: !!st.bandwidthExceeded,
        });
    }
    // Sort: manual first, then traffic exceed, then bandwidth.
    out.sort((a, b) => {
        const pa = a.reasonManual ? 0 : a.reasonTraffic ? 1 : a.reasonBandwidth ? 2 : 3;
        const pb = b.reasonManual ? 0 : b.reasonTraffic ? 1 : b.reasonBandwidth ? 2 : 3;
        if (pa !== pb)
            return pa - pb;
        return a.user.localeCompare(b.user);
    });
    return out;
});
const unblockAndReset = async (user) => {
    if (!user)
        return;
    if (blockedActionBusy.value)
        return;
    blockedActionBusy.value = true;
    try {
        const l = getUserLimit(user);
        setResetBaselineNow(user, {
            disabled: false,
            // Keep enabled as-is.
            enabled: l.enabled,
        });
        await applyUserEnforcementNow();
        showNotification({ content: 'blockedUnblockDone', params: { user }, type: 'alert-success', timeout: 2200 });
    }
    catch (e) {
        console.error(e);
        showNotification({ content: 'blockedActionFailed', params: { user }, type: 'alert-error', timeout: 4500 });
    }
    finally {
        blockedActionBusy.value = false;
    }
};
const disableLimitsQuick = async (user) => {
    if (!user)
        return;
    if (blockedActionBusy.value)
        return;
    blockedActionBusy.value = true;
    try {
        setResetBaselineNow(user, { enabled: false, disabled: false });
        await applyUserEnforcementNow();
        showNotification({ content: 'blockedDisableDone', params: { user }, type: 'alert-success', timeout: 2200 });
    }
    catch (e) {
        console.error(e);
        showNotification({ content: 'blockedActionFailed', params: { user }, type: 'alert-error', timeout: 4500 });
    }
    finally {
        blockedActionBusy.value = false;
    }
};
const qosAppliedIpCount = computed(() => (qosStatus.value.items || []).length);
const shaperBadge = computed(() => {
    const out = {};
    const viaAgent = !!agentEnabled.value && !!agentEnforceBandwidth.value;
    if (!viaAgent)
        return out;
    const st = agentShaperStatus.value || {};
    const managed = managedAgentShapers.value || {};
    for (const row of rows.value) {
        const l = rowLimit(row);
        if (!l.enabled || !l.bandwidthLimitBps || l.bandwidthLimitBps <= 0) {
            out[row.user] = null;
            continue;
        }
        const ips = effectiveIpsForRow(row);
        if (!ips.length) {
            out[row.user] = {
                icon: QuestionMarkCircleIcon,
                cls: 'text-base-content/60',
                title: `${row.user}: no IPs`,
                showReapply: true,
                summary: t('shaperUnknown'),
            };
            continue;
        }
        const expectedMbps = +(((l.bandwidthLimitBps * 8) / 1_000_000)).toFixed(2);
        const statuses = ips.map((ip) => st[ip]).filter(Boolean);
        const hasFail = ips.some((ip) => st[ip] && st[ip].ok === false);
        const allOk = ips.every((ip) => st[ip] && st[ip].ok === true);
        const managedMismatch = ips.some((ip) => {
            const shaped = managed[ip];
            if (!shaped)
                return true;
            return Math.abs((shaped.upMbps || 0) - expectedMbps) > 0.05 || Math.abs((shaped.downMbps || 0) - expectedMbps) > 0.05;
        });
        const ipSuffix = ips.length ? ` · ${ips.join(', ')}` : '';
        if (hasFail) {
            const firstErr = ips.map((ip) => st[ip]).find((x) => x && !x.ok)?.error;
            out[row.user] = {
                icon: XMarkIcon,
                cls: 'text-error',
                title: `${t('shaperFailed')}${firstErr ? `: ${firstErr}` : ''}${ipSuffix}`,
                showReapply: true,
                summary: t('shaperFailed'),
            };
        }
        else if (allOk && !managedMismatch) {
            out[row.user] = {
                icon: CheckCircleIcon,
                cls: 'text-success',
                title: `${t('shaperApplied')} · ${expectedMbps} Mbps${ipSuffix}`,
                showReapply: false,
                summary: t('shaperApplied'),
            };
        }
        else if (!statuses.length || managedMismatch) {
            out[row.user] = {
                icon: QuestionMarkCircleIcon,
                cls: 'text-base-content/60',
                title: `${managedMismatch ? `${t('shaperUnknown')} · UI/agent mismatch` : t('shaperUnknown')}${ipSuffix}`,
                showReapply: true,
                summary: t('shaperUnknown'),
            };
        }
        else {
            out[row.user] = {
                icon: QuestionMarkCircleIcon,
                cls: 'text-base-content/60',
                title: `${t('shaperUnknown')}${ipSuffix}`,
                showReapply: true,
                summary: t('shaperUnknown'),
            };
        }
    }
    return out;
});
const runtimeBadgeClass = (tone) => {
    if (tone === 'success')
        return 'border-success/30 bg-success/10 text-success';
    if (tone === 'warning')
        return 'border-warning/30 bg-warning/10 text-warning';
    if (tone === 'error')
        return 'border-error/30 bg-error/10 text-error';
    if (tone === 'info')
        return 'border-info/30 bg-info/10 text-info';
    return 'border-base-content/15 bg-base-200/60 text-base-content/80';
};
const runtimeProfileBadgeClass = (profile) => {
    if (profile === 'mixed')
        return runtimeBadgeClass('warning');
    if (profile === 'critical')
        return 'border-error/30 bg-error/10 text-error';
    if (profile === 'high')
        return 'border-success/30 bg-success/10 text-success';
    if (profile === 'elevated')
        return 'border-accent/30 bg-accent/10 text-accent';
    if (profile === 'low')
        return 'border-warning/30 bg-warning/10 text-warning';
    if (profile === 'background')
        return 'border-base-content/15 bg-base-200/60 text-base-content/75';
    return 'border-info/30 bg-info/10 text-info';
};
const formatMbpsCompact = (value) => {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0)
        return '0';
    if (Math.abs(n - Math.round(n)) < 0.01)
        return String(Math.round(n));
    return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};
const compactList = (items, max = 2) => {
    const list = Array.from(new Set((items || []).filter(Boolean)));
    if (!list.length)
        return '';
    if (list.length <= max)
        return list.join(', ');
    return `${list.slice(0, max).join(', ')} +${list.length - max}`;
};
const sourceRuleKindLabel = (kind) => {
    if (kind === 'cidr')
        return t('sourceIpRuleKindCidr');
    if (kind === 'regex')
        return t('sourceIpRuleKindRegex');
    if (kind === 'suffix')
        return t('sourceIpRuleKindSuffix');
    return t('sourceIpRuleKindExact');
};
const sourceRuleBadgeClass = (kind) => {
    if (kind === 'cidr')
        return runtimeBadgeClass('info');
    if (kind === 'regex')
        return runtimeBadgeClass('warning');
    if (kind === 'suffix')
        return 'border-secondary/30 bg-secondary/10 text-secondary';
    return runtimeBadgeClass('neutral');
};
const rowSourceRuleSummaries = (row) => {
    const grouped = new Map();
    for (const ip of effectiveIpsForRow(row)) {
        const resolved = getPrimarySourceIpRule(ip);
        if (!resolved?.kind)
            continue;
        const current = grouped.get(resolved.kind) || {
            kind: resolved.kind,
            ruleKeys: new Set(),
            matchedIps: new Set(),
        };
        if (resolved.key)
            current.ruleKeys.add(resolved.key);
        current.matchedIps.add(ip);
        grouped.set(resolved.kind, current);
    }
    return Array.from(grouped.values())
        .map((item) => ({
        kind: item.kind,
        ruleKeys: Array.from(item.ruleKeys).sort((a, b) => a.localeCompare(b)),
        matchedIps: Array.from(item.matchedIps).sort((a, b) => a.localeCompare(b)),
    }))
        .sort((a, b) => {
        if (b.matchedIps.length !== a.matchedIps.length)
            return b.matchedIps.length - a.matchedIps.length;
        return sourceRuleKindLabel(a.kind).localeCompare(sourceRuleKindLabel(b.kind));
    });
};
const rowSourceRuleBadgeTitle = (summary) => {
    const kind = sourceRuleKindLabel(summary.kind);
    const rules = compactList(summary.ruleKeys, 3) || '—';
    const ips = compactList(summary.matchedIps, 4) || '—';
    return [
        t('sourceIpRowMatchedTitle', { kind, count: summary.matchedIps.length }),
        t('sourceIpRowRulesTitle', { rules }),
        t('sourceIpRowIpsTitle', { ips }),
    ].join('\n');
};
const rowSourceRuleBadges = (row) => {
    return rowSourceRuleSummaries(row).map((summary) => ({
        text: `${sourceRuleKindLabel(summary.kind)} · ${t('sourceIpRowIpCountShort', { count: summary.matchedIps.length })}`,
        cls: sourceRuleBadgeClass(summary.kind),
        title: rowSourceRuleBadgeTitle(summary),
    }));
};
const rowOwnerResolutionReasonLabel = (row) => {
    if (row.limitOwnerReason === 'persisted')
        return t('userTrafficOwnerReasonPersisted');
    if (row.limitOwnerReason === 'mac')
        return t('userTrafficOwnerReasonMac');
    if (row.limitOwnerReason === 'ip')
        return t('userTrafficOwnerReasonIp');
    if (row.limitOwnerReason === 'name')
        return t('userTrafficOwnerReasonName');
    return t('userTrafficOwnerReasonSelf');
};
const rowOwnerResolutionBadges = (row) => {
    const owner = rowLimitOwner(row);
    if (!owner || owner === row.user)
        return [];
    return [{
            text: t('userTrafficLimitOwnerBadge', { owner }),
            cls: runtimeBadgeClass('warning'),
            title: [
                t('userTrafficLimitOwnerTitle', { display: row.user, owner }),
                t('userTrafficLimitOwnerReasonTitle', { reason: rowOwnerResolutionReasonLabel(row), match: row.limitOwnerMatch || '—' }),
            ].join('\n'),
        }];
};
const rowResolvedMacs = (row) => resolveMacsForIdentity(row.user, effectiveIpsForRow(row), rowLimitOwner(row));
const rowAgentQosItems = (row) => {
    const seen = new Set();
    return effectiveIpsForRow(row)
        .map((ip) => qosMap.value[ip])
        .filter((item) => {
        if (!item?.ip || seen.has(item.ip))
            return false;
        seen.add(item.ip);
        return true;
    });
};
const rowStoredOnlyQosIps = (row) => {
    const seen = new Set();
    return effectiveIpsForRow(row).filter((ip) => {
        if (seen.has(ip))
            return false;
        seen.add(ip);
        return !qosMap.value[ip] && !!routerHostQosAppliedProfiles.value[ip];
    });
};
const rowRuntimeBadges = (row) => {
    const out = [];
    const ips = effectiveIpsForRow(row);
    const agentItems = rowAgentQosItems(row);
    const storedOnlyIps = rowStoredOnlyQosIps(row);
    if (row.currentQos === 'mixed') {
        out.push({ text: `QoS: ${t('hostQosMixed')}`, cls: runtimeProfileBadgeClass('mixed') });
    }
    else if (row.currentQos) {
        out.push({ text: `QoS: ${profileLabel(row.currentQos)}`, cls: runtimeProfileBadgeClass(row.currentQos) });
    }
    if (agentItems.length) {
        out.push({
            text: `agent ${agentItems.length}/${ips.length || agentItems.length} IP`,
            cls: runtimeBadgeClass('success'),
            title: 'Профиль подтверждён router-agent для указанных IP.',
        });
    }
    else if (storedOnlyIps.length) {
        out.push({
            text: `UI ${storedOnlyIps.length}/${ips.length || storedOnlyIps.length} IP`,
            cls: runtimeBadgeClass('warning'),
            title: 'Профиль сохранён в UI, но пока не подтверждён в свежем ответе router-agent.',
        });
    }
    const priorities = Array.from(new Set(agentItems.map((item) => item.priority).filter((value) => value !== undefined && value !== null)));
    if (priorities.length === 1)
        out.push({ text: `prio ${priorities[0]}`, cls: runtimeBadgeClass('neutral') });
    const upValues = Array.from(new Set(agentItems.map((item) => Number(item.upMinMbit || 0)).filter((value) => value > 0)));
    if (upValues.length === 1)
        out.push({ text: `↑ ${formatMbpsCompact(upValues[0])} Мбит`, cls: runtimeBadgeClass('info') });
    if (qosStatus.value.qosDownlinkEnabled) {
        const downValues = Array.from(new Set(agentItems.map((item) => Number(item.downMinMbit || 0)).filter((value) => value > 0)));
        if (downValues.length === 1)
            out.push({ text: `↓ ${formatMbpsCompact(downValues[0])} Мбит`, cls: runtimeBadgeClass('info') });
    }
    const shape = shaperBadge.value[row.user];
    if (shape?.summary) {
        const tone = shape.cls.includes('text-success') ? 'success' : shape.cls.includes('text-error') ? 'error' : 'warning';
        out.push({ text: `Shape: ${shape.summary}`, cls: runtimeBadgeClass(tone), title: shape.title });
    }
    return out;
};
const rowRuntimeMetaLine = (row) => {
    const parts = [];
    const ips = effectiveIpsForRow(row);
    const macs = rowResolvedMacs(row);
    if (rowLimitOwner(row) !== row.user)
        parts.push(t('userTrafficLimitOwnerMeta', { owner: rowLimitOwner(row) }));
    if (ips.length)
        parts.push(`IP: ${compactList(ips, 2)}`);
    if (macs.length)
        parts.push(`MAC: ${compactList(macs, 1)}`);
    if ((row.currentQos || rowStoredOnlyQosIps(row).length) && qosStatus.value.qosMode === 'wan-only')
        parts.push('safe WAN-only');
    return parts.join(' · ');
};
const rowRuntimeTitle = (row) => {
    const parts = [];
    const ips = effectiveIpsForRow(row);
    const macs = rowResolvedMacs(row);
    const agentItems = rowAgentQosItems(row);
    const storedOnlyIps = rowStoredOnlyQosIps(row);
    if (row.currentQos === 'mixed')
        parts.push(`QoS: ${t('hostQosMixed')}`);
    else if (row.currentQos)
        parts.push(`QoS: ${profileLabel(row.currentQos)}`);
    else
        parts.push(`QoS: ${t('hostQosNone')}`);
    if (rowLimitOwner(row) !== row.user)
        parts.push(t('userTrafficLimitOwnerRuntimeTitle', { display: row.user, owner: rowLimitOwner(row), reason: rowOwnerResolutionReasonLabel(row), match: row.limitOwnerMatch || '—' }));
    if (qosStatus.value.qosMode)
        parts.push(`Mode: ${qosStatus.value.qosMode}`);
    if (agentItems.length)
        parts.push(`Agent confirmed IP: ${agentItems.map((item) => item.ip).join(', ')}`);
    if (storedOnlyIps.length)
        parts.push(`UI-only IP: ${storedOnlyIps.join(', ')}`);
    for (const summary of rowSourceRuleSummaries(row)) {
        parts.push(`Source ${sourceRuleKindLabel(summary.kind)}: ${summary.ruleKeys.join(', ')} -> ${summary.matchedIps.join(', ')}`);
    }
    if (ips.length)
        parts.push(`Effective IP: ${ips.join(', ')}`);
    if (macs.length)
        parts.push(`MAC: ${macs.join(', ')}`);
    const priorities = Array.from(new Set(agentItems.map((item) => item.priority).filter((value) => value !== undefined && value !== null)));
    if (priorities.length === 1)
        parts.push(`Queue priority: ${priorities[0]}`);
    const upValues = Array.from(new Set(agentItems.map((item) => Number(item.upMinMbit || 0)).filter((value) => value > 0)));
    if (upValues.length === 1)
        parts.push(`Guaranteed uplink: ${formatMbpsCompact(upValues[0])} Мбит`);
    if (qosStatus.value.qosDownlinkEnabled) {
        const downValues = Array.from(new Set(agentItems.map((item) => Number(item.downMinMbit || 0)).filter((value) => value > 0)));
        if (downValues.length === 1)
            parts.push(`Guaranteed downlink: ${formatMbpsCompact(downValues[0])} Мбит`);
    }
    const badge = shaperBadge.value[row.user];
    if (badge?.title)
        parts.push(badge.title);
    return parts.join('\n');
};
const applyingShaperUser = ref(null);
const refreshingRuntimeUser = ref(null);
const refreshRowRuntime = async (row) => {
    refreshingRuntimeUser.value = row.user;
    try {
        await ensureAgentReady();
        await usersDbPullNow();
        await refreshAgentRuntime();
        await refreshQosStatus();
    }
    finally {
        refreshingRuntimeUser.value = null;
    }
};
const reapplyShaper = async (row) => {
    const user = rowLimitOwner(row);
    if (!user)
        return;
    await ensureAgentReady();
    applyingShaperUser.value = row.user;
    try {
        await reapplyAgentShapingForUser(user);
        await refreshAgentRuntime();
        await refreshQosStatus();
    }
    finally {
        applyingShaperUser.value = null;
    }
};
// --- Limits dialog ---
const limitsDialogOpen = ref(false);
const limitsUser = ref('');
const limitsUserDisplay = ref('');
const draftEnabled = ref(false);
const draftDisabled = ref(false);
const draftMac = ref('');
const macCandidates = ref([]);
const macLoading = ref(false);
const macApplyLoading = ref(false);
const draftTrafficValue = ref(0);
const draftTrafficUnit = ref('GB');
const draftBandwidthMbps = ref(0);
const draftPeriod = ref('30d');
const bytesFromTraffic = (value, unit) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0)
        return 0;
    const factor = unit === 'GB' ? 1_000_000_000 : 1_000_000;
    return Math.round(n * factor);
};
const bpsFromMbps = (mbps) => {
    const n = Number(mbps);
    if (!Number.isFinite(n) || n <= 0)
        return 0;
    return Math.round((n * 1_000_000) / 8);
};
const openLimits = (user, displayUser = user) => {
    limitsUser.value = user;
    limitsUserDisplay.value = displayUser;
    const l = getUserLimit(user);
    draftEnabled.value = l.enabled;
    draftDisabled.value = l.disabled;
    draftMac.value = (l.mac || '').toString().trim().toLowerCase();
    macCandidates.value = draftMac.value ? [draftMac.value] : [];
    draftPeriod.value = l.trafficPeriod;
    draftTrafficUnit.value = l.trafficLimitUnit || (l.trafficLimitBytes >= 1_000_000_000 ? 'GB' : 'MB');
    const factor = draftTrafficUnit.value === 'GB' ? 1_000_000_000 : 1_000_000;
    draftTrafficValue.value = l.trafficLimitBytes ? +(l.trafficLimitBytes / factor).toFixed(2) : 0;
    draftBandwidthMbps.value = l.bandwidthLimitBps ? +(((l.bandwidthLimitBps * 8) / 1_000_000)).toFixed(2) : 0;
    limitsDialogOpen.value = true;
};
const refreshMac = async () => {
    const user = limitsUser.value;
    if (!user)
        return;
    const ready = await ensureAgentReady();
    if (!ready)
        return;
    const ips = ipsForLimitOwner(user);
    if (!ips.length)
        return;
    macLoading.value = true;
    try {
        const macs = new Set();
        const macRe = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i;
        const extractMac = (val) => {
            if (!val)
                return '';
            if (typeof val === 'string') {
                const v = val.trim().toLowerCase();
                return macRe.test(v) ? v : '';
            }
            if (typeof val !== 'object')
                return '';
            const candidates = [
                val.mac,
                val.MAC,
                val.result,
                val.value,
                val.data?.mac,
                val.data?.value,
            ];
            for (const c of candidates) {
                const m = extractMac(c);
                if (m)
                    return m;
            }
            return '';
        };
        // Lazy import to avoid increasing initial bundle work.
        const { agentIpToMacAPI, agentNeighborsAPI } = await import('@/api/agent');
        // Neighbors fallback (single request), used when ip2mac fails or returns unexpected shape.
        let neighbors = null;
        const loadNeighbors = async () => {
            if (neighbors !== null)
                return neighbors;
            const n = await agentNeighborsAPI().catch(() => null);
            neighbors = n?.ok && n.items ? n.items : [];
            return neighbors;
        };
        // Prefer a direct ip->mac lookup (new agent). Fall back to neighbors list.
        for (const ip of ips) {
            const r = await agentIpToMacAPI(ip);
            const mac = extractMac(r);
            if (r?.ok && mac) {
                macs.add(mac);
                continue;
            }
            // Fallback: neighbors table.
            const nitems = await loadNeighbors();
            for (const it of nitems) {
                if ((it?.ip || '').trim() !== ip)
                    continue;
                const m = extractMac(it?.mac);
                if (m)
                    macs.add(m);
            }
        }
        const list = Array.from(macs).filter(Boolean);
        macCandidates.value = list;
        if (list.length === 1)
            draftMac.value = list[0];
    }
    finally {
        macLoading.value = false;
    }
};
const refreshMacAndApply = async () => {
    const user = limitsUser.value;
    if (!user)
        return;
    const ready = await ensureAgentReady();
    if (!ready)
        return;
    macApplyLoading.value = true;
    try {
        await refreshMac();
        const mac = (draftMac.value || '').trim().toLowerCase();
        if (!mac)
            return;
        // Persist learned MAC even if the user doesn't press "Save".
        setUserLimit(user, { mac });
        // Apply blocks/shaping right away (helps when DHCP changes IPs).
        await applyUserEnforcementNow();
        // Best-effort: also re-apply shaping for this user.
        await reapplyAgentShapingForUser(user);
    }
    finally {
        macApplyLoading.value = false;
    }
};
const clearMac = () => {
    draftMac.value = '';
    macCandidates.value = [];
};
const saveLimits = async () => {
    const user = limitsUser.value;
    if (!user)
        return;
    const trafficLimitBytes = bytesFromTraffic(draftTrafficValue.value, draftTrafficUnit.value);
    const bandwidthLimitBps = bpsFromMbps(draftBandwidthMbps.value);
    const enabled = !!draftEnabled.value;
    const disabled = !!draftDisabled.value;
    // Default: don't persist an entry unless user really sets something.
    if (!enabled && !disabled && !trafficLimitBytes && !bandwidthLimitBps) {
        clearUserLimit(user);
        limitsDialogOpen.value = false;
        return;
    }
    setUserLimit(user, {
        enabled,
        disabled,
        mac: draftMac.value ? draftMac.value : undefined,
        trafficPeriod: draftPeriod.value,
        trafficLimitBytes: trafficLimitBytes || undefined,
        trafficLimitUnit: trafficLimitBytes ? draftTrafficUnit.value : undefined,
        bandwidthLimitBps: bandwidthLimitBps || undefined,
    });
    limitsDialogOpen.value = false;
    // Apply right away so that manual block/limits feel instant.
    try {
        await ensureAgentReady();
        await applyUserEnforcementNow();
    }
    catch {
        // ignore
    }
};
const clearLimits = async () => {
    const user = limitsUser.value;
    if (!user)
        return;
    clearUserLimit(user);
    limitsDialogOpen.value = false;
    try {
        await ensureAgentReady();
        await applyUserEnforcementNow();
    }
    catch {
        // ignore
    }
};
const resetCounter = async () => {
    const user = limitsUser.value;
    if (!user)
        return;
    setResetBaselineNow(user);
    try {
        await ensureAgentReady();
        await applyUserEnforcementNow();
    }
    catch {
        // ignore
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
    ...{ class: "card" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-title px-4 pt-4 flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('userTraffic'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm" },
    value: (__VLS_ctx.preset),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "1h",
});
(__VLS_ctx.$t('last1h'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "24h",
});
(__VLS_ctx.$t('last24h'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "7d",
});
(__VLS_ctx.$t('last7d'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "30d",
});
(__VLS_ctx.$t('last30d'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "custom",
});
(__VLS_ctx.$t('custom'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm" },
    value: (__VLS_ctx.topN),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (0),
});
(__VLS_ctx.$t('all'));
for (const [n] of __VLS_vFor(([10, 20, 30, 50, 100]))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (n),
        value: (n),
    });
    (n);
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, $t, preset, topN,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.reportDialogOpen = true;
            // @ts-ignore
            [reportDialogOpen,];
        } },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('reports'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearHistory) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('clearHistory'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-3" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2 text-sm opacity-75" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
(__VLS_ctx.$t('hostQosBulkHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
if (!__VLS_ctx.agentEnabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    (__VLS_ctx.$t('disabled'));
}
else if (!__VLS_ctx.agentRuntimeReady) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-error" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
    (__VLS_ctx.$t('offline'));
}
else if (__VLS_ctx.qosStatus.ok && (__VLS_ctx.qosStatus.supported || __VLS_ctx.qosAppliedIpCount)) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-success" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
    (__VLS_ctx.$t('online'));
}
else if (__VLS_ctx.agentRuntimeReady && !__VLS_ctx.qosStatus.supported) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-warning" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-error" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
}
if (__VLS_ctx.qosStatus.qosMode === 'wan-only') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-info" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
(__VLS_ctx.qosStatus.wanRateMbit || '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
(__VLS_ctx.qosStatus.lanRateMbit || '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
(__VLS_ctx.qosAppliedIpCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
if (__VLS_ctx.qosStatus.qosMode === 'wan-only') {
}
else if (__VLS_ctx.qosStatus.ok && __VLS_ctx.qosStatus.supported) {
}
else if (__VLS_ctx.agentRuntimeReady && !__VLS_ctx.qosStatus.supported) {
}
else {
}
if (__VLS_ctx.preset === 'custom') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-1 gap-2 sm:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('from'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-sm" },
        type: "datetime-local",
    });
    (__VLS_ctx.customFrom);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "flex flex-col gap-1 text-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('to'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "input input-sm" },
        type: "datetime-local",
    });
    (__VLS_ctx.customTo);
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 p-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
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
    ...{ class: "text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('blockedUsers'));
if (__VLS_ctx.blockedList.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-error" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
    (__VLS_ctx.blockedList.length);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    (__VLS_ctx.blockedList.length);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.applyNow) },
    type: "button",
    ...{ class: "btn btn-xs btn-ghost" },
    disabled: (__VLS_ctx.blockedActionBusy),
    title: (__VLS_ctx.$t('applyEnforcementNow')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
ArrowPathIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.blockedActionBusy ? 'animate-spin' : '') },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.blockedActionBusy ? 'animate-spin' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
if (!__VLS_ctx.blockedList.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-sm opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('noBlockedUsers'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 overflow-x-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
        ...{ class: "table table-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['table']} */ ;
    /** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
    (__VLS_ctx.$t('user'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "max-md:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    (__VLS_ctx.$t('traffic'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "text-right max-lg:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-lg:hidden']} */ ;
    (__VLS_ctx.$t('limits'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ class: "text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    (__VLS_ctx.$t('actions'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [b] of __VLS_vFor((__VLS_ctx.blockedList))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (b.user),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        let __VLS_5;
        /** @ts-ignore @type {typeof __VLS_components.LockClosedIcon} */
        LockClosedIcon;
        // @ts-ignore
        const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
            ...{ class: "h-4 w-4 text-error" },
        }));
        const __VLS_7 = __VLS_6({
            ...{ class: "h-4 w-4 text-error" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_6));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "truncate inline-block max-w-[240px]" },
            title: (b.user),
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[240px]']} */ ;
        (b.user);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        if (b.trafficLimitBytes) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex pointer-events-auto" },
                title: (__VLS_ctx.trafficIconTitle(b.trafficLimitBytes, b.periodKey, b.limitEnabled)),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
            let __VLS_10;
            /** @ts-ignore @type {typeof __VLS_components.CircleStackIcon} */
            CircleStackIcon;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (b.limitEnabled ? 'text-info' : 'opacity-40') },
            }));
            const __VLS_12 = __VLS_11({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (b.limitEnabled ? 'text-info' : 'opacity-40') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_11));
            let __VLS_15;
            const __VLS_16 = ({ mouseenter: {} },
                { onMouseenter: (...[$event]) => {
                        if (!!(!__VLS_ctx.blockedList.length))
                            return;
                        if (!(b.trafficLimitBytes))
                            return;
                        __VLS_ctx.showTip($event, __VLS_ctx.trafficIconTitle(b.trafficLimitBytes, b.periodKey, b.limitEnabled));
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, preset, clearHistory, agentEnabled, agentRuntimeReady, agentRuntimeReady, agentRuntimeReady, qosStatus, qosStatus, qosStatus, qosStatus, qosStatus, qosStatus, qosStatus, qosStatus, qosStatus, qosStatus, qosAppliedIpCount, qosAppliedIpCount, customFrom, customTo, blockedList, blockedList, blockedList, blockedList, blockedList, applyNow, blockedActionBusy, blockedActionBusy, trafficIconTitle, trafficIconTitle, showTip,];
                    } });
            const __VLS_17 = ({ mouseleave: {} },
                { onMouseleave: (__VLS_ctx.hideTip) });
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            var __VLS_13;
            var __VLS_14;
        }
        if (b.bandwidthLimitBps) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex pointer-events-auto" },
                title: (__VLS_ctx.bandwidthIconTitle(b.bandwidthLimitBps, b.limitEnabled)),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
            let __VLS_18;
            /** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
            BoltIcon;
            // @ts-ignore
            const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (b.limitEnabled ? 'text-warning' : 'opacity-40') },
            }));
            const __VLS_20 = __VLS_19({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (b.limitEnabled ? 'text-warning' : 'opacity-40') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_19));
            let __VLS_23;
            const __VLS_24 = ({ mouseenter: {} },
                { onMouseenter: (...[$event]) => {
                        if (!!(!__VLS_ctx.blockedList.length))
                            return;
                        if (!(b.bandwidthLimitBps))
                            return;
                        __VLS_ctx.showTip($event, __VLS_ctx.bandwidthIconTitle(b.bandwidthLimitBps, b.limitEnabled));
                        // @ts-ignore
                        [showTip, hideTip, bandwidthIconTitle, bandwidthIconTitle,];
                    } });
            const __VLS_25 = ({ mouseleave: {} },
                { onMouseleave: (__VLS_ctx.hideTip) });
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            var __VLS_21;
            var __VLS_22;
        }
        if (b.reasonManual) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-error badge-outline" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            (__VLS_ctx.$t('manualBlock'));
        }
        else if (b.reasonTraffic) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-warning badge-outline" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            (__VLS_ctx.$t('trafficExceeded'));
        }
        else if (b.reasonBandwidth) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-warning badge-outline" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            (__VLS_ctx.$t('bandwidthExceeded'));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "max-md:hidden" },
        });
        /** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "truncate inline-block max-w-[420px] opacity-70" },
            title: (b.ips),
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[420px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (b.ips);
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "text-right font-mono whitespace-nowrap" },
        });
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        if (b.limitEnabled && b.trafficLimitBytes) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.format(b.usageBytes));
            (__VLS_ctx.format(b.trafficLimitBytes));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "text-right font-mono max-lg:hidden whitespace-nowrap" },
        });
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-lg:hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        if (b.limitEnabled) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (b.periodLabel);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "text-right relative z-40 pointer-events-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-40']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end gap-1 pointer-events-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.blockedList.length))
                        return;
                    __VLS_ctx.openLimits(b.user);
                    // @ts-ignore
                    [$t, $t, $t, hideTip, format, format, openLimits,];
                } },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
            title: (__VLS_ctx.$t('limits')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        let __VLS_26;
        /** @ts-ignore @type {typeof __VLS_components.AdjustmentsHorizontalIcon} */
        AdjustmentsHorizontalIcon;
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_28 = __VLS_27({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_27));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.blockedList.length))
                        return;
                    __VLS_ctx.unblockAndReset(b.user);
                    // @ts-ignore
                    [$t, unblockAndReset,];
                } },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-xs relative z-20" },
            disabled: (__VLS_ctx.blockedActionBusy),
            title: (__VLS_ctx.$t('unblockAndReset')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        (__VLS_ctx.$t('unblockAndReset'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.blockedList.length))
                        return;
                    __VLS_ctx.disableLimitsQuick(b.user);
                    // @ts-ignore
                    [$t, $t, blockedActionBusy, disableLimitsQuick,];
                } },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-xs relative z-20" },
            disabled: (__VLS_ctx.blockedActionBusy),
            title: (__VLS_ctx.$t('disableLimits')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        (__VLS_ctx.$t('disableLimits'));
        // @ts-ignore
        [$t, $t, blockedActionBusy,];
    }
}
if (__VLS_ctx.selectedList.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/30 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
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
        ...{ class: "text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('selected'));
    (__VLS_ctx.selectedList.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm" },
        value: (__VLS_ctx.bulkProfileId),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    (__VLS_ctx.$t('applyProfile'));
    for (const [p] of __VLS_vFor((__VLS_ctx.limitProfiles))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (p.id),
            value: (p.id),
        });
        (p.name);
        // @ts-ignore
        [$t, $t, selectedList, selectedList, bulkProfileId, limitProfiles,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyProfileBulk) },
        type: "button",
        ...{ class: "btn btn-sm" },
        disabled: (!__VLS_ctx.bulkProfileId || __VLS_ctx.bulkBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('apply'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.bulkUnblockReset) },
        type: "button",
        ...{ class: "btn btn-sm btn-ghost" },
        disabled: (__VLS_ctx.bulkBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('unblockAndReset'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.bulkDisableLimits) },
        type: "button",
        ...{ class: "btn btn-sm btn-ghost" },
        disabled: (__VLS_ctx.bulkBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('disableLimits'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goPolicies) },
        type: "button",
        ...{ class: "btn btn-sm btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('limitProfiles'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearSelection) },
        type: "button",
        ...{ class: "btn btn-sm btn-ghost" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('clearSelection'));
}
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
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onClick: (__VLS_ctx.toggleSelectAll) },
    type: "checkbox",
    ...{ class: "checkbox checkbox-sm" },
    checked: (__VLS_ctx.allSelected),
    title: (__VLS_ctx.$t('selectAll')),
});
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setSort('user');
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, bulkProfileId, applyProfileBulk, bulkBusy, bulkBusy, bulkBusy, bulkUnblockReset, bulkDisableLimits, goPolicies, clearSelection, toggleSelectAll, allSelected, setSort,];
        } },
    ...{ class: "cursor-pointer select-none" },
});
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
(__VLS_ctx.$t('user'));
if (__VLS_ctx.sortKey === 'user') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.sortDir === 'asc' ? '▲' : '▼');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setSort('keys');
            // @ts-ignore
            [$t, setSort, sortKey, sortDir,];
        } },
    ...{ class: "max-md:hidden cursor-pointer select-none" },
});
/** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
(__VLS_ctx.$t('keys'));
if (__VLS_ctx.sortKey === 'keys') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.sortDir === 'asc' ? '▲' : '▼');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setSort('dl');
            // @ts-ignore
            [$t, setSort, sortKey, sortDir,];
        } },
    ...{ class: "text-right cursor-pointer select-none" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
(__VLS_ctx.$t('download'));
if (__VLS_ctx.sortKey === 'dl') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.sortDir === 'asc' ? '▲' : '▼');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setSort('ul');
            // @ts-ignore
            [$t, setSort, sortKey, sortDir,];
        } },
    ...{ class: "text-right cursor-pointer select-none" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
(__VLS_ctx.$t('upload'));
if (__VLS_ctx.sortKey === 'ul') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.sortDir === 'asc' ? '▲' : '▼');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setSort('total');
            // @ts-ignore
            [$t, setSort, sortKey, sortDir,];
        } },
    ...{ class: "text-right cursor-pointer select-none" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['select-none']} */ ;
(__VLS_ctx.$t('total'));
if (__VLS_ctx.sortKey === 'total') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.sortDir === 'asc' ? '▲' : '▼');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right max-lg:hidden" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['max-lg:hidden']} */ ;
(__VLS_ctx.$t('trafficLimit'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right max-lg:hidden" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['max-lg:hidden']} */ ;
(__VLS_ctx.$t('bandwidthLimit'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right min-w-[220px]" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-[220px]']} */ ;
(__VLS_ctx.$t('hostQosColumn'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.$t('actions'));
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [row] of __VLS_vFor((__VLS_ctx.rows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (row.user),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onClick: () => { } },
        type: "checkbox",
        ...{ class: "checkbox checkbox-sm" },
        title: (__VLS_ctx.$t('selectUser')),
    });
    (__VLS_ctx.selectedMap[row.user]);
    /** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
    /** @type {__VLS_StyleScopedClasses['checkbox-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    if (__VLS_ctx.limitStates[row.user]?.blocked) {
        let __VLS_31;
        /** @ts-ignore @type {typeof __VLS_components.LockClosedIcon} */
        LockClosedIcon;
        // @ts-ignore
        const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
            ...{ class: "h-4 w-4 text-error" },
            title: (__VLS_ctx.$t('userBlockedTip')),
        }));
        const __VLS_33 = __VLS_32({
            ...{ class: "h-4 w-4 text-error" },
            title: (__VLS_ctx.$t('userBlockedTip')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_32));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
    }
    if (__VLS_ctx.editingUser === row.user) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "input input-xs w-full max-w-[260px]" },
            placeholder: (__VLS_ctx.$t('user')),
        });
        (__VLS_ctx.editingName);
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "truncate inline-block max-w-[240px]" },
            title: (row.user),
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[240px]']} */ ;
        (row.user);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        if (__VLS_ctx.limitStates[row.user]?.trafficLimitBytes) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex pointer-events-auto" },
                title: (__VLS_ctx.trafficIconTitle(__VLS_ctx.limitStates[row.user].trafficLimitBytes, __VLS_ctx.rowLimit(row).trafficPeriod, __VLS_ctx.limitStates[row.user].enabled)),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
            let __VLS_36;
            /** @ts-ignore @type {typeof __VLS_components.CircleStackIcon} */
            CircleStackIcon;
            // @ts-ignore
            const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-info' : 'opacity-40') },
            }));
            const __VLS_38 = __VLS_37({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-info' : 'opacity-40') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_37));
            let __VLS_41;
            const __VLS_42 = ({ mouseenter: {} },
                { onMouseenter: (...[$event]) => {
                        if (!!(__VLS_ctx.editingUser === row.user))
                            return;
                        if (!(__VLS_ctx.limitStates[row.user]?.trafficLimitBytes))
                            return;
                        __VLS_ctx.showTip($event, __VLS_ctx.trafficIconTitle(__VLS_ctx.limitStates[row.user].trafficLimitBytes, __VLS_ctx.rowLimit(row).trafficPeriod, __VLS_ctx.limitStates[row.user].enabled));
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, trafficIconTitle, trafficIconTitle, showTip, sortKey, sortDir, rows, selectedMap, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, editingUser, editingName, rowLimit, rowLimit,];
                    } });
            const __VLS_43 = ({ mouseleave: {} },
                { onMouseleave: (__VLS_ctx.hideTip) });
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            var __VLS_39;
            var __VLS_40;
        }
        if (__VLS_ctx.limitStates[row.user]?.bandwidthLimitBps) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex pointer-events-auto" },
                title: (__VLS_ctx.bandwidthIconTitle(__VLS_ctx.limitStates[row.user].bandwidthLimitBps, __VLS_ctx.limitStates[row.user].enabled)),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
            let __VLS_44;
            /** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
            BoltIcon;
            // @ts-ignore
            const __VLS_45 = __VLS_asFunctionalComponent1(__VLS_44, new __VLS_44({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-warning' : 'opacity-40') },
            }));
            const __VLS_46 = __VLS_45({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-warning' : 'opacity-40') },
            }, ...__VLS_functionalComponentArgsRest(__VLS_45));
            let __VLS_49;
            const __VLS_50 = ({ mouseenter: {} },
                { onMouseenter: (...[$event]) => {
                        if (!!(__VLS_ctx.editingUser === row.user))
                            return;
                        if (!(__VLS_ctx.limitStates[row.user]?.bandwidthLimitBps))
                            return;
                        __VLS_ctx.showTip($event, __VLS_ctx.bandwidthIconTitle(__VLS_ctx.limitStates[row.user].bandwidthLimitBps, __VLS_ctx.limitStates[row.user].enabled));
                        // @ts-ignore
                        [showTip, hideTip, bandwidthIconTitle, bandwidthIconTitle, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates,];
                    } });
            const __VLS_51 = ({ mouseleave: {} },
                { onMouseleave: (__VLS_ctx.hideTip) });
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            var __VLS_47;
            var __VLS_48;
        }
        if (row.currentQos && row.currentQos !== 'mixed') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-xs" },
                ...{ class: (__VLS_ctx.profileBadgeClass(row.currentQos)) },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (__VLS_ctx.profileIcon(row.currentQos));
            (__VLS_ctx.profileLabel(row.currentQos));
        }
        else if (row.currentQos === 'mixed') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-xs badge-warning" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
            (__VLS_ctx.$t('hostQosMixed'));
        }
    }
    if (__VLS_ctx.editingUser !== row.user && __VLS_ctx.rowSourceRuleBadges(row).length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-1 text-[11px]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        for (const [badge] of __VLS_vFor((__VLS_ctx.rowSourceRuleBadges(row)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (`${row.user}-${badge.text}`),
                ...{ class: "inline-flex items-center rounded-full border px-2 py-0.5 font-medium" },
                ...{ class: (badge.cls) },
                title: (badge.title),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (badge.text);
            // @ts-ignore
            [$t, hideTip, editingUser, profileBadgeClass, profileIcon, profileLabel, rowSourceRuleBadges, rowSourceRuleBadges,];
        }
    }
    if (__VLS_ctx.editingUser !== row.user && __VLS_ctx.rowOwnerResolutionBadges(row).length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-1 text-[11px]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        for (const [badge] of __VLS_vFor((__VLS_ctx.rowOwnerResolutionBadges(row)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (`${row.user}-${badge.text}`),
                ...{ class: "inline-flex items-center rounded-full border px-2 py-0.5 font-medium" },
                ...{ class: (badge.cls) },
                title: (badge.title),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (badge.text);
            // @ts-ignore
            [editingUser, rowOwnerResolutionBadges, rowOwnerResolutionBadges,];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "max-md:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['max-md:hidden']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "truncate inline-block max-w-[420px] opacity-70" },
        title: (row.keys),
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[420px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (row.keys);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.format(row.dl));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.format(row.ul));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.format(row.dl + row.ul));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono max-lg:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-lg:hidden']} */ ;
    if (__VLS_ctx.limitStates[row.user]?.trafficLimitBytes) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "whitespace-nowrap" },
            ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? '' : 'opacity-40') },
        });
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        (__VLS_ctx.format(__VLS_ctx.limitStates[row.user].usageBytes));
        (__VLS_ctx.format(__VLS_ctx.limitStates[row.user].trafficLimitBytes));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs opacity-60 flex items-center justify-end gap-1" },
            ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? '' : 'opacity-40') },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.limitStates[row.user].periodLabel);
        (__VLS_ctx.limitStates[row.user].percent);
        let __VLS_52;
        /** @ts-ignore @type {typeof __VLS_components.CircleStackIcon} */
        CircleStackIcon;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
            ...{ 'onMouseenter': {} },
            ...{ 'onMouseleave': {} },
            ...{ class: "h-4 w-4" },
            ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-info' : 'opacity-40') },
            title: (__VLS_ctx.trafficIconTitle(__VLS_ctx.limitStates[row.user].trafficLimitBytes, __VLS_ctx.rowLimit(row).trafficPeriod, __VLS_ctx.limitStates[row.user].enabled)),
        }));
        const __VLS_54 = __VLS_53({
            ...{ 'onMouseenter': {} },
            ...{ 'onMouseleave': {} },
            ...{ class: "h-4 w-4" },
            ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-info' : 'opacity-40') },
            title: (__VLS_ctx.trafficIconTitle(__VLS_ctx.limitStates[row.user].trafficLimitBytes, __VLS_ctx.rowLimit(row).trafficPeriod, __VLS_ctx.limitStates[row.user].enabled)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_53));
        let __VLS_57;
        const __VLS_58 = ({ mouseenter: {} },
            { onMouseenter: (...[$event]) => {
                    if (!(__VLS_ctx.limitStates[row.user]?.trafficLimitBytes))
                        return;
                    __VLS_ctx.showTip($event, __VLS_ctx.trafficIconTitle(__VLS_ctx.limitStates[row.user].trafficLimitBytes, __VLS_ctx.rowLimit(row).trafficPeriod, __VLS_ctx.limitStates[row.user].enabled));
                    // @ts-ignore
                    [trafficIconTitle, trafficIconTitle, showTip, format, format, format, format, format, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates, rowLimit, rowLimit,];
                } });
        const __VLS_59 = ({ mouseleave: {} },
            { onMouseleave: (__VLS_ctx.hideTip) });
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        var __VLS_55;
        var __VLS_56;
        if (__VLS_ctx.limitStates[row.user].bandwidthLimitBps) {
            let __VLS_60;
            /** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
            BoltIcon;
            // @ts-ignore
            const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-warning' : 'opacity-40') },
                title: (__VLS_ctx.bandwidthIconTitle(__VLS_ctx.limitStates[row.user].bandwidthLimitBps, __VLS_ctx.limitStates[row.user].enabled)),
            }));
            const __VLS_62 = __VLS_61({
                ...{ 'onMouseenter': {} },
                ...{ 'onMouseleave': {} },
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? 'text-warning' : 'opacity-40') },
                title: (__VLS_ctx.bandwidthIconTitle(__VLS_ctx.limitStates[row.user].bandwidthLimitBps, __VLS_ctx.limitStates[row.user].enabled)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_61));
            let __VLS_65;
            const __VLS_66 = ({ mouseenter: {} },
                { onMouseenter: (...[$event]) => {
                        if (!(__VLS_ctx.limitStates[row.user]?.trafficLimitBytes))
                            return;
                        if (!(__VLS_ctx.limitStates[row.user].bandwidthLimitBps))
                            return;
                        __VLS_ctx.showTip($event, __VLS_ctx.bandwidthIconTitle(__VLS_ctx.limitStates[row.user].bandwidthLimitBps, __VLS_ctx.limitStates[row.user].enabled));
                        // @ts-ignore
                        [showTip, hideTip, bandwidthIconTitle, bandwidthIconTitle, limitStates, limitStates, limitStates, limitStates, limitStates, limitStates,];
                    } });
            const __VLS_67 = ({ mouseleave: {} },
                { onMouseleave: (__VLS_ctx.hideTip) });
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            var __VLS_63;
            var __VLS_64;
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-50" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono max-lg:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-lg:hidden']} */ ;
    if (__VLS_ctx.limitStates[row.user]?.bandwidthLimitBps) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "whitespace-nowrap" },
            ...{ class: (__VLS_ctx.limitStates[row.user].enabled ? '' : 'opacity-40') },
        });
        /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
        (__VLS_ctx.speed(__VLS_ctx.limitStates[row.user].speedBps));
        (__VLS_ctx.speed(__VLS_ctx.limitStates[row.user].bandwidthLimitBps));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-50" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col items-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-xs w-[128px]" },
        value: (__VLS_ctx.qosDraftByUser[row.user]),
        disabled: (__VLS_ctx.applyingQosUser === row.user || !__VLS_ctx.rowHasEffectiveIps(row)),
        title: (__VLS_ctx.rowHasEffectiveIps(row) ? (__VLS_ctx.qosStatus.qosMode === 'wan-only' ? 'Safe QoS: только uplink/WAN' : '') : 'Не найден IP для применения QoS'),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-[128px]']} */ ;
    for (const [profile] of __VLS_vFor((__VLS_ctx.profileOrder))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (`qos-${row.user}-${profile}`),
            value: (profile),
        });
        (__VLS_ctx.profileLabel(profile));
        // @ts-ignore
        [qosStatus, hideTip, limitStates, limitStates, limitStates, limitStates, profileLabel, speed, speed, qosDraftByUser, applyingQosUser, rowHasEffectiveIps, rowHasEffectiveIps, profileOrder,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.applyUserQos(row);
                // @ts-ignore
                [applyUserQos,];
            } },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.applyingQosUser === row.user || !__VLS_ctx.rowHasEffectiveIps(row)),
        title: (__VLS_ctx.rowHasEffectiveIps(row) ? (__VLS_ctx.qosStatus.qosMode === 'wan-only' ? 'Safe QoS: только uplink/WAN' : '') : 'Не найден IP для применения QoS'),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('apply'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.clearUserQos(row);
                // @ts-ignore
                [$t, qosStatus, applyingQosUser, rowHasEffectiveIps, rowHasEffectiveIps, clearUserQos,];
            } },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs" },
        disabled: (__VLS_ctx.applyingQosUser === row.user || !row.currentQos),
        title: (__VLS_ctx.qosStatus.qosMode === 'wan-only' ? 'Очистить Safe QoS (uplink/WAN)' : ''),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('clear'));
    if (__VLS_ctx.qosStatus.qosMode === 'wan-only') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex max-w-[340px] flex-wrap justify-end gap-1 text-right" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[340px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info" },
        });
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-info/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-info/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-info']} */ ;
    }
    if (__VLS_ctx.rowRuntimeBadges(row).length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex max-w-[340px] flex-wrap justify-end gap-1 text-right" },
            title: (__VLS_ctx.rowRuntimeTitle(row)),
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[340px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        for (const [badge] of __VLS_vFor((__VLS_ctx.rowRuntimeBadges(row)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                key: (`${row.user}-${badge.text}`),
                ...{ class: "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium" },
                ...{ class: (badge.cls) },
                title: (badge.title || __VLS_ctx.rowRuntimeTitle(row)),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (badge.text);
            // @ts-ignore
            [$t, qosStatus, qosStatus, applyingQosUser, rowRuntimeBadges, rowRuntimeBadges, rowRuntimeTitle, rowRuntimeTitle,];
        }
    }
    if (__VLS_ctx.rowRuntimeMetaLine(row)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "max-w-[340px] text-[11px] leading-4 opacity-65 text-right" },
            title: (__VLS_ctx.rowRuntimeTitle(row)),
        });
        /** @type {__VLS_StyleScopedClasses['max-w-[340px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-65']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        (__VLS_ctx.rowRuntimeMetaLine(row));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right relative z-30 pointer-events-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['relative']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-30']} */ ;
    /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-end gap-1 pointer-events-auto" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
    if (__VLS_ctx.editingUser === row.user) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveEdit) },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
            disabled: (!__VLS_ctx.editingName.trim()),
            title: (__VLS_ctx.$t('save')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        let __VLS_68;
        /** @ts-ignore @type {typeof __VLS_components.CheckIcon} */
        CheckIcon;
        // @ts-ignore
        const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_70 = __VLS_69({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_69));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.cancelEdit) },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
            title: (__VLS_ctx.$t('cancel')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        let __VLS_73;
        /** @ts-ignore @type {typeof __VLS_components.XMarkIcon} */
        XMarkIcon;
        // @ts-ignore
        const __VLS_74 = __VLS_asFunctionalComponent1(__VLS_73, new __VLS_73({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_75 = __VLS_74({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_74));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    else {
        if (__VLS_ctx.shaperBadge[row.user]) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-center justify-center px-1" },
                title: (__VLS_ctx.shaperBadge[row.user].title),
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-1']} */ ;
            const __VLS_78 = (__VLS_ctx.shaperBadge[row.user].icon);
            // @ts-ignore
            const __VLS_79 = __VLS_asFunctionalComponent1(__VLS_78, new __VLS_78({
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.shaperBadge[row.user].cls) },
            }));
            const __VLS_80 = __VLS_79({
                ...{ class: "h-4 w-4" },
                ...{ class: (__VLS_ctx.shaperBadge[row.user].cls) },
            }, ...__VLS_functionalComponentArgsRest(__VLS_79));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            if (__VLS_ctx.shaperBadge[row.user].showReapply) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.editingUser === row.user))
                                return;
                            if (!(__VLS_ctx.shaperBadge[row.user]))
                                return;
                            if (!(__VLS_ctx.shaperBadge[row.user].showReapply))
                                return;
                            __VLS_ctx.reapplyShaper(row);
                            // @ts-ignore
                            [$t, $t, editingUser, editingName, rowRuntimeTitle, rowRuntimeMetaLine, rowRuntimeMetaLine, saveEdit, cancelEdit, shaperBadge, shaperBadge, shaperBadge, shaperBadge, shaperBadge, reapplyShaper,];
                        } },
                    ...{ onPointerdown: () => { } },
                    ...{ onMousedown: () => { } },
                    ...{ onTouchstart: () => { } },
                    type: "button",
                    ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
                    disabled: (__VLS_ctx.applyingShaperUser === row.user),
                    title: (__VLS_ctx.$t('reapply')),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['relative']} */ ;
                /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
                if (__VLS_ctx.applyingShaperUser === row.user) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "loading loading-spinner loading-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
                }
                else {
                    let __VLS_83;
                    /** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
                    ArrowPathIcon;
                    // @ts-ignore
                    const __VLS_84 = __VLS_asFunctionalComponent1(__VLS_83, new __VLS_83({
                        ...{ class: "h-4 w-4" },
                    }));
                    const __VLS_85 = __VLS_84({
                        ...{ class: "h-4 w-4" },
                    }, ...__VLS_functionalComponentArgsRest(__VLS_84));
                    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                }
            }
        }
        if (row.currentQos || __VLS_ctx.limitStates[row.user]?.bandwidthLimitBps) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.editingUser === row.user))
                            return;
                        if (!(row.currentQos || __VLS_ctx.limitStates[row.user]?.bandwidthLimitBps))
                            return;
                        __VLS_ctx.refreshRowRuntime(row);
                        // @ts-ignore
                        [$t, limitStates, applyingShaperUser, applyingShaperUser, refreshRowRuntime,];
                    } },
                ...{ onPointerdown: () => { } },
                ...{ onMousedown: () => { } },
                ...{ onTouchstart: () => { } },
                type: "button",
                ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
                disabled: (__VLS_ctx.refreshingRuntimeUser === row.user),
                title: (__VLS_ctx.$t('refresh')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
            if (__VLS_ctx.refreshingRuntimeUser === row.user) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "loading loading-spinner loading-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
            }
            else {
                let __VLS_88;
                /** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
                ArrowPathIcon;
                // @ts-ignore
                const __VLS_89 = __VLS_asFunctionalComponent1(__VLS_88, new __VLS_88({
                    ...{ class: "h-4 w-4 opacity-70" },
                }));
                const __VLS_90 = __VLS_89({
                    ...{ class: "h-4 w-4 opacity-70" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_89));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.editingUser === row.user))
                        return;
                    __VLS_ctx.openLimits(__VLS_ctx.rowLimitOwner(row), row.user);
                    // @ts-ignore
                    [$t, openLimits, refreshingRuntimeUser, refreshingRuntimeUser, rowLimitOwner,];
                } },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
            title: (__VLS_ctx.$t('limits')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        let __VLS_93;
        /** @ts-ignore @type {typeof __VLS_components.AdjustmentsHorizontalIcon} */
        AdjustmentsHorizontalIcon;
        // @ts-ignore
        const __VLS_94 = __VLS_asFunctionalComponent1(__VLS_93, new __VLS_93({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_95 = __VLS_94({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_94));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.editingUser === row.user))
                        return;
                    __VLS_ctx.startEdit(row.user);
                    // @ts-ignore
                    [$t, startEdit,];
                } },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
            title: (__VLS_ctx.$t('edit')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        let __VLS_98;
        /** @ts-ignore @type {typeof __VLS_components.PencilSquareIcon} */
        PencilSquareIcon;
        // @ts-ignore
        const __VLS_99 = __VLS_asFunctionalComponent1(__VLS_98, new __VLS_98({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_100 = __VLS_99({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_99));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.editingUser === row.user))
                        return;
                    __VLS_ctx.removeUser(row.user);
                    // @ts-ignore
                    [$t, removeUser,];
                } },
            ...{ onPointerdown: () => { } },
            ...{ onMousedown: () => { } },
            ...{ onTouchstart: () => { } },
            type: "button",
            ...{ class: "btn btn-ghost btn-circle btn-xs relative z-20" },
            disabled: (!__VLS_ctx.hasMapping(row.user)),
            title: (__VLS_ctx.$t('delete')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-20']} */ ;
        let __VLS_103;
        /** @ts-ignore @type {typeof __VLS_components.TrashIcon} */
        TrashIcon;
        // @ts-ignore
        const __VLS_104 = __VLS_asFunctionalComponent1(__VLS_103, new __VLS_103({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_105 = __VLS_104({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_104));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    // @ts-ignore
    [$t, hasMapping,];
}
if (!__VLS_ctx.rows.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "10",
        ...{ class: "text-center opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('noContent'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('userTrafficTip'));
(__VLS_ctx.$t('buckets'));
(__VLS_ctx.buckets);
const __VLS_108 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_109 = __VLS_asFunctionalComponent1(__VLS_108, new __VLS_108({
    modelValue: (__VLS_ctx.reportDialogOpen),
}));
const __VLS_110 = __VLS_109({
    modelValue: (__VLS_ctx.reportDialogOpen),
}, ...__VLS_functionalComponentArgsRest(__VLS_109));
const { default: __VLS_113 } = __VLS_111.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2 mb-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('reports'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70 font-mono" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.reportRangeLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-2 sm:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex flex-col gap-1 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('groupBy'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm" },
    value: (__VLS_ctx.reportGroupBy),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "day",
});
(__VLS_ctx.$t('day'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "week",
});
(__VLS_ctx.$t('week'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "month",
});
(__VLS_ctx.$t('month'));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex flex-col gap-1 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('user'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm" },
    value: (__VLS_ctx.reportUser),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
(__VLS_ctx.$t('allUsers'));
for (const [u] of __VLS_vFor((__VLS_ctx.reportUsers))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (u),
        value: (u),
    });
    (u);
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, reportDialogOpen, rows, buckets, reportRangeLabel, reportGroupBy, reportUser, reportUsers,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex items-center justify-between gap-2 sm:pt-6" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:pt-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-sm opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('skipEmpty'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.reportSkipEmpty);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-end gap-2 mt-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportTableCsv) },
    type: "button",
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('exportTableCsv'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportReportCsv) },
    type: "button",
    ...{ class: "btn btn-sm btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
(__VLS_ctx.$t('exportReportCsv'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 overflow-x-auto max-h-[52vh]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[52vh]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "table table-sm" },
});
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('period'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
(__VLS_ctx.$t('user'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.$t('download'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.$t('upload'));
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "text-right" },
});
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
(__VLS_ctx.$t('total'));
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
for (const [r] of __VLS_vFor((__VLS_ctx.reportPreviewRows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (r.period + '|' + r.user),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "font-mono whitespace-nowrap" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    (r.period);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "truncate max-w-[320px]" },
        title: (r.user),
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[320px]']} */ ;
    (r.user);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.format(r.dl));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.format(r.ul));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "text-right font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.format(r.dl + r.ul));
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, $t, $t, format, format, format, reportSkipEmpty, exportTableCsv, exportReportCsv, reportPreviewRows,];
}
if (!__VLS_ctx.reportPreviewRows.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "5",
        ...{ class: "text-center opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('noContent'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('reportRows'));
(__VLS_ctx.reportRowsCount);
if (__VLS_ctx.reportPreviewLimited) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('previewLimited'));
}
// @ts-ignore
[$t, $t, $t, reportPreviewRows, reportRowsCount, reportPreviewLimited,];
var __VLS_111;
const __VLS_114 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_115 = __VLS_asFunctionalComponent1(__VLS_114, new __VLS_114({
    modelValue: (__VLS_ctx.limitsDialogOpen),
}));
const __VLS_116 = __VLS_115({
    modelValue: (__VLS_ctx.limitsDialogOpen),
}, ...__VLS_functionalComponentArgsRest(__VLS_115));
const { default: __VLS_119 } = __VLS_117.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2 mb-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-base font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-base']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('limits'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col items-end max-w-[60%]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[60%]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-70 truncate" },
    title: (__VLS_ctx.limitsUserDisplay || __VLS_ctx.limitsUser),
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
(__VLS_ctx.limitsUserDisplay || __VLS_ctx.limitsUser);
if (__VLS_ctx.limitsUserDisplay && __VLS_ctx.limitsUserDisplay !== __VLS_ctx.limitsUser) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-[11px] opacity-50 truncate" },
        title: (__VLS_ctx.limitsUser),
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (__VLS_ctx.limitsUser);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid grid-cols-1 gap-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
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
(__VLS_ctx.$t('enabled'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.draftEnabled);
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
(__VLS_ctx.$t('blocked'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle" },
});
(__VLS_ctx.draftDisabled);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('routerAgent'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({
    ...{ class: "text-xs px-2 py-1 rounded bg-base-200" },
    ...{ class: (__VLS_ctx.draftMac ? '' : 'opacity-50') },
    title: (__VLS_ctx.draftMac || ''),
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
(__VLS_ctx.draftMac || '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshMac) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs" },
    disabled: (!__VLS_ctx.agentRuntimeReady),
    title: (__VLS_ctx.$t('rebindMac')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
let __VLS_120;
/** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
ArrowPathIcon;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent1(__VLS_120, new __VLS_120({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.macLoading ? 'animate-spin' : '') },
}));
const __VLS_122 = __VLS_121({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.macLoading ? 'animate-spin' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshMacAndApply) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs" },
    disabled: (!__VLS_ctx.agentRuntimeReady),
    title: (__VLS_ctx.$t('rebindMacApply')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
let __VLS_125;
/** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
ArrowPathIcon;
// @ts-ignore
const __VLS_126 = __VLS_asFunctionalComponent1(__VLS_125, new __VLS_125({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.macApplyLoading ? 'animate-spin' : '') },
}));
const __VLS_127 = __VLS_126({
    ...{ class: "h-4 w-4" },
    ...{ class: (__VLS_ctx.macApplyLoading ? 'animate-spin' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_126));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
let __VLS_130;
/** @ts-ignore @type {typeof __VLS_components.CheckIcon} */
CheckIcon;
// @ts-ignore
const __VLS_131 = __VLS_asFunctionalComponent1(__VLS_130, new __VLS_130({
    ...{ class: "h-4 w-4" },
}));
const __VLS_132 = __VLS_131({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_131));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearMac) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs" },
    disabled: (!__VLS_ctx.draftMac),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
(__VLS_ctx.$t('clear'));
if (__VLS_ctx.macCandidates.length > 1) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ class: "select select-sm" },
        value: (__VLS_ctx.draftMac),
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
    for (const [m] of __VLS_vFor((__VLS_ctx.macCandidates))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (m),
            value: (m),
        });
        (m);
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, agentRuntimeReady, agentRuntimeReady, limitsDialogOpen, limitsUserDisplay, limitsUserDisplay, limitsUserDisplay, limitsUserDisplay, limitsUser, limitsUser, limitsUser, limitsUser, limitsUser, draftEnabled, draftDisabled, draftMac, draftMac, draftMac, draftMac, draftMac, refreshMac, macLoading, refreshMacAndApply, macApplyLoading, clearMac, macCandidates, macCandidates,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('multipleMacsFound'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "divider my-0" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['my-0']} */ ;
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
    disabled: (!__VLS_ctx.draftEnabled),
});
(__VLS_ctx.draftTrafficValue);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-sm w-20" },
    value: (__VLS_ctx.draftTrafficUnit),
    disabled: (!__VLS_ctx.draftEnabled),
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
    value: (__VLS_ctx.draftPeriod),
    disabled: (!__VLS_ctx.draftEnabled),
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
    disabled: (!__VLS_ctx.draftEnabled),
});
(__VLS_ctx.draftBandwidthMbps);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('bandwidthLimitTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('autoDisconnectLimitedUsers'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-sm" },
});
(__VLS_ctx.autoDisconnectLimitedUsers);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('hardBlockLimitedUsers'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-sm" },
});
(__VLS_ctx.hardBlockLimitedUsers);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetCounter) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.draftEnabled),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('resetUsage'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearLimits) },
    type: "button",
    ...{ class: "btn btn-ghost btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('clearLimits'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.saveLimits) },
    type: "button",
    ...{ class: "btn btn-primary btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('save'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('limitsEnforcementNote'));
// @ts-ignore
[$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, draftEnabled, draftEnabled, draftEnabled, draftEnabled, draftEnabled, draftTrafficValue, draftTrafficUnit, draftPeriod, draftBandwidthMbps, autoDisconnectLimitedUsers, hardBlockLimitedUsers, resetCounter, clearLimits, saveLimits,];
var __VLS_117;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
