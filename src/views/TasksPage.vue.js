/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { fetchRuleProvidersAPI, updateRuleProviderSilentAPI, zashboardVersion, version as coreVersion } from '@/api';
import { buildRollingReleaseUrl } from '@/config/project';
import { agentGeoInfoAPI, agentGeoUpdateAPI, agentLogsAPI, agentLogsFollowAPI, agentRulesInfoAPI, agentStatusAPI, agentUsersDbGetRevAPI, } from '@/api/agent';
import BackendVersion from '@/components/common/BackendVersion.vue';
import ProviderIconBadge from '@/components/common/ProviderIconBadge.vue';
import TopologyActionButtons from '@/components/common/TopologyActionButtons.vue';
import { useStorage } from '@vueuse/core';
import { getLabelFromBackend, prettyBytesHelper } from '@/helper/utils';
import { navigateToTopology } from '@/helper/topologyNav';
import { parseDateMaybe } from '@/helper/providerHealth';
import { showNotification } from '@/helper/notification';
import { decodeB64Utf8 } from '@/helper/b64';
import { countryCodeToFlagEmoji, normalizeProviderIcon } from '@/helper/providerIcon';
import { FLAG_CODES } from '@/helper/flagIcons';
import { activeBackend, backendList } from '@/store/setup';
import { agentEnabled, agentUrl } from '@/store/agent';
import { proxyProviderIconMap, proxyProviderSubscriptionUrlMap, proxyProviderSslWarnDaysMap, sslNearExpiryDaysDefault } from '@/store/settings';
import { agentProviderByName, agentProviders, agentProvidersAt, agentProvidersError, agentProvidersJobStatus, agentProvidersNextCheckAtMs, agentProvidersOk, agentProvidersSslCacheReady, agentProvidersSslRefreshPending, agentProvidersSslRefreshing, fetchAgentProviders, panelSslCheckedAt, panelSslErrorByName, panelSslNotAfterByName, panelSslProbeError, panelSslProbeLoading, panelSslUrlByName, providerHealthActionsAvailable, providerHealthAvailable, refreshAgentProviderSslCache } from '@/store/providerHealth';
import { fetchProxyProvidersOnly, proxyProviederList } from '@/store/proxies';
import { userLimitProfiles } from '@/store/userLimitProfiles';
import { userLimitSnapshots } from '@/store/userLimitSnapshots';
import { autoDisconnectLimitedUsers, hardBlockLimitedUsers, managedLanDisallowedCidrs, userLimits } from '@/store/userLimits';
import { activeConnections, closedConnections } from '@/store/connections';
import { ruleHitMap } from '@/store/rules';
import { clearJobs, finishJob, jobHistory, startJob } from '@/store/jobs';
import { connectionProviderCandidates, connectionProxyCandidates, providerProxyNames, providerTrafficPullNow, providerTrafficPushNow, providerTrafficSyncState, } from '@/store/providerActivity';
import { applyUserEnforcementNow, getUserLimitState } from '@/composables/userLimits';
import dayjs from 'dayjs';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import router from '@/router';
import { ChevronDownIcon } from '@heroicons/vue/20/solid';
import { usersDbConflictCount, usersDbConflictDiff, usersDbHasConflict, usersDbHistoryItems, usersDbLastError, usersDbLastPullAt, usersDbLastPushAt, usersDbLocalDirty, usersDbPhase, usersDbPullNow, usersDbPushNow, usersDbRemoteRev, usersDbRemoteUpdatedAt, usersDbResolveMerge, usersDbResolvePull, usersDbResolvePush, usersDbResolveSmartMerge, usersDbRestoreRev, usersDbFetchHistory, usersDbSyncEnabled, } from '@/store/usersDbSync';
const busy = ref(false);
const jobs = computed(() => jobHistory.value || []);
// --- Router-agent status (versions) ---
const agentStatusLite = ref({ ok: false });
const refreshAgentStatusLite = async () => {
    if (!agentEnabled.value) {
        agentStatusLite.value = { ok: false };
        return;
    }
    agentStatusLite.value = await agentStatusAPI();
};
watch([agentEnabled, agentUrl], () => {
    refreshAgentStatusLite();
});
// --- Router external-ui-url helper (anti-cache) ---
const routerUiUrl = computed(() => {
    const v = encodeURIComponent(zashboardVersion.value || '');
    return buildRollingReleaseUrl(v);
});
const copyRouterUiUrl = async (asYaml) => {
    try {
        const text = asYaml ? `external-ui-url: "${routerUiUrl.value}"` : routerUiUrl.value;
        await navigator.clipboard.writeText(text);
        showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
};
// --- Proxy providers: shared 3x-ui subscription URLs (synced via users DB) ---
const providersPanelBusy = ref(false);
const providersPanelError = ref('');
const providersPanelList = ref([]);
const providersPanelExpanded = ref(true);
const providersPanelAt = ref(0);
const providerSslCacheRefreshBusy = ref(false);
const providerSslProbeBusy = computed(() => providerSslCacheRefreshBusy.value);
const providerSslProbeErrorText = computed(() => panelSslProbeError.value ? friendlyProviderPanelError(panelSslProbeError.value, 'ssl') : '');
const providerSslLastCheckedAtMs = computed(() => Math.max(providersPanelAt.value || 0, panelSslCheckedAt.value || 0, agentProvidersAt.value || 0));
const providerSourceUrlDraftMap = ref({});
const PROVIDERS_PANEL_EXPANDED_LS_KEY = 'zash.tasks.providersPanels.expanded';
try {
    const v = localStorage.getItem(PROVIDERS_PANEL_EXPANDED_LS_KEY);
    // default: expanded
    if (v === '0')
        providersPanelExpanded.value = false;
    if (v === '1')
        providersPanelExpanded.value = true;
}
catch {
    // ignore
}
watch(providersPanelExpanded, (v) => {
    try {
        localStorage.setItem(PROVIDERS_PANEL_EXPANDED_LS_KEY, v ? '1' : '0');
    }
    catch {
        // ignore
    }
}, { flush: 'post' });
const toggleProvidersPanelExpanded = () => {
    providersPanelExpanded.value = !providersPanelExpanded.value;
};
// (no per-provider accordion state; rendered as a table)
const collectOrderedProviderNames = () => {
    const ordered = [];
    const seen = new Set();
    const pushName = (raw) => {
        const name = String(raw || '').trim();
        if (!name || seen.has(name))
            return;
        seen.add(name);
        ordered.push(name);
    };
    try {
        for (const p of (proxyProviederList.value || [])) {
            const name = String(p?.name || '').trim();
            if (!name || name === 'default' || p?.vehicleType === 'Compatible')
                continue;
            pushName(name);
        }
    }
    catch {
        // ignore
    }
    for (const name of Object.keys(proxyProviderSubscriptionUrlMap.value || {}))
        pushName(name);
    for (const name of Object.keys(proxyProviderIconMap.value || {}))
        pushName(name);
    for (const name of Object.keys(proxyProviderSslWarnDaysMap.value || {}))
        pushName(name);
    for (const it of (providersPanelList.value || []))
        pushName(it?.name);
    return ordered;
};
// Render list should include all providers known to UI plus provider rows returned by the backend.
const providersPanelRenderList = computed(() => {
    const orderedNames = collectOrderedProviderNames();
    const providerMetaByName = new Map();
    const agentMetaByName = new Map();
    try {
        for (const p of (proxyProviederList.value || [])) {
            const name = String(p?.name || '').trim();
            if (!name || name === 'default' || p?.vehicleType === 'Compatible')
                continue;
            providerMetaByName.set(name, p);
        }
    }
    catch {
        // ignore
    }
    for (const it of (providersPanelList.value || [])) {
        const name = String(it?.name || '').trim();
        if (!name)
            continue;
        agentMetaByName.set(name, it);
    }
    const readSourceUrl = (_provider, _agentProvider, name) => {
        const saved = String((proxyProviderSubscriptionUrlMap.value || {})[String(name || '').trim()] || '').trim();
        if (saved)
            return saved;
        return String((panelSslUrlByName.value || {})[String(name || '').trim()] || '').trim();
    };
    const readSslNotAfter = (_provider, _agentProvider, name) => {
        return String((panelSslNotAfterByName.value || {})[String(name || '').trim()] || '').trim();
    };
    const readSslError = (_provider, _agentProvider, name) => {
        return String((panelSslErrorByName.value || {})[String(name || '').trim()] || '').trim();
    };
    const readCheckedAtMs = (_provider, _agentProvider, name) => {
        const probeRaw = Number(panelSslCheckedAt.value || 0);
        if (probeRaw > 0 && ((panelSslNotAfterByName.value || {})[String(name || '').trim()] || (panelSslErrorByName.value || {})[String(name || '').trim()] || (panelSslUrlByName.value || {})[String(name || '').trim()])) {
            return probeRaw;
        }
        return 0;
    };
    return orderedNames.map((name) => {
        const providerMeta = providerMetaByName.get(name) || null;
        const agentMeta = agentMetaByName.get(name) || (agentProviderByName.value || {})[name] || null;
        return {
            name,
            url: readSourceUrl(providerMeta, agentMeta, name),
            host: String(agentMeta?.host || '').trim(),
            port: String(agentMeta?.port || '').trim(),
            sslNotAfter: readSslNotAfter(providerMeta, agentMeta, name),
            sslError: readSslError(providerMeta, agentMeta, name),
            sslCheckedAtMs: readCheckedAtMs(providerMeta, agentMeta, name),
        };
    });
});
const providersPanelStats = computed(() => {
    const now = dayjs();
    let withUrl = 0;
    let withoutUrl = 0;
    let problems = 0;
    let expiringSoon = 0;
    for (const item of providersPanelRenderList.value || []) {
        const url = String(item?.url || '').trim();
        if (url)
            withUrl += 1;
        else
            withoutUrl += 1;
        const err = String(item?.sslError || '').trim();
        const date = parseDateMaybe(item?.sslNotAfter);
        if (err) {
            problems += 1;
            continue;
        }
        if (date) {
            const days = date.diff(now, 'day');
            if (days <= getProviderWarnDays(item.name))
                expiringSoon += 1;
        }
    }
    return {
        total: providersPanelRenderList.value.length,
        withUrl,
        withoutUrl,
        problems,
        expiringSoon,
    };
});
const fmtTs = (ms) => {
    const n = typeof ms === 'number' ? ms : typeof ms === 'string' ? Number(ms) : 0;
    if (!n)
        return '—';
    return dayjs(n).format('DD-MM-YYYY HH:mm:ss');
};
const getProviderWarnDays = (name) => {
    const k = String(name || '').trim();
    const override = Number((proxyProviderSslWarnDaysMap.value || {})[k]);
    const base = Number(sslNearExpiryDaysDefault.value);
    const v = Number.isFinite(override) ? override : Number.isFinite(base) ? base : 2;
    return Math.max(0, Math.min(365, Math.trunc(v)));
};
const getProviderSslWarnOverride = (name) => {
    const k = String(name || '').trim();
    const v = Number((proxyProviderSslWarnDaysMap.value || {})[k]);
    return Number.isFinite(v) ? Math.max(0, Math.min(365, Math.trunc(v))) : null;
};
const setProviderSslWarnOverride = (name, raw) => {
    const k = String(name || '').trim();
    if (!k)
        return;
    const s = String(raw ?? '').trim();
    const cur = { ...(proxyProviderSslWarnDaysMap.value || {}) };
    if (!s) {
        delete cur[k];
        proxyProviderSslWarnDaysMap.value = cur;
        return;
    }
    const n = Math.trunc(Number(s));
    if (!Number.isFinite(n))
        return;
    cur[k] = Math.max(0, Math.min(365, n));
    proxyProviderSslWarnDaysMap.value = cur;
};
const clearProviderSslWarnOverride = (name) => {
    const k = String(name || '').trim();
    if (!k)
        return;
    const cur = { ...(proxyProviderSslWarnDaysMap.value || {}) };
    delete cur[k];
    proxyProviderSslWarnDaysMap.value = cur;
};
const getProviderSourceUrl = (item) => {
    return String(item?.url || '').trim();
};
const syncProviderSourceUrlDrafts = () => {
    const next = {};
    for (const item of providersPanelRenderList.value || []) {
        const name = String(item?.name || '').trim();
        if (!name)
            continue;
        next[name] = getProviderSourceUrl(item);
    }
    providerSourceUrlDraftMap.value = next;
};
watch(providersPanelRenderList, () => {
    syncProviderSourceUrlDrafts();
}, { immediate: true });
const getProviderSourceUrlDraft = (name) => {
    const key = String(name || '').trim();
    return String((providerSourceUrlDraftMap.value || {})[key] || '').trim();
};
const setProviderSourceUrlDraft = (name, raw) => {
    const key = String(name || '').trim();
    if (!key)
        return;
    providerSourceUrlDraftMap.value = {
        ...(providerSourceUrlDraftMap.value || {}),
        [key]: String(raw || ''),
    };
};
const saveProviderSourceUrl = (name) => {
    const key = String(name || '').trim();
    if (!key)
        return;
    const raw = getProviderSourceUrlDraft(key);
    const normalized = raw && !/^(https?|wss):\/\//i.test(raw) ? `https://${raw}` : raw;
    const nextDraft = { ...(providerSourceUrlDraftMap.value || {}), [key]: normalized };
    providerSourceUrlDraftMap.value = nextDraft;
    const cur = { ...(proxyProviderSubscriptionUrlMap.value || {}) };
    if (!normalized)
        delete cur[key];
    else
        cur[key] = normalized;
    proxyProviderSubscriptionUrlMap.value = cur;
};
const sslSubscriptionInfo = (item) => {
    const d = parseDateMaybe(item?.sslNotAfter);
    const backendProbeLabel = !providerHealthAvailable.value
        ? t('providerHealthBackendUnavailable')
        : activeBackend.value?.kind === 'ubuntu-service'
            ? t('providerSslSourceUbuntuService')
            : t('providerSslSourceCompatibilityBridge');
    if (!d) {
        const err = String(item?.sslError || '').trim();
        const hasUrl = Boolean(getProviderSourceUrl(item));
        const pending = providerHealthAvailable.value && !err && (agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value || !agentProvidersSslCacheReady.value);
        if (pending && hasUrl) {
            return {
                text: t('providerSslRefreshing'),
                cls: 'text-info',
                title: `${t('providerSslSourceSubscription')} • ${backendProbeLabel} • ${t('providerSslRefreshingTip')}`,
            };
        }
        return {
            text: err ? t('providerSslError') : (hasUrl ? (providerHealthAvailable.value ? '—' : t('providerSslServerNotConfiguredShort')) : t('providersPanelNoSubscriptionUrl')),
            cls: err ? 'text-error' : (!hasUrl ? 'text-warning' : (!providerHealthAvailable.value ? 'text-warning' : '')),
            title: err
                ? `${t('providerSslSourceSubscription')} • ${backendProbeLabel} • ${t('providerSslError')}: ${err}${hasUrl ? ` • URL: ${getProviderSourceUrl(item)}` : ''}`
                : `${t('providerSslSourceSubscription')} • ${backendProbeLabel}`,
        };
    }
    const days = d.diff(dayjs(), 'day');
    const date = d.format('DD-MM-YYYY HH:mm:ss');
    const warnDays = getProviderWarnDays(item.name);
    const cls = days < 0 ? 'text-error' : days <= warnDays ? 'text-warning' : 'text-base-content/60';
    const text = days < 0 ? `${date} (${t('providerSslStatusExpired')})` : `${date} (${days}${t('daysShort')})`;
    const title = `${t('providerSslSourceSubscription')} • ${backendProbeLabel} • ${t('checkedAt')}: ${fmtTs(item?.sslCheckedAtMs || providersPanelAt.value)}`;
    return { text, cls, title };
};
const providerSslMetaText = (item) => {
    const checked = fmtTs(item?.sslCheckedAtMs || providersPanelAt.value);
    const err = String(item?.sslError || '').trim() || providerSslProbeErrorText.value;
    const url = String(item?.url || '').trim();
    if (!url)
        return `${t('providerPanelUrl')}: ${t('providersPanelNoSubscriptionUrl')}`;
    if (err)
        return `${t('checkedAt')}: ${checked} • ${t('providerSslError')}: ${err}`;
    return `${t('checkedAt')}: ${checked}`;
};
// ---- Provider icon (flag/globe) ----
const providerIconPopular = [
    'RU', 'US', 'DE', 'FR', 'GB', 'NL', 'FI', 'SE', 'NO', 'EE', 'LV', 'LT', 'PL', 'UA', 'RO', 'TR', 'ES', 'IT', 'CH', 'AT', 'CZ', 'SG', 'JP', 'KR', 'CN', 'HK', 'IN',
];
const providerIconSearch = ref('');
const providerIconCountries = computed(() => {
    const all = Array.isArray(FLAG_CODES) ? FLAG_CODES : [];
    const q = String(providerIconSearch.value || '').trim().toUpperCase();
    if (q) {
        return all.filter((cc) => cc.includes(q));
    }
    // default: popular first
    const pop = providerIconPopular.filter((cc) => all.includes(cc));
    const popSet = new Set(pop);
    const rest = all.filter((cc) => !popSet.has(cc));
    return [...pop, ...rest];
});
const getProviderIconRaw = (name) => {
    const k = String(name || '').trim();
    if (!k)
        return '';
    return normalizeProviderIcon((proxyProviderIconMap.value || {})[k]);
};
const setProviderIcon = (name, icon) => {
    const k = String(name || '').trim();
    if (!k)
        return;
    const nv = normalizeProviderIcon(icon);
    const cur = { ...(proxyProviderIconMap.value || {}) };
    if (!nv)
        delete cur[k];
    else
        cur[k] = nv;
    proxyProviderIconMap.value = cur;
};
// Icon picker popover (teleported to body)
const providerIconPickerOpen = ref(false);
const providerIconPickerProvider = ref('');
const providerIconPickerAnchor = ref(null);
const providerIconPickerRoot = ref(null);
const providerIconPickerPos = reactive({ top: 0, left: 0 });
const providerIconPickerStyle = computed(() => ({
    top: `${providerIconPickerPos.top}px`,
    left: `${providerIconPickerPos.left}px`,
}));
const repositionProviderIconPicker = () => {
    const el = providerIconPickerAnchor.value;
    if (!el)
        return;
    const r = el.getBoundingClientRect();
    // Keep the popover fully visible even on narrow viewports.
    const W = Math.min(288, Math.max(220, window.innerWidth - 16));
    const PAD = 8;
    let left = Math.round(r.left);
    // Prefer aligning right edge with trigger if possible.
    left = Math.round(r.right - W);
    const maxLeft = Math.max(PAD, window.innerWidth - W - PAD);
    left = Math.max(PAD, Math.min(maxLeft, left));
    // Place below, but keep inside viewport.
    let top = Math.round(r.bottom + 8);
    const approxH = 220;
    const maxTop = Math.max(PAD, window.innerHeight - approxH - PAD);
    top = Math.max(PAD, Math.min(maxTop, top));
    providerIconPickerPos.left = left;
    providerIconPickerPos.top = top;
};
const openProviderIconPicker = (e, name) => {
    providerIconPickerProvider.value = String(name || '').trim();
    providerIconPickerAnchor.value = e?.currentTarget;
    providerIconPickerOpen.value = true;
    nextTick(() => repositionProviderIconPicker());
};
const closeProviderIconPicker = () => {
    providerIconPickerOpen.value = false;
    providerIconPickerProvider.value = '';
    providerIconPickerAnchor.value = null;
    providerIconPickerRoot.value = null;
    providerIconSearch.value = '';
};
const pickProviderIconFromPicker = (icon) => {
    const name = providerIconPickerProvider.value;
    if (!name)
        return;
    setProviderIcon(name, icon);
    closeProviderIconPicker();
};
const onDocKeydownProviderIconPicker = (ev) => {
    if (!providerIconPickerOpen.value)
        return;
    if (ev.key === 'Escape')
        closeProviderIconPicker();
};
const onDocMousedownProviderIconPicker = (ev) => {
    if (!providerIconPickerOpen.value)
        return;
    const t = ev.target;
    if (!t)
        return;
    const anchor = providerIconPickerAnchor.value;
    if (anchor && (t === anchor || anchor.contains(t)))
        return;
    // Click inside picker is stopped at the picker root; this is a last-resort close.
    closeProviderIconPicker();
};
let providerIconPickerRaf = 0;
const onScrollProviderIconPicker = (ev) => {
    if (!providerIconPickerOpen.value)
        return;
    // Don't close/reposition while the user scrolls inside the picker itself.
    const root = providerIconPickerRoot.value;
    const t = ev.target;
    if (root && t && typeof t.nodeType === 'number') {
        try {
            if (root.contains(t))
                return;
        }
        catch {
            // ignore
        }
    }
    if (providerIconPickerRaf)
        return;
    providerIconPickerRaf = window.requestAnimationFrame(() => {
        providerIconPickerRaf = 0;
        repositionProviderIconPicker();
    });
};
onMounted(() => {
    window.addEventListener('resize', repositionProviderIconPicker);
    window.addEventListener('scroll', onScrollProviderIconPicker, true);
    document.addEventListener('keydown', onDocKeydownProviderIconPicker);
    document.addEventListener('mousedown', onDocMousedownProviderIconPicker);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', repositionProviderIconPicker);
    window.removeEventListener('scroll', onScrollProviderIconPicker, true);
    document.removeEventListener('keydown', onDocKeydownProviderIconPicker);
    document.removeEventListener('mousedown', onDocMousedownProviderIconPicker);
});
const fmtProviderIcon = (v) => {
    const n = normalizeProviderIcon(v);
    if (!n)
        return '—';
    if (n === 'globe')
        return '🌐';
    const f = countryCodeToFlagEmoji(n);
    return f ? `${f} ${n}` : n;
};
const friendlyProviderPanelError = (err, kind = 'providers') => {
    const raw = String(err || '').trim();
    if (!raw)
        return '—';
    const low = raw.toLowerCase();
    if (low.includes('timeout')) {
        return kind === 'ssl'
            ? 'SSL-проверка не успела завершиться. Остальные данные страницы доступны.'
            : 'Список провайдеров отвечает слишком долго. Попробуйте обновить ещё раз.';
    }
    if (low.includes('server-side-ssl-unavailable') || low.includes('capability-missing')) {
        return kind === 'ssl'
            ? 'Серверная проверка сертификатов для провайдеров ещё не подключена на этом Ubuntu-хосте.'
            : 'Провайдерная SSL-проверка ещё не подключена на этом Ubuntu-хосте.';
    }
    if (low.includes('offline') || low.includes('network error') || low.includes('failed to fetch')) {
        return kind === 'ssl'
            ? 'SSL-проверка сейчас недоступна.'
            : 'Не удалось получить список провайдеров.';
    }
    return raw;
};
const loadProvidersPanel = async (force = false) => {
    try {
        await fetchProxyProvidersOnly();
    }
    catch {
        // keep Tasks usable even if providers API is temporarily unavailable
    }
    if (!providerHealthAvailable.value) {
        providersPanelList.value = [];
        providersPanelError.value = '';
        providersPanelAt.value = Date.now();
        return;
    }
    if (providersPanelBusy.value)
        return;
    providersPanelBusy.value = true;
    providersPanelError.value = '';
    try {
        await fetchAgentProviders(force);
        if (!agentProvidersOk.value && (!Array.isArray(agentProviders.value) || !agentProviders.value.length)) {
            providersPanelError.value = agentProvidersError.value || 'failed';
            providersPanelList.value = [];
        }
        else {
            providersPanelError.value = agentProvidersError.value || '';
            providersPanelList.value = Array.isArray(agentProviders.value) ? agentProviders.value : [];
        }
        panelSslProbeError.value = null;
        providersPanelAt.value = agentProvidersAt.value || Date.now();
    }
    catch (e) {
        providersPanelError.value = e?.message || 'failed';
        providersPanelList.value = [];
    }
    finally {
        providersPanelBusy.value = false;
    }
};
const refreshProvidersPanel = async (force = false) => {
    await loadProvidersPanel(force);
    try {
        await fetchProxyProvidersOnly();
        if ((proxyProviederList.value || []).length > 0) {
            providersPanelError.value = '';
        }
    }
    catch {
        // ignore providers-only refresh failure here
    }
};
const hasDirectProviderSslSnapshot = computed(() => {
    return Boolean(panelSslCheckedAt.value ||
        Object.keys(panelSslNotAfterByName.value || {}).length ||
        Object.keys(panelSslErrorByName.value || {}).length);
});
const providerSslCacheStatusText = computed(() => {
    if (panelSslProbeLoading.value)
        return t('providerSslRefreshing');
    if (hasDirectProviderSslSnapshot.value)
        return '';
    if (!providerHealthAvailable.value)
        return providersPanelRenderList.value.some((it) => String(it?.url || '').trim()) ? t('providerSslServerNotConfigured') : '';
    if (agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value)
        return t('providerSslRefreshing');
    if (!agentProvidersSslCacheReady.value && providersPanelRenderList.value.length > 0)
        return t('providerSslPending');
    return '';
});
const providerSslCacheStatusClass = computed(() => {
    if (panelSslProbeLoading.value)
        return 'text-info';
    if (hasDirectProviderSslSnapshot.value)
        return 'text-base-content/60';
    if (!providerHealthAvailable.value)
        return providersPanelRenderList.value.some((it) => String(it?.url || '').trim()) ? 'text-warning' : 'text-base-content/60';
    if (agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value)
        return 'text-info';
    if (!agentProvidersSslCacheReady.value && providersPanelRenderList.value.length > 0)
        return 'text-warning';
    return 'text-base-content/60';
});
const refreshProviderSslCacheNow = async () => {
    if (!providerHealthActionsAvailable.value || providerSslCacheRefreshBusy.value) {
        if (!providerHealthActionsAvailable.value)
            panelSslProbeError.value = 'server-side-ssl-unavailable';
        return;
    }
    providerSslCacheRefreshBusy.value = true;
    try {
        let refreshError = '';
        try {
            const res = await refreshAgentProviderSslCache();
            if (!res?.ok)
                refreshError = String(res?.error || 'failed');
        }
        catch (e) {
            refreshError = String(e?.message || 'failed');
        }
        for (let i = 0; i < 12; i += 1) {
            await refreshProvidersPanel(true);
            const hasCachedRows = (providersPanelRenderList.value || []).some((it) => String(it?.sslNotAfter || '').trim() || String(it?.sslError || '').trim());
            if ((!agentProvidersSslRefreshing.value && !agentProvidersSslRefreshPending.value) || hasCachedRows)
                break;
            await sleep(1000);
        }
        const rows = Array.isArray(providersPanelRenderList.value) ? providersPanelRenderList.value : [];
        const hasUrls = rows.some((it) => String(it?.url || '').trim());
        const hasSslRows = rows.some((it) => String(it?.sslNotAfter || '').trim() || String(it?.sslError || '').trim());
        const stillPending = agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value;
        if (!hasUrls) {
            panelSslProbeError.value = providersPanelError.value || refreshError || 'no-providers';
            showNotification({ content: panelSslProbeError.value || 'operationFailed', type: 'alert-error', timeout: 2200 });
            return;
        }
        // The compatibility bridge may not expose a dedicated refresh endpoint. In that
        // case mihomo_providers still queues the async cache rebuild, so keep the UI in
        // a pending state instead of showing a false hard failure.
        panelSslProbeError.value = stillPending || hasSslRows ? null : (providersPanelError.value || '');
        showNotification({ content: stillPending && !hasSslRows ? 'refreshProviderSslCache' : 'refreshProviderSslCache', type: 'alert-success', timeout: 1600 });
    }
    catch (e) {
        panelSslProbeError.value = String(e?.message || 'failed');
        showNotification({ content: e?.message || 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        providerSslCacheRefreshBusy.value = false;
    }
};
const PROVIDER_TRAFFIC_DEBUG_EXPANDED_LS_KEY = 'zash.tasks.providerTrafficDebug.expanded';
const providerTrafficDebugExpanded = ref(false);
const providerTrafficDebugProvider = ref('');
const providerTrafficDebugIncludeClosed = ref(true);
const providerTrafficDebugLimit = ref(60);
try {
    const v = localStorage.getItem(PROVIDER_TRAFFIC_DEBUG_EXPANDED_LS_KEY);
    if (v === '1')
        providerTrafficDebugExpanded.value = true;
}
catch {
    // ignore
}
watch(providerTrafficDebugExpanded, (v) => {
    try {
        localStorage.setItem(PROVIDER_TRAFFIC_DEBUG_EXPANDED_LS_KEY, v ? '1' : '0');
    }
    catch {
        // ignore
    }
}, { flush: 'post' });
const toggleProviderTrafficDebugExpanded = () => {
    providerTrafficDebugExpanded.value = !providerTrafficDebugExpanded.value;
};
const providerTrafficDebugProviderNames = computed(() => {
    const names = new Set();
    for (const p of (proxyProviederList.value || [])) {
        const name = String(p?.name || '').trim();
        if (!name || name === 'default')
            continue;
        names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
});
watch(providerTrafficDebugProviderNames, (names) => {
    if (!names.length) {
        providerTrafficDebugProvider.value = '';
        return;
    }
    if (!names.includes(providerTrafficDebugProvider.value)) {
        providerTrafficDebugProvider.value = names[0] || '';
    }
}, { immediate: true });
const providerTrafficSyncBadgeClass = computed(() => {
    if (!agentEnabled.value)
        return 'badge-ghost';
    if (providerTrafficSyncState.value.pushing || providerTrafficSyncState.value.pulling)
        return 'badge-info';
    if (!providerTrafficSyncState.value.bootstrapped)
        return 'badge-warning';
    if (providerTrafficSyncState.value.dirty)
        return 'badge-warning';
    return 'badge-success';
});
const providerTrafficSyncBadgeText = computed(() => {
    if (!agentEnabled.value)
        return t('agentDisabled');
    if (providerTrafficSyncState.value.pushing)
        return t('providerTrafficSyncPushing');
    if (providerTrafficSyncState.value.pulling)
        return t('providerTrafficSyncPulling');
    if (!providerTrafficSyncState.value.bootstrapped)
        return t('providerTrafficSyncBootstrapping');
    if (providerTrafficSyncState.value.dirty)
        return t('providerTrafficSyncDirty');
    return t('providerTrafficSyncSynced');
});
const refreshProviderTrafficSync = async () => {
    await providerTrafficPullNow();
};
const flushProviderTrafficSync = async () => {
    await providerTrafficPushNow();
};
const providerTrafficDebugSelectedName = computed(() => String(providerTrafficDebugProvider.value || '').trim());
const providerTrafficDebugSelectedProvider = computed(() => {
    const name = providerTrafficDebugSelectedName.value;
    return (proxyProviederList.value || []).find((p) => String(p?.name || '').trim() === name) || null;
});
const providerTrafficDebugProxyNames = computed(() => {
    const provider = providerTrafficDebugSelectedProvider.value;
    const names = provider ? providerProxyNames(provider) : [];
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
});
const providerTrafficDebugProxySet = computed(() => new Set(providerTrafficDebugProxyNames.value));
const formatDebugNames = (items) => {
    const names = (items || []).map((item) => String(item || '').trim()).filter(Boolean);
    return names.length ? names.join(' • ') : '—';
};
const toDebugRow = (conn, source) => {
    const selected = providerTrafficDebugSelectedName.value;
    if (!selected)
        return null;
    const providerCandidates = connectionProviderCandidates(conn);
    const proxyCandidates = connectionProxyCandidates(conn);
    let matchedBy = '';
    let matchedProxy = '';
    if (providerCandidates.includes(selected)) {
        matchedBy = 'provider';
        matchedProxy = proxyCandidates[0] || '';
    }
    else {
        for (const candidate of proxyCandidates) {
            if (providerTrafficDebugProxySet.value.has(candidate)) {
                matchedBy = 'proxy';
                matchedProxy = candidate;
                break;
            }
        }
    }
    if (!matchedBy)
        return null;
    const download = Number(conn?.download ?? 0) || 0;
    const upload = Number(conn?.upload ?? 0) || 0;
    const speed = source === 'active'
        ? (Number(conn?.downloadSpeed ?? 0) || 0) + (Number(conn?.uploadSpeed ?? 0) || 0)
        : 0;
    const startedAt = dayjs(String(conn?.start || '')).valueOf();
    const metadata = conn?.metadata || {};
    const providerChains = Array.isArray(conn?.providerChains)
        ? conn.providerChains
        : Array.isArray(metadata?.providerChains)
            ? metadata.providerChains
            : [];
    const host = String(metadata?.host || metadata?.sniffHost || metadata?.destinationIP || '—').trim() || '—';
    const port = String(metadata?.destinationPort || '').trim();
    const rule = String(conn?.rule || '').trim();
    const rulePayload = String(conn?.rulePayload || '').trim();
    return {
        key: `${source}:${String(conn?.id || '').trim()}`,
        source,
        id: String(conn?.id || '').trim() || '—',
        matchedBy: matchedBy,
        matchedProxy,
        providerCandidatesLabel: formatDebugNames(providerCandidates),
        proxyCandidatesLabel: formatDebugNames(proxyCandidates),
        chainsLabel: formatDebugNames(Array.isArray(conn?.chains) ? conn.chains : []),
        providerChainsLabel: formatDebugNames(providerChains),
        specialProxy: String(metadata?.specialProxy || '').trim(),
        providerNameField: String(conn?.providerName || conn?.provider || metadata?.providerName || metadata?.provider || '').trim(),
        startLabel: startedAt && Number.isFinite(startedAt) ? dayjs(startedAt).format('DD-MM HH:mm:ss') : '—',
        startedAt: Number.isFinite(startedAt) ? startedAt : 0,
        hostLabel: port ? `${host}:${port}` : host,
        ruleLabel: [rule, rulePayload].filter(Boolean).join(' • ') || '—',
        download,
        upload,
        totalBytes: download + upload,
        speed,
    };
};
const providerTrafficDebugAllRows = computed(() => {
    const rows = [];
    for (const conn of activeConnections.value || []) {
        const row = toDebugRow(conn, 'active');
        if (row)
            rows.push(row);
    }
    if (providerTrafficDebugIncludeClosed.value) {
        for (const conn of closedConnections.value || []) {
            const row = toDebugRow(conn, 'closed');
            if (row)
                rows.push(row);
        }
    }
    return rows.sort((a, b) => {
        if (b.startedAt !== a.startedAt)
            return b.startedAt - a.startedAt;
        if (b.totalBytes !== a.totalBytes)
            return b.totalBytes - a.totalBytes;
        return a.id.localeCompare(b.id);
    });
});
const providerTrafficDebugRows = computed(() => {
    const limit = Math.max(10, Math.min(200, Math.trunc(Number(providerTrafficDebugLimit.value) || 60)));
    return providerTrafficDebugAllRows.value.slice(0, limit);
});
const providerTrafficDebugSummary = computed(() => {
    const rows = providerTrafficDebugAllRows.value;
    return {
        total: rows.length,
        active: rows.filter((row) => row.source === 'active').length,
        closed: rows.filter((row) => row.source === 'closed').length,
        byProvider: rows.filter((row) => row.matchedBy === 'provider').length,
        byProxy: rows.filter((row) => row.matchedBy === 'proxy').length,
    };
});
// --- Live logs (router-agent) ---
const logSource = ref('mihomo');
const logLines = ref(200);
const logsAuto = ref(true);
const logsBusy = ref(false);
const logText = ref('');
const logPath = ref('');
const logOffset = ref(0);
const logMode = ref('poll');
let logTimer = null;
const refreshLogs = async () => {
    if (!agentEnabled.value)
        return;
    if (logsBusy.value)
        return;
    logsBusy.value = true;
    try {
        if (logSource.value === 'config') {
            const r = await agentLogsAPI({ type: 'config', lines: logLines.value });
            logMode.value = 'full';
            logOffset.value = 0;
            if (!r?.ok) {
                logText.value = r?.error || 'failed';
                return;
            }
            logPath.value = r?.path || '';
            logText.value = decodeB64Utf8(r?.contentB64) || '';
            return;
        }
        // Prefer efficient incremental follow (agent >= 0.5.3). Fallback to full polling on older agents.
        const r = await agentLogsFollowAPI({ type: logSource.value, lines: logLines.value, offset: logOffset.value });
        if (r?.ok) {
            logPath.value = r?.path || '';
            const chunk = decodeB64Utf8(r?.contentB64) || '';
            const mode = (r?.mode || 'delta');
            logMode.value = mode;
            const newOffset = typeof r?.offset === 'number' ? r.offset : logOffset.value;
            const resetLike = logOffset.value === 0 || mode === 'full' || newOffset < logOffset.value;
            if (resetLike)
                logText.value = chunk;
            else
                logText.value = (logText.value || '') + chunk;
            logOffset.value = newOffset;
            // Keep last N lines (avoid runaway memory).
            const maxLines = Math.min(2000, Math.max(50, logLines.value || 200));
            const arr = (logText.value || '').split(/\r?\n/);
            if (arr.length > maxLines)
                logText.value = arr.slice(-maxLines).join('\n');
            return;
        }
        // Fallback: full fetch
        const r2 = await agentLogsAPI({ type: logSource.value, lines: logLines.value });
        logMode.value = 'poll';
        logOffset.value = 0;
        if (!r2?.ok) {
            logText.value = r2?.error || 'failed';
            return;
        }
        logPath.value = r2?.path || '';
        logText.value = decodeB64Utf8(r2?.contentB64) || '';
    }
    finally {
        logsBusy.value = false;
    }
};
const forceRefreshLogs = () => {
    logOffset.value = 0;
    logText.value = '';
    refreshLogs();
};
const stopTimer = () => {
    if (logTimer) {
        clearInterval(logTimer);
        logTimer = null;
    }
};
const startTimer = () => {
    stopTimer();
    if (!logsAuto.value)
        return;
    if (!agentEnabled.value)
        return;
    logTimer = setInterval(() => {
        refreshLogs();
    }, 2000);
};
onMounted(() => {
    refreshAgentStatusLite();
    refreshLogs();
    startTimer();
    refreshFreshness();
    refreshProvidersPanel(false);
    checkUpstream();
    startUpstreamTimer();
});
onBeforeUnmount(() => {
    stopTimer();
    stopUpstreamTimer();
});
watch([logsAuto, logSource, logLines, agentEnabled], () => {
    logOffset.value = 0;
    refreshLogs();
    startTimer();
});
// --- Data freshness (GEO files + filter policy files) ---
const { t } = useI18n();
// --- Shared users DB sync status (Source IP mapping) ---
const usersDbBusy = computed(() => usersDbPhase.value === 'pulling' || usersDbPhase.value === 'pushing');
const usersDbBadge = computed(() => {
    if (!usersDbSyncEnabled.value)
        return { text: 'OFF', cls: 'badge-ghost' };
    if (!agentEnabled.value)
        return { text: t('localOnly'), cls: 'badge-ghost' };
    if (usersDbPhase.value === 'idle' && !usersDbLocalDirty.value)
        return { text: t('synced'), cls: 'badge-success' };
    if (usersDbPhase.value === 'pulling' || usersDbPhase.value === 'pushing')
        return { text: t('running'), cls: 'badge-warning' };
    if (usersDbPhase.value === 'conflict')
        return { text: t('conflict'), cls: 'badge-warning' };
    if (usersDbPhase.value === 'offline')
        return { text: t('offline'), cls: 'badge-warning' };
    return { text: t('pendingChanges'), cls: 'badge-warning' };
});
const usersDbConflictSummary = computed(() => {
    const d = usersDbConflictDiff.value;
    if (!d)
        return null;
    return {
        labelsLocalOnly: d.labels.localOnly.length,
        labelsRemoteOnly: d.labels.remoteOnly.length,
        labelsChanged: d.labels.changed.length,
        urlsLocalOnly: d.urls.localOnly.length,
        urlsRemoteOnly: d.urls.remoteOnly.length,
        urlsChanged: d.urls.changed.length,
        iconsLocalOnly: d.icons?.localOnly?.length || 0,
        iconsRemoteOnly: d.icons?.remoteOnly?.length || 0,
        iconsChanged: d.icons?.changed?.length || 0,
        tunnelsLocalOnly: d.tunnels.localOnly.length,
        tunnelsRemoteOnly: d.tunnels.remoteOnly.length,
        tunnelsChanged: d.tunnels.changed.length,
        userLimitsLocalOnly: d.userLimits.localOnly.length,
        userLimitsRemoteOnly: d.userLimits.remoteOnly.length,
        userLimitsChanged: d.userLimits.changed.length,
        sslDefaultChanged: d.ssl.defaultDays.changed ? 1 : 0,
        warnDaysChanged: d.ssl.providerDays.changed.length,
        safeAutoMerge: d.safeAutoMerge,
    };
});
const usersDbSmartOpen = ref(false);
const usersDbSmartChoices = ref({
    labels: {},
    urls: {},
    icons: {},
    tunnels: {},
    warnDays: {},
    sslDefault: { mode: 'local' },
});
const initUsersDbSmartChoices = () => {
    const d = usersDbConflictDiff.value;
    if (!d)
        return;
    const labels = {};
    const urls = {};
    const icons = {};
    const tunnels = {};
    const warnDays = {};
    for (const it of d.labels.changed || [])
        labels[String(it.key)] = { mode: 'local' };
    for (const it of d.urls.changed || [])
        urls[String(it.provider)] = { mode: 'local' };
    for (const it of (d.icons?.changed || []))
        icons[String(it.provider)] = { mode: 'local' };
    for (const it of d.tunnels.changed || [])
        tunnels[String(it.name)] = { mode: 'local' };
    for (const it of d.ssl.providerDays.changed || [])
        warnDays[String(it.provider)] = { mode: 'local' };
    usersDbSmartChoices.value = {
        labels,
        urls,
        icons,
        tunnels,
        warnDays,
        sslDefault: { mode: 'local' },
    };
};
const usersDbSmartSetAll = (section, mode) => {
    const v = usersDbSmartChoices.value;
    const obj = v[section] || {};
    for (const k of Object.keys(obj)) {
        obj[k] = { ...(obj[k] || {}), mode };
    }
    ;
    usersDbSmartChoices.value[section] = obj;
};
const usersDbSmartApply = async () => {
    const res = await usersDbResolveSmartMerge(usersDbSmartChoices.value);
    if (res?.ok) {
        usersDbSmartOpen.value = false;
        showNotification({ content: 'done', type: 'alert-success', timeout: 1800 });
    }
    else {
        showNotification({ content: String(res?.error || 'operationFailed'), type: 'alert-error', timeout: 2600 });
    }
};
watch(() => usersDbSmartOpen.value, (v) => {
    if (v)
        initUsersDbSmartChoices();
});
const usersDbModeMeta = (mode) => {
    if (mode === 'remote')
        return { mode: 'remote', modeLabel: t('router') };
    if (mode === 'custom')
        return { mode: 'custom', modeLabel: t('custom') };
    return { mode: 'local', modeLabel: t('local') };
};
const usersDbReasonText = (mode, fallback, customProvided = false) => {
    if (mode === 'remote')
        return t('usersDbReasonRouterSelected');
    if (mode === 'local')
        return t('usersDbReasonLocalSelected');
    if (customProvided)
        return t('usersDbReasonCustomApplied');
    if (fallback === 'remote')
        return t('usersDbReasonCustomFallbackRouter');
    return t('usersDbReasonCustomFallbackLocal');
};
const usersDbSectionLabel = (section) => {
    if (section === 'labels')
        return t('usersDbLabels');
    if (section === 'urls')
        return t('usersDbPanels');
    if (section === 'icons')
        return t('providerIcon');
    if (section === 'tunnels')
        return t('routerTrafficTunnelDescriptionsSettingsTitle');
    if (section === 'warnDays')
        return t('sslWarnDays');
    if (section === 'userLimits')
        return t('usersDbUserLimits');
    return t('sslWarnThreshold');
};
const fmtUserLimitMbps = (bps) => {
    const n = Number(bps || 0);
    if (!Number.isFinite(n) || n <= 0)
        return '';
    return `${((n * 8) / (1024 ** 2)).toFixed(1)} Mbps`;
};
const fmtUserLimitPeriod = (period) => {
    if (period === '1d')
        return '24ч';
    if (period === 'month')
        return 'месяц';
    return '30д';
};
const usersDbNormalizeScope = (scope) => {
    const ids = Array.isArray(scope) ? scope.map((it) => String(it || '').trim()).filter(Boolean) : [];
    return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
};
const usersDbFormatScopeText = (scope) => {
    const ids = usersDbNormalizeScope(scope);
    if (!ids.length)
        return t('all');
    return ids
        .map((id) => {
        const backend = backendList.value.find((it) => String(it?.uuid || '').trim() === id);
        return backend ? getLabelFromBackend(backend) : id;
    })
        .join(', ');
};
const usersDbFormatLabelSummary = (label, scope) => {
    const safeLabel = String(label || '').trim() || '—';
    return `${safeLabel} · ${t('agentRestoreScope')}: ${usersDbFormatScopeText(scope)}`;
};
const fmtUserLimitSummary = (limit) => {
    const l = limit || {};
    const parts = [];
    if (l.disabled)
        parts.push('ручная блокировка');
    if (l.enabled === false)
        parts.push('лимит выключен');
    if (typeof l.trafficLimitBytes === 'number' && Number.isFinite(l.trafficLimitBytes) && l.trafficLimitBytes > 0) {
        parts.push(`${t('trafficLimit')}: ${prettyBytesHelper(l.trafficLimitBytes)} / ${fmtUserLimitPeriod(l.trafficPeriod)}`);
    }
    if (typeof l.bandwidthLimitBps === 'number' && Number.isFinite(l.bandwidthLimitBps) && l.bandwidthLimitBps > 0) {
        parts.push(`${t('bandwidthLimit')}: ${fmtUserLimitMbps(l.bandwidthLimitBps)}`);
    }
    if (l.mac)
        parts.push(`MAC: ${l.mac}`);
    return parts.length ? parts.join(' · ') : '—';
};
const usersDbUserLimitReasonChanged = () => t('usersDbReasonUserLimitLocalWins');
const usersDbUserLimitReasonLocalOnly = () => t('usersDbReasonUserLimitLocalOnly');
const usersDbUserLimitReasonRouterOnly = () => t('usersDbReasonUserLimitRouterOnly');
const usersDbLabelChangedRows = computed(() => {
    const changed = usersDbConflictDiff.value?.labels?.changed || [];
    return changed.map((it) => {
        const choice = usersDbSmartChoices.value.labels?.[it.key];
        const meta = usersDbModeMeta((choice?.mode || 'local'));
        const customValue = String(choice?.customLabel || '').trim();
        const resultLabel = meta.mode === 'remote'
            ? it.remote.label
            : meta.mode === 'custom'
                ? (customValue || it.local.label)
                : it.local.label;
        const resultScope = meta.mode === 'remote' ? it.remote.scope : it.local.scope;
        const reason = usersDbReasonText(meta.mode, customValue ? undefined : 'local', customValue.length > 0);
        return {
            key: it.key,
            remote: it.remote.label,
            local: it.local.label,
            remoteScope: usersDbNormalizeScope(it.remote?.scope),
            localScope: usersDbNormalizeScope(it.local?.scope),
            remoteScopeText: usersDbFormatScopeText(it.remote?.scope),
            localScopeText: usersDbFormatScopeText(it.local?.scope),
            resultLabel,
            resultScope: usersDbNormalizeScope(resultScope),
            resultScopeText: usersDbFormatScopeText(resultScope),
            resultSummary: usersDbFormatLabelSummary(resultLabel, resultScope),
            reason,
            mode: meta.mode,
            modeLabel: meta.modeLabel,
        };
    });
});
const usersDbUrlChangedRows = computed(() => {
    const changed = usersDbConflictDiff.value?.urls?.changed || [];
    return changed.map((it) => {
        const choice = usersDbSmartChoices.value.urls?.[it.provider];
        const meta = usersDbModeMeta((choice?.mode || 'local'));
        const customValue = String(choice?.customUrl || '').trim();
        const result = meta.mode === 'remote' ? it.remote : meta.mode === 'custom' ? (customValue || it.remote) : it.local;
        const reason = usersDbReasonText(meta.mode, customValue ? undefined : 'remote', customValue.length > 0);
        return {
            provider: it.provider,
            remote: it.remote,
            local: it.local,
            result,
            reason,
            mode: meta.mode,
            modeLabel: meta.modeLabel,
        };
    });
});
const usersDbIconChangedRows = computed(() => {
    const changed = (usersDbConflictDiff.value?.icons?.changed || []);
    return changed.map((it) => {
        const choice = usersDbSmartChoices.value.icons?.[it.provider];
        const meta = usersDbModeMeta((choice?.mode || 'local'));
        const customRaw = String(choice?.customIcon || '').trim();
        const customValue = normalizeProviderIcon(choice?.customIcon);
        const result = meta.mode === 'remote'
            ? it.remote
            : meta.mode === 'custom'
                ? (customValue || (customRaw === '' ? '' : it.remote))
                : it.local;
        const reason = usersDbReasonText(meta.mode, undefined, meta.mode === 'custom' ? (customRaw === '' || customValue !== '') : false);
        return {
            provider: it.provider,
            remote: it.remote,
            local: it.local,
            result,
            reason,
            mode: meta.mode,
            modeLabel: meta.modeLabel,
        };
    });
});
const usersDbSslDefaultRow = computed(() => {
    const row = usersDbConflictDiff.value?.ssl?.defaultDays;
    if (!row?.changed)
        return null;
    const choice = usersDbSmartChoices.value.sslDefault;
    const meta = usersDbModeMeta((choice?.mode || 'local'));
    const customValue = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays)
        ? Math.max(0, Math.min(365, Math.trunc(choice.customDays)))
        : row.local;
    const result = meta.mode === 'remote' ? row.remote : meta.mode === 'custom' ? customValue : row.local;
    const hasCustom = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays);
    return {
        remote: row.remote,
        local: row.local,
        result,
        reason: usersDbReasonText(meta.mode, hasCustom ? undefined : 'local', hasCustom),
        mode: meta.mode,
        modeLabel: meta.modeLabel,
    };
});
const usersDbWarnDaysChangedRows = computed(() => {
    const changed = usersDbConflictDiff.value?.ssl?.providerDays?.changed || [];
    return changed.map((it) => {
        const choice = usersDbSmartChoices.value.warnDays?.[it.provider];
        const meta = usersDbModeMeta((choice?.mode || 'local'));
        const customValue = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays)
            ? Math.max(0, Math.min(365, Math.trunc(choice.customDays)))
            : it.local;
        const result = meta.mode === 'remote' ? it.remote : meta.mode === 'custom' ? customValue : it.local;
        const hasCustom = typeof choice?.customDays === 'number' && Number.isFinite(choice.customDays);
        return {
            provider: it.provider,
            remote: it.remote,
            local: it.local,
            result,
            reason: usersDbReasonText(meta.mode, hasCustom ? undefined : 'local', hasCustom),
            mode: meta.mode,
            modeLabel: meta.modeLabel,
        };
    });
});
const usersDbTunnelWinnerMeta = (name) => {
    const key = String(name || '').trim().toLowerCase();
    const choice = (usersDbSmartChoices.value.tunnels || {})[key];
    const mode = (choice?.mode || 'local');
    return usersDbModeMeta(mode);
};
const usersDbTunnelChangedRows = computed(() => {
    const changed = usersDbConflictDiff.value?.tunnels?.changed || [];
    return changed.map((it) => {
        const meta = usersDbTunnelWinnerMeta(it.name);
        const key = String(it.name || '').trim().toLowerCase();
        const customValue = String(usersDbSmartChoices.value.tunnels?.[key]?.customDescription || '').trim();
        const result = meta.mode === 'remote' ? it.remote : meta.mode === 'custom' ? (customValue || it.local) : it.local;
        return {
            name: it.name,
            remote: it.remote,
            local: it.local,
            result,
            reason: usersDbReasonText(meta.mode, customValue ? undefined : 'local', customValue.length > 0),
            mode: meta.mode,
            modeLabel: meta.modeLabel,
        };
    });
});
const usersDbUserLimitChangedRows = computed(() => {
    const changed = usersDbConflictDiff.value?.userLimits?.changed || [];
    return changed.map((it) => ({
        user: it.user,
        remote: fmtUserLimitSummary(it.remote),
        local: fmtUserLimitSummary(it.local),
        result: fmtUserLimitSummary(it.local),
        reason: usersDbUserLimitReasonChanged(),
        mode: 'local',
        modeLabel: t('local'),
    }));
});
const usersDbSmartPreviewRows = computed(() => {
    const rows = [];
    for (const row of usersDbLabelChangedRows.value) {
        rows.push({
            section: 'labels',
            sectionLabel: usersDbSectionLabel('labels'),
            key: row.key,
            result: row.resultLabel,
            resultText: row.resultSummary,
            mode: row.mode,
            modeLabel: row.modeLabel,
            reason: row.reason,
        });
    }
    for (const row of usersDbUrlChangedRows.value) {
        rows.push({
            section: 'urls',
            sectionLabel: usersDbSectionLabel('urls'),
            key: row.provider,
            result: row.result,
            resultText: row.result || '—',
            mode: row.mode,
            modeLabel: row.modeLabel,
            reason: row.reason,
        });
    }
    for (const row of usersDbIconChangedRows.value) {
        rows.push({
            section: 'icons',
            sectionLabel: usersDbSectionLabel('icons'),
            key: row.provider,
            result: row.result,
            resultText: fmtProviderIcon(row.result),
            mode: row.mode,
            modeLabel: row.modeLabel,
            reason: row.reason,
        });
    }
    for (const row of usersDbTunnelChangedRows.value) {
        rows.push({
            section: 'tunnels',
            sectionLabel: usersDbSectionLabel('tunnels'),
            key: row.name,
            result: row.result,
            resultText: row.result || '—',
            mode: row.mode,
            modeLabel: row.modeLabel,
            reason: row.reason,
        });
    }
    if (usersDbSslDefaultRow.value) {
        rows.push({
            section: 'sslDefault',
            sectionLabel: usersDbSectionLabel('sslDefault'),
            key: 'sslNearExpiryDaysDefault',
            result: usersDbSslDefaultRow.value.result,
            resultText: String(usersDbSslDefaultRow.value.result),
            mode: usersDbSslDefaultRow.value.mode,
            modeLabel: usersDbSslDefaultRow.value.modeLabel,
            reason: usersDbSslDefaultRow.value.reason,
        });
    }
    for (const row of usersDbWarnDaysChangedRows.value) {
        rows.push({
            section: 'warnDays',
            sectionLabel: usersDbSectionLabel('warnDays'),
            key: row.provider,
            result: row.result,
            resultText: String(row.result),
            mode: row.mode,
            modeLabel: row.modeLabel,
            reason: row.reason,
        });
    }
    for (const row of usersDbUserLimitChangedRows.value) {
        rows.push({
            section: 'userLimits',
            sectionLabel: usersDbSectionLabel('userLimits'),
            key: row.user,
            result: row.result,
            resultText: row.result,
            mode: row.mode,
            modeLabel: row.modeLabel,
            reason: row.reason,
        });
    }
    for (const row of (usersDbConflictDiff.value?.userLimits?.localOnly || [])) {
        rows.push({
            section: 'userLimits',
            sectionLabel: usersDbSectionLabel('userLimits'),
            key: row.user,
            result: fmtUserLimitSummary(row.local),
            resultText: fmtUserLimitSummary(row.local),
            mode: 'local',
            modeLabel: t('local'),
            reason: usersDbUserLimitReasonLocalOnly(),
        });
    }
    for (const row of (usersDbConflictDiff.value?.userLimits?.remoteOnly || [])) {
        rows.push({
            section: 'userLimits',
            sectionLabel: usersDbSectionLabel('userLimits'),
            key: row.user,
            result: fmtUserLimitSummary(row.remote),
            resultText: fmtUserLimitSummary(row.remote),
            mode: 'remote',
            modeLabel: t('router'),
            reason: usersDbUserLimitReasonRouterOnly(),
        });
    }
    return rows;
});
const usersDbSmartPreviewStats = computed(() => {
    const d = usersDbConflictDiff.value;
    const rows = usersDbSmartPreviewRows.value;
    if (!d)
        return { changedRows: 0, changedSections: 0, localOnlyRows: 0, routerOnlyRows: 0 };
    const changedSections = new Set(rows.map((row) => row.section)).size;
    const localOnlyRows = (d.labels?.localOnly?.length || 0) + (d.urls?.localOnly?.length || 0) + (d.icons?.localOnly?.length || 0) + (d.tunnels?.localOnly?.length || 0) + (d.ssl?.providerDays?.localOnly?.length || 0) + (d.userLimits?.localOnly?.length || 0);
    const routerOnlyRows = (d.labels?.remoteOnly?.length || 0) + (d.urls?.remoteOnly?.length || 0) + (d.icons?.remoteOnly?.length || 0) + (d.tunnels?.remoteOnly?.length || 0) + (d.ssl?.providerDays?.remoteOnly?.length || 0) + (d.userLimits?.remoteOnly?.length || 0);
    const changedRows = (d.labels?.changed?.length || 0) + (d.urls?.changed?.length || 0) + (d.icons?.changed?.length || 0) + (d.tunnels?.changed?.length || 0) + (d.ssl?.providerDays?.changed?.length || 0) + (d.ssl?.defaultDays?.changed ? 1 : 0) + (d.userLimits?.changed?.length || 0);
    return {
        changedRows,
        changedSections,
        localOnlyRows,
        routerOnlyRows,
    };
});
const usersDbConflictPreview = computed(() => {
    const d = usersDbConflictDiff.value;
    const summary = usersDbConflictSummary.value;
    if (!d || !summary)
        return null;
    return {
        generatedAt: dayjs().toISOString(),
        summary,
        applyPreview: {
            stats: usersDbSmartPreviewStats.value,
            rows: usersDbSmartPreviewRows.value,
        },
        changed: {
            labels: usersDbLabelChangedRows.value,
            panels: usersDbUrlChangedRows.value,
            icons: usersDbIconChangedRows.value,
            tunnels: usersDbTunnelChangedRows.value,
            sslDefault: usersDbSslDefaultRow.value,
            sslWarnDays: usersDbWarnDaysChangedRows.value,
            userLimits: usersDbUserLimitChangedRows.value,
        },
        localOnly: {
            labels: d.labels?.localOnly || [],
            panels: d.urls?.localOnly || [],
            icons: d.icons?.localOnly || [],
            tunnels: d.tunnels?.localOnly || [],
            sslWarnDays: d.ssl?.providerDays?.localOnly || [],
            userLimits: (d.userLimits?.localOnly || []).map((it) => ({ user: it.user, summary: fmtUserLimitSummary(it.local), raw: it.local })),
        },
        routerOnly: {
            labels: d.labels?.remoteOnly || [],
            panels: d.urls?.remoteOnly || [],
            icons: d.icons?.remoteOnly || [],
            tunnels: d.tunnels?.remoteOnly || [],
            sslWarnDays: d.ssl?.providerDays?.remoteOnly || [],
            userLimits: (d.userLimits?.remoteOnly || []).map((it) => ({ user: it.user, summary: fmtUserLimitSummary(it.remote), raw: it.remote })),
        },
    };
});
const usersDbConflictPreviewText = computed(() => {
    const p = usersDbConflictPreview.value;
    return p ? JSON.stringify(p, null, 2) : '';
});
watch(usersDbHasConflict, (v) => {
    if (!v)
        usersDbSmartOpen.value = false;
});
const refreshUsersDbHistory = async () => {
    if (!agentEnabled.value || !usersDbSyncEnabled.value)
        return;
    await usersDbFetchHistory();
};
watch([agentEnabled, usersDbSyncEnabled], () => {
    refreshUsersDbHistory();
});
// --- Users DB history: read-only revision preview (no restore) ---
const usersDbViewBusy = ref(false);
const usersDbViewError = ref('');
const usersDbViewRev = ref(0);
const usersDbViewUpdatedAt = ref('');
const usersDbViewPayload = ref(null);
const usersDbViewRawText = ref('');
const extractUsersDbPayloadView = (v) => {
    const labels = Array.isArray(v?.labels) ? v.labels : Array.isArray(v?.sourceIPLabels) ? v.sourceIPLabels : Array.isArray(v?.sourceIPLabelList) ? v.sourceIPLabelList : [];
    const providerPanelUrls = v?.providerPanelUrls && typeof v.providerPanelUrls === 'object'
        ? v.providerPanelUrls
        : v?.proxyProviderPanelUrls && typeof v.proxyProviderPanelUrls === 'object'
            ? v.proxyProviderPanelUrls
            : v?.proxyProviderSubscriptionUrlMap && typeof v.proxyProviderSubscriptionUrlMap === 'object'
                ? v.proxyProviderSubscriptionUrlMap
                : {};
    const providerIcons = v?.providerIcons && typeof v.providerIcons === 'object'
        ? v.providerIcons
        : v?.proxyProviderIcons && typeof v.proxyProviderIcons === 'object'
            ? v.proxyProviderIcons
            : v?.proxyProviderIconMap && typeof v.proxyProviderIconMap === 'object'
                ? v.proxyProviderIconMap
                : {};
    const sslNearExpiryDaysDefault = typeof v?.sslNearExpiryDaysDefault === 'number'
        ? v.sslNearExpiryDaysDefault
        : typeof v?.sslNearExpiryDaysDefault === 'string'
            ? Number(v.sslNearExpiryDaysDefault)
            : 2;
    const providerSslWarnDaysMap = v?.providerSslWarnDaysMap && typeof v.providerSslWarnDaysMap === 'object'
        ? v.providerSslWarnDaysMap
        : v?.proxyProviderSslWarnDaysMap && typeof v.proxyProviderSslWarnDaysMap === 'object'
            ? v.proxyProviderSslWarnDaysMap
            : v?.providerSslWarnDays && typeof v.providerSslWarnDays === 'object'
                ? v.providerSslWarnDays
                : {};
    const tunnelInterfaceDescriptions = v?.tunnelInterfaceDescriptions && typeof v.tunnelInterfaceDescriptions === 'object'
        ? v.tunnelInterfaceDescriptions
        : v?.tunnelInterfaceDescriptionMap && typeof v.tunnelInterfaceDescriptionMap === 'object'
            ? v.tunnelInterfaceDescriptionMap
            : {};
    const userLimitsMap = v?.userLimits && typeof v.userLimits === 'object'
        ? v.userLimits
        : {};
    const cleanUrlMap = {};
    try {
        for (const [k, vv] of Object.entries(providerPanelUrls || {})) {
            const kk = String(k || '').trim();
            const vvv = String(vv || '').trim();
            if (!kk || !vvv)
                continue;
            cleanUrlMap[kk] = vvv;
        }
    }
    catch {
        // ignore
    }
    const cleanIconMap = {};
    try {
        for (const [k, vv] of Object.entries(providerIcons || {})) {
            const kk = String(k || '').trim();
            const nv = normalizeProviderIcon(vv);
            if (!kk || !nv)
                continue;
            cleanIconMap[kk] = nv;
        }
    }
    catch {
        // ignore
    }
    const cleanWarnMap = {};
    try {
        for (const [k, vv] of Object.entries(providerSslWarnDaysMap || {})) {
            const kk = String(k || '').trim();
            const n = typeof vv === 'number' ? vv : typeof vv === 'string' ? Number(vv) : NaN;
            if (!kk || !Number.isFinite(n))
                continue;
            cleanWarnMap[kk] = Math.max(0, Math.min(365, Math.trunc(n)));
        }
    }
    catch {
        // ignore
    }
    const sslDef = Number.isFinite(sslNearExpiryDaysDefault) ? Math.max(0, Math.min(365, Math.trunc(sslNearExpiryDaysDefault))) : 2;
    const cleanTunnelMap = {};
    try {
        for (const [k, vv] of Object.entries(tunnelInterfaceDescriptions || {})) {
            const kk = String(k || '').trim().toLowerCase();
            const vvv = String(vv || '').trim();
            if (!kk || !vvv)
                continue;
            cleanTunnelMap[kk] = vvv;
        }
    }
    catch {
        // ignore
    }
    const cleanUserLimits = {};
    try {
        for (const [k, vv] of Object.entries(userLimitsMap || {})) {
            const kk = String(k || '').trim();
            if (!kk || !vv || typeof vv !== 'object' || Array.isArray(vv))
                continue;
            cleanUserLimits[kk] = { ...vv };
        }
    }
    catch {
        // ignore
    }
    return {
        labels: Array.isArray(labels) ? labels : [],
        providerPanelUrls: cleanUrlMap,
        providerIcons: cleanIconMap,
        sslNearExpiryDaysDefault: sslDef,
        providerSslWarnDaysMap: cleanWarnMap,
        tunnelInterfaceDescriptions: cleanTunnelMap,
        userLimits: cleanUserLimits,
    };
};
const usersDbViewNormalized = computed(() => {
    if (!usersDbViewPayload.value || typeof usersDbViewPayload.value !== 'object')
        return null;
    return extractUsersDbPayloadView(usersDbViewPayload.value);
});
const usersDbViewSummary = computed(() => {
    const p = usersDbViewNormalized.value;
    if (!p)
        return null;
    return {
        labels: Array.isArray(p.labels) ? p.labels.length : 0,
        panels: p.providerPanelUrls ? Object.keys(p.providerPanelUrls).length : 0,
        icons: p.providerIcons ? Object.keys(p.providerIcons).length : 0,
        sslDefault: p.sslNearExpiryDaysDefault,
        warnMap: p.providerSslWarnDaysMap ? Object.keys(p.providerSslWarnDaysMap).length : 0,
        tunnels: p.tunnelInterfaceDescriptions ? Object.keys(p.tunnelInterfaceDescriptions).length : 0,
        userLimits: p.userLimits ? Object.keys(p.userLimits).length : 0,
    };
});
const usersDbViewJsonText = computed(() => {
    if (!usersDbViewRev.value)
        return '';
    if (usersDbViewPayload.value) {
        try {
            return JSON.stringify(usersDbViewPayload.value, null, 2);
        }
        catch {
            return usersDbViewRawText.value || '';
        }
    }
    return usersDbViewRawText.value || '';
});
const usersDbCloseRevPreview = () => {
    usersDbViewRev.value = 0;
    usersDbViewUpdatedAt.value = '';
    usersDbViewError.value = '';
    usersDbViewPayload.value = null;
    usersDbViewRawText.value = '';
    usersDbViewBusy.value = false;
};
watch([agentEnabled], () => {
    if (!agentEnabled.value)
        usersDbCloseRevPreview();
});
const usersDbOpenRevPreview = async (rev) => {
    const r = Number(rev) || 0;
    if (!r || !agentEnabled.value)
        return;
    usersDbViewRev.value = r;
    usersDbViewUpdatedAt.value = '';
    usersDbViewError.value = '';
    usersDbViewPayload.value = null;
    usersDbViewRawText.value = '';
    usersDbViewBusy.value = true;
    try {
        const res = await agentUsersDbGetRevAPI(r);
        if (!res || !res.ok) {
            usersDbViewError.value = String(res?.error || 'operationFailed');
            return;
        }
        usersDbViewUpdatedAt.value = String(res.updatedAt || '');
        const raw = decodeB64Utf8(res.contentB64 || '');
        usersDbViewRawText.value = raw;
        try {
            usersDbViewPayload.value = raw ? JSON.parse(raw) : null;
        }
        catch {
            usersDbViewPayload.value = null;
        }
    }
    finally {
        usersDbViewBusy.value = false;
    }
};
const copyTextToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
};
const copyUsersDbViewJson = async () => {
    const text = String(usersDbViewJsonText.value || '');
    if (!text)
        return;
    await copyTextToClipboard(text);
};
const copyUsersDbViewLabels = async () => {
    const p = usersDbViewNormalized.value;
    if (!p)
        return;
    await copyTextToClipboard(JSON.stringify(p.labels || [], null, 2));
};
const copyUsersDbViewPanels = async () => {
    const p = usersDbViewNormalized.value;
    if (!p)
        return;
    await copyTextToClipboard(JSON.stringify(p.providerPanelUrls || {}, null, 2));
};
const copyUsersDbViewIcons = async () => {
    const p = usersDbViewNormalized.value;
    if (!p)
        return;
    await copyTextToClipboard(JSON.stringify(p.providerIcons || {}, null, 2));
};
const copyUsersDbConflictPreview = async () => {
    const text = String(usersDbConflictPreviewText.value || '');
    if (!text)
        return;
    await copyTextToClipboard(text);
};
const exportUsersDbConflictPreview = () => {
    try {
        const text = String(usersDbConflictPreviewText.value || '');
        if (!text)
            return;
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zash-usersdb-conflict-preview-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showNotification({ content: 'done', type: 'alert-success', timeout: 1400 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
};
// --- Top rules -> open Topology with filter (stage R) ---
const normalizeRulePart = (s) => (s || '').trim() || '-';
const topHitRules = computed(() => {
    const entries = Array.from(ruleHitMap.value.entries() || [])
        .map(([key, hits]) => {
        const parts = String(key).split('\0');
        const type = normalizeRulePart(parts[0] || '');
        const payloadRaw = String(parts[1] || '').trim();
        const ruleText = payloadRaw ? `${type}: ${normalizeRulePart(payloadRaw)}` : type;
        return { key: String(key), ruleText, hits: Number(hits) || 0 };
    })
        .filter((x) => x.ruleText && x.ruleText !== '-')
        .sort((a, b) => b.hits - a.hits);
    return entries.slice(0, 20);
});
const openTopologyWithRule = async (ruleText, mode = 'only') => {
    const value = String(ruleText || '').trim();
    if (!value)
        return;
    await navigateToTopology(router, { stage: 'R', value }, mode);
};
const lastFreshnessOkAt = useStorage('runtime/tasks-last-freshness-ok-at-v1', 0);
const lastGeoUpdate = useStorage('runtime/tasks-last-geo-update-v1', {
    ranAt: 0,
    dataAtSec: 0,
    ok: true,
    items: [],
    note: '',
});
const lastRuleProvidersUpdate = useStorage('runtime/tasks-last-rule-providers-update-v1', {
    ranAt: 0,
    dataAt: '',
    ok: true,
    total: 0,
    okCount: 0,
    failCount: 0,
    items: [],
});
const geoBusy = ref(false);
const geoError = ref('');
const geoItems = ref([]);
const providersBusy = ref(false);
const providersError = ref('');
const ruleProviders = ref([]);
const sortedProviders = computed(() => {
    return [...(ruleProviders.value || [])].sort((a, b) => {
        const ta = dayjs(a.updatedAt).valueOf();
        const tb = dayjs(b.updatedAt).valueOf();
        return tb - ta;
    });
});
const newestProviderAt = computed(() => sortedProviders.value[0]?.updatedAt || '');
const oldestProviderAt = computed(() => {
    const arr = [...(ruleProviders.value || [])].sort((a, b) => dayjs(a.updatedAt).valueOf() - dayjs(b.updatedAt).valueOf());
    return arr[0]?.updatedAt || '';
});
const geoKindLabel = (kind) => {
    const k = (kind || '').toLowerCase();
    if (k === 'geoip')
        return t('geoipFile');
    if (k === 'geosite')
        return t('geositeFile');
    if (k === 'asn')
        return t('asnMmdbFile');
    if (k === 'mmdb')
        return t('mmdbFile');
    return kind || '—';
};
const fmtMtime = (mtimeSec) => {
    if (!mtimeSec || !Number.isFinite(mtimeSec))
        return '—';
    return dayjs.unix(mtimeSec).format('DD-MM-YYYY HH:mm:ss');
};
const fmtUpdatedAt = (s) => {
    const d = dayjs(s || '');
    if (!d.isValid())
        return '—';
    return d.format('DD-MM-YYYY HH:mm:ss');
};
const shortPath = (p) => {
    const s = (p || '').trim();
    if (!s)
        return '—';
    const parts = s.split('/').filter(Boolean);
    if (parts.length <= 3)
        return s;
    return `…/${parts.slice(-3).join('/')}`;
};
const refreshGeoInfo = async () => {
    geoError.value = '';
    geoItems.value = [];
    if (!agentEnabled.value)
        return;
    geoBusy.value = true;
    try {
        const r = await agentGeoInfoAPI();
        if (!r?.ok) {
            geoError.value = r?.error || 'failed';
            return;
        }
        const items = Array.isArray(r?.items) ? r.items : [];
        geoItems.value = items
            .filter((x) => x && x.path)
            .map((x) => ({
            kind: String(x.kind || ''),
            path: String(x.path || ''),
            exists: !!x.exists,
            mtimeSec: typeof x.mtimeSec === 'number' ? x.mtimeSec : Number(x.mtimeSec || 0) || undefined,
            sizeBytes: typeof x.sizeBytes === 'number' ? x.sizeBytes : Number(x.sizeBytes || 0) || undefined,
        }))
            .filter((x) => x.exists)
            .sort((a, b) => (a.kind || '').localeCompare(b.kind || ''));
    }
    catch (e) {
        geoError.value = e?.message || 'failed';
    }
    finally {
        geoBusy.value = false;
    }
};
const refreshRuleProviders = async () => {
    providersBusy.value = true;
    providersError.value = '';
    try {
        const { data } = await fetchRuleProvidersAPI();
        ruleProviders.value = Object.values(data?.providers || {});
    }
    catch (e) {
        ruleProviders.value = [];
        providersError.value = e?.message || 'failed';
    }
    finally {
        providersBusy.value = false;
    }
};
// Local rules directory (XKeen/mihomo rules folder)
const rulesBusy = ref(false);
const rulesError = ref('');
const rulesDir = ref('');
const rulesCount = ref(0);
const rulesNewest = ref(undefined);
const rulesOldest = ref(undefined);
const rulesItems = ref([]);
const refreshRulesInfo = async () => {
    rulesError.value = '';
    rulesDir.value = '';
    rulesCount.value = 0;
    rulesNewest.value = undefined;
    rulesOldest.value = undefined;
    rulesItems.value = [];
    if (!agentEnabled.value)
        return;
    rulesBusy.value = true;
    try {
        const r = await agentRulesInfoAPI();
        if (!r?.ok) {
            rulesError.value = r?.error || 'failed';
            return;
        }
        rulesDir.value = String(r?.dir || '');
        rulesCount.value = Number(r?.count || 0) || 0;
        const newest = typeof r?.newestMtimeSec === 'number' ? r.newestMtimeSec : Number(r?.newestMtimeSec || 0) || 0;
        const oldest = typeof r?.oldestMtimeSec === 'number' ? r.oldestMtimeSec : Number(r?.oldestMtimeSec || 0) || 0;
        rulesNewest.value = newest > 0 ? newest : undefined;
        rulesOldest.value = oldest > 0 ? oldest : undefined;
        const items = Array.isArray(r?.items) ? r.items : [];
        rulesItems.value = items
            .filter((x) => x && x.path)
            .map((x) => ({
            name: String(x.name || ''),
            path: String(x.path || ''),
            mtimeSec: typeof x.mtimeSec === 'number' ? x.mtimeSec : Number(x.mtimeSec || 0) || undefined,
            sizeBytes: typeof x.sizeBytes === 'number' ? x.sizeBytes : Number(x.sizeBytes || 0) || undefined,
        }));
    }
    catch (e) {
        rulesError.value = e?.message || 'failed';
    }
    finally {
        rulesBusy.value = false;
    }
};
const freshnessBusy = computed(() => geoBusy.value || providersBusy.value || rulesBusy.value);
const refreshFreshness = async () => {
    await Promise.all([refreshGeoInfo(), refreshRuleProviders(), refreshRulesInfo()]);
    const okProviders = !providersError.value;
    const okGeo = !agentEnabled.value || !geoError.value;
    const okRules = !agentEnabled.value || !rulesError.value;
    if (okProviders && okGeo && okRules) {
        lastFreshnessOkAt.value = Date.now();
    }
};
// --- Upstream tracking (GitHub: Zephyruso/zashboard) ---
const upstreamRepo = 'Zephyruso/zashboard';
const upstreamRepoUrl = 'https://github.com/Zephyruso/zashboard';
const upstreamApiBase = 'https://api.github.com/repos/Zephyruso/zashboard';
const upstreamLatest = useStorage('runtime/tasks-upstream-latest-v1', {
    releaseTag: '',
    releasePublishedAt: '',
    releaseUrl: '',
    commitSha: '',
    commitDate: '',
    commitMessage: '',
    commitUrl: '',
});
const upstreamReviewed = useStorage('runtime/tasks-upstream-reviewed-v1', { releaseTag: '', commitSha: '', reviewedAt: 0 });
const upstreamCheckedAt = useStorage('runtime/tasks-upstream-checked-at-v1', 0);
const upstreamLastNotifiedKey = useStorage('runtime/tasks-upstream-last-notified-v1', '');
const upstreamBusy = ref(false);
const upstreamError = ref('');
const upstreamHasNew = computed(() => {
    const newRelease = !!upstreamLatest.value.releaseTag &&
        !!upstreamReviewed.value.releaseTag &&
        upstreamLatest.value.releaseTag !== upstreamReviewed.value.releaseTag;
    const newCommit = !!upstreamLatest.value.commitSha &&
        !!upstreamReviewed.value.commitSha &&
        upstreamLatest.value.commitSha !== upstreamReviewed.value.commitSha;
    // If user hasn't marked reviewed yet, still show NEW when we have data.
    const neverReviewed = !upstreamReviewed.value.releaseTag && !upstreamReviewed.value.commitSha;
    return neverReviewed ? !!(upstreamLatest.value.releaseTag || upstreamLatest.value.commitSha) : newRelease || newCommit;
});
const shortSha = (sha) => (sha || '').trim().slice(0, 7);
const fmtIso = (iso) => {
    const d = dayjs(iso || '');
    if (!d.isValid())
        return '—';
    return d.format('DD-MM-YYYY HH:mm:ss');
};
const upstreamCompareReleaseUrl = computed(() => {
    const a = (upstreamReviewed.value.releaseTag || '').trim();
    const b = (upstreamLatest.value.releaseTag || '').trim();
    if (!a || !b || a === b)
        return '';
    return `https://github.com/Zephyruso/zashboard/compare/${encodeURIComponent(a)}...${encodeURIComponent(b)}`;
});
const upstreamCompareCommitUrl = computed(() => {
    const a = (upstreamReviewed.value.commitSha || '').trim();
    const b = (upstreamLatest.value.commitSha || '').trim();
    if (!a || !b || a === b)
        return '';
    return `https://github.com/Zephyruso/zashboard/compare/${encodeURIComponent(a)}...${encodeURIComponent(b)}`;
});
const checkUpstream = async () => {
    if (upstreamBusy.value)
        return;
    upstreamBusy.value = true;
    upstreamError.value = '';
    try {
        const ghFetch = async (url) => {
            const res = await fetch(url, {
                headers: {
                    Accept: 'application/vnd.github+json',
                },
                cache: 'no-store',
            });
            // Rate limit hint
            const remaining = res.headers.get('x-ratelimit-remaining');
            if (res.status === 403 && remaining === '0') {
                throw new Error(t('githubRateLimited'));
            }
            if (!res.ok) {
                throw new Error(`${t('operationFailed')}: ${res.status}`);
            }
            return res.json();
        };
        const [rel, commits] = await Promise.all([
            ghFetch(`${upstreamApiBase}/releases/latest`),
            ghFetch(`${upstreamApiBase}/commits?per_page=1`),
        ]);
        const latestReleaseTag = String(rel?.tag_name || '');
        const latestReleaseAt = String(rel?.published_at || rel?.created_at || '');
        const latestReleaseUrl = String(rel?.html_url || '');
        const c0 = Array.isArray(commits) ? commits[0] : commits;
        const latestCommitSha = String(c0?.sha || '');
        const latestCommitDate = String(c0?.commit?.committer?.date || c0?.commit?.author?.date || '');
        const latestCommitMessage = String(c0?.commit?.message || '').split('\n')[0];
        const latestCommitUrl = String(c0?.html_url || '');
        upstreamLatest.value = {
            releaseTag: latestReleaseTag,
            releasePublishedAt: latestReleaseAt,
            releaseUrl: latestReleaseUrl,
            commitSha: latestCommitSha,
            commitDate: latestCommitDate,
            commitMessage: latestCommitMessage,
            commitUrl: latestCommitUrl,
        };
        upstreamCheckedAt.value = Date.now();
        // Notify only once per new release tag (or commit if no tag)
        const notifyKey = latestReleaseTag || latestCommitSha;
        if (upstreamHasNew.value && notifyKey && upstreamLastNotifiedKey.value !== notifyKey) {
            upstreamLastNotifiedKey.value = notifyKey;
            showNotification({ content: 'upstreamUpdateAvailable', type: 'alert-warning', timeout: 2600 });
        }
    }
    catch (e) {
        upstreamError.value = e?.message || 'failed';
    }
    finally {
        upstreamBusy.value = false;
    }
};
const markUpstreamReviewed = () => {
    upstreamReviewed.value = {
        releaseTag: upstreamLatest.value.releaseTag || upstreamReviewed.value.releaseTag || '',
        commitSha: upstreamLatest.value.commitSha || upstreamReviewed.value.commitSha || '',
        reviewedAt: Date.now(),
    };
    showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
};
let upstreamTimer = null;
const startUpstreamTimer = () => {
    stopUpstreamTimer();
    // While Tasks page is open: check every 6 hours.
    upstreamTimer = setInterval(() => {
        checkUpstream();
    }, 6 * 60 * 60 * 1000);
};
const stopUpstreamTimer = () => {
    if (upstreamTimer) {
        clearInterval(upstreamTimer);
        upstreamTimer = null;
    }
};
// --- Diagnostics report ---
const diagBusy = ref(false);
const buildDiagnostics = async () => {
    const ts = new Date().toISOString();
    const agentStatus = await agentStatusAPI();
    const takeLog = async (type) => {
        const r = await agentLogsAPI({ type, lines: 200 });
        return {
            ok: !!r?.ok,
            path: r?.path || '',
            content: decodeB64Utf8(r?.contentB64) || (r?.error || ''),
        };
    };
    const logs = {
        mihomo: await takeLog('mihomo'),
        agent: await takeLog('agent'),
        config: await takeLog('config'),
    };
    const blocked = [];
    const keys = Object.keys(userLimits.value || {});
    for (const u of keys) {
        const st = getUserLimitState(u);
        if (st.blocked) {
            blocked.push({
                user: u,
                reasonManual: !!st.limit.disabled,
                trafficExceeded: !!st.trafficExceeded,
                bandwidthExceeded: !!st.bandwidthExceeded,
                usageBytes: st.usageBytes,
                trafficLimitBytes: st.limit.trafficLimitBytes || 0,
                bandwidthLimitBps: st.limit.bandwidthLimitBps || 0,
                mac: st.limit.mac || '',
            });
        }
    }
    return {
        kind: 'zash-diagnostics',
        generatedAt: ts,
        uiVersion: zashboardVersion.value,
        coreVersion: coreVersion.value,
        backend: activeBackend.value ? {
            label: activeBackend.value.label,
            host: activeBackend.value.host,
            port: activeBackend.value.port,
            protocol: activeBackend.value.protocol,
            secondaryPath: activeBackend.value.secondaryPath,
        } : null,
        agent: {
            enabled: !!agentEnabled.value,
            url: agentUrl.value,
            status: agentStatus,
        },
        limits: {
            autoDisconnectLimitedUsers: !!autoDisconnectLimitedUsers.value,
            hardBlockLimitedUsers: !!hardBlockLimitedUsers.value,
            managedLanDisallowedCidrs: managedLanDisallowedCidrs.value || [],
            profiles: userLimitProfiles.value || [],
            snapshotsCount: (userLimitSnapshots.value || []).length,
            userLimits: userLimits.value || {},
            blockedUsers: blocked,
        },
        connections: {
            activeCount: (activeConnections.value || []).length,
        },
        logs,
        ua: navigator.userAgent,
    };
};
const downloadDiagnostics = async () => {
    if (diagBusy.value)
        return;
    diagBusy.value = true;
    try {
        const rep = await buildDiagnostics();
        const blob = new Blob([JSON.stringify(rep, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zash-diagnostics-${dayjs().format('YYYYMMDD-HHmmss')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1400 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        diagBusy.value = false;
    }
};
const copyDiagnostics = async () => {
    if (diagBusy.value)
        return;
    diagBusy.value = true;
    try {
        const rep = await buildDiagnostics();
        const text = JSON.stringify(rep, null, 2);
        await navigator.clipboard.writeText(text);
        showNotification({ content: 'copySuccess', type: 'alert-success', timeout: 1400 });
    }
    catch {
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        diagBusy.value = false;
    }
};
const fmtTime = (ts) => dayjs(ts).format('HH:mm:ss');
const fmtMs = (ms) => {
    if (!Number.isFinite(ms))
        return '—';
    if (ms < 1000)
        return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
};
const applyEnforcement = async () => {
    if (busy.value)
        return;
    busy.value = true;
    try {
        const id = startJob('Apply limits & blocks');
        try {
            await applyUserEnforcementNow();
            finishJob(id, { ok: true });
            showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
        }
        catch (e) {
            finishJob(id, { ok: false, error: e?.message || 'failed' });
            showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
        }
    }
    finally {
        busy.value = false;
    }
};
const refreshSsl = async () => {
    if (busy.value)
        return;
    if (!providerHealthActionsAvailable.value) {
        showNotification({ content: 'providerHealthBackendUnavailable', type: 'alert-warning', timeout: 2200 });
        return;
    }
    busy.value = true;
    try {
        const id = startJob('Refresh providers SSL');
        try {
            let refreshError = '';
            try {
                const refreshRes = await refreshAgentProviderSslCache();
                if (!refreshRes?.ok)
                    refreshError = String(refreshRes?.error || 'failed');
            }
            catch (e) {
                refreshError = String(e?.message || 'failed');
            }
            for (let i = 0; i < 12; i += 1) {
                await refreshProvidersPanel(true);
                const hasCachedRows = Array.isArray(providersPanelRenderList.value) && providersPanelRenderList.value.some((it) => String(it?.sslNotAfter || '').trim() || String(it?.sslError || '').trim());
                if ((!agentProvidersSslRefreshing.value && !agentProvidersSslRefreshPending.value) || hasCachedRows)
                    break;
                await sleep(1000);
            }
            const rows = Array.isArray(providersPanelRenderList.value) ? providersPanelRenderList.value : [];
            const n = rows.filter((it) => String(it?.url || '').trim()).length;
            const okRows = rows.filter((it) => String(it?.sslNotAfter || '').trim()).length;
            const errorRows = rows.filter((it) => String(it?.sslError || '').trim()).length;
            const stillPending = agentProvidersSslRefreshing.value || agentProvidersSslRefreshPending.value;
            const noProviders = !rows.length || !n;
            if (noProviders) {
                panelSslProbeError.value = providersPanelError.value || refreshError || 'no-providers';
                throw new Error(panelSslProbeError.value);
            }
            // A missing dedicated refresh command is not fatal if the provider list is
            // readable and the agent has queued the async SSL cache rebuild.
            panelSslProbeError.value = stillPending || okRows || errorRows ? null : (providersPanelError.value || '');
            finishJob(id, {
                ok: true,
                meta: { probed: n, ok: okRows, errors: errorRows, pending: stillPending ? 1 : 0 },
            });
            showNotification({ content: 'sslRefreshed', type: 'alert-success', timeout: 1600 });
        }
        catch (e) {
            finishJob(id, { ok: false, error: e?.message || 'failed' });
            showNotification({ content: e?.message || 'operationFailed', type: 'alert-error', timeout: 2200 });
        }
    }
    finally {
        busy.value = false;
    }
};
// --- Data refresh operations (panel) ---
const geoUpdateBusy = ref(false);
const providersUpdateBusy = ref(false);
const rulesRescanBusy = ref(false);
const updateGeoNow = async () => {
    if (!providerHealthActionsAvailable.value) {
        showNotification({ content: 'providerHealthBackendUnavailable', type: 'alert-warning', timeout: 2200 });
        return;
    }
    if (geoUpdateBusy.value)
        return;
    geoUpdateBusy.value = true;
    const id = startJob(t('updateGeoNow'));
    try {
        const r = await agentGeoUpdateAPI();
        const itemsRaw = Array.isArray(r?.items) ? r.items : [];
        const items = itemsRaw
            .filter((x) => x && x.path)
            .map((x) => ({
            kind: String(x.kind || ''),
            path: String(x.path || ''),
            ok: typeof x.ok === 'boolean' ? x.ok : (x.ok ?? true),
            changed: !!x.changed,
            mtimeSec: typeof x.mtimeSec === 'number' ? x.mtimeSec : Number(x.mtimeSec || 0) || undefined,
            sizeBytes: typeof x.sizeBytes === 'number' ? x.sizeBytes : Number(x.sizeBytes || 0) || undefined,
            method: String(x.method || ''),
            source: String(x.source || ''),
            error: String(x.error || ''),
        }));
        const failItems = items.filter((x) => x.ok === false || !!x.error);
        const okAll = !!r?.ok && failItems.length === 0;
        const changedKinds = items.filter((x) => x.changed).map((x) => x.kind).join(', ');
        const ranAt = Date.now();
        const dataAtSec = Math.max(0, ...items
            .map((x) => (typeof x?.mtimeSec === 'number' ? x.mtimeSec : Number(x?.mtimeSec || 0) || 0))
            .filter((n) => Number.isFinite(n) && n > 0));
        lastGeoUpdate.value = {
            ranAt,
            dataAtSec: dataAtSec || 0,
            ok: okAll,
            items,
            note: String(r?.note || ''),
        };
        if (!r?.ok) {
            finishJob(id, { ok: false, error: r?.error || 'failed', meta: { changed: changedKinds || '—' } });
            showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
            return;
        }
        finishJob(id, { ok: okAll, meta: { changed: changedKinds || '—', fail: failItems.length } });
        showNotification({ content: okAll ? 'updateGeoSuccess' : 'operationFailed', type: okAll ? 'alert-success' : 'alert-warning', timeout: 2200 });
        await refreshFreshness();
    }
    catch (e) {
        finishJob(id, { ok: false, error: e?.message || 'failed' });
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        geoUpdateBusy.value = false;
    }
};
const updateRuleProvidersNow = async () => {
    if (providersUpdateBusy.value)
        return;
    providersUpdateBusy.value = true;
    const ranAt = Date.now();
    const id = startJob(t('updateRuleProvidersNow'));
    try {
        await refreshRuleProviders();
        const beforeMap = new Map();
        for (const p of ruleProviders.value || []) {
            if (p?.name)
                beforeMap.set(p.name, p.updatedAt || '');
        }
        const names = (ruleProviders.value || []).map((p) => p.name).filter(Boolean);
        const items = [];
        let ok = 0;
        let fail = 0;
        for (const name of names) {
            const started = Date.now();
            try {
                await updateRuleProviderSilentAPI(name);
                ok += 1;
                items.push({
                    name,
                    ok: true,
                    changed: false,
                    beforeUpdatedAt: beforeMap.get(name) || '',
                    durationMs: Date.now() - started,
                    error: '',
                });
            }
            catch (e) {
                fail += 1;
                const d = e?.response?.data;
                const msg = (() => {
                    if (typeof d === 'string')
                        return d;
                    if (d && typeof d === 'object')
                        return JSON.stringify(d);
                    return String(e?.message || 'failed');
                })();
                items.push({
                    name,
                    ok: false,
                    changed: false,
                    beforeUpdatedAt: beforeMap.get(name) || '',
                    durationMs: Date.now() - started,
                    error: msg,
                });
            }
        }
        await refreshRuleProviders();
        const afterMap = new Map();
        for (const p of ruleProviders.value || []) {
            if (p?.name)
                afterMap.set(p.name, p.updatedAt || '');
        }
        let changed = 0;
        for (const it of items) {
            const after = afterMap.get(it.name) || '';
            it.afterUpdatedAt = after;
            const before = it.beforeUpdatedAt || '';
            const ch = !!after && !!before && after !== before;
            it.changed = ch;
            if (ch)
                changed += 1;
        }
        const okAll = fail === 0;
        lastRuleProvidersUpdate.value = {
            ranAt,
            dataAt: newestProviderAt.value || '',
            ok: okAll,
            total: names.length,
            okCount: ok,
            failCount: fail,
            items,
        };
        finishJob(id, { ok: okAll, meta: { total: names.length, ok, fail, changed } });
        showNotification({ content: okAll ? 'operationDone' : 'operationFailed', type: okAll ? 'alert-success' : 'alert-warning', timeout: 2200 });
        await refreshFreshness();
    }
    catch (e) {
        finishJob(id, { ok: false, error: e?.message || 'failed' });
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        providersUpdateBusy.value = false;
    }
};
const rescanLocalRules = async () => {
    if (!providerHealthActionsAvailable.value) {
        showNotification({ content: 'providerHealthBackendUnavailable', type: 'alert-warning', timeout: 2200 });
        return;
    }
    if (rulesRescanBusy.value)
        return;
    rulesRescanBusy.value = true;
    const id = startJob(t('rescanLocalRules'));
    try {
        await refreshRulesInfo();
        if (rulesError.value) {
            finishJob(id, { ok: false, error: rulesError.value });
            showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
            return;
        }
        finishJob(id, { ok: true, meta: { files: rulesCount.value } });
        showNotification({ content: 'operationDone', type: 'alert-success', timeout: 1600 });
        await refreshFreshness();
    }
    catch (e) {
        finishJob(id, { ok: false, error: e?.message || 'failed' });
        showNotification({ content: 'operationFailed', type: 'alert-error', timeout: 2200 });
    }
    finally {
        rulesRescanBusy.value = false;
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
(__VLS_ctx.$t('legacyWorkspaceTasksNotice'));
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
(__VLS_ctx.$t('quickActions'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.applyEnforcement) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.busy),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('applyEnforcementNow'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshSsl) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.busy || !__VLS_ctx.providerHealthActionsAvailable),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('refreshProvidersSsl'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
(__VLS_ctx.$t('applyEnforcementTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
(__VLS_ctx.$t('refreshProvidersSslTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs font-semibold opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('routerUiUrlTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyRouterUiUrl(false);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, applyEnforcement, busy, busy, refreshSsl, providerHealthActionsAvailable, copyRouterUiUrl,];
        } },
    type: "button",
    ...{ class: "btn btn-xs btn-ghost" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('copy'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.copyRouterUiUrl(true);
            // @ts-ignore
            [$t, copyRouterUiUrl,];
        } },
    type: "button",
    ...{ class: "btn btn-xs btn-ghost" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('copyYamlLine'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 text-[11px] opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('routerUiUrlTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 break-all font-mono text-xs opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['break-all']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.routerUiUrl);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleProvidersPanelExpanded) },
    type: "button",
    ...{ class: "flex min-w-0 items-center gap-2 text-left" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
let __VLS_0;
/** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
ChevronDownIcon;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-4 w-4 opacity-70 transition-transform" },
    ...{ class: (__VLS_ctx.providersPanelExpanded ? 'rotate-180' : '') },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-4 w-4 opacity-70 transition-transform" },
    ...{ class: (__VLS_ctx.providersPanelExpanded ? 'rotate-180' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "truncate font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('providersPanelTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.refreshProvidersPanel(true);
            // @ts-ignore
            [$t, $t, $t, routerUiUrl, toggleProvidersPanelExpanded, providersPanelExpanded, refreshProvidersPanel,];
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (__VLS_ctx.providersPanelBusy || __VLS_ctx.providerSslCacheRefreshBusy || !__VLS_ctx.providerHealthAvailable),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('refresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshProviderSslCacheNow) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (__VLS_ctx.providersPanelBusy || __VLS_ctx.providerSslProbeBusy || !__VLS_ctx.providerHealthActionsAvailable),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
if (__VLS_ctx.providerSslCacheRefreshBusy) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "loading loading-spinner loading-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['loading']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-spinner']} */ ;
    /** @type {__VLS_StyleScopedClasses['loading-xs']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('refreshProviderSslCache'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.providersPanelExpanded) }, null, null);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('providersPanelTip'));
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
(__VLS_ctx.$t('sslWarnThreshold'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "0",
    max: "365",
    ...{ class: "input input-bordered input-xs w-20" },
});
(__VLS_ctx.sslNearExpiryDaysDefault);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('daysShort'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-[11px] opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('sslWarnThresholdTip'));
if (!__VLS_ctx.providerHealthAvailable) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    (__VLS_ctx.$t('providerHealthBackendUnavailable'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('providerSslServerNotConfiguredTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('providersPanelSavedListHint'));
}
if (__VLS_ctx.providersPanelBusy) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    if (__VLS_ctx.providersPanelError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning" },
            title: (__VLS_ctx.providersPanelError),
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-warning/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
        (__VLS_ctx.friendlyProviderPanelError(__VLS_ctx.providersPanelError, 'providers'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    if (__VLS_ctx.providerSslCacheStatusText) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-2 text-xs" },
            ...{ class: (__VLS_ctx.providerSslCacheStatusClass) },
            title: (__VLS_ctx.$t('providerSslRefreshingTip')),
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.providerSslCacheStatusText);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap gap-2 text-[11px]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.$t('providersPanelKnownProviders'));
    (__VLS_ctx.providersPanelStats.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.$t('providersPanelWithSubscriptions'));
    (__VLS_ctx.providersPanelStats.withUrl);
    if (__VLS_ctx.providersPanelStats.withoutUrl) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('providersPanelWithoutSubscriptions'));
        (__VLS_ctx.providersPanelStats.withoutUrl);
    }
    if (__VLS_ctx.providersPanelStats.problems) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-error badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('providersPanelProblems'));
        (__VLS_ctx.providersPanelStats.problems);
    }
    if (__VLS_ctx.providersPanelStats.expiringSoon) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        (__VLS_ctx.$t('providersPanelExpiringSoon'));
        (__VLS_ctx.providersPanelStats.expiringSoon);
    }
    if (!__VLS_ctx.providersPanelRenderList.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('providersPanelEmpty'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.$t('providersPanelColumnsExplain'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        (__VLS_ctx.$t('sslSource'));
        (__VLS_ctx.$t('checkedAt'));
        (__VLS_ctx.fmtTs(__VLS_ctx.providerSslLastCheckedAtMs));
        if (__VLS_ctx.providerSslProbeErrorText) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-0.5 text-error" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
            (__VLS_ctx.providerSslProbeErrorText);
        }
        if (__VLS_ctx.agentProvidersNextCheckAtMs || __VLS_ctx.agentProvidersJobStatus) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-0.5" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
            (__VLS_ctx.$t('providerChecksStateLine', { next: __VLS_ctx.fmtTs(__VLS_ctx.agentProvidersNextCheckAtMs), status: __VLS_ctx.agentProvidersJobStatus || '—' }));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "table table-zebra table-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['table']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-zebra']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "w-[180px]" },
        });
        /** @type {__VLS_StyleScopedClasses['w-[180px]']} */ ;
        (__VLS_ctx.$t('provider'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
        (__VLS_ctx.$t('providerPanelUrl'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "w-[148px]" },
        });
        /** @type {__VLS_StyleScopedClasses['w-[148px]']} */ ;
        (__VLS_ctx.$t('sslWarnDays'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ class: "w-[220px]" },
        });
        /** @type {__VLS_StyleScopedClasses['w-[220px]']} */ ;
        (__VLS_ctx.$t('sslExpires'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [p] of __VLS_vFor((__VLS_ctx.providersPanelRenderList))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (p.name),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: ((e) => __VLS_ctx.openProviderIconPicker(e, p.name)) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs h-7 w-10 shrink-0 px-0" },
                title: (__VLS_ctx.$t('providerIcon')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-0']} */ ;
            const __VLS_5 = ProviderIconBadge;
            // @ts-ignore
            const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
                icon: (__VLS_ctx.getProviderIconRaw(p.name)),
            }));
            const __VLS_7 = __VLS_6({
                icon: (__VLS_ctx.getProviderIconRaw(p.name)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_6));
            __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                ...{ onChange: ((e) => __VLS_ctx.setProviderIcon(p.name, (e.target?.value || ''))) },
                ...{ class: "select select-bordered select-xs w-24" },
                value: (__VLS_ctx.getProviderIconRaw(p.name)),
                title: (__VLS_ctx.$t('providerIcon')),
            });
            /** @type {__VLS_StyleScopedClasses['select']} */ ;
            /** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
            /** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-24']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                value: "globe",
            });
            for (const [cc] of __VLS_vFor((__VLS_ctx.providerIconCountries))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                    key: (`sel-${p.name}-${cc}`),
                    value: (cc),
                });
                (__VLS_ctx.fmtProviderIcon(cc));
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, providerHealthActionsAvailable, providersPanelExpanded, providersPanelBusy, providersPanelBusy, providersPanelBusy, providerSslCacheRefreshBusy, providerSslCacheRefreshBusy, providerHealthAvailable, providerHealthAvailable, refreshProviderSslCacheNow, providerSslProbeBusy, sslNearExpiryDaysDefault, providersPanelError, providersPanelError, providersPanelError, friendlyProviderPanelError, providerSslCacheStatusText, providerSslCacheStatusText, providerSslCacheStatusClass, providersPanelStats, providersPanelStats, providersPanelStats, providersPanelStats, providersPanelStats, providersPanelStats, providersPanelStats, providersPanelStats, providersPanelRenderList, providersPanelRenderList, fmtTs, fmtTs, providerSslLastCheckedAtMs, providerSslProbeErrorText, providerSslProbeErrorText, agentProvidersNextCheckAtMs, agentProvidersNextCheckAtMs, agentProvidersJobStatus, agentProvidersJobStatus, openProviderIconPicker, getProviderIconRaw, getProviderIconRaw, setProviderIcon, providerIconCountries, fmtProviderIcon,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "min-w-0 truncate" },
                title: (p.name),
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (p.name);
            const __VLS_10 = TopologyActionButtons;
            // @ts-ignore
            const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
                stage: ('P'),
                value: (p.name),
                grouped: (true),
            }));
            const __VLS_12 = __VLS_11({
                stage: ('P'),
                value: (p.name),
                grouped: (true),
            }, ...__VLS_functionalComponentArgsRest(__VLS_11));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onInput: ((e) => __VLS_ctx.setProviderSourceUrlDraft(p.name, e.target?.value || '')) },
                ...{ onKeydown: (...[$event]) => {
                        if (!!(__VLS_ctx.providersPanelBusy))
                            return;
                        if (!!(!__VLS_ctx.providersPanelRenderList.length))
                            return;
                        __VLS_ctx.saveProviderSourceUrl(p.name);
                        // @ts-ignore
                        [setProviderSourceUrlDraft, saveProviderSourceUrl,];
                    } },
                ...{ onBlur: (...[$event]) => {
                        if (!!(__VLS_ctx.providersPanelBusy))
                            return;
                        if (!!(!__VLS_ctx.providersPanelRenderList.length))
                            return;
                        __VLS_ctx.saveProviderSourceUrl(p.name);
                        // @ts-ignore
                        [saveProviderSourceUrl,];
                    } },
                ...{ class: "input input-bordered input-xs min-w-[260px] flex-1 font-mono" },
                value: (__VLS_ctx.getProviderSourceUrlDraft(p.name)),
                placeholder: (__VLS_ctx.$t('providerPanelUrlPlaceholder')),
            });
            /** @type {__VLS_StyleScopedClasses['input']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-w-[260px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            if (__VLS_ctx.getProviderSourceUrlDraft(p.name)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
                    ...{ class: "btn btn-ghost btn-xs" },
                    href: (__VLS_ctx.getProviderSourceUrlDraft(p.name)),
                    target: "_blank",
                    rel: "noreferrer",
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('open'));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onInput: ((e) => __VLS_ctx.setProviderSslWarnOverride(p.name, (e && e.target && e.target.value) || '')) },
                type: "number",
                min: "0",
                max: "365",
                ...{ class: "input input-bordered input-xs w-20" },
                placeholder: (String(__VLS_ctx.sslNearExpiryDaysDefault)),
                value: (__VLS_ctx.getProviderSslWarnOverride(p.name) === null ? '' : String(__VLS_ctx.getProviderSslWarnOverride(p.name))),
            });
            /** @type {__VLS_StyleScopedClasses['input']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.providersPanelBusy))
                            return;
                        if (!!(!__VLS_ctx.providersPanelRenderList.length))
                            return;
                        __VLS_ctx.clearProviderSslWarnOverride(p.name);
                        // @ts-ignore
                        [$t, $t, sslNearExpiryDaysDefault, getProviderSourceUrlDraft, getProviderSourceUrlDraft, getProviderSourceUrlDraft, setProviderSslWarnOverride, getProviderSslWarnOverride, getProviderSslWarnOverride, clearProviderSslWarnOverride,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('clear'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-0.5 text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('sslWarnDaysHint', { d: __VLS_ctx.sslNearExpiryDaysDefault }));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col gap-0.5" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-[11px] font-mono" },
                ...{ class: (__VLS_ctx.sslSubscriptionInfo(p).cls) },
                title: (__VLS_ctx.sslSubscriptionInfo(p).title),
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.sslSubscriptionInfo(p).text);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.providerSslMetaText(p));
            // @ts-ignore
            [$t, $t, sslNearExpiryDaysDefault, sslSubscriptionInfo, sslSubscriptionInfo, sslSubscriptionInfo, providerSslMetaText,];
        }
        let __VLS_15;
        /** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
        Teleport;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            to: "body",
        }));
        const __VLS_17 = __VLS_16({
            to: "body",
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        const { default: __VLS_20 } = __VLS_18.slots;
        if (__VLS_ctx.providerIconPickerOpen) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onMousedown: (__VLS_ctx.closeProviderIconPicker) },
                ...{ class: "fixed inset-0 z-[9999]" },
            });
            /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
            /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['z-[9999]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onMousedown: () => { } },
                ref: "providerIconPickerRoot",
                ...{ class: "absolute w-[min(18rem,calc(100vw-16px))] rounded-box bg-base-200 p-2 shadow ring-1 ring-base-300" },
                ...{ style: (__VLS_ctx.providerIconPickerStyle) },
            });
            /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-[min(18rem,calc(100vw-16px))]']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-box']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-200']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['shadow']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-base-300']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.$t('providerIconTip'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ onKeydown: () => { } },
                type: "text",
                ...{ class: "input input-bordered input-xs mt-2 w-full" },
                value: (__VLS_ctx.providerIconSearch),
                placeholder: (__VLS_ctx.$t('search') + ' (RU/US/DE...)'),
            });
            /** @type {__VLS_StyleScopedClasses['input']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
            /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 max-h-64 overflow-auto pr-1 flex flex-wrap gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['max-h-64']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['pr-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (() => __VLS_ctx.pickProviderIconFromPicker('')) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs px-2" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            const __VLS_21 = ProviderIconBadge;
            // @ts-ignore
            const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
                icon: "",
            }));
            const __VLS_23 = __VLS_22({
                icon: "",
            }, ...__VLS_functionalComponentArgsRest(__VLS_22));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (() => __VLS_ctx.pickProviderIconFromPicker('globe')) },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs px-2" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
            const __VLS_26 = ProviderIconBadge;
            // @ts-ignore
            const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
                icon: "globe",
            }));
            const __VLS_28 = __VLS_27({
                icon: "globe",
            }, ...__VLS_functionalComponentArgsRest(__VLS_27));
            for (const [cc] of __VLS_vFor((__VLS_ctx.providerIconCountries))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (() => __VLS_ctx.pickProviderIconFromPicker(cc)) },
                    key: (cc),
                    type: "button",
                    ...{ class: "btn btn-ghost btn-xs px-2" },
                    title: (cc),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                const __VLS_31 = ProviderIconBadge;
                // @ts-ignore
                const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
                    icon: (cc),
                }));
                const __VLS_33 = __VLS_32({
                    icon: (cc),
                }, ...__VLS_functionalComponentArgsRest(__VLS_32));
                // @ts-ignore
                [$t, $t, providerIconCountries, providerIconPickerOpen, closeProviderIconPicker, providerIconPickerStyle, providerIconSearch, pickProviderIconFromPicker, pickProviderIconFromPicker, pickProviderIconFromPicker,];
            }
        }
        // @ts-ignore
        [];
        var __VLS_18;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggleProviderTrafficDebugExpanded) },
    type: "button",
    ...{ class: "flex min-w-0 items-center gap-2 text-left" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
let __VLS_36;
/** @ts-ignore @type {typeof __VLS_components.ChevronDownIcon} */
ChevronDownIcon;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    ...{ class: "h-4 w-4 opacity-70 transition-transform" },
    ...{ class: (__VLS_ctx.providerTrafficDebugExpanded ? 'rotate-180' : '') },
}));
const __VLS_38 = __VLS_37({
    ...{ class: "h-4 w-4 opacity-70 transition-transform" },
    ...{ class: (__VLS_ctx.providerTrafficDebugExpanded ? 'rotate-180' : '') },
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-transform']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "truncate font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('providerTrafficDebugTitle'));
if (__VLS_ctx.providerTrafficDebugSelectedName) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('connections'));
    (__VLS_ctx.providerTrafficDebugSummary.total);
    (__VLS_ctx.$t('activeConnections'));
    (__VLS_ctx.providerTrafficDebugSummary.active);
    (__VLS_ctx.$t('closedConnections'));
    (__VLS_ctx.providerTrafficDebugSummary.closed);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.providerTrafficDebugExpanded) }, null, null);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('providerTrafficDebugTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 rounded-lg border border-base-content/10 bg-base-200/45 p-2 text-xs" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/45']} */ ;
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
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('providerTrafficSyncStatus'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-xs" },
    ...{ class: (__VLS_ctx.providerTrafficSyncBadgeClass) },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
(__VLS_ctx.providerTrafficSyncBadgeText);
if (__VLS_ctx.providerTrafficSyncState.rev > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.providerTrafficSyncState.rev);
}
if (__VLS_ctx.providerTrafficSyncState.remoteUpdatedAt) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.providerTrafficSyncState.remoteUpdatedAt);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshProviderTrafficSync) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs" },
    disabled: (!__VLS_ctx.agentEnabled),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
(__VLS_ctx.$t('refresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.flushProviderTrafficSync) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs" },
    disabled: (!__VLS_ctx.agentEnabled || !__VLS_ctx.providerTrafficSyncState.dirty),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
(__VLS_ctx.$t('providerTrafficSyncFlush'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 flex flex-wrap gap-x-3 gap-y-1 opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-3']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('providerTrafficSyncLastPull'));
(__VLS_ctx.fmtTs(__VLS_ctx.providerTrafficSyncState.lastPullAt));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('providerTrafficSyncLastPush'));
(__VLS_ctx.fmtTs(__VLS_ctx.providerTrafficSyncState.lastPushAt));
if (__VLS_ctx.providerTrafficSyncState.dirty) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-warning" },
    });
    /** @type {__VLS_StyleScopedClasses['text-warning']} */ ;
    (__VLS_ctx.$t('providerTrafficSyncDirty'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-bordered select-sm min-w-56" },
    value: (__VLS_ctx.providerTrafficDebugProvider),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-56']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
(__VLS_ctx.$t('providerTrafficDebugSelectProvider'));
for (const [name] of __VLS_vFor((__VLS_ctx.providerTrafficDebugProviderNames))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (`ptd-${name}`),
        value: (name),
    });
    (name);
    // @ts-ignore
    [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, fmtTs, fmtTs, toggleProviderTrafficDebugExpanded, providerTrafficDebugExpanded, providerTrafficDebugExpanded, providerTrafficDebugSelectedName, providerTrafficDebugSummary, providerTrafficDebugSummary, providerTrafficDebugSummary, providerTrafficSyncBadgeClass, providerTrafficSyncBadgeText, providerTrafficSyncState, providerTrafficSyncState, providerTrafficSyncState, providerTrafficSyncState, providerTrafficSyncState, providerTrafficSyncState, providerTrafficSyncState, providerTrafficSyncState, refreshProviderTrafficSync, agentEnabled, agentEnabled, flushProviderTrafficSync, providerTrafficDebugProvider, providerTrafficDebugProviderNames,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "label cursor-pointer gap-2 py-0" },
});
/** @type {__VLS_StyleScopedClasses['label']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "label-text text-xs" },
});
/** @type {__VLS_StyleScopedClasses['label-text']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
(__VLS_ctx.$t('providerTrafficDebugIncludeClosed'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "checkbox checkbox-xs" },
    type: "checkbox",
});
(__VLS_ctx.providerTrafficDebugIncludeClosed);
/** @type {__VLS_StyleScopedClasses['checkbox']} */ ;
/** @type {__VLS_StyleScopedClasses['checkbox-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2 text-xs" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('providerTrafficDebugLimit'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "number",
    min: "10",
    max: "200",
    ...{ class: "input input-bordered input-xs w-20" },
});
(__VLS_ctx.providerTrafficDebugLimit);
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
if (__VLS_ctx.providerTrafficDebugSelectedName) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 rounded-lg border border-base-content/10 bg-base-200/55 p-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/55']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-x-3 gap-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-x-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('proxies'));
    (__VLS_ctx.providerTrafficDebugProxyNames.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('connections'));
    (__VLS_ctx.providerTrafficDebugSummary.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.providerTrafficDebugSummary.byProvider);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.providerTrafficDebugSummary.byProxy);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 break-all opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.providerTrafficDebugProxyNames.join(' • ') || '—');
}
if (!__VLS_ctx.providerTrafficDebugSelectedName) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('providerTrafficDebugSelectProvider'));
}
else if (!__VLS_ctx.providerTrafficDebugRows.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-200/40 p-3 text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('providerTrafficDebugNoRows'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 space-y-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
    for (const [row] of __VLS_vFor((__VLS_ctx.providerTrafficDebugRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (row.key),
            ...{ class: "rounded-lg border border-base-content/10 bg-base-200/55 p-2 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/55']} */ ;
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
            ...{ class: "badge badge-xs" },
            ...{ class: (row.source === 'active' ? 'badge-success' : 'badge-ghost') },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (row.source === 'active' ? __VLS_ctx.$t('activeConnections') : __VLS_ctx.$t('closedConnections'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-xs" },
            ...{ class: (row.matchedBy === 'provider' ? 'badge-info' : 'badge-warning') },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (row.matchedBy === 'provider' ? __VLS_ctx.$t('providerTrafficDebugMatchedByProvider') : __VLS_ctx.$t('providerTrafficDebugMatchedByProxy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (row.id);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (row.startLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "truncate opacity-70" },
            title: (row.hostLabel),
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (row.hostLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 flex flex-wrap gap-x-3 gap-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-x-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (row.matchedProxy || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.prettyBytesHelper(row.download, { binary: true }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.prettyBytesHelper(row.upload, { binary: true }));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.prettyBytesHelper(row.totalBytes, { binary: true }));
        if (row.speed > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.prettyBytesHelper(row.speed, { binary: true }));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 grid gap-1 text-[11px] opacity-75 sm:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
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
        (row.providerCandidatesLabel);
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
        (row.proxyCandidatesLabel);
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
        (row.chainsLabel);
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
        (row.providerChainsLabel);
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
        (row.specialProxy || '—');
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
        (row.providerNameField || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sm:col-span-2" },
        });
        /** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono break-all" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        (row.ruleLabel);
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, providerTrafficDebugSelectedName, providerTrafficDebugSelectedName, providerTrafficDebugSummary, providerTrafficDebugSummary, providerTrafficDebugSummary, providerTrafficDebugIncludeClosed, providerTrafficDebugLimit, providerTrafficDebugProxyNames, providerTrafficDebugProxyNames, providerTrafficDebugRows, providerTrafficDebugRows, prettyBytesHelper, prettyBytesHelper, prettyBytesHelper, prettyBytesHelper,];
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
(__VLS_ctx.$t('liveLogs'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-bordered select-sm" },
    value: (__VLS_ctx.logSource),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "mihomo",
});
(__VLS_ctx.$t('mihomoLog'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "config",
});
(__VLS_ctx.$t('mihomoConfig'));
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "agent",
});
(__VLS_ctx.$t('agentLog'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ class: "select select-bordered select-sm" },
    value: (__VLS_ctx.logLines),
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-bordered']} */ ;
/** @type {__VLS_StyleScopedClasses['select-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (50),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (200),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (500),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (1000),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.forceRefreshLogs) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.logsBusy || !__VLS_ctx.agentEnabled),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('refresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('path'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.logPath || '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('autoRefresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "toggle toggle-sm" },
});
(__VLS_ctx.logsAuto);
/** @type {__VLS_StyleScopedClasses['toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['toggle-sm']} */ ;
if (!__VLS_ctx.agentEnabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('agentDisabled'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
        ...{ class: "max-h-[48vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4" },
    });
    /** @type {__VLS_StyleScopedClasses['max-h-[48vh]']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-4']} */ ;
    (__VLS_ctx.logText || '—');
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('dataFreshness'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.updateGeoNow) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.geoUpdateBusy || !__VLS_ctx.agentEnabled),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('updateGeoNow'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.updateRuleProvidersNow) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.providersUpdateBusy),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('updateRuleProvidersNow'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.rescanLocalRules) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (__VLS_ctx.rulesRescanBusy || !__VLS_ctx.agentEnabled),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('rescanLocalRules'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.refreshFreshness) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (__VLS_ctx.freshnessBusy),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('refresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('lastUiRefresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ml-1 font-mono" },
});
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.fmtTs(__VLS_ctx.lastFreshnessOkAt));
if (__VLS_ctx.lastGeoUpdate?.ranAt) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs font-semibold opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('lastGeoUpdateResult'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-2 font-mono opacity-70" },
        title: (__VLS_ctx.$t('dataTimestamp')),
    });
    /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.lastGeoUpdate.dataAtSec ? __VLS_ctx.fmtMtime(__VLS_ctx.lastGeoUpdate.dataAtSec) : __VLS_ctx.fmtTs(__VLS_ctx.lastGeoUpdate.ranAt));
    if (__VLS_ctx.lastGeoUpdate.ok) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 badge badge-success badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 badge badge-error badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-col gap-1 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    for (const [it] of __VLS_vFor(((__VLS_ctx.lastGeoUpdate.items || [])))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (it.kind + ':' + it.path),
            ...{ class: "flex flex-col gap-1 rounded-md border border-base-content/10 bg-base-100/40 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-semibold opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.geoKindLabel(it.kind));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 font-mono opacity-70" },
            title: (it.path),
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.shortPath(it.path));
        if (it.changed) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 badge badge-info badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (__VLS_ctx.$t('changed'));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "shrink-0 font-mono opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.fmtMtime(it.mtimeSec));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-x-3 gap-y-1 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-x-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        if (it.method) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('method'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-1 font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (it.method);
        }
        if (typeof it.sizeBytes === 'number' && it.sizeBytes >= 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('size'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-1 font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.prettyBytesHelper(it.sizeBytes));
        }
        if (it.source) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('source'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-1 truncate font-mono" },
                title: (it.source),
            });
            /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (it.source);
        }
        if (it.ok === false || it.error) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-error" },
            });
            /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
            (it.error || 'failed');
        }
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, fmtTs, fmtTs, agentEnabled, agentEnabled, agentEnabled, agentEnabled, prettyBytesHelper, logSource, logLines, forceRefreshLogs, logsBusy, logPath, logsAuto, logText, updateGeoNow, geoUpdateBusy, updateRuleProvidersNow, providersUpdateBusy, rescanLocalRules, rulesRescanBusy, refreshFreshness, freshnessBusy, lastFreshnessOkAt, lastGeoUpdate, lastGeoUpdate, lastGeoUpdate, lastGeoUpdate, lastGeoUpdate, lastGeoUpdate, fmtMtime, fmtMtime, geoKindLabel, shortPath,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-[11px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('runTimestamp'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.fmtTs(__VLS_ctx.lastGeoUpdate.ranAt));
    if (__VLS_ctx.lastGeoUpdate.note) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.lastGeoUpdate.note);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-[11px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('geoRestartTip'));
}
if (__VLS_ctx.lastRuleProvidersUpdate?.ranAt) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer text-xs font-semibold opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('lastRuleProvidersUpdateResult'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-2 font-mono opacity-70" },
        title: (__VLS_ctx.$t('dataTimestamp')),
    });
    /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.lastRuleProvidersUpdate.dataAt ? __VLS_ctx.fmtUpdatedAt(__VLS_ctx.lastRuleProvidersUpdate.dataAt) : __VLS_ctx.fmtTs(__VLS_ctx.lastRuleProvidersUpdate.ranAt));
    if (__VLS_ctx.lastRuleProvidersUpdate.ok) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 badge badge-success badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 badge badge-error badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-col gap-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-[11px] opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('runTimestamp'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.fmtTs(__VLS_ctx.lastRuleProvidersUpdate.ranAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-x-3 gap-y-1 opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-x-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('total'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1 font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.lastRuleProvidersUpdate.total);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1 font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.lastRuleProvidersUpdate.okCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1 font-mono" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    (__VLS_ctx.lastRuleProvidersUpdate.failCount);
    for (const [it] of __VLS_vFor(((__VLS_ctx.lastRuleProvidersUpdate.items || [])))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (it.name),
            ...{ class: "flex flex-col gap-1 rounded-md border border-base-content/10 bg-base-100/40 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "min-w-0 truncate font-mono" },
            title: (it.name),
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (it.name);
        if (it.changed) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 badge badge-info badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-info']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (__VLS_ctx.$t('changed'));
        }
        if (it.ok) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 badge badge-success badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 badge badge-error badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "shrink-0 font-mono opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (it.durationMs != null ? __VLS_ctx.fmtMs(it.durationMs) : '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-x-3 gap-y-1 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-x-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('before'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.fmtUpdatedAt(it.beforeUpdatedAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('after'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.fmtUpdatedAt(it.afterUpdatedAt));
        if (it.error) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-error" },
            });
            /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
            (it.error);
        }
        // @ts-ignore
        [$t, $t, $t, $t, $t, $t, $t, $t, $t, fmtTs, fmtTs, fmtTs, lastGeoUpdate, lastGeoUpdate, lastGeoUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, lastRuleProvidersUpdate, fmtUpdatedAt, fmtUpdatedAt, fmtUpdatedAt, fmtMs,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-2 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('geoFiles'));
