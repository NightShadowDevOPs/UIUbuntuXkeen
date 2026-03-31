/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { disconnectByIdSilentAPI, proxyProviderHealthCheckAPI, updateProxyProviderAPI } from '@/api';
import { getProviderHealth, getProviderSslDiagnostics } from '@/helper/providerHealth';
import { agentProviderByName, agentProvidersSslRefreshPending, agentProvidersSslRefreshing, fetchAgentProviders, panelSslCheckedAt, panelSslErrorByName, panelSslNotAfterByName, panelSslUrlByName, } from '@/store/providerHealth';
import { useBounceOnVisible } from '@/composables/bouncein';
import { useRenderProxies } from '@/composables/renderProxies';
import { fromNow, prettyBytesHelper } from '@/helper/utils';
import { showNotification } from '@/helper/notification';
import { normalizeProviderIcon } from '@/helper/providerIcon';
import { normalizeProxyProtoKey, protoLabel } from '@/helper/proxyProto';
import { fetchProxyProviderByNameOnly, getLatencyByName, getTestUrl, proxyLatencyTest, proxyMap, proxyProviederList } from '@/store/proxies';
import { activeConnections } from '@/store/connections';
import { connectionMatchesProviderProxyNames, providerActivityByName, providerLiveStatusByName } from '@/store/providerActivity';
import { NOT_CONNECTED, ROUTE_NAME } from '@/constant';
import { activeBackend } from '@/store/setup';
import { proxyProviderCardOpacity, proxyProviderIconMap, proxyProviderPanelUrlMap, proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault, twoColumnProxyGroup, } from '@/store/settings';
import ProviderIconBadge from '@/components/common/ProviderIconBadge.vue';
import { BACKEND_KINDS } from '@/config/backendContract';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, BoltIcon, ClipboardDocumentIcon, LinkIcon, PresentationChartLineIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { ChevronDownIcon } from '@heroicons/vue/20/solid';
import dayjs from 'dayjs';
import { twMerge } from 'tailwind-merge';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import CollapseCard from '../common/CollapseCard.vue';
import ProxyNodeCard from './ProxyNodeCard.vue';
import ProxyNodeGrid from './ProxyNodeGrid.vue';
import ProxyPreview from './ProxyPreview.vue';
const props = defineProps();
const clampPercent = (value, min = 45, max = 100) => {
    if (!Number.isFinite(value))
        return max;
    return Math.max(min, Math.min(max, Math.trunc(value)));
};
const providerCardSurfaceStyle = computed(() => {
    const alpha = clampPercent(Number(proxyProviderCardOpacity.value), 45, 100) / 100;
    return {
        backgroundColor: `oklch(var(--b1) / ${alpha})`,
        borderColor: 'oklch(var(--bc) / 0.12)',
    };
});
const router = useRouter();
const { t } = useI18n();
const activeBackendKind = computed(() => activeBackend.value?.kind);
const sslProbeServiceLabel = computed(() => activeBackendKind.value === BACKEND_KINDS.UBUNTU_SERVICE ? t('providerSslSourceUbuntuService') : t('providerSslSourceCompatibilityBridge'));
// Provider list can refresh/reorder; be defensive to avoid blank screens if a provider is
// temporarily missing (or name mismatched).
const proxyProvider = computed(() => proxyProviederList.value.find((group) => group.name === props.name));
// Different cores/APIs may shape provider.proxies as an array OR as an object map.
// Normalize to an array to keep rendering stable.
const providerProxyItems = computed(() => {
    const v = proxyProvider.value?.proxies;
    if (Array.isArray(v))
        return v;
    if (v && typeof v === 'object')
        return Object.values(v);
    return [];
});
const providerIconRaw = computed(() => normalizeProviderIcon((proxyProviderIconMap.value || {})[props.name]));
const providerTypeCounts = computed(() => {
    const m = new Map();
    for (const p of providerProxyItems.value) {
        const t0 = typeof p === 'string' ? proxyMap.value?.[p]?.type : p?.type;
        const k = normalizeProxyProtoKey(t0);
        if (!k)
            continue;
        m.set(k, (m.get(k) || 0) + 1);
    }
    const arr = Array.from(m.entries()).map(([key, count]) => ({
        key,
        label: protoLabel(key),
        count,
    }));
    arr.sort((a, b) => (b.count - a.count) || a.key.localeCompare(b.key));
    return arr;
});
const providerTypeBadges = computed(() => providerTypeCounts.value.slice(0, 4));
const providerTypeOverflow = computed(() => Math.max(0, providerTypeCounts.value.length - providerTypeBadges.value.length));
const providerTypesTooltip = computed(() => {
    return providerTypeCounts.value
        .map((x) => x.label + (x.count > 1 ? ('\u00D7' + String(x.count)) : ''))
        .join(' / ');
});
const allProxies = computed(() => providerProxyItems.value
    .map((node) => (typeof node === 'string' ? node : node?.name))
    .filter(Boolean));
