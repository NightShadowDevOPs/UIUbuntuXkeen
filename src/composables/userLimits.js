import { disconnectByIdSilentAPI, getConfigsSilentAPI, patchConfigsSilentAPI } from '@/api';
import { agentBlockIpAPI, agentBlockMacAPI, agentIpToMacAPI, agentNeighborsAPI, agentRemoveShapeAPI, agentSetShapeAPI, agentStatusAPI, agentUnblockIpAPI, agentUnblockMacAPI, } from '@/api/agent';
import { getIPLabelFromMap, matchesSourceIpRule } from '@/helper/sourceip';
import { activeConnections } from '@/store/connections';
import { sourceIPLabelList } from '@/store/settings';
import { agentEnabled, agentEnforceBandwidth, agentShaperStatus, managedAgentBlocks, managedAgentIpBlocks, managedAgentShapers, } from '@/store/agent';
import { autoDisconnectLimitedUsers, hardBlockLimitedUsers, managedLanDisallowedCidrs, userLimits, } from '@/store/userLimits';
import dayjs from 'dayjs';
import { debounce } from 'lodash';
import { computed, ref, watch } from 'vue';
import { getTrafficRange } from './userTraffic';
const resolveLimit = (l) => {
    return {
        mac: l?.mac,
        // Default: no limits until user explicitly enables them.
        enabled: l?.enabled ?? false,
        disabled: l?.disabled ?? false,
        trafficPeriod: (l?.trafficPeriod ?? '30d'),
        trafficLimitBytes: l?.trafficLimitBytes ?? 0,
        trafficLimitUnit: (l?.trafficLimitUnit ?? 'GB'),
        bandwidthLimitBps: l?.bandwidthLimitBps ?? 0,
        resetAt: l?.resetAt,
        resetHourKey: l?.resetHourKey,
        resetHourDl: l?.resetHourDl,
        resetHourUl: l?.resetHourUl,
    };
};
export const getUserLimit = (user) => {
    const raw = userLimits.value[user];
    return resolveLimit(raw);
};
export const setUserLimit = (user, patch) => {
    const prev = userLimits.value[user] || {};
    const next = { ...prev, ...patch };
    // Normalize empties
    if (!next.trafficLimitBytes)
        delete next.trafficLimitBytes;
    if (!next.trafficLimitBytes)
        delete next.trafficLimitUnit;
    if (!next.bandwidthLimitBps)
        delete next.bandwidthLimitBps;
    // If resetAt is cleared, clear baseline too.
    if (!next.resetAt) {
        delete next.resetAt;
        delete next.resetHourKey;
        delete next.resetHourDl;
        delete next.resetHourUl;
    }
    // If baseline is incomplete, drop it.
    if (!next.resetHourKey) {
        delete next.resetHourKey;
        delete next.resetHourDl;
        delete next.resetHourUl;
    }
    userLimits.value = { ...userLimits.value, [user]: next };
};
export const clearUserLimit = (user) => {
    const next = { ...userLimits.value };
    delete next[user];
    userLimits.value = next;
};
const normalizeResetAt = (ts) => {
    // Fallback for legacy entries without a baseline: move reset to next hour
    // so the hourly bucket math can't immediately re-block.
    const d = dayjs(ts);
    if (d.minute() === 0 && d.second() === 0 && d.millisecond() === 0)
        return ts;
    return d.add(1, 'hour').startOf('hour').valueOf();
};
const hasResetBaseline = (l) => {
    return !!l.resetHourKey && Number.isFinite(l.resetHourDl) && Number.isFinite(l.resetHourUl);
};
const getTrafficWindowForLimit = (l) => {
    const now = dayjs();
    let baseStart = now.subtract(30, 'day');
    if (l.trafficPeriod === '1d')
        baseStart = now.subtract(24, 'hour');
    else if (l.trafficPeriod === 'month')
        baseStart = now.startOf('month');
    let startTs = baseStart.valueOf();
    let useBaseline = false;
    if (l.resetAt && Number.isFinite(l.resetAt) && l.resetAt > startTs) {
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
const getWindow = (period, resetAt) => {
    const now = dayjs();
    let start;
    if (period === '1d')
        start = now.subtract(24, 'hour');
    else if (period === 'month')
        start = now.startOf('month');
    else
        start = now.subtract(30, 'day');
    let startTs = start.valueOf();
    if (resetAt && Number.isFinite(resetAt) && resetAt > startTs)
        startTs = resetAt;
    return { startTs, endTs: now.valueOf() };
};
export const getUserUsageBytes = (user, limit) => {
    const l = limit || getUserLimit(user);
    const baseStart = (() => {
        const now = dayjs();
        let s = now.subtract(30, 'day');
        if (l.trafficPeriod === '1d')
            s = now.subtract(24, 'hour');
        if (l.trafficPeriod === 'month')
            s = now.startOf('month');
        return s.valueOf();
    })();
    let startTs = baseStart;
    let useBaseline = false;
    if (l.resetAt && Number.isFinite(l.resetAt) && l.resetAt > startTs) {
        if (hasResetBaseline(l)) {
            startTs = l.resetAt;
            useBaseline = true;
        }
        else {
            // legacy behavior
            startTs = normalizeResetAt(l.resetAt);
            useBaseline = false;
        }
    }
    const { endTs } = getWindow(l.trafficPeriod, undefined);
    const agg = getTrafficRange(startTs, endTs);
    // Sum traffic for the label itself PLUS any mapped keys (IPs). This makes usage resilient
    // to changes in the SourceIP map (traffic can be stored under IP or under label).
    const keys = new Set([user]);
    for (const it of sourceIPLabelList.value || []) {
        const name = (it.label || it.key || '').toString();
        if (name === user && it.key)
            keys.add(it.key);
    }
    let dl = 0;
    let ul = 0;
    for (const k of keys) {
        const t = agg.get(k);
        dl += t?.dl || 0;
        ul += t?.ul || 0;
    }
    if (useBaseline) {
        dl = Math.max(0, dl - (l.resetHourDl || 0));
        ul = Math.max(0, ul - (l.resetHourUl || 0));
    }
    return dl + ul;
};
export const getUserCurrentSpeedBps = (user) => {
    if (isReservedPseudoUserLabel(user))
        return 0;
    const ips = new Set(ipsForUserLabel(user));
    if (looksLikeIP(user))
        ips.add(String(user || '').trim());
    let bps = 0;
    for (const c of activeConnections.value) {
        const ip = String(c?.metadata?.sourceIP || '').trim();
        if (!ip)
            continue;
        if (!ips.size) {
            const u = getIPLabelFromMap(ip);
            if (u !== user)
                continue;
        }
        else if (!ips.has(ip)) {
            continue;
        }
        bps += (c.downloadSpeed || 0) + (c.uploadSpeed || 0);
    }
    return bps;
};
export const getUserLimitState = (user) => {
    const l = getUserLimit(user);
    const usage = l.enabled && l.trafficLimitBytes > 0 ? getUserUsageBytes(user, l) : 0;
    const speed = l.enabled && l.bandwidthLimitBps > 0 ? getUserCurrentSpeedBps(user) : 0;
    const trafficExceeded = l.enabled && l.trafficLimitBytes > 0 && usage >= l.trafficLimitBytes;
    const bandwidthExceeded = l.enabled && l.bandwidthLimitBps > 0 && speed >= l.bandwidthLimitBps;
    // Bandwidth limits are "adult" (shaping) when the router agent is enabled.
    const bwViaAgent = !!agentEnabled.value && !!agentEnforceBandwidth.value;
    // Manual block works regardless of "enabled".
    const blocked = l.disabled || (l.enabled && (trafficExceeded || (!bwViaAgent && bandwidthExceeded)));
    return {
        limit: l,
        usageBytes: usage,
        speedBps: speed,
        trafficExceeded,
        bandwidthExceeded,
        blocked,
    };
};
// --- Enforcement (best-effort) ---
let started = false;
const lastDisconnectAt = ref({});
const bwExceedCountByUser = ref({});
let lastAppliedManagedCidrsKey = '';
let lastHardBlockSyncAt = 0;
// Cache router neighbor table (IP -> MAC) from the agent.
let neighborsCacheAt = 0;
let neighborsIpToMac = {};
let neighborsUnsupported = false;
// Cache per-IP lookups (ip2mac) as well, since some agents don't support `neighbors`.
let ipToMacCacheAt = 0;
let ipToMacCache = {};
let ip2macUnsupported = false;
const getNeighborsIpToMac = async () => {
    if (neighborsUnsupported)
        return neighborsIpToMac;
    const now = Date.now();
    if (now - neighborsCacheAt < 5000 && Object.keys(neighborsIpToMac).length)
        return neighborsIpToMac;
    const st = await agentStatusAPI();
    if (!st?.ok)
        return neighborsIpToMac;
    const resp = await agentNeighborsAPI();
    if (!resp?.ok || !resp.items) {
        if (resp?.error && String(resp.error).includes('unknown-cmd'))
            neighborsUnsupported = true;
        return neighborsIpToMac;
    }
    const map = {};
    for (const it of resp.items) {
        const ip = (it.ip || '').trim();
        const mac = (it.mac || '').trim().toLowerCase();
        if (!ip || !mac)
            continue;
        map[ip] = mac;
    }
    neighborsCacheAt = now;
    neighborsIpToMac = map;
    return neighborsIpToMac;
};
const resolveIpToMac = async (ips) => {
    const out = {};
    const list = Array.from(new Set((ips || []).map((x) => (x || '').trim()).filter(Boolean)));
    if (!list.length)
        return out;
    const now = Date.now();
    // fast path from cache (~30s)
    if (now - ipToMacCacheAt < 30000 && Object.keys(ipToMacCache).length) {
        for (const ip of list) {
            const mac = ipToMacCache[ip];
            if (mac)
                out[ip] = mac;
        }
        if (Object.keys(out).length === list.length)
            return out;
    }
    const st = await agentStatusAPI();
    if (!st?.ok)
        return out;
    // Prefer ip2mac (widely supported). Fall back to neighbors if ip2mac is unsupported.
    for (const ip of list) {
        if (out[ip])
            continue;
        if (!ip2macUnsupported) {
            const r = await agentIpToMacAPI(ip);
            const mac = (r?.mac || '').trim().toLowerCase();
            if (r?.ok && mac) {
                out[ip] = mac;
                continue;
            }
            if (!r?.ok && String(r?.error || '').includes('unknown-cmd')) {
                ip2macUnsupported = true;
            }
        }
    }
    if (ip2macUnsupported) {
        const neigh = await getNeighborsIpToMac().catch(() => ({}));
        for (const ip of list) {
            if (out[ip])
                continue;
            const mac = neigh?.[ip];
            if (mac)
                out[ip] = String(mac).trim().toLowerCase();
        }
    }
    ipToMacCacheAt = now;
    ipToMacCache = { ...ipToMacCache, ...out };
    return out;
};
const getMihomoPortsFromConfigs = (cfg) => {
    const keys = ['port', 'socks-port', 'mixed-port', 'redir-port', 'tproxy-port'];
    const out = [];
    if (!cfg || typeof cfg !== 'object')
        return out;
    for (const k of keys) {
        const v = cfg[k] ?? cfg[k.replace(/-/g, '')];
        const n = Number(v);
        if (Number.isFinite(n) && n > 0)
            out.push(n);
    }
    return Array.from(new Set(out)).sort((a, b) => a - b);
};
const syncAgentMacBlocksNow = async (desiredMacs, ports) => {
    const enabled = !!agentEnabled.value;
    if (!enabled)
        return;
    const st = await agentStatusAPI();
    if (!st?.ok)
        return;
    if (st.iptables === false)
        return;
    const desired = Array.from(new Set(desiredMacs.map((m) => m.trim().toLowerCase()).filter(Boolean))).sort();
    const prev = managedAgentBlocks.value || {};
    const prevKeys = Object.keys(prev);
    const portsStr = ports === 'all' ? 'all' : (ports || []).join(',');
    // Remove blocks no longer desired.
    const toRemove = prevKeys.filter((m) => !desired.includes(m));
    if (toRemove.length) {
        await Promise.allSettled(toRemove.map((m) => agentUnblockMacAPI(m)));
    }
    // Apply blocks.
    const toApply = desired.filter((m) => !prev[m] || prev[m].ports !== portsStr);
    if (toApply.length) {
        await Promise.allSettled(toApply.map((m) => agentBlockMacAPI({ mac: m, ports })));
    }
    // Persist managed blocks.
    const next = {};
    for (const m of desired)
        next[m] = { ports: portsStr };
    managedAgentBlocks.value = next;
};
const syncAgentIpBlocksNow = async (desiredIps) => {
    const enabled = !!agentEnabled.value;
    if (!enabled)
        return;
    const st = await agentStatusAPI();
    if (!st?.ok)
        return;
    if (st.iptables === false)
        return;
    const norm = (s) => (s || '').trim().split('/')[0];
    const desired = Array.from(new Set(desiredIps.map(norm).filter(Boolean))).sort();
    const prev = managedAgentIpBlocks.value || {};
    const prevKeys = Object.keys(prev);
    const toRemove = prevKeys.filter((ip) => !desired.includes(ip));
    if (toRemove.length) {
        await Promise.allSettled(toRemove.map((ip) => agentUnblockIpAPI(ip)));
    }
    const toApply = desired.filter((ip) => !prev[ip]);
    if (toApply.length) {
        await Promise.allSettled(toApply.map((ip) => agentBlockIpAPI(ip)));
    }
    const next = {};
    for (const ip of desired)
        next[ip] = true;
    managedAgentIpBlocks.value = next;
};
const looksLikeIP = (s) => {
    const v = (s || '').trim();
    if (!v)
        return false;
    const v4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(v);
    const v6 = v.includes(':');
    return v4 || v6;
};
const toCidr = (ipOrCidr) => {
    const v = (ipOrCidr || '').trim();
    if (!v)
        return '';
    if (v.includes('/'))
        return v;
    if (v.includes(':'))
        return `${v}/128`;
    return `${v}/32`;
};
const normalizeUserName = (value) => (value || '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
const isPatternSourceKey = (key) => {
    const raw = String(key || '').trim();
    return !!raw && (raw.startsWith('/') || raw.includes('/'));
};
const isReservedPseudoUserLabel = (userLabel) => {
    const want = normalizeUserName(userLabel);
    return want === 'dhcp' || want === 'arp';
};
const isSyntheticGroupUserLabel = (userLabel) => {
    const want = normalizeUserName(userLabel);
    if (!want || looksLikeIP(want))
        return false;
    if (isReservedPseudoUserLabel(want))
        return true;
    let hasGrouped = false;
    let hasExact = false;
    for (const it of sourceIPLabelList.value || []) {
        const rawKey = String(it.key || '').trim();
        if (!rawKey)
            continue;
        const label = String(it.label || it.key || '').trim();
        if (normalizeUserName(label) != want)
            continue;
        if (isPatternSourceKey(rawKey))
            hasGrouped = true;
        else
            hasExact = true;
        if (hasGrouped && hasExact)
            break;
    }
    return hasGrouped && !hasExact;
};
const ipsForUserLabel = (userLabel) => {
    const out = [];
    const want = (userLabel || '').trim();
    const wantLc = want.toLowerCase();
    if (isReservedPseudoUserLabel(want))
        return out;
    const normIp = (k) => (k || '').trim().split('/')[0];
    const addIp = (val) => {
        const ip = normIp(val);
        if (!ip)
            return;
        out.push(ip);
    };
    const liveIps = Array.from(new Set((activeConnections.value || [])
        .map((c) => normIp(String(c?.metadata?.sourceIP || '').trim()))
        .filter(Boolean)));
    for (const it of sourceIPLabelList.value) {
        const rawKey = String(it.key || '').trim();
        if (!rawKey)
            continue;
        const label = String(it.label || it.key || '').trim();
        const key = normIp(rawKey);
        const matchesLabel = label === want || label.toLowerCase() === wantLc;
        if (!matchesLabel && key !== want)
            continue;
        if (!isPatternSourceKey(rawKey)) {
            if (key)
                addIp(key);
            continue;
        }
        for (const ip of liveIps) {
            if (matchesSourceIpRule(rawKey, ip))
                addIp(ip);
        }
    }
    for (const c of activeConnections.value || []) {
        const ip = normIp(String(c?.metadata?.sourceIP || '').trim());
        if (!ip)
            continue;
        const display = String(getIPLabelFromMap(ip) || ip).trim();
        if (!display)
            continue;
        if (display === want || display.toLowerCase() === wantLc || ip === want)
            addIp(ip);
    }
    if (!out.length && looksLikeIP(want))
        addIp(want);
    return Array.from(new Set(out)).filter(Boolean);
};
export const getIpsForUser = (userLabel) => {
    return ipsForUserLabel(userLabel);
};
const getCfgList = (cfg, key) => {
    if (!cfg || typeof cfg !== 'object')
        return [];
    // prefer exact key
    const v = cfg[key];
    if (Array.isArray(v))
        return v.filter((x) => typeof x === 'string');
    // fallback: case-insensitive search
    const k = Object.keys(cfg).find((kk) => kk.toLowerCase() === key.toLowerCase());
    const vv = k ? cfg[k] : undefined;
    if (Array.isArray(vv))
        return vv.filter((x) => typeof x === 'string');
    return [];
};
const syncLanDisallowedIps = async (desiredManagedCidrs) => {
    const desired = Array.from(new Set(desiredManagedCidrs.filter(Boolean))).sort();
    const desiredKey = desired.join('|');
    const now = Date.now();
    // Avoid hammering /configs: if desired hasn't changed, sync at most every 15s.
    if (desiredKey === lastAppliedManagedCidrsKey && now - lastHardBlockSyncAt < 15_000)
        return;
    const prevManaged = Array.from(new Set((managedLanDisallowedCidrs.value || []).filter(Boolean))).sort();
    const cfgResp = await getConfigsSilentAPI().catch(() => null);
    const cfg = cfgResp?.data;
    const current = getCfgList(cfg, 'lan-disallowed-ips');
    // Keep entries not managed by UI, update only managed ones.
    const nonManaged = current.filter((x) => !prevManaged.includes(x));
    const next = Array.from(new Set([...nonManaged, ...desired]));
    // Patch only if changed
    const curKey = Array.from(new Set(current)).sort().join('|');
    const nextKey = Array.from(new Set(next)).sort().join('|');
    if (curKey !== nextKey) {
        await patchConfigsSilentAPI({ 'lan-disallowed-ips': next }).catch(() => null);
    }
    managedLanDisallowedCidrs.value = desired;
    lastAppliedManagedCidrsKey = desiredKey;
    lastHardBlockSyncAt = now;
};
const cleanupDisconnectCache = () => {
    const now = Date.now();
    const next = {};
    for (const [id, ts] of Object.entries(lastDisconnectAt.value)) {
        if (now - ts < 20_000)
            next[id] = ts;
    }
    lastDisconnectAt.value = next;
};
const shouldDisconnect = (connId) => {
    const ts = lastDisconnectAt.value[connId];
    if (ts && Date.now() - ts < 2500)
        return false;
    lastDisconnectAt.value[connId] = Date.now();
    return true;
};
const enforceNow = async () => {
    const cfgDisconnect = !!autoDisconnectLimitedUsers.value;
    const cfgHardBlock = !!hardBlockLimitedUsers.value;
    cleanupDisconnectCache();
    // Precompute current speed per user (for bandwidth limits)
    const speedByUser = new Map();
    const connsByUser = new Map();
    for (const c of activeConnections.value) {
        const id = c?.id;
        if (!id)
            continue;
        const user = getIPLabelFromMap(c?.metadata?.sourceIP || '');
        const bps = (c.downloadSpeed || 0) + (c.uploadSpeed || 0);
        speedByUser.set(user, (speedByUser.get(user) || 0) + bps);
        const ids = connsByUser.get(user) || [];
        ids.push(id);
        connsByUser.set(user, ids);
    }
    // Compute traffic aggregates for the distinct periods present in limits
    const usersWithTrafficLimits = [];
    const periods = new Map();
    for (const [user, raw] of Object.entries(userLimits.value)) {
        const l = resolveLimit(raw);
        if (!l.enabled)
            continue;
        if (l.trafficLimitBytes && l.trafficLimitBytes > 0) {
            usersWithTrafficLimits.push({ user, l });
            const w = getTrafficWindowForLimit(l);
            periods.set(`${l.trafficPeriod}:${w.startHourTs}`, { startHourTs: w.startHourTs, endTs: w.endTs });
        }
    }
    const aggByWindow = new Map();
    for (const [k, w] of periods.entries()) {
        aggByWindow.set(k, getTrafficRange(w.startHourTs, w.endTs));
    }
    const isUserBlocked = (user) => {
        const l = resolveLimit(userLimits.value[user]);
        if (l.disabled)
            return true;
        if (!l.enabled)
            return false;
        const bwViaAgent = !!agentEnabled.value && !!agentEnforceBandwidth.value;
        if (l.bandwidthLimitBps && l.bandwidthLimitBps > 0) {
            const sp = speedByUser.get(user) || 0;
            if (sp >= l.bandwidthLimitBps) {
                bwExceedCountByUser.value[user] = (bwExceedCountByUser.value[user] || 0) + 1;
                // If bandwidth is enforced by the router agent, do not "block" the user.
                if (!bwViaAgent && bwExceedCountByUser.value[user] >= 3)
                    return true;
            }
            else {
                bwExceedCountByUser.value[user] = 0;
            }
        }
        if (l.trafficLimitBytes && l.trafficLimitBytes > 0) {
            const w = getTrafficWindowForLimit(l);
            const key = `${l.trafficPeriod}:${w.startHourTs}`;
            const agg = aggByWindow.get(key);
            if (agg) {
                const keys = new Set([user]);
                for (const ip of ipsForUserLabel(user))
                    keys.add(ip);
                let dl = 0;
                let ul = 0;
                for (const k of keys) {
                    const t = agg.get(k);
                    dl += t?.dl || 0;
                    ul += t?.ul || 0;
                }
                if (w.useBaseline) {
                    dl = Math.max(0, dl - (l.resetHourDl || 0));
                    ul = Math.max(0, ul - (l.resetHourUl || 0));
                }
                const used = dl + ul;
                if (used >= l.trafficLimitBytes)
                    return true;
            }
        }
        return false;
    };
    // Compute blocked users once (manual block OR exceeded limits).
    const blockedUsers = [];
    for (const [user] of Object.entries(userLimits.value)) {
        if (isUserBlocked(user))
            blockedUsers.push(user);
    }
    const hasBlockedUsers = blockedUsers.length > 0;
    // If user explicitly blocks someone or limits are exceeded, enforcement should still apply
    // even if global toggles are off (best-effort UX).
    const useHardBlock = cfgHardBlock || hasBlockedUsers;
    const useDisconnect = cfgDisconnect || useHardBlock || hasBlockedUsers;
    const hasAnyManaged = (managedLanDisallowedCidrs.value || []).length > 0 || Object.keys(managedAgentBlocks.value || {}).length > 0;
    // Nothing to do, and nothing to clean up.
    if (!useHardBlock && !useDisconnect && !hasAnyManaged)
        return;
    // --- Hard block via Mihomo `lan-disallowed-ips` ---
    if (useHardBlock) {
        // If router-agent is enabled, prefer MAC-based blocks to keep blocks stable across DHCP IP changes.
        // We still keep Mihomo `lan-disallowed-ips` in sync (IP-based) as an additional layer.
        const desiredBlockedMacs = [];
        const neededIps = [];
        for (const u of blockedUsers) {
            if (looksLikeIP(u))
                neededIps.push(u);
            for (const ip of ipsForUserLabel(u))
                neededIps.push(ip);
        }
        const ipToMac = (agentEnabled.value ? await resolveIpToMac(neededIps).catch(() => ({})) : {});
        for (const u of blockedUsers) {
            const l = resolveLimit(userLimits.value[u]);
            if (l.mac)
                desiredBlockedMacs.push(l.mac);
            // Auto-learn MAC for IP users (helps prevent bypass by DHCP renew).
            if (!l.mac && looksLikeIP(u)) {
                const mac = ipToMac[u];
                if (mac) {
                    desiredBlockedMacs.push(mac);
                    setUserLimit(u, { mac });
                }
            }
            // Also collect MACs from mapped IPs, if any.
            const macsFromIps = new Set();
            for (const ip of ipsForUserLabel(u)) {
                const mac = ipToMac[ip];
                if (mac) {
                    desiredBlockedMacs.push(mac);
                    macsFromIps.add(mac);
                }
            }
            // If the label resolves to a single MAC, remember it to keep blocks stable across DHCP changes.
            if (!l.mac && macsFromIps.size === 1) {
                setUserLimit(u, { mac: Array.from(macsFromIps)[0] });
            }
        }
        const cidrs = [];
        for (const u of blockedUsers) {
            const l = resolveLimit(userLimits.value[u]);
            const ips = new Set(ipsForUserLabel(u));
            const mac = (l.mac || '').trim().toLowerCase();
            if (mac) {
                for (const [ip, m] of Object.entries(ipToMac)) {
                    if ((m || '').trim().toLowerCase() === mac)
                        ips.add(ip);
                }
            }
            for (const ip of Array.from(ips)) {
                const cidr = toCidr(ip);
                if (cidr)
                    cidrs.push(cidr);
            }
        }
        if (cidrs.length || (managedLanDisallowedCidrs.value || []).length) {
            await syncLanDisallowedIps(cidrs);
        }
        // Apply blocks via router-agent.
        // We block ALL traffic from the client (MAC/IP) to avoid bypasses in TProxy/redirect modes.
        if (agentEnabled.value) {
            await Promise.allSettled([
                syncAgentMacBlocksNow(desiredBlockedMacs, 'all'),
                syncAgentIpBlocksNow(cidrs.map((c) => c.split('/')[0])),
            ]);
        }
    }
    else {
        // If hard-block disabled, clean up only entries we previously managed.
        if ((managedLanDisallowedCidrs.value || []).length) {
            await syncLanDisallowedIps([]);
        }
        // Also remove any MAC/IP blocks previously managed via agent.
        if (agentEnabled.value && Object.keys(managedAgentBlocks.value || {}).length) {
            await syncAgentMacBlocksNow([], 'all');
        }
        if (agentEnabled.value && Object.keys(managedAgentIpBlocks.value || {}).length) {
            await syncAgentIpBlocksNow([]);
        }
    }
    // Disconnect active connections for blocked users (makes blocks immediate).
    const tasks = [];
    if (useDisconnect) {
        const blockedSet = new Set(blockedUsers);
        for (const [user, ids] of connsByUser.entries()) {
            if (!blockedSet.has(user) && !isUserBlocked(user))
                continue;
            for (const id of ids) {
                if (!shouldDisconnect(id))
                    continue;
                tasks.push(disconnectByIdSilentAPI(id).catch(() => null));
            }
        }
    }
    if (tasks.length) {
        await Promise.allSettled(tasks);
    }
};
// --- Bandwidth shaping via router agent (tc/iptables) ---
const syncAgentShapingNow = async () => {
    const enabled = !!agentEnabled.value && !!agentEnforceBandwidth.value;
    const prev = managedAgentShapers.value || {};
    // When disabled: best-effort remove everything we previously managed.
    if (!enabled) {
        const ips = Object.keys(prev);
        if (!ips.length)
            return;
        await Promise.allSettled(ips.map((ip) => agentRemoveShapeAPI(ip)));
        managedAgentShapers.value = {};
        return;
    }
    // Desired: from enabled users with bandwidthLimit.
    // If a user has a remembered MAC, also include current neighbor IPs for that MAC.
    const desired = {};
    const ipToMac = (await getNeighborsIpToMac().catch(() => ({})));
    for (const [user, raw] of Object.entries(userLimits.value || {})) {
        const l = resolveLimit(raw);
        if (!l.enabled)
            continue;
        if (!l.bandwidthLimitBps || l.bandwidthLimitBps <= 0)
            continue;
        // Stored as bytes/sec; convert to Mbps (bits/sec).
        const mbps = +(((l.bandwidthLimitBps * 8) / 1_000_000)).toFixed(2);
        if (!mbps || mbps <= 0)
            continue;
        const ips = new Set(ipsForUserLabel(user));
        const mac = (l.mac || '').trim().toLowerCase();
        if (mac) {
            for (const [ip, m] of Object.entries(ipToMac)) {
                if ((m || '').trim().toLowerCase() === mac)
                    ips.add(ip);
            }
        }
        for (const ip of Array.from(ips)) {
            // Single field applies to both directions.
            desired[ip] = { upMbps: mbps, downMbps: mbps };
        }
    }
    // If agent is offline, don't destroy the previous state; we'll retry later.
    const st = await agentStatusAPI();
    if (!st?.ok)
        return;
    const now = Date.now();
    const tasks = [];
    // Apply/Update
    for (const [ip, v] of Object.entries(desired)) {
        const p = prev[ip];
        const changed = !p || p.upMbps !== v.upMbps || p.downMbps !== v.downMbps;
        if (!changed)
            continue;
        tasks.push(agentSetShapeAPI({ ip, upMbps: v.upMbps, downMbps: v.downMbps }).then((res) => {
            agentShaperStatus.value = {
                ...agentShaperStatus.value,
                [ip]: { ok: !!res.ok, error: res.ok ? undefined : res.error, at: now },
            };
        }));
    }
    // Remove
    for (const ip of Object.keys(prev)) {
        if (desired[ip])
            continue;
        tasks.push(agentRemoveShapeAPI(ip).then((res) => {
            const next = { ...(agentShaperStatus.value || {}) };
            // keep last error if failed
            if (!res.ok) {
                next[ip] = { ok: false, error: res.error, at: now };
            }
            else {
                delete next[ip];
            }
            agentShaperStatus.value = next;
        }));
    }
    if (tasks.length)
        await Promise.allSettled(tasks);
    managedAgentShapers.value = desired;
};
const syncAgentShapingDebounced = debounce(() => {
    syncAgentShapingNow();
}, 600);
const enforceDebounced = debounce(() => {
    enforceNow();
}, 500);
export const initUserLimitsEnforcer = () => {
    if (started)
        return;
    started = true;
    // Trigger on every connections WS tick (activeConnections updated)
    watch(activeConnections, () => {
        enforceDebounced();
    }, { deep: false });
    // Also trigger when limits toggled
    watch(userLimits, () => {
        enforceDebounced();
    }, { deep: true });
    // Sync shaping rules whenever limits or agent settings change.
    watch([userLimits, agentEnabled, agentEnforceBandwidth], () => {
        syncAgentShapingDebounced();
    }, { deep: true });
};
export const reapplyAgentShapingForUser = async (userLabel) => {
    const enabled = !!agentEnabled.value && !!agentEnforceBandwidth.value;
    if (!enabled)
        return { ok: false, error: 'agent disabled' };
    const l = resolveLimit(userLimits.value[userLabel]);
    if (!l.enabled || !l.bandwidthLimitBps || l.bandwidthLimitBps <= 0) {
        return { ok: false, error: 'no bandwidth limit' };
    }
    const mbps = +(((l.bandwidthLimitBps * 8) / 1_000_000)).toFixed(2);
    if (!mbps || mbps <= 0)
        return { ok: false, error: 'invalid limit' };
    const st = await agentStatusAPI();
    if (!st?.ok)
        return { ok: false, error: st?.error || 'offline' };
    // Prefer the user's mapped IPs, but if the user has a remembered MAC,
    // also apply to current neighbor IPs for that MAC (stable across DHCP changes).
    const ipToMac = (await getNeighborsIpToMac().catch(() => ({})));
    const ipsSet = new Set(ipsForUserLabel(userLabel));
    const mac = (l.mac || '').trim().toLowerCase();
    if (mac) {
        for (const [ip, m] of Object.entries(ipToMac)) {
            if ((m || '').trim().toLowerCase() === mac)
                ipsSet.add(ip);
        }
    }
    const ips = Array.from(ipsSet);
    if (!ips.length)
        return { ok: false, error: 'no ips' };
    const now = Date.now();
    const nextManaged = { ...(managedAgentShapers.value || {}) };
    const nextStatus = { ...(agentShaperStatus.value || {}) };
    const results = await Promise.allSettled(ips.map((ip) => agentSetShapeAPI({ ip, upMbps: mbps, downMbps: mbps }).then((res) => {
        nextStatus[ip] = { ok: !!res.ok, error: res.ok ? undefined : res.error, at: now };
        if (res.ok)
            nextManaged[ip] = { upMbps: mbps, downMbps: mbps };
        return res;
    })));
    agentShaperStatus.value = nextStatus;
    managedAgentShapers.value = nextManaged;
    const anyFail = results.some((r) => r.status === 'fulfilled' && !r.value?.ok);
    return anyFail ? { ok: false, error: 'failed' } : { ok: true };
};
/**
 * Force an immediate re-sync of user enforcement.
 * Useful when the user re-binds MAC after a DHCP change and wants blocks/shaping applied right away.
 */
export const applyUserEnforcementNow = async () => {
    await Promise.allSettled([
        syncAgentShapingNow(),
        enforceNow(),
    ]);
};
export const limitedUsersCount = computed(() => Object.keys(userLimits.value || {}).length);