if (!__VLS_ctx.agentEnabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('agentDisabled'));
}
else if (__VLS_ctx.geoBusy) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    if (__VLS_ctx.geoError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs text-error" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
        (__VLS_ctx.geoError);
    }
    else if (!__VLS_ctx.geoItems.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [g] of __VLS_vFor((__VLS_ctx.geoItems))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (g.kind + ':' + g.path),
                ...{ class: "flex items-center justify-between gap-2 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.geoKindLabel(g.kind));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-1 font-mono opacity-70" },
                title: (g.path),
            });
            /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.shortPath(g.path));
            if (typeof g.sizeBytes === 'number' && g.sizeBytes >= 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "ml-2 opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.prettyBytesHelper(g.sizeBytes));
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "shrink-0 font-mono opacity-80" },
            });
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
            (__VLS_ctx.fmtMtime(g.mtimeSec));
            // @ts-ignore
            [$t, $t, agentEnabled, prettyBytesHelper, fmtMtime, geoKindLabel, shortPath, geoBusy, geoError, geoError, geoItems, geoItems,];
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 text-sm font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('filterPoliciesFiles'));
if (__VLS_ctx.providersBusy) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    if (__VLS_ctx.providersError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs text-error" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
        (__VLS_ctx.providersError);
    }
    else if (!__VLS_ctx.ruleProviders.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-1 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('ruleProvidersCount'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.ruleProviders.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('newestUpdate'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.fmtUpdatedAt(__VLS_ctx.newestProviderAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('oldestUpdate'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.fmtUpdatedAt(__VLS_ctx.oldestProviderAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
            ...{ class: "cursor-pointer opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.$t('showList'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-col gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        for (const [p] of __VLS_vFor((__VLS_ctx.sortedProviders))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (p.name),
                ...{ class: "flex items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "min-w-0 truncate font-mono" },
                title: (p.name),
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (p.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "shrink-0 font-mono opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.fmtUpdatedAt(p.updatedAt));
            // @ts-ignore
            [$t, $t, $t, $t, $t, fmtUpdatedAt, fmtUpdatedAt, fmtUpdatedAt, providersBusy, providersError, providersError, ruleProviders, ruleProviders, newestProviderAt, oldestProviderAt, sortedProviders,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 border-t border-base-content/10 pt-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-1 text-xs font-semibold opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.$t('topRulesTitle'));
        if (!__VLS_ctx.topHitRules.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-sm opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                ...{ class: "mt-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
                ...{ class: "cursor-pointer opacity-80" },
            });
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
            (__VLS_ctx.$t('showList'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 flex flex-col gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            for (const [r] of __VLS_vFor((__VLS_ctx.topHitRules))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (r.key),
                    ...{ class: "flex items-center justify-between gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.providersBusy))
                                return;
                            if (!!(__VLS_ctx.providersError))
                                return;
                            if (!!(!__VLS_ctx.ruleProviders.length))
                                return;
                            if (!!(!__VLS_ctx.topHitRules.length))
                                return;
                            __VLS_ctx.openTopologyWithRule(r.ruleText, 'none');
                            // @ts-ignore
                            [$t, $t, topHitRules, topHitRules, openTopologyWithRule,];
                        } },
                    type: "button",
                    ...{ class: "link min-w-0 truncate text-left font-mono" },
                    title: (__VLS_ctx.$t('openInTopology')),
                });
                /** @type {__VLS_StyleScopedClasses['link']} */ ;
                /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (r.ruleText);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex items-center gap-2 shrink-0" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-mono opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (r.hits);
                const __VLS_41 = TopologyActionButtons;
                // @ts-ignore
                const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
                    stage: ('R'),
                    value: (r.ruleText),
                    grouped: (true),
                }));
                const __VLS_43 = __VLS_42({
                    stage: ('R'),
                    value: (r.ruleText),
                    grouped: (true),
                }, ...__VLS_functionalComponentArgsRest(__VLS_42));
                // @ts-ignore
                [$t,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('topRulesTip'));
    }
    if (__VLS_ctx.agentEnabled) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 border-t border-base-content/10 pt-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-1 text-xs font-semibold opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.$t('localRulesDir'));
        if (__VLS_ctx.rulesBusy) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-sm opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            if (__VLS_ctx.rulesError) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-xs text-error" },
                });
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
                (__VLS_ctx.rulesError);
            }
            else if (!__VLS_ctx.rulesDir) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-sm opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-col gap-1 text-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('path'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "ml-1 font-mono" },
                    title: (__VLS_ctx.rulesDir),
                });
                /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.shortPath(__VLS_ctx.rulesDir));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('filesCount'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "ml-1 font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.rulesCount);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('newestUpdate'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "ml-1 font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.fmtMtime(__VLS_ctx.rulesNewest));
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (__VLS_ctx.$t('oldestUpdate'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "ml-1 font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.fmtMtime(__VLS_ctx.rulesOldest));
                if (__VLS_ctx.rulesItems.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
                        ...{ class: "mt-1" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
                        ...{ class: "cursor-pointer opacity-80" },
                    });
                    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
                    (__VLS_ctx.$t('showList'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-2 flex flex-col gap-1" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                    for (const [f] of __VLS_vFor((__VLS_ctx.rulesItems))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            key: (f.path),
                            ...{ class: "flex items-center justify-between gap-2" },
                        });
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "min-w-0 truncate font-mono" },
                            title: (f.path),
                        });
                        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
                        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                        (f.name || __VLS_ctx.shortPath(f.path));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "shrink-0 font-mono opacity-70" },
                        });
                        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                        (__VLS_ctx.fmtMtime(f.mtimeSec));
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, agentEnabled, fmtMtime, fmtMtime, fmtMtime, shortPath, shortPath, rulesBusy, rulesError, rulesError, rulesDir, rulesDir, rulesDir, rulesCount, rulesNewest, rulesOldest, rulesItems, rulesItems,];
                    }
                }
            }
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-[11px] opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('dataFreshnessTip'));
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
(__VLS_ctx.$t('diagnostics'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.downloadDiagnostics) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (__VLS_ctx.diagBusy),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('downloadReport'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.copyDiagnostics) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (__VLS_ctx.diagBusy),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('copy'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('diagnosticsTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('upstreamTracking'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.checkUpstream) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (__VLS_ctx.upstreamBusy),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('refresh'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.markUpstreamReviewed) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.upstreamLatest.releaseTag && !__VLS_ctx.upstreamLatest.commitSha),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('markReviewed'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('repo'));
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "link ml-1 font-mono" },
    href: (__VLS_ctx.upstreamRepoUrl),
    target: "_blank",
    rel: "noreferrer",
});
/** @type {__VLS_StyleScopedClasses['link']} */ ;
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.upstreamRepo);
if (__VLS_ctx.upstreamHasNew) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-warning badge-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.$t('new'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ml-auto" },
});
/** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('lastChecked'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ml-1 font-mono" },
});
/** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.fmtTs(__VLS_ctx.upstreamCheckedAt));
if (__VLS_ctx.upstreamError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs text-error" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
    (__VLS_ctx.upstreamError);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-1 text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('latestRelease'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('tag'));
    if (__VLS_ctx.upstreamLatest.releaseUrl) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            ...{ class: "link ml-1 font-mono" },
            href: (__VLS_ctx.upstreamLatest.releaseUrl),
            target: "_blank",
            rel: "noreferrer",
        });
        /** @type {__VLS_StyleScopedClasses['link']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.upstreamLatest.releaseTag || '—');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.upstreamLatest.releaseTag || '—');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 font-mono opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.fmtIso(__VLS_ctx.upstreamLatest.releasePublishedAt));
    if (__VLS_ctx.upstreamCompareReleaseUrl) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            ...{ class: "link" },
            href: (__VLS_ctx.upstreamCompareReleaseUrl),
            target: "_blank",
            rel: "noreferrer",
        });
        /** @type {__VLS_StyleScopedClasses['link']} */ ;
        (__VLS_ctx.$t('compareSinceLastReview'));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-1 text-sm font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('latestCommit'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-1 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    if (__VLS_ctx.upstreamLatest.commitUrl) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            ...{ class: "link ml-1 font-mono" },
            href: (__VLS_ctx.upstreamLatest.commitUrl),
            target: "_blank",
            rel: "noreferrer",
        });
        /** @type {__VLS_StyleScopedClasses['link']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.shortSha(__VLS_ctx.upstreamLatest.commitSha) || '—');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.shortSha(__VLS_ctx.upstreamLatest.commitSha) || '—');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "shrink-0 font-mono opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.fmtIso(__VLS_ctx.upstreamLatest.commitDate));
    if (__VLS_ctx.upstreamLatest.commitMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "max-h-[32px] overflow-hidden break-words opacity-80" },
            title: (__VLS_ctx.upstreamLatest.commitMessage),
        });
        /** @type {__VLS_StyleScopedClasses['max-h-[32px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.upstreamLatest.commitMessage);
    }
    if (__VLS_ctx.upstreamCompareCommitUrl) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
            ...{ class: "link" },
            href: (__VLS_ctx.upstreamCompareCommitUrl),
            target: "_blank",
            rel: "noreferrer",
        });
        /** @type {__VLS_StyleScopedClasses['link']} */ ;
        (__VLS_ctx.$t('compareCommits'));
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-[11px] opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('upstreamTrackingTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card gap-2 p-3" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('usersDbSyncTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-sm" },
    ...{ class: (__VLS_ctx.usersDbBadge.cls) },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
(__VLS_ctx.usersDbBadge.text);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-sm opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('usersDbSyncDesc'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-x-4 gap-y-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.usersDbRemoteRev);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('updated'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.usersDbRemoteUpdatedAt || '—');
if (__VLS_ctx.agentEnabled && (__VLS_ctx.agentStatusLite.version || __VLS_ctx.agentStatusLite.serverVersion)) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('agentVersion'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.agentStatusLite.version || '—');
    if (__VLS_ctx.agentStatusLite.serverVersion) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60 ml-2" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        (__VLS_ctx.$t('agentServerVersion'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono ml-1" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        (__VLS_ctx.agentStatusLite.serverVersion);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-x-4 gap-y-1 mt-1" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-x-4']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('lastPull'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.usersDbLastPullAt ? __VLS_ctx.fmtTs(__VLS_ctx.usersDbLastPullAt) : '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('lastPush'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.usersDbLastPushAt ? __VLS_ctx.fmtTs(__VLS_ctx.usersDbLastPushAt) : '—');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('conflicts'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.usersDbConflictCount || 0);
if (__VLS_ctx.usersDbLocalDirty) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-warning badge-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.$t('pendingChanges'));
}
if (__VLS_ctx.usersDbLastError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs text-error" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
    (__VLS_ctx.usersDbLastError);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.usersDbPullNow) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.usersDbSyncEnabled || !__VLS_ctx.agentEnabled || __VLS_ctx.usersDbBusy),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('pull'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.usersDbPushNow) },
    type: "button",
    ...{ class: "btn btn-sm" },
    disabled: (!__VLS_ctx.usersDbSyncEnabled || !__VLS_ctx.agentEnabled || __VLS_ctx.usersDbBusy || __VLS_ctx.usersDbHasConflict),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