const { renderProxies, proxiesCount } = useRenderProxies(allProxies);
// best-effort: ensure cache is populated when provider cards mount
fetchAgentProviders(false);
const sslWarnDays = computed(() => {
    const override = Number((proxyProviderSslWarnDaysMap.value || {})[props.name]);
    const base = Number(sslNearExpiryDaysDefault.value);
    const v = Number.isFinite(override) ? override : Number.isFinite(base) ? base : 2;
    return Math.max(0, Math.min(365, Math.trunc(v)));
});
const providerHealth = computed(() => {
    const ap = agentProviderByName.value[props.name];
    return getProviderHealth(proxyProvider.value, ap, { nearExpiryDays: sslWarnDays.value, sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value });
});
const activeConnectionTargets = computed(() => {
    const set = new Set(allProxies.value || []);
    if (!set.size)
        return [];
    return (activeConnections.value || []).filter((c) => !!connectionMatchesProviderProxyNames(c, set));
});
const providerStats = computed(() => {
    const rec = (providerActivityByName.value || {})[props.name];
    const live = (providerLiveStatusByName.value || {})[props.name];
    const mappedConnections = Number(rec?.connections || 0);
    const liveConnections = Number(live?.connections || 0);
    const connections = Math.max(mappedConnections, liveConnections);
    const bytes = Number(rec?.bytes || 0);
    const todayBytes = Number(rec?.todayBytes || 0);
    const speed = Number(rec?.speed || 0);
    const currentBytes = Number(rec?.currentBytes || 0);
    const killableConnections = activeConnectionTargets.value.length;
    const active = Boolean(live?.active)
        || Boolean(rec?.active)
        || killableConnections > 0
        || connections > 0
        || currentBytes > 0
        || speed > 0
        || todayBytes > 0;
    return {
        active,
        connections,
        killableConnections,
        bytes,
        todayBytes,
        speed,
        currentBytes,
        download: Number(rec?.download || 0),
        upload: Number(rec?.upload || 0),
        todayDownload: Number(rec?.todayDownload || 0),
        todayUpload: Number(rec?.todayUpload || 0),
    };
});
// Highlight the "currently used" proxy inside this provider.
// Best-effort: infer from active connections using specialProxy first,
// then fall back to any hop in the chain (from leaf to root).
const activeProxy = computed(() => {
    const set = new Set(allProxies.value || []);
    let bestName = '';
    let bestTotal = 0;
    for (const c of activeConnections.value || []) {
        const matched = connectionMatchesProviderProxyNames(c, set);
        if (!matched)
            continue;
        const total = (Number(c?.download) || 0) + (Number(c?.upload) || 0);
        if (total > bestTotal) {
            bestTotal = total;
            bestName = matched;
        }
    }
    return bestName;
});
// Fallback: if there are no active connections, show the best (lowest) latency proxy.
const bestLatencyProxy = computed(() => {
    let best = '';
    let bestLatency = Number.POSITIVE_INFINITY;
    for (const name of renderProxies.value || []) {
        const l = getLatencyByName(name, proxyProvider.value?.name);
        if (l === NOT_CONNECTED)
            continue;
        if (typeof l !== 'number' || !Number.isFinite(l) || l <= 0)
            continue;
        if (l < bestLatency) {
            bestLatency = l;
            best = name;
        }
    }
    return best;
});
const displayProxyName = computed(() => {
    return activeProxy.value || bestLatencyProxy.value || '';
});
// ---- shared provider 3x-ui subscription URL ----
const panelUrl = computed(() => {
    const m = proxyProviderPanelUrlMap.value || {};
    return String(m[props.name] || '').trim();
});
const panelUrlDraft = ref(panelUrl.value);
watch(panelUrl, (v) => {
    // keep draft in sync when updated by sync engine
    if (panelUrlDraft.value !== v)
        panelUrlDraft.value = v;
});
const savePanelUrl = () => {
    const raw = String(panelUrlDraft.value || '').trim();
    const normalized = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
    const cur = { ...(proxyProviderPanelUrlMap.value || {}) };
    if (!normalized) {
        delete cur[props.name];
    }
    else {
        ;
        cur[props.name] = normalized;
    }
    proxyProviderPanelUrlMap.value = cur;
};
const openPanelUrl = () => {
    const url = panelUrl.value;
    if (!url)
        return;
    try {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    catch {
        // ignore
    }
};
const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1';
const openTopologyWithProxy = async (p) => {
    const payload = {
        ts: Date.now(),
        mode: p.mode,
        focus: { stage: 'S', kind: 'value', value: p.name },
    };
    try {
        localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload));
    }
    catch {
        // ignore
    }
    await router.push({ name: ROUTE_NAME.overview });
};
const openTopologyWithProvider = async () => {
    const payload = {
        ts: Date.now(),
        mode: 'only',
        focus: { stage: 'P', kind: 'value', value: proxyProvider.value?.name || props.name },
        // Fallback to a concrete proxy name if provider map is not yet ready on the Topology page.
        fallbackProxyName: displayProxyName.value || '',
    };
    try {
        localStorage.setItem(TOPOLOGY_NAV_FILTER_KEY, JSON.stringify(payload));
    }
    catch {
        // ignore
    }
    await router.push({ name: ROUTE_NAME.overview });
};
const getAnyFromObj = (obj, candidates) => {
    if (!obj || typeof obj !== 'object')
        return undefined;
    const keys = Object.keys(obj);
    // exact match (case-insensitive)
    for (const c of candidates) {
        const k = keys.find((x) => x.toLowerCase() === c.toLowerCase());
        if (k) {
            const v = obj[k];
            if (v !== undefined && v !== null && `${v}`.trim() !== '')
                return v;
        }
    }
    // contains match (case-insensitive)
    for (const c of candidates) {
        const lc = c.toLowerCase();
        const k = keys.find((x) => x.toLowerCase().includes(lc));
        if (k) {
            const v = obj[k];
            if (v !== undefined && v !== null && `${v}`.trim() !== '')
                return v;
        }
    }
    return undefined;
};
const parseDateMaybe = (v) => {
    if (v === null || v === undefined)
        return null;
    if (typeof v === 'number' && Number.isFinite(v)) {
        const ts = v > 10_000_000_000 ? v : v * 1000;
        const d = dayjs(ts);
        return d.isValid() ? d : null;
    }
    if (typeof v === 'string') {
        const s = v.trim();
        if (!s)
            return null;
        if (/^[0-9]{10,13}$/.test(s)) {
            const num = Number(s);
            return parseDateMaybe(num);
        }
        const d = dayjs(s);
        return d.isValid() ? d : null;
    }
    if (typeof v === 'object') {
        // common shapes: { expire: ... }
        const inner = getAnyFromObj(v, ['expire', 'expiry', 'expiration', 'notAfter', 'not_after']);
        return parseDateMaybe(inner);
    }
    return null;
};
const sslDiagnosticsRaw = computed(() => {
    const agentP = agentProviderByName.value[props.name];
    return getProviderSslDiagnostics(proxyProvider.value, agentP, {
        panelProbeNotAfter: (panelSslNotAfterByName.value || {})[props.name] || '',
        panelProbeError: (panelSslErrorByName.value || {})[props.name] || '',
        panelProbeCheckedAtMs: panelSslCheckedAt.value,
        panelProbeUrl: (panelSslUrlByName.value || {})[props.name] || '',
        panelUrlOverride: panelUrl.value,
        nearExpiryDays: sslWarnDays.value,
        sslRefreshing: agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value,
    });
});
const sslExpireInfo = computed(() => {
    const d = sslDiagnosticsRaw.value;
    if (!d.notAfter) {
        const checked = d.checkedAtMs ? dayjs(d.checkedAtMs).format('DD-MM-YYYY HH:mm:ss') : '';
        const tip = d.isRefreshing
            ? t('providerSslRefreshingTip') + (checked ? ` • ${t('checkedAt')}: ${checked}` : '')
            : d.error
                ? `${t('providerSslError')}: ${d.error}` + (checked ? ` • ${t('checkedAt')}: ${checked}` : '')
                : checked
                    ? `${t('providerSslStatusUnavailable')} • ${t('checkedAt')}: ${checked}`
                    : t('providerSslStatusUnavailable');
        return {
            dateTime: '—',
            days: Number.NaN,
            cls: d.isRefreshing ? 'text-info' : d.error ? 'text-error' : 'text-base-content/60',
            label: d.isRefreshing ? t('providerSslRefreshing') : '—',
            tip,
            isRefreshing: d.isRefreshing,
        };
    }
    const label = (d.days ?? 0) < 0 ? `${d.dateTime} (${t('providerSslStatusExpired')})` : `${d.dateTime} (${d.days}${t('daysShort')})`;
    const cls = (d.days ?? 0) < 0 ? 'text-error' : (d.days ?? 0) <= sslWarnDays.value ? 'text-warning' : 'text-success';
    const checked = d.checkedAtMs ? dayjs(d.checkedAtMs).format('DD-MM-YYYY HH:mm:ss') : '';
    const source = d.source === 'subscription'
        ? t('providerSslSourceSubscription')
        : d.source === 'panel-probe'
            ? `${t('providerSslSourcePanelProbe')} • ${sslProbeServiceLabel.value}`
            : d.source === 'panel'
                ? `${t('providerSslSourcePanelUrl')} • ${sslProbeServiceLabel.value}`
                : d.source === 'provider'
                    ? `${t('providerSslSourceProviderUrl')} • ${sslProbeServiceLabel.value}`
                    : t('providerSslSourceUnknown');
    const tip = checked ? `${source} • ${t('checkedAt')}: ${checked}` : source;
    return { dateTime: d.dateTime, days: d.days, cls, label, tip };
});
const sslDiagnosticsCard = computed(() => {
    const d = sslDiagnosticsRaw.value;
    const checked = d.checkedAtMs ? dayjs(d.checkedAtMs).format('DD-MM-YYYY HH:mm:ss') : '';
    const remaining = Number.isFinite(d.days) ? (d.days < 0 ? t('providerSslStatusExpired') : `${d.days}${t('daysShort')}`) : '—';
    const expiresLabel = d.dateTime
        ? `${t('providerSslExpiresAt')}: ${d.dateTime} • ${t('providerSslRemaining')}: ${remaining}`
        : `${t('providerSslExpiresAt')}: —`;
    const checkedLabel = checked ? `${t('providerSslCheckedLabel')}: ${checked}` : `${t('providerSslCheckedLabel')}: —`;
    const sourceLabel = d.source === 'subscription'
        ? t('providerSslSourceSubscription')
        : d.source === 'panel-probe'
            ? `${t('providerSslSourcePanelProbe')} • ${sslProbeServiceLabel.value}`
            : d.source === 'panel'
                ? `${t('providerSslSourcePanelUrl')} • ${sslProbeServiceLabel.value}`
                : d.source === 'provider'
                    ? `${t('providerSslSourceProviderUrl')} • ${sslProbeServiceLabel.value}`
                    : t('providerSslSourceUnknown');
    const statusLabel = d.status === 'refreshing'
        ? t('providerSslStatusRefreshing')
        : d.status === 'unavailable'
            ? t('providerSslStatusUnavailable')
            : d.status === 'expired'
                ? t('providerSslStatusExpired')
                : d.status === 'warning'
                    ? t('providerSslStatusNearExpiry')
                    : t('providerSslStatusHealthy');
    const statusCls = d.status === 'refreshing'
        ? 'text-info'
        : d.status === 'unavailable'
            ? d.error
                ? 'text-error'
                : 'text-base-content/70'
            : d.status === 'expired'
                ? 'text-error'
                : d.status === 'warning'
                    ? 'text-warning'
                    : 'text-success';
    return {
        ...d,
        statusLabel,
        statusCls,
        sourceLabel,
        checkedLabel,
        expiresLabel,
        urlLabel: d.sourceUrl || '—',
    };
});
const sslExpireBadge = computed(() => {
    const info = sslExpireInfo.value;
    if (!info)
        return null;
    if (!Number.isFinite(info.days)) {
        if (info?.isRefreshing) {
            return { badgeCls: 'badge-info badge-outline', text: t('providerSslRefreshing'), tip: info.tip };
        }
        return { badgeCls: 'badge-ghost', text: 'SSL —', tip: info.tip };
    }
    const level = info.days < 0 ? 'error' : info.days <= sslWarnDays.value ? 'warning' : 'success';
    const badgeCls = level === 'error'
        ? 'badge-error'
        : level === 'warning'
            ? 'badge-warning'
            : 'badge-success';
    const text = info.days < 0 ? t('providerSslStatusExpired') : `SSL ${info.days}${t('daysShort')}`;
    return { badgeCls, text, tip: info.tip };
});
const subscriptionInfo = computed(() => {
    const info = proxyProvider.value.subscriptionInfo;
    if (!info)
        return null;
    const parseBytes = (v) => {
        if (v === null || v === undefined)
            return 0;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : 0;
        if (typeof v === 'string') {
            const s0 = v.trim();
            if (!s0)
                return 0;
            // Some backends may pass userinfo fragments like: "total=123; download=..."
            const kv = s0.match(/\b(?:total|download|upload)\s*=\s*([0-9]+(?:\.[0-9]+)?)(?:\s*([kmgtpe]?i?b?)\b)?/i);
            if (kv) {
                const num = Number(kv[1]);
                const unit = (kv[2] || '').toUpperCase();
                const pow10 = { K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 };
                const base = unit.includes('I') ? 1024 : 1000;
                const letter = unit.replace('IB', '').replace('B', '');
                const p = pow10[letter] || 0;
                return num * Math.pow(base, p);
            }
            // plain number string
            if (/^[0-9]+(\.[0-9]+)?$/.test(s0))
                return Number(s0) || 0;
            // "<num><unit>" or "<num> <unit>"
            const m = s0.match(/^\s*([0-9]+(?:\.[0-9]+)?)\s*([kmgtpe]?i?b?)\s*$/i);
            if (m) {
                const num = Number(m[1]);
                const unit = (m[2] || '').toUpperCase();
                const pow10 = { K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 };
                const base = unit.includes('I') ? 1024 : 1000;
                const letter = unit.replace('IB', '').replace('B', '');
                const p = pow10[letter] || 0;
                return num * Math.pow(base, p);
            }
            // Extract first "number+unit" anywhere
            const m2 = s0.match(/([0-9]+(?:\.[0-9]+)?)\s*([kmgtpe]?i?b?)\b/i);
            if (m2) {
                const num = Number(m2[1]);
                const unit = (m2[2] || '').toUpperCase();
                const pow10 = { K: 1, M: 2, G: 3, T: 4, P: 5, E: 6 };
                const base = unit.includes('I') ? 1024 : 1000;
                const letter = unit.replace('IB', '').replace('B', '');
                const p = pow10[letter] || 0;
                return num * Math.pow(base, p);
            }
            return Number(s0) || 0;
        }
        return 0;
    };
    const parseNumber = (v) => {
        if (v === null || v === undefined)
            return 0;
        if (typeof v === 'number')
            return Number.isFinite(v) ? v : 0;
        if (typeof v === 'string') {
            const s = v.trim();
            const m = s.match(/-?[0-9]+/);
            return m ? Number(m[0]) || 0 : 0;
        }
        return 0;
    };
    const getAny = (obj, candidates) => {
        if (!obj || typeof obj !== 'object')
            return undefined;
        const keys = Object.keys(obj);
        // exact match (case-insensitive)
        for (const c of candidates) {
            const k = keys.find((x) => x.toLowerCase() === c.toLowerCase());
            if (k) {
                const v = obj[k];
                if (v !== undefined && v !== null && `${v}`.trim() !== '')
                    return v;
            }
        }
        // contains match (case-insensitive)
        for (const c of candidates) {
            const lc = c.toLowerCase();
            const k = keys.find((x) => x.toLowerCase().includes(lc));
            if (k) {
                const v = obj[k];
                if (v !== undefined && v !== null && `${v}`.trim() !== '')
                    return v;
            }
        }
        return undefined;
    };
    const parseUserinfoString = (s) => {
        const read = (k) => {
            const m = s.match(new RegExp(`\\b${k}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i'));
            return m ? Number(m[1]) || 0 : 0;
        };
        const download = read('download');
        const upload = read('upload');
        const total = read('total');
        const expire = read('expire');
        return { download, upload, total, expire };
    };
    const providerObj = proxyProvider.value;
    const rawDownload = getAny(info, ['Download', 'download']) ?? getAny(providerObj, ['Download', 'download']);
    const rawUpload = getAny(info, ['Upload', 'upload']) ?? getAny(providerObj, ['Upload', 'upload']);
    const rawTotal = getAny(info, ['Total', 'total', 'quota', 'limit']) ?? getAny(providerObj, ['Total', 'total', 'quota', 'limit']);
    const rawExpire = getAny(info, ['Expire', 'expire', 'expiry', 'expiration']) ?? getAny(providerObj, ['Expire', 'expire', 'expiry', 'expiration']);
    let Download = parseBytes(rawDownload);
    let Upload = parseBytes(rawUpload);
    let Total = parseBytes(rawTotal);
    let Expire = parseNumber(rawExpire);
    // Fallback: scan any string field for "total=..."
    if (Total <= 0) {
        for (const v of Object.values(info)) {
            if (typeof v !== 'string')
                continue;
            if (!/\btotal\s*=\s*/i.test(v))
                continue;
            const p = parseUserinfoString(v);
            if (p.total > 0)
                Total = p.total;
            if (Download <= 0 && p.download > 0)
                Download = p.download;
            if (Upload <= 0 && p.upload > 0)
                Upload = p.upload;
            if (Expire <= 0 && p.expire > 0)
                Expire = p.expire;
        }
    }
    if (Download === 0 && Upload === 0 && Total === 0 && Expire === 0)
        return null;
    const { t } = useI18n();
    const usedBytes = Download + Upload;
    const used = prettyBytesHelper(usedBytes, { binary: true });
    const isUnlimited = (rawTotal === 0 || rawTotal === '0' || rawTotal === '0B' || rawTotal === '0b' || rawTotal === -1 || rawTotal === '-1') && usedBytes > 0;
    const totalLabel = Total > 0 ? prettyBytesHelper(Total, { binary: true }) : isUnlimited ? '∞' : '—';
    const percentage = Total > 0 ? ((usedBytes / Total) * 100).toFixed(2) : '';
    const usageStr = percentage ? `${used} / ${totalLabel} ( ${percentage}% )` : `${used} / ${totalLabel}`;
    const expireSec = Expire > 1e12 ? Math.floor(Expire / 1000) : Expire;
    const expireStr = expireSec === 0
        ? `${t('expire')}: ${t('noExpire')}`
        : `${t('expire')}: ${dayjs(expireSec * 1000).format('YYYY-MM-DD')}`;
    const percentNumber = Total > 0 ? (usedBytes / Total) * 100 : null;
    return {
        expireStr,
        usageStr,
        percent: percentNumber,
        totalLabel,
        raw: JSON.stringify(info, null, 2),
    };
});
const showRawSub = ref(false);
const isUpdating = ref(false);
const isHealthChecking = ref(false);
const isKilling = ref(false);
const killSessionsClickHandler = async () => {
    if (isKilling.value)
        return;
    const count = Number(providerStats.value?.killableConnections || 0);
    if (count <= 0)
        return;
    const okConfirm = window.confirm(t('killProviderSessionsConfirm', {
        name: proxyProvider.value?.name || props.name,
        count,
    }));
    if (!okConfirm)
        return;
    isKilling.value = true;
    try {
        const ids = activeConnectionTargets.value
            .map((c) => String(c?.id || ''))
            .filter(Boolean);
        let ok = 0;
        let fail = 0;
        for (const id of ids) {
            try {
                await disconnectByIdSilentAPI(id);
                ok++;
            }
            catch {
                fail++;
            }
        }
        showNotification({
            content: 'killProviderSessionsDone',
            params: {
                ok: String(ok),
                fail: String(fail),
                count: String(ids.length),
            },
            type: fail > 0 ? 'alert-warning' : 'alert-success',
        });
    }
    finally {
        isKilling.value = false;
    }
};
const healthCheckClickHandler = async () => {
    if (isHealthChecking.value)
        return;
    isHealthChecking.value = true;
    try {
        await proxyProviderHealthCheckAPI(props.name);
        await fetchProxyProviderByNameOnly(props.name);
        isHealthChecking.value = false;
    }
    catch {
        isHealthChecking.value = false;
    }
};
const updateProviderClickHandler = async () => {
    if (isUpdating.value)
        return;
    isUpdating.value = true;
    try {
        await updateProxyProviderAPI(props.name);
        await fetchProxyProviderByNameOnly(props.name);
        isUpdating.value = false;
    }
    catch {
        isUpdating.value = false;
    }
};
// --- Quick actions for the currently used proxy inside this provider ---
const isActiveTesting = ref(false);
const activeProxyNode = computed(() => {
    const name = displayProxyName.value;
    return name ? proxyMap.value?.[name] : null;
});
const activeProxyUri = computed(() => {
    const node = activeProxyNode.value;
    if (!node)
        return '';
    const candidates = ['uri', 'url', 'link', 'share', 'subscription', 'subscribe', 'proxyUrl'];
    const v1 = getAnyFromObj(node, candidates);
    if (typeof v1 === 'string' && v1.includes('://'))
        return v1.trim();
    const v2 = getAnyFromObj(node?.extra, candidates);
    if (typeof v2 === 'string' && v2.includes('://'))
        return v2.trim();
    return '';
});
const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
};
const copyActiveName = async () => {
    if (!displayProxyName.value)
        return;
    await copyText(displayProxyName.value);
};
const copyActiveUri = async () => {
    if (!activeProxyUri.value)
        return;
    await copyText(activeProxyUri.value);
};
const testActiveNode = async () => {
    if (!displayProxyName.value)
        return;
    if (isActiveTesting.value)
        return;
    isActiveTesting.value = true;
    try {
        await proxyLatencyTest(displayProxyName.value, getTestUrl(proxyProvider.value?.name));
    }
    finally {
        isActiveTesting.value = false;
    }
};
useBounceOnVisible();
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
if (__VLS_ctx.proxyProvider) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        'data-nav-kind': "proxy-provider",
        'data-nav-value': (__VLS_ctx.proxyProvider.name),
    });
    const __VLS_0 = CollapseCard || CollapseCard;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        name: (__VLS_ctx.proxyProvider.name),
        ...{ class: "provider-collapse-card border border-base-content/10 shadow-lg" },
        ...{ style: (__VLS_ctx.providerCardSurfaceStyle) },
    }));
    const __VLS_2 = __VLS_1({
        name: (__VLS_ctx.proxyProvider.name),
        ...{ class: "provider-collapse-card border border-base-content/10 shadow-lg" },
        ...{ style: (__VLS_ctx.providerCardSurfaceStyle) },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['provider-collapse-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
    const { default: __VLS_5 } = __VLS_3.slots;
    {
        const { title: __VLS_6 } = __VLS_3.slots;
        const [{ open }] = __VLS_vSlot(__VLS_6);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2 rounded-xl px-2 py-1" },
            ...{ class: (open ? 'bg-base-200 ring-1 ring-base-300' : '') },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xl font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        if (__VLS_ctx.providerIconRaw) {
            const __VLS_7 = ProviderIconBadge;
            // @ts-ignore
            const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
                icon: (__VLS_ctx.providerIconRaw),
                size: "sm",
                ...{ class: "mr-1 align-middle" },
            }));
            const __VLS_9 = __VLS_8({
                icon: (__VLS_ctx.providerIconRaw),
                size: "sm",
                ...{ class: "mr-1 align-middle" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_8));
            /** @type {__VLS_StyleScopedClasses['mr-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['align-middle']} */ ;
        }
        (__VLS_ctx.proxyProvider.name);
        if (__VLS_ctx.providerTypeCounts.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 inline-flex flex-wrap items-center gap-1 align-middle" },
                title: (__VLS_ctx.providerTypesTooltip),
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['align-middle']} */ ;
            for (const [b] of __VLS_vFor((__VLS_ctx.providerTypeBadges))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (b.key),
                    ...{ class: "badge badge-sm opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (b.label);
                if (b.count > 1) {
                    (b.count);
                }
                // @ts-ignore
                [proxyProvider, proxyProvider, proxyProvider, proxyProvider, providerCardSurfaceStyle, providerIconRaw, providerIconRaw, providerTypeCounts, providerTypesTooltip, providerTypeBadges,];
            }
            if (__VLS_ctx.providerTypeOverflow) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-sm opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.providerTypeOverflow);
            }
        }
        if (__VLS_ctx.providerHealth) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-sm ml-2 align-middle" },
                ...{ class: (__VLS_ctx.providerHealth.badgeCls) },
                title: (__VLS_ctx.providerHealth.tip),
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['align-middle']} */ ;
            (__VLS_ctx.$t(__VLS_ctx.providerHealth.labelKey));
        }
        if (__VLS_ctx.sslExpireBadge) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-sm ml-2 align-middle" },
                ...{ class: (__VLS_ctx.sslExpireBadge.badgeCls) },
                title: (__VLS_ctx.sslExpireBadge.tip),
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['align-middle']} */ ;
            (__VLS_ctx.sslExpireBadge.text);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-sm ml-2 align-middle" },
            ...{ class: (__VLS_ctx.providerStats.active ? 'badge-success' : 'badge-ghost opacity-70') },
            title: (__VLS_ctx.providerStats.active ? __VLS_ctx.$t('providerActiveNowTip') : __VLS_ctx.$t('providerInactiveNowTip')),
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['align-middle']} */ ;
        (__VLS_ctx.providerStats.active ? __VLS_ctx.$t('providerActiveNow') : __VLS_ctx.$t('providerInactiveNow'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-base-content/60 text-sm font-normal" },
        });
        /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
        (__VLS_ctx.proxiesCount);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.killSessionsClickHandler) },
            type: "button",
            ...{ class: (__VLS_ctx.twMerge('btn btn-circle btn-sm z-30')) },
            disabled: (__VLS_ctx.providerStats.killableConnections <= 0 || __VLS_ctx.isKilling),
            title: (__VLS_ctx.providerStats.killableConnections > 0 ? __VLS_ctx.$t('killProviderSessions') : __VLS_ctx.$t('killProviderSessionsNone')),
        });
        if (__VLS_ctx.isKilling) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "loading loading-spinner loading-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['loading']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
        }
        else {
            let __VLS_12;
            /** @ts-ignore @type {typeof __VLS_components.XMarkIcon} */
            XMarkIcon;
            // @ts-ignore
            const __VLS_13 = __VLS_asFunctionalComponent1(__VLS_12, new __VLS_12({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_14 = __VLS_13({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_13));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.healthCheckClickHandler) },
            type: "button",
            ...{ class: (__VLS_ctx.twMerge('btn btn-circle btn-sm z-30')) },
        });
        if (__VLS_ctx.isHealthChecking) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "loading loading-spinner loading-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['loading']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
        }
        else {
            let __VLS_17;
            /** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
            BoltIcon;
            // @ts-ignore
            const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_19 = __VLS_18({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_18));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        if (__VLS_ctx.proxyProvider.vehicleType !== 'Inline') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.updateProviderClickHandler) },
                type: "button",
                ...{ class: (__VLS_ctx.twMerge('btn btn-circle btn-sm z-30', __VLS_ctx.isUpdating ? 'animate-spin' : '')) },
            });
            let __VLS_22;
            /** @ts-ignore @type {typeof __VLS_components.ArrowPathIcon} */
            ArrowPathIcon;
            // @ts-ignore
            const __VLS_23 = __VLS_asFunctionalComponent1(__VLS_22, new __VLS_22({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_24 = __VLS_23({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_23));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-base-content/60 flex items-end justify-between text-sm max-sm:flex-col max-sm:items-start" },
        });
        /** @type {__VLS_StyleScopedClasses['text-base-content/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-sm:flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-sm:items-start']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-h-10" },
        });
        /** @type {__VLS_StyleScopedClasses['min-h-10']} */ ;
        if (__VLS_ctx.subscriptionInfo) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            (__VLS_ctx.subscriptionInfo.expireStr);
        }
        if (__VLS_ctx.subscriptionInfo) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.subscriptionInfo.usageStr);
            if (__VLS_ctx.subscriptionInfo.totalLabel === '—') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.proxyProvider))
                                return;
                            if (!(__VLS_ctx.subscriptionInfo))
                                return;
                            if (!(__VLS_ctx.subscriptionInfo.totalLabel === '—'))
                                return;
                            __VLS_ctx.showRawSub = !__VLS_ctx.showRawSub;
                            // @ts-ignore
                            [proxyProvider, providerTypeOverflow, providerTypeOverflow, providerHealth, providerHealth, providerHealth, providerHealth, $t, $t, $t, $t, $t, $t, $t, sslExpireBadge, sslExpireBadge, sslExpireBadge, sslExpireBadge, providerStats, providerStats, providerStats, providerStats, providerStats, proxiesCount, killSessionsClickHandler, twMerge, twMerge, twMerge, isKilling, isKilling, healthCheckClickHandler, isHealthChecking, updateProviderClickHandler, isUpdating, subscriptionInfo, subscriptionInfo, subscriptionInfo, subscriptionInfo, subscriptionInfo, showRawSub, showRawSub,];
                        } },
                    type: "button",
                    ...{ class: "btn btn-ghost btn-xs" },
                    title: ('subscriptionInfo'),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            }
        }
        if (__VLS_ctx.subscriptionInfo?.percent != null) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.progress, __VLS_intrinsics.progress)({
                ...{ class: "progress progress-info w-full max-w-72" },
                value: (__VLS_ctx.subscriptionInfo?.percent ?? 0),
                max: "100",
            });
            /** @type {__VLS_StyleScopedClasses['progress']} */ ;
            /** @type {__VLS_StyleScopedClasses['progress-info']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-w-72']} */ ;
        }
        if (__VLS_ctx.sslExpireInfo) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-xs font-medium" },
                ...{ class: (__VLS_ctx.sslExpireInfo.cls) },
                title: (__VLS_ctx.sslExpireInfo.tip),
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (__VLS_ctx.$t('sslExpire'));
            (__VLS_ctx.sslExpireInfo.label);
        }
        if (open) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-wrap items-center gap-2 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('providerPanelUrl'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onKeydown: (__VLS_ctx.savePanelUrl) },
                ...{ onBlur: (__VLS_ctx.savePanelUrl) },
                ...{ class: "input input-bordered input-xs w-72 max-w-full" },
                placeholder: (__VLS_ctx.$t('providerPanelUrlPlaceholder')),
            });
            (__VLS_ctx.panelUrlDraft);
            /** @type {__VLS_StyleScopedClasses['input']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-72']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-w-full']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.openPanelUrl) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (!__VLS_ctx.panelUrl),
                title: (__VLS_ctx.$t('openPanel')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            let __VLS_27;
            /** @ts-ignore @type {typeof __VLS_components.ArrowTopRightOnSquareIcon} */
            ArrowTopRightOnSquareIcon;
            // @ts-ignore
            const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_29 = __VLS_28({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_28));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        if (open) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-xl border border-base-content/10 bg-base-200/60 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[11px] uppercase tracking-wide opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('providerSslStatus'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-sm font-semibold" },
                ...{ class: (__VLS_ctx.sslDiagnosticsCard.statusCls) },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            (__VLS_ctx.sslDiagnosticsCard.statusLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-xs opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.sslDiagnosticsCard.expiresLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-xl border border-base-content/10 bg-base-200/60 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[11px] uppercase tracking-wide opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('providerSslSourceLabel'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-sm font-medium" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            (__VLS_ctx.sslDiagnosticsCard.sourceLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-xs opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.sslDiagnosticsCard.checkedLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-xl border border-base-content/10 bg-base-200/60 p-3 sm:col-span-2 xl:col-span-1" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['xl:col-span-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[11px] uppercase tracking-wide opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('providerSslUrlLabel'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 break-all text-xs font-mono opacity-80" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
            (__VLS_ctx.sslDiagnosticsCard.urlLabel);
            if (__VLS_ctx.sslDiagnosticsCard.issuer) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-xl border border-base-content/10 bg-base-200/60 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] uppercase tracking-wide opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('providerSslIssuer'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-words text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                (__VLS_ctx.sslDiagnosticsCard.issuer);
            }
            if (__VLS_ctx.sslDiagnosticsCard.subject) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-xl border border-base-content/10 bg-base-200/60 p-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] uppercase tracking-wide opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('providerSslSubject'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-words text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                (__VLS_ctx.sslDiagnosticsCard.subject);
            }
            if (__VLS_ctx.sslDiagnosticsCard.san.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-xl border border-base-content/10 bg-base-200/60 p-3 sm:col-span-2 xl:col-span-1" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:col-span-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] uppercase tracking-wide opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('providerSslSan'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-words text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                (__VLS_ctx.sslDiagnosticsCard.san.join(', '));
            }
            if (__VLS_ctx.sslDiagnosticsCard.error) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "rounded-xl border border-error/30 bg-error/10 p-3 text-error sm:col-span-2 xl:col-span-3" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-error/30']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-error/10']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
                /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['xl:col-span-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[11px] uppercase tracking-wide opacity-80" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
                (__VLS_ctx.$t('providerSslError'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-1 break-words text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                (__VLS_ctx.sslDiagnosticsCard.error);
            }
        }
        if (__VLS_ctx.subscriptionInfo?.totalLabel === '—' && __VLS_ctx.showRawSub) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "mt-2 text-xs opacity-70 whitespace-pre-wrap break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (__VLS_ctx.subscriptionInfo.raw);
        }
        if (__VLS_ctx.providerStats.active || __VLS_ctx.providerStats.bytes > 0 || __VLS_ctx.providerStats.todayBytes > 0 || __VLS_ctx.providerStats.currentBytes > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 text-xs opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('connections'));
            (__VLS_ctx.providerStats.connections);
            if (__VLS_ctx.providerStats.killableConnections > 0 && __VLS_ctx.providerStats.killableConnections !== __VLS_ctx.providerStats.connections) {
                (__VLS_ctx.$t('killableConnections'));
                (__VLS_ctx.providerStats.killableConnections);
            }
            (__VLS_ctx.$t('proxies'));
            (__VLS_ctx.proxiesCount);
            (__VLS_ctx.$t('providerTrafficToday'));
            (__VLS_ctx.prettyBytesHelper(__VLS_ctx.providerStats.todayBytes, { binary: true }));
            (__VLS_ctx.$t('providerTrafficSinceReset'));
            (__VLS_ctx.prettyBytesHelper(__VLS_ctx.providerStats.bytes, { binary: true }));
            if (__VLS_ctx.providerStats.currentBytes > 0) {
                (__VLS_ctx.$t('providerTrafficLive'));
                (__VLS_ctx.prettyBytesHelper(__VLS_ctx.providerStats.currentBytes, { binary: true }));
            }
            if (__VLS_ctx.providerStats.speed > 0) {
                (__VLS_ctx.prettyBytesHelper(__VLS_ctx.providerStats.speed, { binary: true }));
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col items-end gap-1 max-sm:items-start" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-sm:items-start']} */ ;
        if (open) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                ...{ class: "dropdown dropdown-end" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown']} */ ;
            /** @type {__VLS_StyleScopedClasses['dropdown-end']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
                ...{ onClick: () => { } },
                ...{ class: "list-none cursor-pointer select-none flex items-center gap-1.5 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['list-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.activeProxy ? __VLS_ctx.$t('activeProxy') : __VLS_ctx.$t('bestLatencyProxy'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono truncate max-w-[18rem]" },
                ...{ class: (__VLS_ctx.activeProxy ? '' : 'opacity-70') },
                title: (__VLS_ctx.displayProxyName || ''),
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-w-[18rem]']} */ ;
            (__VLS_ctx.displayProxyName || '—');
            let __VLS_32;
            /** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
            ChevronDownIcon;
            // @ts-ignore
            const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
                ...{ class: "h-4 w-4 opacity-60" },
            }));
            const __VLS_34 = __VLS_33({
                ...{ class: "h-4 w-4 opacity-60" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_33));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "dropdown-content z-[999] mt-2 w-72 rounded-box bg-base-200 bg-opacity-100 p-2 shadow ring-1 ring-base-300" },
            });
            /** @type {__VLS_StyleScopedClasses['dropdown-content']} */ ;
            /** @type {__VLS_StyleScopedClasses['z-[999]']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-72']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-opacity-100']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['shadow']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-base-300']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-xs mb-2" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.activeProxy ? __VLS_ctx.$t('activeProxy') : __VLS_ctx.$t('bestLatencyProxy'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (__VLS_ctx.displayProxyName || '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-1.5" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.copyActiveName) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs btn-circle" },
                disabled: (!__VLS_ctx.displayProxyName),
                title: (__VLS_ctx.$t('copyProxyName')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            let __VLS_37;
            /** @ts-ignore @type {typeof __VLS_components.ClipboardDocumentIcon} */
            ClipboardDocumentIcon;
            // @ts-ignore
            const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_39 = __VLS_38({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_38));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.testActiveNode) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs btn-circle" },
                disabled: (__VLS_ctx.isActiveTesting || !__VLS_ctx.displayProxyName),
                title: (__VLS_ctx.$t('testProxyLatency')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            if (__VLS_ctx.isActiveTesting) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "loading loading-spinner loading-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['loading']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
                /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
            }
            else {
                let __VLS_42;
                /** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
                BoltIcon;
                // @ts-ignore
                const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_44 = __VLS_43({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_43));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            if (__VLS_ctx.activeProxyUri) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.copyActiveUri) },
                    type: "button",
                    ...{ class: "btn btn-ghost btn-xs btn-circle" },
                    title: (__VLS_ctx.$t('copyProxyUri')),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
                let __VLS_47;
                /** @ts-ignore @type {typeof __VLS_components.LinkIcon} */
                LinkIcon;
                // @ts-ignore
                const __VLS_48 = __VLS_asFunctionalComponent1(__VLS_47, new __VLS_47({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_49 = __VLS_48({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_48));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.openTopologyWithProvider) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs btn-circle" },
                title: (__VLS_ctx.$t('showInTopology')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            let __VLS_52;
            /** @ts-ignore @type {typeof __VLS_components.PresentationChartLineIcon} */
            PresentationChartLineIcon;
            // @ts-ignore
            const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_54 = __VLS_53({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_53));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            if (__VLS_ctx.panelUrl) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.openPanelUrl) },
                    type: "button",
                    ...{ class: "btn btn-ghost btn-xs btn-circle" },
                    title: (__VLS_ctx.$t('openPanel')),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
                let __VLS_57;
                /** @ts-ignore @type {typeof __VLS_components.ArrowTopRightOnSquareIcon} */
                ArrowTopRightOnSquareIcon;
                // @ts-ignore
                const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_59 = __VLS_58({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_58));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.$t('updated'));
        (__VLS_ctx.fromNow(__VLS_ctx.proxyProvider.updatedAt));
        // @ts-ignore
        [proxyProvider, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, providerStats, proxiesCount, subscriptionInfo, subscriptionInfo, subscriptionInfo, subscriptionInfo, showRawSub, sslExpireInfo, sslExpireInfo, sslExpireInfo, sslExpireInfo, savePanelUrl, savePanelUrl, panelUrlDraft, openPanelUrl, openPanelUrl, panelUrl, panelUrl, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, sslDiagnosticsCard, prettyBytesHelper, prettyBytesHelper, prettyBytesHelper, prettyBytesHelper, activeProxy, activeProxy, activeProxy, displayProxyName, displayProxyName, displayProxyName, displayProxyName, displayProxyName, copyActiveName, testActiveNode, isActiveTesting, isActiveTesting, activeProxyUri, copyActiveUri, openTopologyWithProvider, fromNow,];
    }
    {
        const { preview: __VLS_62 } = __VLS_3.slots;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        const __VLS_63 = ProxyPreview;
        // @ts-ignore
        const __VLS_64 = __VLS_asFunctionalComponent1(__VLS_63, new __VLS_63({
            ...{ 'onNodefilter': {} },
            nodes: (__VLS_ctx.renderProxies),
            now: (__VLS_ctx.displayProxyName),
            groupName: (__VLS_ctx.proxyProvider.name),
            enableTopologyFilter: (true),
        }));
        const __VLS_65 = __VLS_64({
            ...{ 'onNodefilter': {} },
            nodes: (__VLS_ctx.renderProxies),
            now: (__VLS_ctx.displayProxyName),
            groupName: (__VLS_ctx.proxyProvider.name),
            enableTopologyFilter: (true),
        }, ...__VLS_functionalComponentArgsRest(__VLS_64));
        let __VLS_68;
        const __VLS_69 = ({ nodefilter: {} },
            { onNodefilter: (__VLS_ctx.openTopologyWithProxy) });
        var __VLS_66;
        var __VLS_67;
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "dropdown dropdown-end" },
        });
        /** @type {__VLS_StyleScopedClasses['dropdown']} */ ;
        /** @type {__VLS_StyleScopedClasses['dropdown-end']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
            ...{ onClick: () => { } },
            ...{ class: "list-none cursor-pointer select-none flex items-center gap-1.5 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['list-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.activeProxy ? __VLS_ctx.$t('activeProxy') : __VLS_ctx.$t('bestLatencyProxy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono truncate max-w-[18rem]" },
            ...{ class: (__VLS_ctx.activeProxy ? '' : 'opacity-70') },
            title: (__VLS_ctx.displayProxyName || ''),
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[18rem]']} */ ;
        (__VLS_ctx.displayProxyName || '—');
        let __VLS_70;
        /** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
        ChevronDownIcon;
        // @ts-ignore
        const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
            ...{ class: "h-4 w-4 opacity-60" },
        }));
        const __VLS_72 = __VLS_71({
            ...{ class: "h-4 w-4 opacity-60" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_71));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "dropdown-content z-[999] mt-2 w-72 rounded-box bg-base-200 bg-opacity-100 p-2 shadow ring-1 ring-base-300" },
        });
        /** @type {__VLS_StyleScopedClasses['dropdown-content']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[999]']} */ ;
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-72']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-opacity-100']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-base-300']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs mb-2" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.activeProxy ? __VLS_ctx.$t('activeProxy') : __VLS_ctx.$t('bestLatencyProxy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (__VLS_ctx.displayProxyName || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-1.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.copyActiveName) },
            type: "button",
            ...{ class: "btn btn-ghost btn-xs btn-circle" },
            disabled: (!__VLS_ctx.displayProxyName),
            title: (__VLS_ctx.$t('copyProxyName')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        let __VLS_75;
        /** @ts-ignore @type {typeof __VLS_components.ClipboardDocumentIcon} */
        ClipboardDocumentIcon;
        // @ts-ignore
        const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_77 = __VLS_76({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_76));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.testActiveNode) },
            type: "button",
            ...{ class: "btn btn-ghost btn-xs btn-circle" },
            disabled: (__VLS_ctx.isActiveTesting || !__VLS_ctx.displayProxyName),
            title: (__VLS_ctx.$t('testProxyLatency')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        if (__VLS_ctx.isActiveTesting) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "loading loading-spinner loading-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['loading']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
            /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
        }
        else {
            let __VLS_80;
            /** @ts-ignore @type {typeof __VLS_components.BoltIcon} */
            BoltIcon;
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_82 = __VLS_81({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        if (__VLS_ctx.activeProxyUri) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.copyActiveUri) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs btn-circle" },
                title: (__VLS_ctx.$t('copyProxyUri')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            let __VLS_85;
            /** @ts-ignore @type {typeof __VLS_components.LinkIcon} */
            LinkIcon;
            // @ts-ignore
            const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_87 = __VLS_86({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_86));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.openTopologyWithProvider) },
            type: "button",
            ...{ class: "btn btn-ghost btn-xs btn-circle" },
            title: (__VLS_ctx.$t('showInTopology')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
        let __VLS_90;
        /** @ts-ignore @type {typeof __VLS_components.PresentationChartLineIcon} */
        PresentationChartLineIcon;
        // @ts-ignore
        const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_92 = __VLS_91({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_91));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        if (__VLS_ctx.panelUrl) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.openPanelUrl) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs btn-circle" },
                title: (__VLS_ctx.$t('openPanel')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
            let __VLS_95;
            /** @ts-ignore @type {typeof __VLS_components.ArrowTopRightOnSquareIcon} */
            ArrowTopRightOnSquareIcon;
            // @ts-ignore
            const __VLS_96 = __VLS_asFunctionalComponent1(__VLS_95, new __VLS_95({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_97 = __VLS_96({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_96));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        // @ts-ignore
        [proxyProvider, $t, $t, $t, $t, $t, $t, $t, $t, $t, openPanelUrl, panelUrl, activeProxy, activeProxy, activeProxy, displayProxyName, displayProxyName, displayProxyName, displayProxyName, displayProxyName, displayProxyName, copyActiveName, testActiveNode, isActiveTesting, isActiveTesting, activeProxyUri, copyActiveUri, openTopologyWithProvider, renderProxies, openTopologyWithProxy,];
    }
    {
        const { content: __VLS_100 } = __VLS_3.slots;
        const [{ showFullContent }] = __VLS_vSlot(__VLS_100);
        const __VLS_101 = ProxyNodeGrid || ProxyNodeGrid;
        // @ts-ignore
        const __VLS_102 = __VLS_asFunctionalComponent1(__VLS_101, new __VLS_101({}));
        const __VLS_103 = __VLS_102({}, ...__VLS_functionalComponentArgsRest(__VLS_102));
        const { default: __VLS_106 } = __VLS_104.slots;
        for (const [node] of __VLS_vFor((showFullContent
            ? __VLS_ctx.renderProxies
            : __VLS_ctx.renderProxies.slice(0, __VLS_ctx.twoColumnProxyGroup ? 48 : 96)))) {
            const __VLS_107 = ProxyNodeCard;
            // @ts-ignore
            const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
                key: (node),
                name: (node),
                groupName: (__VLS_ctx.name),
            }));
            const __VLS_109 = __VLS_108({
                key: (node),
                name: (node),
                groupName: (__VLS_ctx.name),
            }, ...__VLS_functionalComponentArgsRest(__VLS_108));
            // @ts-ignore
            [renderProxies, renderProxies, twoColumnProxyGroup, name,];
        }
        // @ts-ignore
        [];
        var __VLS_104;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_3;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-box border border-base-content/10 p-4 text-sm opacity-80 shadow-lg" },
        ...{ style: (__VLS_ctx.providerCardSurfaceStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.name);
}
// @ts-ignore
[providerCardSurfaceStyle, name,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
