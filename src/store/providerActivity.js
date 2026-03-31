import { computed, ref, watch } from 'vue';
import { getNowProxyNodeName, proxyMap, proxyProviederList } from '@/store/proxies';
import { activeConnections, closedConnections } from '@/store/connections';
import { debounce, throttle } from 'lodash';
import { agentProviderTrafficGetAPI, agentProviderTrafficPutAPI } from '@/api/agent';
import { decodeB64Utf8 } from '@/helper/b64';
import { agentEnabled } from '@/store/agent';
const FALLBACK_SPEED_MULTIPLIER = 1;
const REMOTE_SCHEMA_VERSION = 1;
const REMOTE_PUSH_DEBOUNCE_MS = 15_000;
const REMOTE_PULL_INTERVAL_MS = 90_000;
const REMOTE_PUSH_INTERVAL_MS = 75_000;
const REMOTE_HIDDEN_PUSH_THROTTLE_MS = 20_000;
const STORAGE_KEY = 'stats/provider-traffic-session-v7';
const DAILY_STORAGE_KEY = 'stats/provider-traffic-daily-v6';
const CONN_TOTALS_STORAGE_KEY = 'stats/provider-traffic-conn-baselines-v6';
const SESSION_RESET_STORAGE_KEY = 'stats/provider-traffic-session-reset-at-v1';
const MAX_PERSISTED_CONN_TOTALS = 5000;
const trafficTotals = ref({});
const dailyTrafficTotals = ref({});
const connTotals = new Map();
const providerActivityCurrent = ref({});
const sessionResetAt = ref(0);
const providerTrafficRemoteRev = ref(0);
const providerTrafficRemoteUpdatedAt = ref('');
let lastTickAt = Date.now();
let providerTrafficSyncStarted = false;
let providerTrafficRemoteBootstrapped = false;
let providerTrafficPullInFlight = false;
let providerTrafficPushInFlight = false;
let providerTrafficSuppressRemotePush = 0;
let providerTrafficLocalDirty = false;
let providerTrafficLastPullAt = 0;
let providerTrafficLastPushAt = 0;
let providerTrafficLastHiddenPushAt = 0;
const pad2 = (v) => String(v).padStart(2, '0');
const localDayKeyFromDate = (value) => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
const todayKey = () => localDayKeyFromDate(new Date());
const isLocalToday = (value) => {
    if (!value)
        return false;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime()))
        return false;
    return localDayKeyFromDate(date) === todayKey();
};
const safeParse = (raw, fallback) => {
    if (!raw)
        return fallback;
    try {
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object' ? parsed : fallback);
    }
    catch {
        return fallback;
    }
};
const normalizeTrafficTotals = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        const name = String(key || '').trim();
        if (!name)
            continue;
        const dl = Number(value?.dl ?? value?.download ?? 0);
        const ul = Number(value?.ul ?? value?.upload ?? 0);
        const updatedAt = Number(value?.updatedAt ?? 0);
        out[name] = {
            dl: Number.isFinite(dl) && dl >= 0 ? dl : 0,
            ul: Number.isFinite(ul) && ul >= 0 ? ul : 0,
            updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : undefined,
        };
    }
    return out;
};
const normalizeConnEntry = (value) => {
    if (!value || typeof value !== 'object')
        return null;
    const provider = String(value?.provider || '').trim();
    if (!provider)
        return null;
    const dl = Number(value?.dl ?? 0);
    const ul = Number(value?.ul ?? 0);
    const start = String(value?.start || '').trim();
    const seenAt = Number(value?.seenAt ?? 0);
    return {
        provider,
        dl: Number.isFinite(dl) && dl >= 0 ? dl : 0,
        ul: Number.isFinite(ul) && ul >= 0 ? ul : 0,
        start: start || undefined,
        seenAt: Number.isFinite(seenAt) && seenAt > 0 ? seenAt : undefined,
    };
};
const normalizeConnEntries = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return {};
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        const id = String(key || '').trim();
        if (!id)
            continue;
        const entry = normalizeConnEntry(value);
        if (!entry)
            continue;
        out[id] = entry;
    }
    return out;
};
const normalizeDailyStore = (raw) => {
    const day = todayKey();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return { day, totals: {} };
    const incomingDay = String(raw?.day || '').trim() || day;
    return {
        day: incomingDay,
        totals: normalizeTrafficTotals(raw?.totals),
    };
};
const normalizeRemotePayload = (raw) => {
    const day = todayKey();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            version: REMOTE_SCHEMA_VERSION,
            sessionResetAt: 0,
            sessionTotals: {},
            daily: { day, totals: {} },
            connTotals: { entries: {} },
        };
    }
    return {
        version: Number(raw?.version ?? REMOTE_SCHEMA_VERSION) || REMOTE_SCHEMA_VERSION,
        sessionResetAt: Number(raw?.sessionResetAt ?? 0) || 0,
        sessionTotals: normalizeTrafficTotals(raw?.sessionTotals),
        daily: normalizeDailyStore(raw?.daily),
        connTotals: { entries: normalizeConnEntries(raw?.connTotals?.entries) },
    };
};
const mergeTrafficTotals = (left, right) => {
    const out = {};
    const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    for (const key of keys) {
        const a = left?.[key];
        const b = right?.[key];
        out[key] = {
            dl: Math.max(Number(a?.dl ?? 0) || 0, Number(b?.dl ?? 0) || 0),
            ul: Math.max(Number(a?.ul ?? 0) || 0, Number(b?.ul ?? 0) || 0),
            updatedAt: Math.max(Number(a?.updatedAt ?? 0) || 0, Number(b?.updatedAt ?? 0) || 0) || undefined,
        };
    }
    return out;
};
const pickNewerConnEntry = (left, right) => {
    const leftSeen = Number(left?.seenAt ?? 0) || 0;
    const rightSeen = Number(right?.seenAt ?? 0) || 0;
    if (rightSeen > leftSeen)
        return right;
    if (leftSeen > rightSeen)
        return left;
    const leftBytes = (Number(left?.dl ?? 0) || 0) + (Number(left?.ul ?? 0) || 0);
    const rightBytes = (Number(right?.dl ?? 0) || 0) + (Number(right?.ul ?? 0) || 0);
    return rightBytes >= leftBytes ? right : left;
};
const mergeConnEntries = (left, right) => {
    const merged = new Map();
    const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})]);
    for (const key of keys) {
        const a = left?.[key];
        const b = right?.[key];
        if (!a && b) {
            merged.set(key, b);
            continue;
        }
        if (a && !b) {
            merged.set(key, a);
            continue;
        }
        if (!a || !b)
            continue;
        if ((a.start || '') === (b.start || '') && a.provider === b.provider) {
            merged.set(key, {
                provider: a.provider || b.provider,
                start: a.start || b.start,
                dl: Math.max(Number(a.dl || 0), Number(b.dl || 0)),
                ul: Math.max(Number(a.ul || 0), Number(b.ul || 0)),
                seenAt: Math.max(Number(a.seenAt || 0), Number(b.seenAt || 0)) || undefined,
            });
            continue;
        }
        merged.set(key, pickNewerConnEntry(a, b));
    }
    return Object.fromEntries(Array.from(merged.entries())
        .sort((a, b) => (Number(b[1]?.seenAt ?? 0) || 0) - (Number(a[1]?.seenAt ?? 0) || 0))
        .slice(0, MAX_PERSISTED_CONN_TOTALS));
};
const serializeConnTotalsEntries = () => {
    const out = {};
    const sorted = Array.from(connTotals.entries())
        .sort((a, b) => (Number(b[1]?.seenAt ?? 0) || 0) - (Number(a[1]?.seenAt ?? 0) || 0))
        .slice(0, MAX_PERSISTED_CONN_TOTALS);
    for (const [key, value] of sorted) {
        out[key] = {
            provider: value.provider,
            dl: Number(value.dl || 0) || 0,
            ul: Number(value.ul || 0) || 0,
            start: value.start || undefined,
            seenAt: Number(value.seenAt || 0) || undefined,
        };
    }
    return out;
};
const replaceConnTotalsFromEntries = (entries) => {
    connTotals.clear();
    for (const [key, value] of Object.entries(entries || {})) {
        connTotals.set(key, value);
    }
};
const loadTrafficTotals = () => {
    if (typeof localStorage === 'undefined')
        return;
    trafficTotals.value = normalizeTrafficTotals(safeParse(localStorage.getItem(STORAGE_KEY), {}));
};
const loadDailyTrafficTotals = () => {
    if (typeof localStorage === 'undefined')
        return;
    const parsed = normalizeDailyStore(safeParse(localStorage.getItem(DAILY_STORAGE_KEY), { day: todayKey(), totals: {} }));
    if (parsed.day !== todayKey()) {
        dailyTrafficTotals.value = {};
        return;
    }
    dailyTrafficTotals.value = parsed.totals || {};
};
const loadConnTotals = () => {
    connTotals.clear();
    if (typeof localStorage === 'undefined')
        return;
    const parsed = safeParse(localStorage.getItem(CONN_TOTALS_STORAGE_KEY), { entries: {} });
    for (const [id, entry] of Object.entries(normalizeConnEntries(parsed.entries || {}))) {
        connTotals.set(id, entry);
    }
};
const loadSessionResetAt = () => {
    if (typeof localStorage === 'undefined')
        return;
    const raw = Number(localStorage.getItem(SESSION_RESET_STORAGE_KEY) || 0);
    sessionResetAt.value = Number.isFinite(raw) && raw > 0 ? raw : 0;
};
const saveTrafficTotals = debounce(() => {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trafficTotals.value || {}));
    }
    catch {
        // ignore
    }
}, 1500);
const saveDailyTrafficTotals = debounce(() => {
    if (typeof localStorage === 'undefined')
        return;
    try {
        const payload = { day: todayKey(), totals: dailyTrafficTotals.value || {} };
        localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(payload));
    }
    catch {
        // ignore
    }
}, 1500);
const saveConnTotals = debounce(() => {
    if (typeof localStorage === 'undefined')
        return;
    try {
        localStorage.setItem(CONN_TOTALS_STORAGE_KEY, JSON.stringify({ entries: serializeConnTotalsEntries() }));
    }
    catch {
        // ignore
    }
}, 1500);
const saveSessionResetAt = () => {
    if (typeof localStorage === 'undefined')
        return;
    try {
        if (sessionResetAt.value > 0)
            localStorage.setItem(SESSION_RESET_STORAGE_KEY, String(sessionResetAt.value));
        else
            localStorage.removeItem(SESSION_RESET_STORAGE_KEY);
    }
    catch {
        // ignore
    }
};
const emptyActivity = () => ({
    connections: 0,
    active: false,
    bytes: 0,
    speed: 0,
    activeProxy: '',
    activeProxyBytes: 0,
    currentBytes: 0,
    download: 0,
    upload: 0,
    todayBytes: 0,
    todayDownload: 0,
    todayUpload: 0,
    updatedAt: undefined,
});
const buildRemotePayload = () => ({
    version: REMOTE_SCHEMA_VERSION,
    sessionResetAt: Number(sessionResetAt.value || 0) || 0,
    sessionTotals: normalizeTrafficTotals(trafficTotals.value || {}),
    daily: { day: todayKey(), totals: normalizeTrafficTotals(dailyTrafficTotals.value || {}) },
    connTotals: { entries: serializeConnTotalsEntries() },
});
const syncStoredTotalsIntoCurrent = () => {
    const next = { ...(providerActivityCurrent.value || {}) };
    const keys = new Set([
        ...Object.keys(next),
        ...Object.keys(trafficTotals.value || {}),
        ...Object.keys(dailyTrafficTotals.value || {}),
        ...((proxyProviederList.value || []).map((provider) => String(provider?.name || '').trim()).filter(Boolean)),
    ]);
    for (const providerName of keys) {
        const rec = next[providerName] || emptyActivity();
        const totals = trafficTotals.value[providerName];
        const daily = dailyTrafficTotals.value[providerName];
        rec.download = Number(totals?.dl ?? 0) || 0;
        rec.upload = Number(totals?.ul ?? 0) || 0;
        rec.bytes = rec.download + rec.upload;
        rec.todayDownload = Number(daily?.dl ?? 0) || 0;
        rec.todayUpload = Number(daily?.ul ?? 0) || 0;
        rec.todayBytes = rec.todayDownload + rec.todayUpload;
        rec.updatedAt = Math.max(Number(totals?.updatedAt ?? 0) || 0, Number(daily?.updatedAt ?? 0) || 0) || undefined;
        next[providerName] = rec;
    }
    providerActivityCurrent.value = next;
};
const applyRemotePayload = (raw) => {
    const payload = normalizeRemotePayload(raw);
    const remoteResetAt = Number(payload.sessionResetAt || 0) || 0;
    const localResetAt = Number(sessionResetAt.value || 0) || 0;
    const mergedSession = remoteResetAt > localResetAt
        ? normalizeTrafficTotals(payload.sessionTotals || {})
        : localResetAt > remoteResetAt
            ? normalizeTrafficTotals(trafficTotals.value || {})
            : mergeTrafficTotals(trafficTotals.value || {}, payload.sessionTotals || {});
    const mergedDaily = payload.daily.day === todayKey()
        ? mergeTrafficTotals(dailyTrafficTotals.value || {}, payload.daily.totals || {})
        : normalizeTrafficTotals(dailyTrafficTotals.value || {});
    const mergedConnEntries = mergeConnEntries(serializeConnTotalsEntries(), payload.connTotals?.entries || {});
    providerTrafficSuppressRemotePush += 1;
    sessionResetAt.value = Math.max(localResetAt, remoteResetAt);
    saveSessionResetAt();
    trafficTotals.value = mergedSession;
    dailyTrafficTotals.value = mergedDaily;
    replaceConnTotalsFromEntries(mergedConnEntries);
    saveTrafficTotals();
    saveDailyTrafficTotals();
    saveConnTotals();
    syncStoredTotalsIntoCurrent();
};
const pushProviderTrafficRemoteNow = async () => {
    if (!agentEnabled.value || providerTrafficPushInFlight || providerTrafficPullInFlight)
        return;
    if (!providerTrafficRemoteBootstrapped)
        return;
    if (!providerTrafficLocalDirty)
        return;
    providerTrafficPushInFlight = true;
    try {
        const body = JSON.stringify(buildRemotePayload());
        const res = await agentProviderTrafficPutAPI({
            rev: Number(providerTrafficRemoteRev.value || 0),
            content: body,
        });
        if (res?.ok) {
            providerTrafficRemoteRev.value = Number(res.rev ?? providerTrafficRemoteRev.value + 1) || providerTrafficRemoteRev.value + 1;
            providerTrafficRemoteUpdatedAt.value = String(res.updatedAt || '').trim();
            providerTrafficLocalDirty = false;
            providerTrafficLastPushAt = Date.now();
            return;
        }
        if (res?.error === 'conflict') {
            const remoteRev = Number(res.rev ?? providerTrafficRemoteRev.value) || providerTrafficRemoteRev.value;
            providerTrafficRemoteRev.value = remoteRev;
            providerTrafficRemoteUpdatedAt.value = String(res.updatedAt || '').trim();
            const content = decodeB64Utf8(String(res.contentB64 || ''));
            const parsed = content ? safeParse(content, buildRemotePayload()) : buildRemotePayload();
            applyRemotePayload(parsed);
            const retryBody = JSON.stringify(buildRemotePayload());
            const retry = await agentProviderTrafficPutAPI({ rev: remoteRev, content: retryBody });
            if (retry?.ok) {
                providerTrafficRemoteRev.value = Number(retry.rev ?? remoteRev + 1) || remoteRev + 1;
                providerTrafficRemoteUpdatedAt.value = String(retry.updatedAt || '').trim();
                providerTrafficLocalDirty = false;
                providerTrafficLastPushAt = Date.now();
            }
        }
    }
    finally {
        providerTrafficPushInFlight = false;
    }
};
const scheduleProviderTrafficRemotePush = debounce(() => {
    pushProviderTrafficRemoteNow();
}, REMOTE_PUSH_DEBOUNCE_MS);
const markProviderTrafficDirty = () => {
    if (providerTrafficSuppressRemotePush > 0) {
        providerTrafficSuppressRemotePush -= 1;
        return;
    }
    providerTrafficLocalDirty = true;
    scheduleProviderTrafficRemotePush();
};
const pullProviderTrafficRemote = async () => {
    if (!agentEnabled.value || providerTrafficPullInFlight)
        return;
    providerTrafficPullInFlight = true;
    try {
        const res = await agentProviderTrafficGetAPI();
        if (!res?.ok)
            return;
        providerTrafficRemoteRev.value = Number(res.rev ?? 0) || 0;
        providerTrafficRemoteUpdatedAt.value = String(res.updatedAt || '').trim();
        providerTrafficLastPullAt = Date.now();
        const content = decodeB64Utf8(String(res.contentB64 || ''));
        const parsed = content ? safeParse(content, buildRemotePayload()) : buildRemotePayload();
        applyRemotePayload(parsed);
        providerTrafficRemoteBootstrapped = true;
        if (providerTrafficLocalDirty)
            scheduleProviderTrafficRemotePush();
    }
    finally {
        providerTrafficPullInFlight = false;
    }
};
export const initProviderTrafficSync = () => {
    if (providerTrafficSyncStarted || typeof window === 'undefined')
        return;
    providerTrafficSyncStarted = true;
    watch(agentEnabled, async (enabled) => {
        if (!enabled) {
            providerTrafficRemoteBootstrapped = false;
            return;
        }
        await pullProviderTrafficRemote();
        providerTrafficRemoteBootstrapped = true;
        if (providerTrafficLocalDirty)
            scheduleProviderTrafficRemotePush();
    }, { immediate: true });
    window.setInterval(() => {
        if (!agentEnabled.value)
            return;
        if (providerTrafficPullInFlight || providerTrafficPushInFlight)
            return;
        if (Date.now() - providerTrafficLastPullAt < REMOTE_PULL_INTERVAL_MS)
            return;
        pullProviderTrafficRemote();
    }, 30_000);
    window.setInterval(() => {
        if (!agentEnabled.value)
            return;
        if (!providerTrafficLocalDirty)
            return;
        if (providerTrafficPullInFlight || providerTrafficPushInFlight)
            return;
        if (!providerTrafficRemoteBootstrapped)
            return;
        if (Date.now() - providerTrafficLastPushAt < REMOTE_PUSH_INTERVAL_MS)
            return;
        pushProviderTrafficRemoteNow();
    }, 20_000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'hidden')
            return;
        if (!agentEnabled.value || !providerTrafficLocalDirty)
            return;
        if (Date.now() - providerTrafficLastHiddenPushAt < REMOTE_HIDDEN_PUSH_THROTTLE_MS)
            return;
        providerTrafficLastHiddenPushAt = Date.now();
        pushProviderTrafficRemoteNow();
    });
};
loadTrafficTotals();
loadDailyTrafficTotals();
loadConnTotals();
loadSessionResetAt();
export const providerProxyNames = (provider) => {
    const raw = provider?.proxies;
    const items = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
    return items
        .map((node) => (typeof node === 'string' ? node : node?.name))
        .map((name) => String(name || '').trim())
        .filter(Boolean);
};
const pushCandidate = (out, value) => {
    const name = String(value || '').trim();
    if (name)
        out.push(name);
};
const pushCandidateList = (out, value, reverse = false) => {
    const arr = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? Object.values(value)
            : [];
    const items = reverse ? [...arr].reverse() : arr;
    for (const item of items)
        pushCandidate(out, item);
};
export const connectionProviderCandidates = (conn) => {
    const candidates = [];
    pushCandidateList(candidates, conn?.providerChains, true);
    pushCandidateList(candidates, conn?.metadata?.providerChains, true);
    pushCandidate(candidates, conn?.provider);
    pushCandidate(candidates, conn?.providerName);
    pushCandidate(candidates, conn?.['provider-name']);
    pushCandidate(candidates, conn?.metadata?.provider);
    pushCandidate(candidates, conn?.metadata?.providerName);
    pushCandidate(candidates, conn?.metadata?.['provider-name']);
    const out = [];
    const seen = new Set();
    for (const name of candidates) {
        if (!name || seen.has(name))
            continue;
        seen.add(name);
        out.push(name);
    }
    return out;
};
export const connectionProxyCandidates = (conn) => {
    const candidates = [];
    const specialProxy = String(conn?.metadata?.specialProxy || '').trim();
    if (specialProxy)
        candidates.push(specialProxy);
    pushCandidate(candidates, conn?.metadata?.proxy);
    pushCandidate(candidates, conn?.metadata?.proxyName);
    pushCandidate(candidates, conn?.metadata?.['proxy-name']);
    const chains = Array.isArray(conn?.chains) ? conn.chains : [];
    for (let i = chains.length - 1; i >= 0; i--) {
        const name = String(chains[i] || '').trim();
        if (name)
            candidates.push(name);
    }
    const out = [];
    const seen = new Set();
    for (const name of candidates) {
        if (!name || seen.has(name))
            continue;
        seen.add(name);
        out.push(name);
    }
    return out;
};
const resolvedProxyCandidateNames = (name) => {
    const out = [];
    const seen = new Set();
    const push = (value) => {
        const next = String(value || '').trim();
        if (!next || seen.has(next))
            return;
        seen.add(next);
        out.push(next);
    };
    const candidate = String(name || '').trim();
    if (!candidate)
        return out;
    push(candidate);
    const node = (proxyMap.value || {})[candidate];
    if (node?.now)
        push(node.now);
    try {
        push(getNowProxyNodeName(candidate));
    }
    catch {
        // ignore
    }
    if (node?.now) {
        try {
            push(getNowProxyNodeName(String(node.now || '').trim()));
        }
        catch {
            // ignore
        }
    }
    return out;
};
export const connectionMatchesProviderProxyNames = (conn, proxyNames) => {
    const set = proxyNames instanceof Set ? proxyNames : new Set(Array.from(proxyNames || []));
    for (const proxyName of connectionProxyCandidates(conn)) {
        for (const alias of resolvedProxyCandidateNames(proxyName)) {
            if (set.has(alias))
                return alias;
        }
        const node = (proxyMap.value || {})[String(proxyName || '').trim()];
        const members = Array.isArray(node?.all) ? node.all : [];
        if (!members.length || members.length > 16)
            continue;
        for (const member of members) {
            const candidate = String(member || '').trim();
            if (!candidate)
                continue;
            if (set.has(candidate))
                return candidate;
            try {
                const resolved = getNowProxyNodeName(candidate);
                if (set.has(resolved))
                    return resolved;
            }
            catch {
                // ignore
            }
        }
    }
    return '';
};
export const connectionMatchesProvider = (conn, providerName, proxyNames) => {
    const provider = String(providerName || '').trim();
    if (provider) {
        const providerCandidates = connectionProviderCandidates(conn);
        for (const candidate of providerCandidates) {
            if (candidate === provider)
                return connectionProxyCandidates(conn)[0] || provider;
        }
    }
    return connectionMatchesProviderProxyNames(conn, proxyNames);
};
watch([activeConnections, closedConnections, proxyProviederList], ([list, closedList, providers]) => {
    if (todayKey() !== safeParse(typeof localStorage === 'undefined' ? null : localStorage.getItem(DAILY_STORAGE_KEY), { day: todayKey(), totals: {} }).day) {
        dailyTrafficTotals.value = {};
        saveDailyTrafficTotals();
        markProviderTrafficDirty();
    }
    const now = Date.now();
    const dt = Math.max(1, (now - lastTickAt) / 1000);
    lastTickAt = now;
    const current = {};
    const providerProxySets = new Map();
    const liveCurrentByProvider = {};
    const liveTodayByProvider = {};
    for (const p of providers || []) {
        const providerName = String(p?.name || '').trim();
        if (!providerName)
            continue;
        current[providerName] = emptyActivity();
        providerProxySets.set(providerName, new Set(providerProxyNames(p)));
    }
    const perProxyBytes = {};
    const seen = new Set();
    let totalsChanged = false;
    let dailyChanged = false;
    let connTotalsChanged = false;
    const processConnection = (c, mode) => {
        const id = String(c?.id || '').trim();
        if (!id)
            return;
        const curDl = Number(c?.download ?? 0) || 0;
        const curUl = Number(c?.upload ?? 0) || 0;
        const curSpeedDl = mode === 'active' ? (Number(c?.downloadSpeed ?? 0) || 0) : 0;
        const curSpeedUl = mode === 'active' ? (Number(c?.uploadSpeed ?? 0) || 0) : 0;
        const curSpeed = curSpeedDl + curSpeedUl;
        const curBytes = curDl + curUl;
        const start = String(c?.start || '');
        for (const [providerName, proxyNames] of providerProxySets.entries()) {
            if (!proxyNames.size)
                continue;
            const proxyName = connectionMatchesProvider(c, providerName, proxyNames);
            if (!proxyName)
                continue;
            const seenKey = `${providerName}\u0000${id}`;
            if (seen.has(seenKey))
                continue;
            seen.add(seenKey);
            const rec = current[providerName] || (current[providerName] = emptyActivity());
            if (mode === 'active') {
                rec.connections += 1;
                rec.currentBytes += curBytes;
                rec.speed += curSpeed;
                rec.active = true;
                const liveTotals = liveCurrentByProvider[providerName] || { dl: 0, ul: 0 };
                liveTotals.dl += curDl;
                liveTotals.ul += curUl;
                liveCurrentByProvider[providerName] = liveTotals;
                if (isLocalToday(start)) {
                    const todayLiveTotals = liveTodayByProvider[providerName] || { dl: 0, ul: 0 };
                    todayLiveTotals.dl += curDl;
                    todayLiveTotals.ul += curUl;
                    liveTodayByProvider[providerName] = todayLiveTotals;
                }
                const proxyKey = `${providerName}|${proxyName}`;
                perProxyBytes[proxyKey] = (perProxyBytes[proxyKey] || 0) + curBytes;
            }
            let prev = connTotals.get(seenKey);
            if (prev && prev.start && start && prev.start !== start)
                prev = undefined;
            let dDl = 0;
            let dUl = 0;
            if (prev) {
                dDl = curDl - (prev.dl || 0);
                dUl = curUl - (prev.ul || 0);
            }
            else if (isLocalToday(start)) {
                dDl = curDl;
                dUl = curUl;
            }
            if (!Number.isFinite(dDl) || dDl < 0)
                dDl = 0;
            if (!Number.isFinite(dUl) || dUl < 0)
                dUl = 0;
            if (mode === 'active' && dDl <= 0 && dUl <= 0 && (curSpeedDl > 0 || curSpeedUl > 0)) {
                dDl = Math.max(0, curSpeedDl * dt * FALLBACK_SPEED_MULTIPLIER);
                dUl = Math.max(0, curSpeedUl * dt * FALLBACK_SPEED_MULTIPLIER);
            }
            if (dDl > 0 || dUl > 0) {
                const totals = trafficTotals.value[providerName] || { dl: 0, ul: 0 };
                const nextDl = (Number(totals.dl || 0) || 0) + dDl;
                const nextUl = (Number(totals.ul || 0) || 0) + dUl;
                if (nextDl !== totals.dl || nextUl !== totals.ul)
                    totalsChanged = true;
                totals.dl = nextDl;
                totals.ul = nextUl;
                totals.updatedAt = now;
                trafficTotals.value[providerName] = totals;
                const daily = dailyTrafficTotals.value[providerName] || { dl: 0, ul: 0 };
                const nextDailyDl = (Number(daily.dl || 0) || 0) + dDl;
                const nextDailyUl = (Number(daily.ul || 0) || 0) + dUl;
                if (nextDailyDl !== daily.dl || nextDailyUl !== daily.ul)
                    dailyChanged = true;
                daily.dl = nextDailyDl;
                daily.ul = nextDailyUl;
                daily.updatedAt = now;
                dailyTrafficTotals.value[providerName] = daily;
            }
            const prevConn = connTotals.get(seenKey);
            if (!prevConn || prevConn.dl !== curDl || prevConn.ul !== curUl || prevConn.start !== (start || undefined) || prevConn.provider !== providerName) {
                connTotalsChanged = true;
            }
            connTotals.set(seenKey, { provider: providerName, dl: curDl, ul: curUl, start: start || undefined, seenAt: now });
        }
    };
    for (const c of list || [])
        processConnection(c, 'active');
    for (const c of closedList || [])
        processConnection(c, 'closed');
    for (const id of Array.from(connTotals.keys())) {
        if (!seen.has(id)) {
            connTotals.delete(id);
            connTotalsChanged = true;
        }
    }
    for (const [providerName, totals] of Object.entries(trafficTotals.value || {})) {
        const rec = current[providerName] || (current[providerName] = emptyActivity());
        rec.download = Number(totals?.dl ?? 0) || 0;
        rec.upload = Number(totals?.ul ?? 0) || 0;
        rec.bytes = rec.download + rec.upload;
        rec.updatedAt = Number(totals?.updatedAt ?? 0) || undefined;
    }
    for (const [providerName, totals] of Object.entries(dailyTrafficTotals.value || {})) {
        const rec = current[providerName] || (current[providerName] = emptyActivity());
        rec.todayDownload = Number(totals?.dl ?? 0) || 0;
        rec.todayUpload = Number(totals?.ul ?? 0) || 0;
        rec.todayBytes = rec.todayDownload + rec.todayUpload;
        rec.updatedAt = Math.max(Number(rec.updatedAt || 0), Number(totals?.updatedAt ?? 0) || 0) || undefined;
    }
    for (const [providerName, rec] of Object.entries(current)) {
        const liveTotals = liveCurrentByProvider[providerName];
        if (liveTotals) {
            const liveBytes = Math.max(0, Number(liveTotals.dl || 0)) + Math.max(0, Number(liveTotals.ul || 0));
            if (liveBytes > rec.bytes) {
                rec.download = Math.max(rec.download, Math.max(0, Number(liveTotals.dl || 0)));
                rec.upload = Math.max(rec.upload, Math.max(0, Number(liveTotals.ul || 0)));
                rec.bytes = rec.download + rec.upload;
                const totals = trafficTotals.value[providerName] || { dl: 0, ul: 0 };
                const nextDl = Math.max(Number(totals.dl || 0), rec.download);
                const nextUl = Math.max(Number(totals.ul || 0), rec.upload);
                if (nextDl !== totals.dl || nextUl !== totals.ul)
                    totalsChanged = true;
                totals.dl = nextDl;
                totals.ul = nextUl;
                totals.updatedAt = now;
                trafficTotals.value[providerName] = totals;
                rec.updatedAt = Math.max(Number(rec.updatedAt || 0), now) || undefined;
            }
        }
        const dailyLiveTotals = liveTodayByProvider[providerName];
        const dailyLiveBytes = dailyLiveTotals
            ? Math.max(0, Number(dailyLiveTotals.dl || 0)) + Math.max(0, Number(dailyLiveTotals.ul || 0))
            : 0;
        const fallbackDailyBytes = rec.todayBytes <= 0 && rec.currentBytes > 0 ? rec.currentBytes : 0;
        if (dailyLiveBytes > rec.todayBytes || fallbackDailyBytes > rec.todayBytes) {
            const nextTodayDl = dailyLiveBytes > 0
                ? Math.max(rec.todayDownload, Math.max(0, Number(dailyLiveTotals?.dl || 0)))
                : Math.max(rec.todayDownload, Math.max(0, Number(liveTotals?.dl || 0)));
            const nextTodayUl = dailyLiveBytes > 0
                ? Math.max(rec.todayUpload, Math.max(0, Number(dailyLiveTotals?.ul || 0)))
                : Math.max(rec.todayUpload, Math.max(0, Number(liveTotals?.ul || 0)));
            rec.todayDownload = nextTodayDl;
            rec.todayUpload = nextTodayUl;
            rec.todayBytes = rec.todayDownload + rec.todayUpload;
            const daily = dailyTrafficTotals.value[providerName] || { dl: 0, ul: 0 };
            const nextDl = Math.max(Number(daily.dl || 0), rec.todayDownload);
            const nextUl = Math.max(Number(daily.ul || 0), rec.todayUpload);
            if (nextDl !== daily.dl || nextUl !== daily.ul)
                dailyChanged = true;
            daily.dl = nextDl;
            daily.ul = nextUl;
            daily.updatedAt = now;
            dailyTrafficTotals.value[providerName] = daily;
            rec.updatedAt = Math.max(Number(rec.updatedAt || 0), now) || undefined;
        }
    }
    for (const [key, value] of Object.entries(perProxyBytes)) {
        const idx = key.indexOf('|');
        if (idx < 0)
            continue;
        const providerName = key.slice(0, idx);
        const proxyName = key.slice(idx + 1);
        const rec = current[providerName];
        if (!rec)
            continue;
        if (value > rec.activeProxyBytes) {
            rec.activeProxyBytes = value;
            rec.activeProxy = proxyName;
        }
    }
    providerActivityCurrent.value = current;
    saveTrafficTotals();
    saveDailyTrafficTotals();
    saveConnTotals();
    if (totalsChanged || dailyChanged || connTotalsChanged)
        markProviderTrafficDirty();
}, { immediate: true, deep: false });
export const providerActivityByName = computed(() => providerActivityCurrent.value || {});
export const providerActivitySnapshot = ref({});
watch(providerActivityByName, throttle((v) => {
    providerActivitySnapshot.value = v || {};
}, 30_000, { leading: true, trailing: true }), { immediate: true, deep: true });
export const providerLiveStatusByName = computed(() => {
    const out = {};
    const list = activeConnections.value || [];
    for (const provider of proxyProviederList.value || []) {
        const providerName = String(provider?.name || '').trim();
        if (!providerName)
            continue;
        const names = new Set(providerProxyNames(provider));
        if (!names.size) {
            out[providerName] = { connections: 0, active: false };
            continue;
        }
        let connections = 0;
        for (const c of list) {
            if (connectionMatchesProvider(c, providerName, names))
                connections += 1;
        }
        out[providerName] = { connections, active: connections > 0 };
    }
    return out;
});
export const providerTrafficSyncState = computed(() => ({
    enabled: !!agentEnabled.value,
    bootstrapped: providerTrafficRemoteBootstrapped,
    pulling: providerTrafficPullInFlight,
    pushing: providerTrafficPushInFlight,
    dirty: providerTrafficLocalDirty,
    rev: Number(providerTrafficRemoteRev.value || 0) || 0,
    remoteUpdatedAt: String(providerTrafficRemoteUpdatedAt.value || '').trim(),
    lastPullAt: Number(providerTrafficLastPullAt || 0) || 0,
    lastPushAt: Number(providerTrafficLastPushAt || 0) || 0,
}));
export const providerTrafficPullNow = async () => {
    await pullProviderTrafficRemote();
};
export const providerTrafficPushNow = async () => {
    await pushProviderTrafficRemoteNow();
};
export const clearProviderTrafficSession = () => {
    sessionResetAt.value = Date.now();
    saveSessionResetAt();
    trafficTotals.value = {};
    providerActivityCurrent.value = {};
    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.removeItem(STORAGE_KEY);
        }
        catch {
            // ignore
        }
    }
    providerTrafficLocalDirty = true;
    scheduleProviderTrafficRemotePush();
};