(__VLS_ctx.$t('push'));
if (__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-error/30 bg-error/5 p-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-error/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-error/5']} */ ;
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
        ...{ class: "font-semibold text-error" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
    (__VLS_ctx.$t('usersDbConflictTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-error badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.$t('conflict'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-x-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('usersDbLabels'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.labelsLocalOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.labelsRemoteOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.labelsChanged);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('usersDbPanels'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.urlsLocalOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.urlsRemoteOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.urlsChanged);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('providerIcon'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.iconsLocalOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.iconsRemoteOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.iconsChanged);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.tunnelsLocalOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.tunnelsRemoteOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.tunnelsChanged);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.sslDefaultChanged + __VLS_ctx.usersDbConflictSummary.warnDaysChanged);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('usersDbUserLimits'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.userLimitsLocalOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.userLimitsRemoteOnly);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "opacity-60 ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-mono ml-1" },
    });
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    (__VLS_ctx.usersDbConflictSummary.userLimitsChanged);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.usersDbResolveMerge) },
        type: "button",
        ...{ class: "btn btn-xs" },
        disabled: (__VLS_ctx.usersDbBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('usersDbMergeAndPush'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.usersDbResolvePull) },
        type: "button",
        ...{ class: "btn btn-xs" },
        disabled: (__VLS_ctx.usersDbBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('usersDbAcceptRouter'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.usersDbResolvePush) },
        type: "button",
        ...{ class: "btn btn-xs" },
        disabled: (__VLS_ctx.usersDbBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    (__VLS_ctx.$t('usersDbAcceptLocal'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                    return;
                __VLS_ctx.usersDbSmartOpen = !__VLS_ctx.usersDbSmartOpen;
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, fmtTs, fmtTs, fmtTs, agentEnabled, agentEnabled, agentEnabled, downloadDiagnostics, diagBusy, diagBusy, copyDiagnostics, checkUpstream, upstreamBusy, markUpstreamReviewed, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamLatest, upstreamRepoUrl, upstreamRepo, upstreamHasNew, upstreamCheckedAt, upstreamError, upstreamError, fmtIso, fmtIso, upstreamCompareReleaseUrl, upstreamCompareReleaseUrl, shortSha, shortSha, upstreamCompareCommitUrl, upstreamCompareCommitUrl, usersDbBadge, usersDbBadge, usersDbRemoteRev, usersDbRemoteUpdatedAt, agentStatusLite, agentStatusLite, agentStatusLite, agentStatusLite, agentStatusLite, usersDbLastPullAt, usersDbLastPullAt, usersDbLastPushAt, usersDbLastPushAt, usersDbConflictCount, usersDbLocalDirty, usersDbLastError, usersDbLastError, usersDbPullNow, usersDbSyncEnabled, usersDbSyncEnabled, usersDbBusy, usersDbBusy, usersDbBusy, usersDbBusy, usersDbBusy, usersDbPushNow, usersDbHasConflict, usersDbHasConflict, usersDbConflictDiff, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbConflictSummary, usersDbResolveMerge, usersDbResolvePull, usersDbResolvePush, usersDbSmartOpen, usersDbSmartOpen,];
            } },
        type: "button",
        ...{ class: "btn btn-xs btn-ghost" },
        disabled: (__VLS_ctx.usersDbBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('usersDbSmartMerge'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copyUsersDbConflictPreview) },
        type: "button",
        ...{ class: "btn btn-xs btn-ghost" },
        disabled: (__VLS_ctx.usersDbBusy || !__VLS_ctx.usersDbConflictPreviewText),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('copy'));
    (__VLS_ctx.$t('usersDbConflictPreview'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.exportUsersDbConflictPreview) },
        type: "button",
        ...{ class: "btn btn-xs btn-ghost" },
        disabled: (__VLS_ctx.usersDbBusy || !__VLS_ctx.usersDbConflictPreviewText),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('export'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 text-[11px] opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('usersDbConflictPreviewHint'));
    if (__VLS_ctx.usersDbLabelChangedRows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbLabels'));
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.usersDbLabelChangedRows.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbWinnerHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "table table-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['table']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('router'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('local'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [row] of __VLS_vFor((__VLS_ctx.usersDbLabelChangedRows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (row.key),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (row.key);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "max-w-[260px] truncate" },
                title: (row.remote),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.remote || '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('agentRestoreScope'));
            (row.remoteScopeText);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "max-w-[260px] truncate" },
                title: (row.local),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.local || '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('agentRestoreScope'));
            (row.localScopeText);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (row.modeLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono break-all" },
                title: (row.resultSummary),
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (row.resultLabel || '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('agentRestoreScope'));
            (row.resultScopeText);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (row.reason);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, usersDbBusy, usersDbBusy, usersDbBusy, copyUsersDbConflictPreview, usersDbConflictPreviewText, usersDbConflictPreviewText, exportUsersDbConflictPreview, usersDbLabelChangedRows, usersDbLabelChangedRows, usersDbLabelChangedRows,];
        }
    }
    if (__VLS_ctx.usersDbUserLimitChangedRows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbUserLimits'));
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.usersDbUserLimitChangedRows.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbUserLimitsHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "table table-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['table']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('router'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('local'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [row] of __VLS_vFor((__VLS_ctx.usersDbUserLimitChangedRows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (row.user),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (row.user);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "max-w-[280px] truncate" },
                title: (row.remote),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[280px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "max-w-[280px] truncate" },
                title: (row.local),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[280px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.local);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (row.modeLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono break-all" },
                title: (row.result),
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (row.result);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (row.reason);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, usersDbUserLimitChangedRows, usersDbUserLimitChangedRows, usersDbUserLimitChangedRows,];
        }
    }
    if (__VLS_ctx.usersDbTunnelChangedRows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbTunnelConflictDiagnostics'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.usersDbTunnelChangedRows.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbTunnelConflictDiagnosticsHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "table table-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['table']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('router'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('local'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [row] of __VLS_vFor((__VLS_ctx.usersDbTunnelChangedRows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (row.name),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (row.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "max-w-[260px] truncate" },
                title: (row.remote),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "max-w-[260px] truncate" },
                title: (row.local),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.local);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (row.modeLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
                title: (row.result),
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (row.result);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (row.reason);
            // @ts-ignore
            [$t, $t, $t, $t, $t, usersDbTunnelChangedRows, usersDbTunnelChangedRows, usersDbTunnelChangedRows,];
        }
    }
    if (__VLS_ctx.usersDbUrlChangedRows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbPanels'));
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.usersDbUrlChangedRows.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbWinnerHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "table table-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['table']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('provider'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('router'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('local'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [row] of __VLS_vFor((__VLS_ctx.usersDbUrlChangedRows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (row.provider),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (row.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "max-w-[320px] truncate" },
                title: (row.remote),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[320px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "max-w-[320px] truncate" },
                title: (row.local),
            });
            /** @type {__VLS_StyleScopedClasses['max-w-[320px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            (row.local);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (row.modeLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono break-all" },
                title: (row.result || '—'),
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            (row.result || '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (row.reason);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, usersDbUrlChangedRows, usersDbUrlChangedRows, usersDbUrlChangedRows,];
        }
    }
    if (__VLS_ctx.usersDbIconChangedRows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('providerIcon'));
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.usersDbIconChangedRows.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbWinnerHint'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "table table-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['table']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('provider'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('router'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('local'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [row] of __VLS_vFor((__VLS_ctx.usersDbIconChangedRows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (row.provider),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (row.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            const __VLS_46 = ProviderIconBadge;
            // @ts-ignore
            const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
                icon: (row.remote),
            }));
            const __VLS_48 = __VLS_47({
                icon: (row.remote),
            }, ...__VLS_functionalComponentArgsRest(__VLS_47));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.fmtProviderIcon(row.remote));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            const __VLS_51 = ProviderIconBadge;
            // @ts-ignore
            const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
                icon: (row.local),
            }));
            const __VLS_53 = __VLS_52({
                icon: (row.local),
            }, ...__VLS_functionalComponentArgsRest(__VLS_52));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.fmtProviderIcon(row.local));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-col gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (row.modeLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            const __VLS_56 = ProviderIconBadge;
            // @ts-ignore
            const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
                icon: (row.result),
            }));
            const __VLS_58 = __VLS_57({
                icon: (row.result),
            }, ...__VLS_functionalComponentArgsRest(__VLS_57));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.fmtProviderIcon(row.result));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (row.reason);
            // @ts-ignore
            [$t, $t, $t, $t, $t, $t, $t, fmtProviderIcon, fmtProviderIcon, fmtProviderIcon, usersDbIconChangedRows, usersDbIconChangedRows, usersDbIconChangedRows,];
        }
    }
    if (__VLS_ctx.usersDbSslDefaultRow || __VLS_ctx.usersDbWarnDaysChangedRows.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-warning/30 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-warning/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbWinner'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-warning badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        ((__VLS_ctx.usersDbSslDefaultRow ? 1 : 0) + __VLS_ctx.usersDbWarnDaysChangedRows.length);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbWinnerHint'));
        if (__VLS_ctx.usersDbSslDefaultRow) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('fieldName'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('usersDbWinner'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            (__VLS_ctx.$t('sslWarnThreshold'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbSslDefaultRow.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbSslDefaultRow.local);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (__VLS_ctx.usersDbSslDefaultRow.modeLabel);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbSslDefaultRow.result);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[10px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.usersDbSslDefaultRow.reason);
        }
        if (__VLS_ctx.usersDbWarnDaysChangedRows.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('provider'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('usersDbWinner'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [row] of __VLS_vFor((__VLS_ctx.usersDbWarnDaysChangedRows))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (row.provider),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (row.provider);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (row.remote);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (row.local);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-2" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline badge-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                (row.modeLabel);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (row.result);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[10px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (row.reason);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, usersDbSslDefaultRow, usersDbSslDefaultRow, usersDbSslDefaultRow, usersDbSslDefaultRow, usersDbSslDefaultRow, usersDbSslDefaultRow, usersDbSslDefaultRow, usersDbSslDefaultRow, usersDbWarnDaysChangedRows, usersDbWarnDaysChangedRows, usersDbWarnDaysChangedRows, usersDbWarnDaysChangedRows,];
            }
        }
    }
    if (__VLS_ctx.usersDbSmartOpen) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbSmartMergeTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                        return;
                    if (!(__VLS_ctx.usersDbSmartOpen))
                        return;
                    __VLS_ctx.usersDbSmartOpen = false;
                    // @ts-ignore
                    [$t, usersDbSmartOpen, usersDbSmartOpen,];
                } },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (__VLS_ctx.usersDbBusy),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbSmartMergeDesc'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
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
            ...{ class: "text-xs font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbApplyPreviewTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2 text-[11px]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.usersDbSmartPreviewStats.changedRows);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.$t('usersDbPreviewSections'));
        (__VLS_ctx.usersDbSmartPreviewStats.changedSections);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.$t('usersDbLocalOnly'));
        (__VLS_ctx.usersDbSmartPreviewStats.localOnlyRows);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline badge-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        (__VLS_ctx.$t('usersDbRouterOnly'));
        (__VLS_ctx.usersDbSmartPreviewStats.routerOnlyRows);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbApplyPreviewHint'));
        if (__VLS_ctx.usersDbSmartPreviewRows.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('fieldName'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('provider'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('usersDbWinner'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('usersDbWinner'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.$t('usersDbReason'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [row] of __VLS_vFor((__VLS_ctx.usersDbSmartPreviewRows))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (`${row.section}-${row.key}`),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (row.sectionLabel);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (row.key);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-outline badge-xs" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                (row.modeLabel);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono break-all" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                (row.resultText);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "text-[11px] opacity-70" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                (row.reason);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, usersDbBusy, usersDbSmartPreviewStats, usersDbSmartPreviewStats, usersDbSmartPreviewStats, usersDbSmartPreviewStats, usersDbSmartPreviewRows, usersDbSmartPreviewRows,];
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 text-[11px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('usersDbPreviewNoChanges'));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.usersDbSmartApply) },
            type: "button",
            ...{ class: "btn btn-xs" },
            disabled: (__VLS_ctx.usersDbBusy),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('usersDbSmartMergeAndPush'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 space-y-4" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
        if (__VLS_ctx.usersDbConflictDiff.labels.changed.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (__VLS_ctx.$t('usersDbLabels'));
            (__VLS_ctx.$t('usersDbChanged'));
            (__VLS_ctx.usersDbConflictDiff.labels.changed.length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.labels.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('labels', 'local');
                        // @ts-ignore
                        [$t, $t, $t, $t, usersDbBusy, usersDbConflictDiff, usersDbConflictDiff, usersDbSmartApply, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllLocal'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.labels.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('labels', 'remote');
                        // @ts-ignore
                        [$t, usersDbBusy, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllRouter'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.$t('actions'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.labels.changed))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (it.key),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (it.key);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-col gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "max-w-[260px] truncate" },
                    title: (it.remote.label),
                });
                /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (it.remote.label || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[10px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('agentRestoreScope'));
                (__VLS_ctx.usersDbFormatScopeText(it.remote.scope));
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-col gap-1" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "max-w-[260px] truncate" },
                    title: (it.local.label),
                });
                /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (it.local.label || '—');
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "text-[10px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('agentRestoreScope'));
                (__VLS_ctx.usersDbFormatScopeText(it.local.scope));
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "min-w-[260px]" },
                });
                /** @type {__VLS_StyleScopedClasses['min-w-[260px]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-3" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-l-${it.key}`),
                    value: "remote",
                });
                (__VLS_ctx.usersDbSmartChoices.labels[it.key].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('router'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-l-${it.key}`),
                    value: "local",
                });
                (__VLS_ctx.usersDbSmartChoices.labels[it.key].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('local'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-l-${it.key}`),
                    value: "custom",
                });
                (__VLS_ctx.usersDbSmartChoices.labels[it.key].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('custom'));
                if (__VLS_ctx.usersDbSmartChoices.labels[it.key].mode === 'custom') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        type: "text",
                        ...{ class: "input input-bordered input-xs mt-1 w-full" },
                        value: (__VLS_ctx.usersDbSmartChoices.labels[it.key].customLabel),
                        placeholder: (it.local.label),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                }
                if (__VLS_ctx.usersDbSmartChoices.labels[it.key].mode === 'custom') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "mt-1 text-[10px] opacity-60" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                    (__VLS_ctx.$t('agentRestoreScope'));
                    (__VLS_ctx.usersDbFormatScopeText(it.local.scope));
                    (__VLS_ctx.$t('local'));
                }
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, usersDbBusy, usersDbConflictDiff, usersDbFormatScopeText, usersDbFormatScopeText, usersDbFormatScopeText, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices,];
            }
        }
        if (__VLS_ctx.usersDbConflictDiff.urls.changed.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (__VLS_ctx.$t('usersDbPanels'));
            (__VLS_ctx.$t('usersDbChanged'));
            (__VLS_ctx.usersDbConflictDiff.urls.changed.length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.urls.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('urls', 'local');
                        // @ts-ignore
                        [$t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllLocal'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.urls.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('urls', 'remote');
                        // @ts-ignore
                        [$t, usersDbBusy, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllRouter'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('provider'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.$t('actions'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.urls.changed))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (it.provider),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (it.provider);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "max-w-[320px] truncate" },
                });
                /** @type {__VLS_StyleScopedClasses['max-w-[320px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (it.remote);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "max-w-[320px] truncate" },
                });
                /** @type {__VLS_StyleScopedClasses['max-w-[320px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (it.local);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "min-w-[260px]" },
                });
                /** @type {__VLS_StyleScopedClasses['min-w-[260px]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-3" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-u-${it.provider}`),
                    value: "remote",
                });
                (__VLS_ctx.usersDbSmartChoices.urls[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('router'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-u-${it.provider}`),
                    value: "local",
                });
                (__VLS_ctx.usersDbSmartChoices.urls[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('local'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-u-${it.provider}`),
                    value: "custom",
                });
                (__VLS_ctx.usersDbSmartChoices.urls[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('custom'));
                if (__VLS_ctx.usersDbSmartChoices.urls[it.provider].mode === 'custom') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        type: "text",
                        ...{ class: "input input-bordered input-xs mt-1 w-full" },
                        value: (__VLS_ctx.usersDbSmartChoices.urls[it.provider].customUrl),
                        placeholder: (it.local),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                }
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, usersDbBusy, usersDbConflictDiff, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices,];
            }
        }
        if (__VLS_ctx.usersDbConflictDiff.tunnels.changed.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsTitle'));
            (__VLS_ctx.$t('usersDbChanged'));
            (__VLS_ctx.usersDbConflictDiff.tunnels.changed.length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.tunnels.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('tunnels', 'local');
                        // @ts-ignore
                        [$t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllLocal'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.tunnels.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('tunnels', 'remote');
                        // @ts-ignore
                        [$t, usersDbBusy, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllRouter'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.$t('actions'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.tunnels.changed))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (it.name),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (it.name);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "max-w-[260px] truncate" },
                    title: (it.remote),
                });
                /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (it.remote);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "max-w-[260px] truncate" },
                    title: (it.local),
                });
                /** @type {__VLS_StyleScopedClasses['max-w-[260px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                (it.local);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "min-w-[260px]" },
                });
                /** @type {__VLS_StyleScopedClasses['min-w-[260px]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-3" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-t-${it.name}`),
                    value: "remote",
                });
                (__VLS_ctx.usersDbSmartChoices.tunnels[it.name].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('router'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-t-${it.name}`),
                    value: "local",
                });
                (__VLS_ctx.usersDbSmartChoices.tunnels[it.name].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('local'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-t-${it.name}`),
                    value: "custom",
                });
                (__VLS_ctx.usersDbSmartChoices.tunnels[it.name].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('custom'));
                if (__VLS_ctx.usersDbSmartChoices.tunnels[it.name].mode === 'custom') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        type: "text",
                        ...{ class: "input input-bordered input-xs mt-1 w-full" },
                        value: (__VLS_ctx.usersDbSmartChoices.tunnels[it.name].customDescription),
                        placeholder: (it.local),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                }
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, usersDbBusy, usersDbConflictDiff, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices,];
            }
        }
        if (__VLS_ctx.usersDbConflictDiff.icons && __VLS_ctx.usersDbConflictDiff.icons.changed && __VLS_ctx.usersDbConflictDiff.icons.changed.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (__VLS_ctx.$t('providerIcon'));
            (__VLS_ctx.$t('usersDbChanged'));
            (__VLS_ctx.usersDbConflictDiff.icons.changed.length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.icons && __VLS_ctx.usersDbConflictDiff.icons.changed && __VLS_ctx.usersDbConflictDiff.icons.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('icons', 'local');
                        // @ts-ignore
                        [$t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllLocal'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.icons && __VLS_ctx.usersDbConflictDiff.icons.changed && __VLS_ctx.usersDbConflictDiff.icons.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('icons', 'remote');
                        // @ts-ignore
                        [$t, usersDbBusy, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllRouter'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('provider'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.$t('actions'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.icons.changed))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (it.provider),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (it.provider);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.fmtProviderIcon(it.remote));
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (__VLS_ctx.fmtProviderIcon(it.local));
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "min-w-[260px]" },
                });
                /** @type {__VLS_StyleScopedClasses['min-w-[260px]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-3" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-i-${it.provider}`),
                    value: "remote",
                });
                (__VLS_ctx.usersDbSmartChoices.icons[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('router'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-i-${it.provider}`),
                    value: "local",
                });
                (__VLS_ctx.usersDbSmartChoices.icons[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('local'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-i-${it.provider}`),
                    value: "custom",
                });
                (__VLS_ctx.usersDbSmartChoices.icons[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('custom'));
                if (__VLS_ctx.usersDbSmartChoices.icons[it.provider].mode === 'custom') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        type: "text",
                        ...{ class: "input input-bordered input-xs mt-1 w-full" },
                        value: (__VLS_ctx.usersDbSmartChoices.icons[it.provider].customIcon),
                        placeholder: (it.local),
                    });
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "mt-0.5 text-[10px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (__VLS_ctx.$t('providerIconHint'));
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, fmtProviderIcon, fmtProviderIcon, usersDbBusy, usersDbConflictDiff, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices,];
            }
        }
        if (__VLS_ctx.usersDbConflictDiff.ssl.defaultDays.changed) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (__VLS_ctx.$t('sslWarnThreshold'));
            (__VLS_ctx.$t('usersDbChanged'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 flex flex-wrap items-center gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "radio radio-xs" },
                type: "radio",
                name: "udb-ssl-default",
                value: "remote",
            });
            (__VLS_ctx.usersDbSmartChoices.sslDefault.mode);
            /** @type {__VLS_StyleScopedClasses['radio']} */ ;
            /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbConflictDiff.ssl.defaultDays.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "radio radio-xs" },
                type: "radio",
                name: "udb-ssl-default",
                value: "local",
            });
            (__VLS_ctx.usersDbSmartChoices.sslDefault.mode);
            /** @type {__VLS_StyleScopedClasses['radio']} */ ;
            /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbConflictDiff.ssl.defaultDays.local);
            __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "radio radio-xs" },
                type: "radio",
                name: "udb-ssl-default",
                value: "custom",
            });
            (__VLS_ctx.usersDbSmartChoices.sslDefault.mode);
            /** @type {__VLS_StyleScopedClasses['radio']} */ ;
            /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-[11px]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            (__VLS_ctx.$t('custom'));
            if (__VLS_ctx.usersDbSmartChoices.sslDefault.mode === 'custom') {
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    type: "number",
                    min: "0",
                    max: "365",
                    ...{ class: "input input-bordered input-xs w-24" },
                });
                (__VLS_ctx.usersDbSmartChoices.sslDefault.customDays);
                /** @type {__VLS_StyleScopedClasses['input']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
                /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-24']} */ ;
            }
        }
        if (__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "font-semibold text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            (__VLS_ctx.$t('sslWarnDays'));
            (__VLS_ctx.$t('usersDbChanged'));
            (__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed.length);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('warnDays', 'local');
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbSmartSetAll, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllLocal'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.usersDbHasConflict && __VLS_ctx.usersDbConflictDiff && __VLS_ctx.usersDbConflictSummary))
                            return;
                        if (!(__VLS_ctx.usersDbSmartOpen))
                            return;
                        if (!(__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed.length))
                            return;
                        __VLS_ctx.usersDbSmartSetAll('warnDays', 'remote');
                        // @ts-ignore
                        [$t, usersDbBusy, usersDbSmartSetAll,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
                disabled: (__VLS_ctx.usersDbBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.$t('usersDbSetAllRouter'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 overflow-x-auto" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "table table-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['table']} */ ;
            /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('provider'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('router'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
                ...{ style: {} },
            });
            (__VLS_ctx.$t('local'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            (__VLS_ctx.$t('actions'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (it.provider),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (it.provider);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (it.remote);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (it.local);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                    ...{ class: "min-w-[260px]" },
                });
                /** @type {__VLS_StyleScopedClasses['min-w-[260px]']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "flex flex-wrap items-center gap-3" },
                });
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-w-${it.provider}`),
                    value: "remote",
                });
                (__VLS_ctx.usersDbSmartChoices.warnDays[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('router'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-w-${it.provider}`),
                    value: "local",
                });
                (__VLS_ctx.usersDbSmartChoices.warnDays[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('local'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: "inline-flex items-center gap-1 cursor-pointer" },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ class: "radio radio-xs" },
                    type: "radio",
                    name: (`udb-w-${it.provider}`),
                    value: "custom",
                });
                (__VLS_ctx.usersDbSmartChoices.warnDays[it.provider].mode);
                /** @type {__VLS_StyleScopedClasses['radio']} */ ;
                /** @type {__VLS_StyleScopedClasses['radio-xs']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[11px]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                (__VLS_ctx.$t('custom'));
                if (__VLS_ctx.usersDbSmartChoices.warnDays[it.provider].mode === 'custom') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        type: "number",
                        min: "0",
                        max: "365",
                        ...{ class: "input input-bordered input-xs mt-1 w-24" },
                    });
                    (__VLS_ctx.usersDbSmartChoices.warnDays[it.provider].customDays);
                    /** @type {__VLS_StyleScopedClasses['input']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-bordered']} */ ;
                    /** @type {__VLS_StyleScopedClasses['input-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-24']} */ ;
                }
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, usersDbBusy, usersDbConflictDiff, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices, usersDbSmartChoices,];
            }
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "mt-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer select-none opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (__VLS_ctx.$t('details'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.usersDbConflictDiff.labels.changed.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.$t('usersDbLabels'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.labels.changed.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.key),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.key);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.usersDbFormatLabelSummary(it.remote.label, it.remote.scope));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.usersDbFormatLabelSummary(it.local.label, it.local.scope));
            // @ts-ignore
            [$t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbFormatLabelSummary, usersDbFormatLabelSummary,];
        }
        if (__VLS_ctx.usersDbConflictDiff.labels.changed.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.labels.localOnly.length || __VLS_ctx.usersDbConflictDiff.labels.remoteOnly.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbAddedRemoved'));
        (__VLS_ctx.$t('usersDbLabels'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbLocalOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.labels.localOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.key),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.key);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.usersDbFormatLabelSummary(it.label, it.scope));
            // @ts-ignore
            [$t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbFormatLabelSummary,];
        }
        if (__VLS_ctx.usersDbConflictDiff.labels.localOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbRouterOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.labels.remoteOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.key),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.key);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.usersDbFormatLabelSummary(it.label, it.scope));
            // @ts-ignore
            [$t, usersDbConflictDiff, usersDbConflictDiff, usersDbFormatLabelSummary,];
        }
        if (__VLS_ctx.usersDbConflictDiff.labels.remoteOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.userLimits.changed.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.$t('usersDbUserLimits'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbUserLimitChangedRows.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.user),
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.user);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.result);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.reason);
            // @ts-ignore
            [$t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbUserLimitChangedRows,];
        }
        if (__VLS_ctx.usersDbConflictDiff.userLimits.changed.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.userLimits.localOnly.length || __VLS_ctx.usersDbConflictDiff.userLimits.remoteOnly.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbAddedRemoved'));
        (__VLS_ctx.$t('usersDbUserLimits'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbLocalOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.userLimits.localOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.user),
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.user);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.fmtUserLimitSummary(it.local));
            // @ts-ignore
            [$t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, fmtUserLimitSummary,];
        }
        if (__VLS_ctx.usersDbConflictDiff.userLimits.localOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbRouterOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.userLimits.remoteOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.user),
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.user);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.fmtUserLimitSummary(it.remote));
            // @ts-ignore
            [$t, usersDbConflictDiff, usersDbConflictDiff, fmtUserLimitSummary,];
        }
        if (__VLS_ctx.usersDbConflictDiff.userLimits.remoteOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.urls.changed.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.$t('usersDbPanels'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.urls.changed.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.local);
            // @ts-ignore
            [$t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.urls.changed.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.urls.localOnly.length || __VLS_ctx.usersDbConflictDiff.urls.remoteOnly.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbAddedRemoved'));
        (__VLS_ctx.$t('usersDbPanels'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbLocalOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.urls.localOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.url);
            // @ts-ignore
            [$t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.urls.localOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbRouterOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.urls.remoteOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono break-all" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.url);
            // @ts-ignore
            [$t, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.urls.remoteOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.icons && __VLS_ctx.usersDbConflictDiff.icons.changed && __VLS_ctx.usersDbConflictDiff.icons.changed.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.$t('providerIcon'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor(((__VLS_ctx.usersDbConflictDiff.icons.changed || []).slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.fmtProviderIcon(it.remote));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.fmtProviderIcon(it.local));
            // @ts-ignore
            [$t, $t, fmtProviderIcon, fmtProviderIcon, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if ((__VLS_ctx.usersDbConflictDiff.icons.changed || []).length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if ((__VLS_ctx.usersDbConflictDiff.icons?.localOnly || []).length || (__VLS_ctx.usersDbConflictDiff.icons?.remoteOnly || []).length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbAddedRemoved'));
        (__VLS_ctx.$t('providerIcon'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbLocalOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((((__VLS_ctx.usersDbConflictDiff.icons?.localOnly) || []).slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.fmtProviderIcon(it.icon));
            // @ts-ignore
            [$t, $t, $t, fmtProviderIcon, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (((__VLS_ctx.usersDbConflictDiff.icons?.localOnly) || []).length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbRouterOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((((__VLS_ctx.usersDbConflictDiff.icons?.remoteOnly) || []).slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.fmtProviderIcon(it.icon));
            // @ts-ignore
            [$t, fmtProviderIcon, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (((__VLS_ctx.usersDbConflictDiff.icons?.remoteOnly) || []).length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.tunnels.changed.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.tunnels.changed.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.name),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.local);
            // @ts-ignore
            [$t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.tunnels.changed.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.tunnels.localOnly.length || __VLS_ctx.usersDbConflictDiff.tunnels.remoteOnly.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbAddedRemoved'));
        (__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbLocalOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.tunnels.localOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.name),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.description);
            // @ts-ignore
            [$t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.tunnels.localOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbRouterOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.tunnels.remoteOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.name),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.name);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.description);
            // @ts-ignore
            [$t, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.tunnels.remoteOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.ssl.defaultDays.changed) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.$t('sslWarnThreshold'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.usersDbConflictDiff.ssl.defaultDays.remote);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.usersDbConflictDiff.ssl.defaultDays.local);
    }
    if (__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbChanged'));
        (__VLS_ctx.$t('sslWarnDays'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.remote);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.local);
            // @ts-ignore
            [$t, $t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.ssl.providerDays.changed.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
    if (__VLS_ctx.usersDbConflictDiff.ssl.providerDays.localOnly.length || __VLS_ctx.usersDbConflictDiff.ssl.providerDays.remoteOnly.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbAddedRemoved'));
        (__VLS_ctx.$t('sslWarnDays'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbLocalOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.ssl.providerDays.localOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.days);
            // @ts-ignore
            [$t, $t, $t, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.ssl.providerDays.localOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('usersDbRouterOnly'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 space-y-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbConflictDiff.ssl.providerDays.remoteOnly.slice(0, 50)))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (it.provider),
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (it.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (it.days);
            // @ts-ignore
            [$t, usersDbConflictDiff, usersDbConflictDiff,];
        }
        if (__VLS_ctx.usersDbConflictDiff.ssl.providerDays.remoteOnly.length > 50) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        }
    }
}
if (__VLS_ctx.agentEnabled) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/40 p-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({
        ...{ class: "cursor-pointer select-none opacity-80 flex items-center justify-between gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-none']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('usersDbHistoryTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.usersDbHistoryItems.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-2 flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.refreshUsersDbHistory) },
        type: "button",
        ...{ class: "btn btn-xs btn-ghost" },
        disabled: (__VLS_ctx.usersDbBusy),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    (__VLS_ctx.$t('refresh'));
    if (!__VLS_ctx.usersDbHistoryItems.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('noData'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 overflow-x-auto" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "table table-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['table']} */ ;
        /** @type {__VLS_StyleScopedClasses['table-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('updated'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        (__VLS_ctx.$t('status'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [it] of __VLS_vFor((__VLS_ctx.usersDbHistoryItems))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (it.rev),
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (it.rev);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (it.updatedAt || '—');
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
            if (it.current) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-success badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
                (__VLS_ctx.$t('current'));
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "badge badge-ghost badge-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "text-right" },
            });
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex justify-end gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.agentEnabled))
                            return;
                        if (!!(!__VLS_ctx.usersDbHistoryItems.length))
                            return;
                        __VLS_ctx.usersDbOpenRevPreview(it.rev);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, agentEnabled, usersDbBusy, usersDbConflictDiff, usersDbHistoryItems, usersDbHistoryItems, usersDbHistoryItems, refreshUsersDbHistory, usersDbOpenRevPreview,];
                    } },
                type: "button",
                ...{ class: "btn btn-xs btn-ghost" },
                disabled: (__VLS_ctx.usersDbBusy || __VLS_ctx.usersDbViewBusy),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            (__VLS_ctx.$t('usersDbView'));
            if (!it.current) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.agentEnabled))
                                return;
                            if (!!(!__VLS_ctx.usersDbHistoryItems.length))
                                return;
                            if (!(!it.current))
                                return;
                            __VLS_ctx.usersDbRestoreRev(it.rev);
                            // @ts-ignore
                            [$t, usersDbBusy, usersDbViewBusy, usersDbRestoreRev,];
                        } },
                    type: "button",
                    ...{ class: "btn btn-xs" },
                    disabled: (__VLS_ctx.usersDbBusy),
                });
                /** @type {__VLS_StyleScopedClasses['btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
                (__VLS_ctx.$t('restore'));
            }
            // @ts-ignore
            [$t, usersDbBusy,];
        }
    }
    if (__VLS_ctx.usersDbViewRev) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-200/40 p-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
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
            ...{ class: "min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm font-semibold" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        (__VLS_ctx.$t('usersDbRevisionPreview'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.usersDbViewRev);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-0.5 text-[11px] opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (__VLS_ctx.$t('updated'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono ml-1" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        (__VLS_ctx.usersDbViewUpdatedAt || '—');
        if (__VLS_ctx.usersDbViewSummary) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.$t('usersDbLabels'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbViewSummary.labels);
            (__VLS_ctx.$t('usersDbPanels'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbViewSummary.panels);
            (__VLS_ctx.$t('providerIcon'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbViewSummary.icons);
            (__VLS_ctx.$t('routerTrafficTunnelDescriptionsSettingsTitle'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbViewSummary.tunnels);
            (__VLS_ctx.$t('usersDbUserLimits'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbViewSummary.userLimits);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (__VLS_ctx.usersDbViewSummary.sslDefault);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.copyUsersDbViewJson) },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (__VLS_ctx.usersDbViewBusy || !__VLS_ctx.usersDbViewJsonText),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('copy'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.copyUsersDbViewLabels) },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (__VLS_ctx.usersDbViewBusy || !__VLS_ctx.usersDbViewPayload),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('copy'));
        (__VLS_ctx.$t('usersDbLabels'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.copyUsersDbViewPanels) },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (__VLS_ctx.usersDbViewBusy || !__VLS_ctx.usersDbViewPayload),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('copy'));
        (__VLS_ctx.$t('usersDbPanels'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.copyUsersDbViewIcons) },
            type: "button",
            ...{ class: "btn btn-xs btn-ghost" },
            disabled: (__VLS_ctx.usersDbViewBusy || !__VLS_ctx.usersDbViewPayload),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        (__VLS_ctx.$t('copy'));
        (__VLS_ctx.$t('providerIcon'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.usersDbCloseRevPreview) },
            type: "button",
            ...{ class: "btn btn-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        (__VLS_ctx.$t('close'));
        if (__VLS_ctx.usersDbViewError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 text-xs text-error" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
            (__VLS_ctx.usersDbViewError);
        }
        else if (__VLS_ctx.usersDbViewBusy) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 text-xs opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        }
        if (__VLS_ctx.usersDbViewJsonText) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-2 rounded-lg border border-base-content/10 bg-base-100/60 p-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
                ...{ class: "max-h-[40vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4" },
            });
            /** @type {__VLS_StyleScopedClasses['max-h-[40vh]']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['whitespace-pre-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-words']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['leading-4']} */ ;
            (__VLS_ctx.usersDbViewJsonText);
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-[11px] opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('usersDbSyncCurrent'));
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
(__VLS_ctx.$t('operationsHistory'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearJobs) },
    type: "button",
    ...{ class: "btn btn-sm btn-ghost" },
    disabled: (!__VLS_ctx.jobs.length),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
(__VLS_ctx.$t('clear'));
if (!__VLS_ctx.jobs.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.$t('noOperationsYet'));
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
    (__VLS_ctx.$t('operation'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
    });
    (__VLS_ctx.$t('status'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
        ...{ style: {} },
    });
    (__VLS_ctx.$t('duration'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
    for (const [j] of __VLS_vFor((__VLS_ctx.jobs))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
            key: (j.id),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "font-mono text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (__VLS_ctx.fmtTime(j.startedAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        (j.title);
        if (j.error) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-xs text-error" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-error']} */ ;
            (j.error);
        }
        else if (j.meta && Object.keys(j.meta).length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            for (const [v, k] of __VLS_vFor((j.meta))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (k),
                    ...{ class: "mr-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mr-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (k);
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "font-mono" },
                });
                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                (v);
                // @ts-ignore
                [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, usersDbViewBusy, usersDbViewBusy, usersDbViewBusy, usersDbViewBusy, usersDbViewBusy, usersDbViewRev, usersDbViewRev, usersDbViewUpdatedAt, usersDbViewSummary, usersDbViewSummary, usersDbViewSummary, usersDbViewSummary, usersDbViewSummary, usersDbViewSummary, usersDbViewSummary, copyUsersDbViewJson, usersDbViewJsonText, usersDbViewJsonText, usersDbViewJsonText, copyUsersDbViewLabels, usersDbViewPayload, usersDbViewPayload, usersDbViewPayload, copyUsersDbViewPanels, copyUsersDbViewIcons, usersDbCloseRevPreview, usersDbViewError, usersDbViewError, clearJobs, jobs, jobs, jobs, fmtTime,];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
        if (j.endedAt && j.ok) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-success" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-success']} */ ;
            (__VLS_ctx.$t('done'));
        }
        else if (j.endedAt && j.ok === false) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-error" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-error']} */ ;
            (__VLS_ctx.$t('failed'));
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-warning" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-warning']} */ ;
            (__VLS_ctx.$t('running'));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
            ...{ class: "font-mono text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        (j.endedAt ? __VLS_ctx.fmtMs(j.endedAt - j.startedAt) : '—');
        // @ts-ignore
        [$t, $t, $t, fmtMs,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex-1" },
});
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card items-center justify-center gap-2 p-2 sm:flex-row" },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
(__VLS_ctx.getLabelFromBackend(__VLS_ctx.activeBackend));
const __VLS_61 = BackendVersion;
// @ts-ignore
const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({}));
const __VLS_63 = __VLS_62({}, ...__VLS_functionalComponentArgsRest(__VLS_62));
// @ts-ignore
[getLabelFromBackend, activeBackend,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
