import { showNotification } from '@/helper/notification';
import { pushSnapshot, userLimitSnapshots } from '@/store/userLimitSnapshots';
import { DEFAULT_LIMIT_PROFILES, userLimitProfiles } from '@/store/userLimitProfiles';
import { userLimits } from '@/store/userLimits';
import { applyUserEnforcementNow, getIpsForUser, getUserLimit, setUserLimit } from './userLimits';
import { getUserHourBucket } from './userTraffic';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
export const resetProfilesToDefault = () => {
    userLimitProfiles.value = DEFAULT_LIMIT_PROFILES;
};
export const createSnapshotNow = (label) => {
    const snap = {
        id: uuidv4(),
        createdAt: Date.now(),
        label,
        data: JSON.parse(JSON.stringify(userLimits.value || {})),
    };
    pushSnapshot(snap);
    return snap;
};
const setResetBaselineNow = (user, extra = {}) => {
    const now = Date.now();
    const keys = new Set([user]);
    for (const ip of getIpsForUser(user) || [])
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
export const applyProfileToUsers = async (users, profile) => {
    const list = Array.from(new Set((users || []).filter(Boolean)));
    if (!list.length)
        return;
    // snapshot before bulk
    createSnapshotNow(`Before applying profile: ${profile.name}`);
    for (const user of list) {
        const prev = getUserLimit(user);
        const patch = {
            enabled: profile.enabled,
            disabled: false,
            trafficPeriod: profile.trafficPeriod || prev.trafficPeriod,
        };
        const tl = profile.trafficLimitBytes || 0;
        patch.trafficLimitBytes = tl > 0 ? tl : 0;
        patch.trafficLimitUnit = profile.trafficLimitUnit || prev.trafficLimitUnit;
        const bl = profile.bandwidthLimitBps || 0;
        patch.bandwidthLimitBps = bl > 0 ? bl : 0;
        // keep MAC if present
        if (prev.mac)
            patch.mac = prev.mac;
        setResetBaselineNow(user, patch);
    }
    try {
        await applyUserEnforcementNow();
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
    }
    catch (e) {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2400 });
        throw e;
    }
};
export const unblockResetUsers = async (users) => {
    const list = Array.from(new Set((users || []).filter(Boolean)));
    if (!list.length)
        return;
    createSnapshotNow('Before unblock + reset');
    for (const user of list) {
        const prev = getUserLimit(user);
        setResetBaselineNow(user, {
            enabled: prev.enabled,
            disabled: false,
            mac: prev.mac,
        });
    }
    await applyUserEnforcementNow().catch(() => null);
};
export const disableLimitsForUsers = async (users) => {
    const list = Array.from(new Set((users || []).filter(Boolean)));
    if (!list.length)
        return;
    createSnapshotNow('Before disabling limits');
    for (const user of list) {
        const prev = getUserLimit(user);
        // Keep MAC, clear limits.
        setUserLimit(user, {
            mac: prev.mac,
            enabled: false,
            disabled: false,
            trafficLimitBytes: 0,
            bandwidthLimitBps: 0,
        });
    }
    await applyUserEnforcementNow().catch(() => null);
};
export const restoreSnapshot = async (id) => {
    const snap = (userLimitSnapshots.value || []).find((s) => s.id === id);
    if (!snap)
        return;
    userLimits.value = JSON.parse(JSON.stringify(snap.data || {}));
    await applyUserEnforcementNow().catch(() => null);
};
export const exportLimitsBundle = () => {
    const bundle = {
        kind: 'zash-user-limits-bundle',
        createdAt: new Date().toISOString(),
        profiles: userLimitProfiles.value || [],
        userLimits: userLimits.value || {},
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zash-limits-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
};
export const importLimitsBundle = async (raw, mode) => {
    const data = raw && typeof raw === 'object' ? raw : null;
    if (!data || data.kind !== 'zash-user-limits-bundle')
        throw new Error('invalid bundle');
    const incomingProfiles = Array.isArray(data.profiles) ? data.profiles : [];
    const incomingLimits = data.userLimits && typeof data.userLimits === 'object' ? data.userLimits : {};
    createSnapshotNow(`Before import (${mode})`);
    if (mode === 'replace') {
        userLimitProfiles.value = incomingProfiles.length ? incomingProfiles : DEFAULT_LIMIT_PROFILES;
        userLimits.value = incomingLimits || {};
    }
    else {
        // merge profiles by id
        const curProfiles = userLimitProfiles.value || [];
        const map = new Map(curProfiles.map((p) => [p.id, p]));
        for (const p of incomingProfiles) {
            if (!p?.id)
                continue;
            map.set(p.id, { ...map.get(p.id), ...p });
        }
        userLimitProfiles.value = Array.from(map.values());
        userLimits.value = { ...(userLimits.value || {}), ...(incomingLimits || {}) };
    }
    await applyUserEnforcementNow().catch(() => null);
};
