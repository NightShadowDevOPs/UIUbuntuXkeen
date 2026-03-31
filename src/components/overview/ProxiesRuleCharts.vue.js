/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { backgroundImage } from '@/helper/indexeddb';
import { prettyBytesHelper } from '@/helper/utils';
import { showNotification } from '@/helper/notification';
import { isSourceIpScopeVisible } from '@/helper/sourceip';
import { cleanupExpiredPendingPageFocus, setPendingPageFocus } from '@/helper/navFocus';
import { ROUTE_NAME } from '@/constant';
import { activeConnections } from '@/store/connections';
import { proxyProviederList } from '@/store/proxies';
import { blurIntensity, dashboardTransparent, font, proxiesRelationshipColorMode, proxiesRelationshipTopN, proxiesRelationshipWeightMode, sourceIPLabelList, theme, } from '@/store/settings';
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, ArrowUturnLeftIcon, ArrowsPointingInIcon, ArrowsPointingOutIcon, BookmarkIcon, CheckIcon, FunnelIcon, LockClosedIcon, LockOpenIcon, NoSymbolIcon, PencilIcon, PlusIcon, PresentationChartLineIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useElementSize, useStorage } from '@vueuse/core';
import { SankeyChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import dayjs from 'dayjs';
import { debounce } from 'lodash';
import { twMerge } from 'tailwind-merge';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import DialogWrapper from '@/components/common/DialogWrapper.vue';
import TextInput from '@/components/common/TextInput.vue';
echarts.use([SankeyChart, TooltipComponent, CanvasRenderer]);
const { t } = useI18n();
const router = useRouter();
const isFullScreen = ref(false);
const chart = ref();
const fullScreenChart = ref();
const colorRef = ref();
const controlsBar = ref(null);
const fsControlsBar = ref(null);
const { height: controlsBarHeight } = useElementSize(controlsBar);
const { height: fsControlsBarHeight } = useElementSize(fsControlsBar);
const fullChartStyle = computed(() => `backdrop-filter: blur(${blurIntensity.value}px);`);
const colorSet = { baseContent30: '', baseContent: '', base70: '' };
let fontFamily = '';
const updateColorSet = () => {
    const cs = getComputedStyle(colorRef.value);
    colorSet.baseContent = cs.getPropertyValue('--color-base-content').trim();
    colorSet.baseContent30 = cs.borderColor;
    colorSet.base70 = cs.backgroundColor;
};
const updateFontFamily = () => {
    fontFamily = getComputedStyle(colorRef.value).fontFamily;
};
const { width, height } = useElementSize(chart);
// Topology height can be manually resized.
const defaultTopologyHeight = () => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    return Math.round(Math.max(420, Math.min(900, vh * 0.65)));
};
const topologyHeight = useStorage('config/topology-height-px', defaultTopologyHeight());
const resizing = ref(false);
let resizeStartY = 0;
let resizeStartH = 0;
const clampHeight = (h) => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const min = 320;
    const max = Math.max(min, Math.floor(vh * 0.9));
    return Math.round(Math.max(min, Math.min(max, h)));
};
const onResizeMove = (e) => {
    if (!resizing.value)
        return;
    const dy = e.clientY - resizeStartY;
    topologyHeight.value = clampHeight(resizeStartH + dy);
};
const stopResize = () => {
    resizing.value = false;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', stopResize);
};
const startResize = (e) => {
    resizing.value = true;
    resizeStartY = e.clientY;
    resizeStartH = topologyHeight.value;
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', stopResize);
};
const labelFontSize = computed(() => {
    const w = Number(width.value) || 0;
    return isFullScreen.value ? 16 : w >= 1100 ? 15 : w >= 800 ? 14 : 13;
});
const labelWidth = computed(() => {
    const w = (isFullScreen.value ? window.innerWidth : Number(width.value)) || 0;
    const col = w > 0 ? w / 4 : 260;
    // не даём label'ам разваливать лейаут, но и не делаем их слишком узкими
    return Math.round(Math.max(140, Math.min(440, col - (isFullScreen.value ? 88 : 72))));
});
const normalize = (s) => (s || '').trim() || '-';
const stageOf = (name) => {
    const i = name.indexOf(':');
    return i >= 0 ? name.slice(0, i) : '';
};
const labelOf = (name) => {
    const i = name.indexOf(':');
    return i >= 0 ? name.slice(i + 1) : name;
};
const shortLabel = (name) => {
    const v = labelOf(name);
    if (!v)
        return '';
    const max = isFullScreen.value ? 56 : 40;
    return v.length > max ? `${v.slice(0, max - 1)}…` : v;
};
const labelForIp = (ip) => {
    const item = sourceIPLabelList.value.find((x) => {
        if (x.key !== ip)
            return false;
        return isSourceIpScopeVisible(x.scope);
    });
    return item?.label || '';
};
const providerMap = computed(() => {
    const m = new Map();
    for (const p of proxyProviederList.value) {
        for (const proxy of p.proxies || []) {
            m.set(proxy.name, p.name);
        }
    }
    return m;
});
const providerOf = (name) => providerMap.value.get(name) || '';
const colorFromKey = (key) => {
    const s = key || 'unknown';
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360} 70% 55%)`;
};
const focus = ref(null);
const filterMode = ref('none');
const filterFocus = ref(null);
const filterLocked = useStorage('config/topology-filter-locked', false);
// Bridge: other pages can request a Topology filter via localStorage.
const TOPOLOGY_NAV_FILTER_KEY = 'runtime/topology-pending-filter-v1';
const pendingNavFilter = useStorage(TOPOLOGY_NAV_FILTER_KEY, null);
const readPendingNavFilter = () => {
    const pf = pendingNavFilter.value;
    if (pf && typeof pf === 'object')
        return pf;
    try {
        const raw = localStorage.getItem(TOPOLOGY_NAV_FILTER_KEY);
        if (!raw || raw === 'null')
            return null;
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object')
            return obj;
    }
    catch {
        // ignore
    }
    return null;
};
const presetDialogShow = ref(false);
const topologyPresets = useStorage('config/topology-presets', []);
const activePresetId = useStorage('config/topology-preset-active', '');
const activePreset = computed(() => topologyPresets.value.find((p) => p.id === activePresetId.value) || null);
const newPresetName = ref('');
const editingPresetId = ref(null);
const editingPresetName = ref('');
const stageLabel = (st) => st === 'C'
    ? t('proxiesRelationshipClients')
    : st === 'R'
        ? t('rule')
        : st === 'G'
            ? t('proxyGroup')
            : st === 'P'
                ? t('proxyProvider')
                : t('proxies');
const toggleFilterLock = () => {
    filterLocked.value = !filterLocked.value;
};
const shortText = (s, maxLen = 60) => {
    const v = (s || '').trim();
    if (v.length <= maxLen)
        return v;
    return v.slice(0, Math.max(0, maxLen - 1)) + '…';
};
const filterValueLabel = (f) => {
    if (f.kind !== 'value')
        return '';
    const v = String(f.value || '').trim();
    if (!v)
        return '';
    if (f.stage === 'C') {
        const ip = v;
        const lbl = labelForIp(ip);
        return lbl ? `${lbl} (${ip})` : ip;
    }
    return v;
};
const activeFilterChip = computed(() => {
    if (filterMode.value === 'none' || !filterFocus.value || filterFocus.value.kind !== 'value')
        return null;
    const modeText = filterMode.value === 'only' ? t('topologyOnlyThis') : t('topologyExcludeThis');
    const stage = stageLabel(filterFocus.value.stage);
    const fullValue = filterValueLabel(filterFocus.value);
    const text = `${modeText} · ${stage}: ${shortText(fullValue, 64)}`;
    const title = `${modeText} · ${stage}: ${fullValue}`;
    return { text, title };
});
const normalizeSavedFilter = () => {
    if (filterMode.value === 'none' || !filterFocus.value || filterFocus.value.kind !== 'value') {
        return { mode: 'none', focus: null };
    }
    return { mode: filterMode.value, focus: { ...filterFocus.value } };
};
const captureScene = () => {
    const ff = normalizeSavedFilter();
    return {
        weightMode: proxiesRelationshipWeightMode.value,
        topN: Number(proxiesRelationshipTopN.value) || 40,
        colorMode: proxiesRelationshipColorMode.value,
        filterMode: ff.mode,
        filterFocus: ff.focus,
    };
};
const currentSceneSummary = computed(() => {
    const s = captureScene();
    const parts = [
        proxiesRelationshipWeightMode.value === 'count' ? t('count') : t('traffic'),
        `Top ${s.topN}`,
    ];
    if (s.filterMode !== 'none' && s.filterFocus?.kind === 'value') {
        parts.push(`${s.filterMode === 'only' ? t('topologyFilterOnly') : t('topologyFilterExclude')} · ${stageLabel(s.filterFocus.stage)}`);
    }
    return parts.join(' · ');
});
const ensureDefaultPresets = () => {
    if (topologyPresets.value?.length)
        return;
    topologyPresets.value = [
        {
            id: 'streaming',
            name: t('presetStreaming'),
            weightMode: 'traffic',
            topN: 60,
            colorMode: 'proxy',
            filterMode: 'none',
            filterFocus: null,
        },
        {
            id: 'work',
            name: t('presetWork'),
            weightMode: 'traffic',
            topN: 40,
            colorMode: 'proxy',
            filterMode: 'none',
            filterFocus: null,
        },
        {
            id: 'gaming',
            name: t('presetGaming'),
            weightMode: 'count',
            topN: 30,
            colorMode: 'proxy',
            filterMode: 'none',
            filterFocus: null,
        },
    ];
};
ensureDefaultPresets();
const resetPresets = () => {
    topologyPresets.value = [];
    activePresetId.value = '';
    ensureDefaultPresets();
    showNotification({ content: 'presetResetDone', type: 'alert-success', timeout: 1800 });
};
const presetSummary = (p) => {
    const parts = [
        p.weightMode === 'count' ? t('count') : t('traffic'),
        `Top ${p.topN}`,
    ];
    if (p.filterMode !== 'none' && p.filterFocus?.kind === 'value') {
        const who = stageLabel(p.filterFocus.stage);
        parts.push(`${p.filterMode === 'only' ? t('topologyFilterOnly') : t('topologyFilterExclude')} · ${who}`);
    }
    return parts.join(' · ');
};
const applyPreset = (p) => {
    proxiesRelationshipWeightMode.value = p.weightMode;
    proxiesRelationshipTopN.value = p.topN;
    proxiesRelationshipColorMode.value = p.colorMode;
    if (!filterLocked.value) {
        if (p.filterMode === 'none' || !p.filterFocus) {
            clearFilter();
        }
        else {
            filterMode.value = p.filterMode;
            filterFocus.value = { ...p.filterFocus };
        }
    }
    activePresetId.value = p.id;
    showNotification({
        content: filterLocked.value ? 'presetAppliedFiltersLocked' : 'presetApplied',
        type: 'alert-success',
        timeout: 1800,
    });
};
const isSameSceneAsPreset = (p) => {
    const s = captureScene();
    if (p.weightMode !== s.weightMode)
        return false;
    if (Number(p.topN) !== Number(s.topN))
        return false;
    if (p.colorMode !== s.colorMode)
        return false;
    if (p.filterMode !== s.filterMode)
        return false;
    const a = p.filterFocus ? JSON.stringify(p.filterFocus) : '';
    const b = s.filterFocus ? JSON.stringify(s.filterFocus) : '';
    return a === b;
};
// If user changes any controls after applying a preset, stop showing it as active.
watch(() => [
    proxiesRelationshipWeightMode.value,
    proxiesRelationshipTopN.value,
    proxiesRelationshipColorMode.value,
    filterMode.value,
    filterFocus.value ? JSON.stringify(filterFocus.value) : '',
], () => {
    if (!activePresetId.value || !activePreset.value)
        return;
    if (!isSameSceneAsPreset(activePreset.value))
        activePresetId.value = '';
});
const genId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createPreset = () => {
    const name = (newPresetName.value || '').trim();
    if (!name) {
        showNotification({ content: 'presetNeedName', type: 'alert-warning' });
        return;
    }
    const scene = captureScene();
    const p = { id: genId(), name, ...scene };
    topologyPresets.value = [p, ...(topologyPresets.value || [])];
    activePresetId.value = p.id;
    newPresetName.value = '';
    showNotification({ content: 'presetSaved', type: 'alert-success', timeout: 1800 });
};
const overwritePreset = (p) => {
    const scene = captureScene();
    topologyPresets.value = (topologyPresets.value || []).map((x) => (x.id === p.id ? { ...x, ...scene } : x));
    activePresetId.value = p.id;
    showNotification({ content: 'presetUpdated', type: 'alert-success', timeout: 1800 });
};
const startRenamePreset = (p) => {
    editingPresetId.value = p.id;
    editingPresetName.value = p.name;
};
const confirmRenamePreset = (p) => {
    const nm = (editingPresetName.value || '').trim();
    if (!nm)
        return;
    topologyPresets.value = (topologyPresets.value || []).map((x) => (x.id === p.id ? { ...x, name: nm } : x));
    editingPresetId.value = null;
    editingPresetName.value = '';
    showNotification({ content: 'presetRenamed', type: 'alert-success', timeout: 1800 });
};
const deletePreset = (p) => {
    const ok = confirm(t('confirmDeletePreset', { name: p.name }));
    if (!ok)
        return;
    topologyPresets.value = (topologyPresets.value || []).filter((x) => x.id !== p.id);
    if (activePresetId.value === p.id)
        activePresetId.value = '';
    showNotification({ content: 'presetDeleted', type: 'alert-success', timeout: 1800 });
};
const setFocus = (v) => {
    focus.value = v;
};
const closeDetails = () => {
    focus.value = null;
};
// --- Cross-page navigation (Topology -> Proxies/Rules/Users) ---
const openMainLabel = computed(() => {
    const f = focus.value;
    if (!f || f.kind !== 'value')
        return '';
    if (f.stage === 'C')
        return t('users');
    if (f.stage === 'R')
        return t('rules');
    // G/S (and provider via secondary button) open Proxies.
    return t('proxies');
});
const openProviderLabel = computed(() => {
    const f = focus.value;
    if (!f || f.kind !== 'value')
        return '';
    if (f.stage !== 'S')
        return '';
    const p = providerOf(String(f.value || '').trim());
    if (!p)
        return '';
    return `${t('proxyProvider')}: ${p}`;
});
const openFocusedMain = async () => {
    const f = focus.value;
    if (!f || f.kind !== 'value')
        return;
    const v = String(f.value || '').trim();
    if (!v)
        return;
    if (f.stage === 'C') {
        setPendingPageFocus(ROUTE_NAME.users, 'user', v);
        closeDetails();
        await router.push({ name: ROUTE_NAME.users });
        return;
    }
    if (f.stage === 'R') {
        setPendingPageFocus(ROUTE_NAME.rules, 'rule', v);
        closeDetails();
        await router.push({ name: ROUTE_NAME.rules });
        return;
    }
    if (f.stage === 'P') {
        setPendingPageFocus(ROUTE_NAME.proxies, 'provider', v);
        closeDetails();
        await router.push({ name: ROUTE_NAME.proxyProviders });
        return;
    }
    if (f.stage === 'G') {
        setPendingPageFocus(ROUTE_NAME.proxies, 'proxyGroup', v);
        closeDetails();
        await router.push({ name: ROUTE_NAME.proxies });
        return;
    }
    if (f.stage === 'S') {
        setPendingPageFocus(ROUTE_NAME.proxies, 'proxy', v);
        closeDetails();
        await router.push({ name: ROUTE_NAME.proxies });
    }
};
const openFocusedProvider = async () => {
    const f = focus.value;
    if (!f || f.kind !== 'value' || f.stage !== 'S')
        return;
    const v = String(f.value || '').trim();
    if (!v)
        return;
    const p = providerOf(v);
    if (!p)
        return;
    setPendingPageFocus(ROUTE_NAME.proxies, 'provider', p);
    closeDetails();
    await router.push({ name: ROUTE_NAME.proxyProviders });
};
const isSameFocus = (a, b) => {
    if (!a || !b)
        return false;
    if (a.stage !== b.stage || a.kind !== b.kind)
        return false;
    if (a.kind === 'other')
        return true;
    return (a.value || '') === (b.value || '');
};
const notifyFilterPinned = () => {
    showNotification({ content: 'topologyFilterPinned', type: 'alert-info', timeout: 2200 });
};
const isFilterChangeBlocked = (mode, f) => {
    if (!filterLocked.value)
        return false;
    if (filterMode.value === 'none')
        return false;
    if (mode === filterMode.value && isSameFocus(filterFocus.value, f))
        return false;
    return true;
};
const clearFilter = () => {
    filterMode.value = 'none';
    filterFocus.value = null;
    filterLocked.value = false;
};
const applyOpenForFocus = () => {
    if (isFilterChangeBlocked('none', null)) {
        notifyFilterPinned();
        return;
    }
    clearFilter();
};
const applyOnly = () => {
    if (!focus.value || focus.value.kind !== 'value')
        return;
    const target = { ...focus.value };
    if (isFilterChangeBlocked('only', target)) {
        notifyFilterPinned();
        return;
    }
    filterMode.value = 'only';
    filterFocus.value = target;
};
const applyExclude = () => {
    if (!focus.value || focus.value.kind !== 'value')
        return;
    const target = { ...focus.value };
    if (isFilterChangeBlocked('exclude', target)) {
        notifyFilterPinned();
        return;
    }
    filterMode.value = 'exclude';
    filterFocus.value = target;
};
const applyListOpen = (stage, value) => {
    const v = String(value || '').trim();
    if (!v)
        return;
    setFocus({ stage, kind: 'value', value: v });
    if (filterMode.value === 'none')
        return;
    if (isFilterChangeBlocked('none', null)) {
        notifyFilterPinned();
        return;
    }
    clearFilter();
};
const applyListFilter = (mode, stage, value) => {
    const v = String(value || '').trim();
    if (!v)
        return;
    const target = { stage, kind: 'value', value: v };
    if (isFilterChangeBlocked(mode, target)) {
        notifyFilterPinned();
        return;
    }
    filterMode.value = mode;
    filterFocus.value = target;
};
const otherLabels = computed(() => {
    const OTHER = t('other');
    return {
        C: `${OTHER}`,
        R: `${OTHER} (${t('rule')})`,
        G: `${OTHER} (${t('proxyGroup')})`,
        S: `${OTHER} (${t('proxies')})`,
    };
});
const ipFromClientLabel = (label) => {
    const s = (label || '').trim();
    const m = s.match(/\(([^()]+)\)\s*$/);
    return (m?.[1] || s).trim();
};
// ----- snapshot (обновляемся каждые 5 секунд) -----
const snapshot = ref([]);
const deltaBytesById = ref({});
const prevTotalsById = new Map();
let lastSnapshotAt = Date.now();
let timer;
const refreshSnapshot = () => {
    const now = Date.now();
    const dt = Math.max(1, (now - lastSnapshotAt) / 1000);
    lastSnapshotAt = now;
    const conns = activeConnections.value.slice();
    const deltas = {};
    for (const c of conns) {
        // Connection.id всегда присутствует в данных Mihomo
        const id = c.id;
        if (!id)
            continue;
        const total = (Number(c.download) || 0) + (Number(c.upload) || 0);
        const prev = prevTotalsById.get(id);
        let delta = prev === undefined ? 0 : Math.max(0, total - prev);
        // если дельта 0 (например, первое обновление) — оценим по скорости за интервал
        if (delta === 0) {
            const sp = (Number(c.downloadSpeed) || 0) + (Number(c.uploadSpeed) || 0);
            if (sp > 0)
                delta = sp * dt;
        }
        deltas[id] = delta;
        prevTotalsById.set(id, total);
    }
    // чистим старые id
    for (const id of Array.from(prevTotalsById.keys())) {
        if (!(id in deltas))
            prevTotalsById.delete(id);
    }
    deltaBytesById.value = deltas;
    snapshot.value = conns;
};
const stopTimer = () => {
    if (timer) {
        clearInterval(timer);
        timer = undefined;
    }
};
const startTimer = () => {
    stopTimer();
    timer = window.setInterval(refreshSnapshot, 5000);
};
const bytesOf = (c) => {
    const id = c.id || '';
    if (id && deltaBytesById.value[id] !== undefined)
        return Number(deltaBytesById.value[id]) || 0;
    return (Number(c.downloadSpeed) || 0) + (Number(c.uploadSpeed) || 0);
};
const fmtRule = (c) => {
    const rt = normalize(c.rule);
    const rp = String(c.rulePayload || '').trim();
    return rp ? `${rt}: ${normalize(rp)}` : rt;
};
const getGroupServer = (c) => {
    const arr = (c.chains || []).map(normalize).filter((x) => x && x !== '-');
    const group = arr[0] || 'DIRECT';
    const server = arr[arr.length - 1] || group;
    return { group, server };
};
const filteredSnapshot = computed(() => {
    const conns = snapshot.value || [];
    if (filterMode.value === 'none' || !filterFocus.value)
        return conns;
    const f = filterFocus.value;
    if (f.kind !== 'value' || !f.value)
        return conns;
    const match = (c) => {
        const ip = c.metadata?.sourceIP || '';
        const rule = fmtRule(c);
        const { group, server } = getGroupServer(c);
        if (f.stage === 'C')
            return ip === f.value;
        if (f.stage === 'R')
            return rule === f.value;
        if (f.stage === 'G')
            return group === f.value;
        if (f.stage === 'P') {
            const p = providerOf(server) || providerOf(group) || '';
            return p === f.value;
        }
        return server === f.value;
    };
    const keep = filterMode.value === 'only';
    return conns.filter((c) => (keep ? match(c) : !match(c)));
});
const sankeyData = computed(() => {
    const conns = filteredSnapshot.value || [];
    const topClientsN = Math.max(10, Number(proxiesRelationshipTopN.value) || 40);
    const topRulesN = Math.max(10, Math.floor(topClientsN * 1.5));
    const topGroupsN = Math.max(10, Math.floor(topClientsN * 1.2));
    const topServersN = topGroupsN;
    const metricForTop = (c) => {
        if (proxiesRelationshipWeightMode.value === 'count')
            return 1;
        return bytesOf(c);
    };
    const weight = (c) => {
        if (proxiesRelationshipWeightMode.value === 'count')
            return 1;
        const b = bytesOf(c);
        if (b <= 0)
            return 0;
        // log compression to avoid "giant bars"
        return Math.min(1 + Math.log1p(b) / 6, 18);
    };
    const colorKeyOf = (rawRule, group, server, c) => {
        const cm = proxiesRelationshipColorMode.value;
        if (cm === 'none')
            return '';
        if (cm === 'rule')
            return normalize(c.rule) || rawRule;
        if (cm === 'provider')
            return providerOf(server) || providerOf(group) || group || server;
        // default: by real final hop (proxy) / group
        return server || group || rawRule;
    };
    const totalsClients = new Map();
    const totalsRules = new Map();
    const totalsGroups = new Map();
    const totalsServers = new Map();
    for (const c of conns) {
        const ip = c.metadata?.sourceIP || '';
        if (!ip)
            continue;
        const m = metricForTop(c);
        if (m <= 0)
            continue;
        totalsClients.set(ip, (totalsClients.get(ip) || 0) + m);
        const r = fmtRule(c);
        totalsRules.set(r, (totalsRules.get(r) || 0) + m);
        const { group, server } = getGroupServer(c);
        totalsGroups.set(group, (totalsGroups.get(group) || 0) + m);
        totalsServers.set(server, (totalsServers.get(server) || 0) + m);
    }
    const topClients = new Set(Array.from(totalsClients.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topClientsN)
        .map(([k]) => k));
    const topRules = new Set(Array.from(totalsRules.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topRulesN)
        .map(([k]) => k));
    const topGroups = new Set(Array.from(totalsGroups.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topGroupsN)
        .map(([k]) => k));
    const topServers = new Set(Array.from(totalsServers.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topServersN)
        .map(([k]) => k));
    const OTHER_CLIENT = otherLabels.value.C;
    const OTHER_RULE = otherLabels.value.R;
    const OTHER_GROUP = otherLabels.value.G;
    const OTHER_SERVER = otherLabels.value.S;
    const node = (stage, label) => `${stage}:${label}`;
    const linkAgg = new Map();
    const nodeMeta = new Map();
    const addNodeMeta = (name, b, cnt) => {
        const cur = nodeMeta.get(name) || { bytes: 0, count: 0 };
        cur.bytes += b;
        cur.count += cnt;
        if (!cur.provider && stageOf(name) === 'S') {
            const p = providerOf(labelOf(name));
            if (p)
                cur.provider = p;
        }
        nodeMeta.set(name, cur);
    };
    const voteColor = (agg, key, v) => {
        if (!key)
            return;
        agg.colorVotes[key] = (agg.colorVotes[key] || 0) + v;
    };
    const add = (s, tname, c, colorKey) => {
        const b = bytesOf(c);
        const v = weight(c);
        if (v <= 0 && b <= 0)
            return;
        const key = `${s}\u0000${tname}`;
        const agg = linkAgg.get(key) || { value: 0, bytes: 0, count: 0, colorVotes: {} };
        agg.value += v;
        agg.bytes += b;
        agg.count += 1;
        // Окраска потоков — единая по всему пути, по выбранному ключу (по умолчанию: реальный финальный хоп).
        voteColor(agg, colorKey, v);
        linkAgg.set(key, agg);
        addNodeMeta(s, b, 1);
        addNodeMeta(tname, b, 1);
    };
    for (const c of conns) {
        const ip0 = c.metadata?.sourceIP || '';
        if (!ip0)
            continue;
        const lbl = labelForIp(ip0);
        const clientLabel = topClients.has(ip0) ? (lbl ? `${lbl} (${ip0})` : ip0) : OTHER_CLIENT;
        const rawRule = fmtRule(c);
        const ruleLabel = topRules.has(rawRule) ? rawRule : OTHER_RULE;
        const { group: rawGroup, server: rawServer } = getGroupServer(c);
        const groupLabel = topGroups.has(rawGroup) ? rawGroup : OTHER_GROUP;
        const serverLabel = topServers.has(rawServer) ? rawServer : OTHER_SERVER;
        const colorKey = colorKeyOf(rawRule, rawGroup, rawServer, c);
        const C = node('C', clientLabel);
        const R = node('R', ruleLabel);
        const G = node('G', groupLabel);
        const S = node('S', serverLabel);
        add(C, R, c, colorKey);
        add(R, G, c, colorKey);
        add(G, S, c, colorKey);
    }
    const nodesSet = new Set();
    const links = Array.from(linkAgg.entries()).map(([k, a]) => {
        const [source, target] = k.split('\u0000');
        nodesSet.add(source);
        nodesSet.add(target);
        let color = colorSet.baseContent30;
        if (proxiesRelationshipColorMode.value !== 'none') {
            const entries = Object.entries(a.colorVotes);
            if (entries.length) {
                entries.sort((x, y) => y[1] - x[1]);
                color = colorFromKey(entries[0][0]);
            }
        }
        return {
            source,
            target,
            value: a.value,
            bytes: a.bytes,
            count: a.count,
            lineStyle: { color, opacity: 0.55 },
        };
    });
    const stageOrder = { C: 0, R: 1, G: 2, S: 3 };
    const nodes = Array.from(nodesSet)
        .sort((a, b) => {
        const sa = stageOrder[stageOf(a)] ?? 9;
        const sb = stageOrder[stageOf(b)] ?? 9;
        if (sa !== sb)
            return sa - sb;
        return labelOf(a).localeCompare(labelOf(b));
    })
        .map((name) => {
        const st = stageOf(name);
        const isRight = st === 'S';
        return {
            name,
            label: {
                position: isRight ? 'left' : 'right',
                align: isRight ? 'right' : 'left',
                distance: isRight ? 6 : 8,
            },
        };
    });
    return {
        nodes,
        links,
        nodeMeta,
        topClients,
        topRules,
        topGroups,
        topServers,
        OTHER_CLIENT,
        OTHER_RULE,
        OTHER_GROUP,
        OTHER_SERVER,
    };
});
const matchesFocus = (c, f, model) => {
    const ip = c.metadata?.sourceIP || '';
    const rule = fmtRule(c);
    const { group, server } = getGroupServer(c);
    if (f.stage === 'C')
        return f.kind === 'other' ? !model.topClients.has(ip) : ip === (f.value || '');
    if (f.stage === 'R')
        return f.kind === 'other' ? !model.topRules.has(rule) : rule === (f.value || '');
    if (f.stage === 'G')
        return f.kind === 'other' ? !model.topGroups.has(group) : group === (f.value || '');
    return f.kind === 'other' ? !model.topServers.has(server) : server === (f.value || '');
};
const detailsConns = computed(() => {
    if (!focus.value)
        return [];
    const model = sankeyData.value;
    return (filteredSnapshot.value || []).filter((c) => matchesFocus(c, focus.value, model));
});
const detailsTotals = computed(() => {
    let b = 0;
    let cnt = 0;
    for (const c of detailsConns.value) {
        b += bytesOf(c);
        cnt += 1;
    }
    return { bytes: b, count: cnt };
});
const listMetric = (it) => {
    return proxiesRelationshipWeightMode.value === 'count' ? `${it.count}` : prettyBytesHelper(it.bytes);
};
const buildTopList = (m, makeLabel) => {
    const arr = Array.from(m.entries()).map(([key, v]) => {
        const label = makeLabel(key);
        return { key, label, title: label, bytes: v.bytes, count: v.count, metric: listMetric(v) };
    });
    const sortByCount = proxiesRelationshipWeightMode.value === 'count';
    arr.sort((a, b) => (sortByCount ? b.count - a.count : b.bytes - a.bytes));
    return arr.slice(0, 10);
};
const topUsers = computed(() => {
    const m = new Map();
    for (const c of detailsConns.value) {
        const ip = c.metadata?.sourceIP || '';
        if (!ip)
            continue;
        const cur = m.get(ip) || { bytes: 0, count: 0 };
        cur.bytes += bytesOf(c);
        cur.count += 1;
        m.set(ip, cur);
    }
    return buildTopList(m, (ip) => {
        const lbl = labelForIp(ip);
        return lbl ? `${lbl} (${ip})` : ip;
    });
});
const topRules = computed(() => {
    const m = new Map();
    for (const c of detailsConns.value) {
        const rule = fmtRule(c);
        const cur = m.get(rule) || { bytes: 0, count: 0 };
        cur.bytes += bytesOf(c);
        cur.count += 1;
        m.set(rule, cur);
    }
    return buildTopList(m, (k) => k);
});
const topProviders = computed(() => {
    const m = new Map();
    for (const c of detailsConns.value) {
        const { group, server } = getGroupServer(c);
        const p = providerOf(server) || providerOf(group) || t('none');
        const cur = m.get(p) || { bytes: 0, count: 0 };
        cur.bytes += bytesOf(c);
        cur.count += 1;
        m.set(p, cur);
    }
    return buildTopList(m, (k) => k);
});
const focusHeader = computed(() => {
    const f = focus.value;
    if (!f)
        return { stageLabel: '', title: '', subTitle: '' };
    const stageLabel = f.stage === 'C'
        ? t('proxiesRelationshipClients')
        : f.stage === 'R'
            ? t('rule')
            : f.stage === 'G'
                ? t('proxyGroup')
                : t('proxies');
    if (f.kind === 'other') {
        const m = sankeyData.value;
        const title = f.stage === 'C' ? m.OTHER_CLIENT : f.stage === 'R' ? m.OTHER_RULE : f.stage === 'G' ? m.OTHER_GROUP : m.OTHER_SERVER;
        return { stageLabel, title, subTitle: '' };
    }
    const v = (f.value || '').trim();
    if (f.stage === 'C') {
        const lbl = labelForIp(v);
        return { stageLabel, title: lbl ? `${lbl} (${v})` : v, subTitle: '' };
    }
    if (f.stage === 'S') {
        const p = providerOf(v);
        return { stageLabel, title: v, subTitle: p ? `${t('provider')}: ${p}` : '' };
    }
    return { stageLabel, title: v, subTitle: '' };
});
const tooltipFormatter = (p) => {
    if (p?.dataType === 'edge') {
        const d = p.data || {};
        const cnt = Number(d.count) || 0;
        const b = Number(d.bytes) || 0;
        return `
      <div style="max-width: 560px">
        <div style="font-weight:600">${shortLabel(d.source)} → ${shortLabel(d.target)}</div>
        <div>${t('count')}: <b>${cnt}</b></div>
        <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
      </div>
    `;
    }
    const name = p?.name || '';
    const meta = sankeyData.value.nodeMeta.get(name);
    const provider = meta?.provider ? ` (${t('provider')}: ${meta.provider})` : '';
    const cnt = meta?.count || 0;
    const b = meta?.bytes || 0;
    return `
    <div style="max-width: 560px">
      <div style="font-weight:600">${shortLabel(name)}${provider}</div>
      <div>${t('count')}: <b>${cnt}</b></div>
      <div>${t('traffic')}: <b>${prettyBytesHelper(b)}</b></div>
    </div>
  `;
};
const options = computed(() => {
    // The chart has an overlay toolbar (filters/presets/topN). Reserve vertical space so it doesn't cover
    // the column headers and the first nodes.
    const overlayTop = 16; // left-4/top-4
    const overlayH = Math.round((isFullScreen.value ? fsControlsBarHeight.value : controlsBarHeight.value) || 36);
    const columnHeaderTop = overlayTop + overlayH + 6;
    const seriesTop = columnHeaderTop + 22;
    return {
        animation: true,
        animationDuration: 250,
        animationDurationUpdate: 550,
        animationEasingUpdate: 'cubicOut',
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            formatter: tooltipFormatter,
            backgroundColor: colorSet.base70,
            borderColor: colorSet.base70,
            confine: true,
            padding: [6, 8],
            textStyle: { color: colorSet.baseContent, fontFamily, fontSize: Math.max(12, labelFontSize.value) },
        },
        graphic: (() => {
            // небольшие заголовки колонок, чтобы диаграмма читалась "клиент → правило → группа → сервер"
            const w = (isFullScreen.value ? window.innerWidth : Number(width.value)) || 0;
            if (!w)
                return [];
            const top = columnHeaderTop;
            const leftPad = 18;
            const rightPad = 22;
            const col = Math.max(1, (w - leftPad - rightPad) / 4);
            const fontSize = Math.max(12, Math.min(14, labelFontSize.value));
            const mk = (i, text) => ({
                type: 'text',
                left: Math.round(leftPad + col * i),
                top,
                style: {
                    text,
                    fill: colorSet.baseContent,
                    font: `600 ${fontSize}px ${fontFamily}`,
                    opacity: 0.65,
                },
                silent: true,
            });
            return [
                mk(0, t('proxiesRelationshipClients')),
                mk(1, t('rule')),
                mk(2, t('proxyGroup')),
                mk(3, t('proxies')),
            ];
        })(),
        series: [
            {
                id: 'sankey-client-rule-group-server',
                type: 'sankey',
                left: 18,
                right: 22,
                top: seriesTop,
                bottom: 8,
                data: sankeyData.value.nodes,
                links: sankeyData.value.links,
                nodeAlign: 'justify',
                nodeWidth: isFullScreen.value ? 10 : 8,
                nodeGap: isFullScreen.value ? 11 : 9,
                emphasis: { focus: 'adjacency' },
                lineStyle: { curveness: 0.5, opacity: 0.55 },
                label: {
                    color: colorSet.baseContent,
                    fontFamily,
                    fontSize: labelFontSize.value,
                    position: 'right',
                    align: 'left',
                    distance: 6,
                    ellipsis: '…',
                    overflow: 'truncate',
                    width: labelWidth.value,
                    rich: {
                        n: { fontWeight: 600, fontSize: labelFontSize.value, lineHeight: Math.round(labelFontSize.value * 1.2) },
                        v: { fontSize: Math.max(11, labelFontSize.value - 3), opacity: 0.65, lineHeight: Math.round((labelFontSize.value - 2) * 1.15) },
                    },
                    formatter: (pp) => {
                        const name = pp?.name || '';
                        const st = stageOf(name);
                        const base = shortLabel(name);
                        if (st === 'R') {
                            const meta = sankeyData.value.nodeMeta.get(name);
                            const b = meta?.bytes || 0;
                            if (b > 0)
                                return `{n|${base}}
{v|${prettyBytesHelper(b)}}`;
                        }
                        return base;
                    },
                },
            },
        ],
    };
});
let mainChart = null;
let fsChart = null;
const handleNodeClick = (params) => {
    if (!params || params.dataType !== 'node')
        return;
    const name = String(params.name || '');
    const st = stageOf(name);
    const lbl = labelOf(name);
    const isOther = (st === 'C' && lbl === otherLabels.value.C) ||
        (st === 'R' && lbl === otherLabels.value.R) ||
        (st === 'G' && lbl === otherLabels.value.G) ||
        (st === 'S' && lbl === otherLabels.value.S);
    if (isOther) {
        setFocus({ stage: st, kind: 'other' });
        return;
    }
    if (st === 'C') {
        setFocus({ stage: 'C', kind: 'value', value: ipFromClientLabel(lbl) });
        return;
    }
    setFocus({ stage: st, kind: 'value', value: lbl });
};
const render = (force = false) => {
    if (!mainChart)
        return;
    mainChart.setOption(options.value, { notMerge: force, lazyUpdate: true });
    if (isFullScreen.value && fsChart)
        fsChart.setOption(options.value, { notMerge: force, lazyUpdate: true });
};
const exportPng = () => {
    const ch = isFullScreen.value ? fsChart : mainChart;
    if (!ch)
        return;
    try {
        const url = ch.getDataURL({ type: 'png', pixelRatio: 2 });
        const a = document.createElement('a');
        a.href = url;
        a.download = `topology-${dayjs().format('YYYYMMDD-HHmmss')}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showNotification({ content: 'exportPngDone', type: 'alert-success', timeout: 1800 });
    }
    catch (e) {
        showNotification({
            content: 'exportPngFailed',
            type: 'alert-error',
            timeout: 6000,
            params: { error: String(e?.message || e) },
        });
    }
};
const applyPendingNavFilter = () => {
    const pf = readPendingNavFilter();
    if (!pf)
        return;
    // clear first to avoid re-applying on navigation back/forward
    pendingNavFilter.value = null;
    try {
        localStorage.removeItem(TOPOLOGY_NAV_FILTER_KEY);
    }
    catch { }
    const ts = Number(pf.ts) || 0;
    if (!ts || Date.now() - ts > 10 * 60 * 1000)
        return;
    const requestedMode = (pf.mode || 'none');
    const requestedFocus = pf.focus;
    const fallbackProxyName = String(pf.fallbackProxyName || '').trim();
    const providerMapReady = Boolean(providerMap.value?.size && proxyProviederList.value?.length);
    // Provider filter needs provider map; if it's not ready yet, fall back to a concrete proxy name.
    const effectiveFocus = requestedFocus?.stage === 'P' && !providerMapReady && fallbackProxyName
        ? { stage: 'S', kind: 'value', value: fallbackProxyName }
        : requestedFocus;
    // Always apply focus/highlight (even when filter lock is enabled).
    if (effectiveFocus?.kind === 'value' && String(effectiveFocus.value || '').trim()) {
        setFocus({ ...effectiveFocus });
    }
    if (filterLocked.value) {
        if (requestedMode !== 'none') {
            showNotification({ content: 'topologyNavFilterLocked', type: 'alert-info', timeout: 2400 });
        }
        return;
    }
    // mode:none means "open Topology" only (no filter change).
    if (requestedMode === 'none')
        return;
    filterMode.value = requestedMode;
    filterFocus.value = effectiveFocus ? { ...effectiveFocus } : null;
    showNotification({ content: 'topologyNavFilterApplied', type: 'alert-success', timeout: 1800 });
};
watch(pendingNavFilter, (v) => {
    if (v)
        applyPendingNavFilter();
}, { deep: true });
onMounted(() => {
    cleanupExpiredPendingPageFocus();
    updateColorSet();
    updateFontFamily();
    refreshSnapshot();
    startTimer();
    applyPendingNavFilter();
    watch(theme, updateColorSet);
    watch(font, updateFontFamily);
    mainChart = echarts.init(chart.value);
    mainChart.setOption(options.value);
    mainChart.on('click', handleNodeClick);
    watch(options, () => render(false));
    watch(isFullScreen, async (v) => {
        if (v) {
            await nextTick();
            if (!fsChart) {
                fsChart = echarts.init(fullScreenChart.value);
                fsChart.on('click', handleNodeClick);
            }
            fsChart.resize();
            render(true);
        }
        else {
            fsChart?.dispose();
            fsChart = null;
        }
    });
    const resize = debounce(() => {
        mainChart?.resize();
        fsChart?.resize();
    }, 100);
    watch([width, height], resize);
});
onBeforeUnmount(() => {
    stopResize();
    stopTimer();
    mainChart?.dispose();
    fsChart?.dispose();
    mainChart = null;
    fsChart = null;
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onMousemove: () => { } },
    ...{ onTouchmove: () => { } },
    ...{ class: (__VLS_ctx.twMerge('relative w-full overflow-hidden rounded-2xl')) },
    ...{ style: (__VLS_ctx.isFullScreen ? '' : `height: ${__VLS_ctx.topologyHeight}px;`) },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "chart",
    ...{ class: "h-full w-full" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "border-base-content/30 text-base-content/10 bg-base-100/70 hidden" },
    ref: "colorRef",
});
/** @type {__VLS_StyleScopedClasses['border-base-content/30']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/70']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "controlsBar",
    ...{ class: "absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['left-4']} */ ;
/** @type {__VLS_StyleScopedClasses['top-4']} */ ;
/** @type {__VLS_StyleScopedClasses['z-20']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
if (__VLS_ctx.filterMode !== 'none') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearFilter) },
        ...{ class: "badge badge-outline cursor-pointer hover:opacity-80 max-w-[min(820px,calc(100vw-12rem))] truncate" },
        title: (__VLS_ctx.activeFilterChip?.title || __VLS_ctx.$t('clear')),
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[min(820px,calc(100vw-12rem))]']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (__VLS_ctx.activeFilterChip?.text || (__VLS_ctx.filterMode === 'only' ? __VLS_ctx.$t('topologyFilterOnly') : __VLS_ctx.$t('topologyFilterExclude')));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.toggleFilterLock) },
        ...{ class: "btn btn-ghost btn-xs btn-square" },
        title: (__VLS_ctx.filterLocked ? __VLS_ctx.$t('topologyUnpinFilter') : __VLS_ctx.$t('topologyPinFilter')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-square']} */ ;
    const __VLS_0 = (__VLS_ctx.filterLocked ? __VLS_ctx.LockClosedIcon : __VLS_ctx.LockOpenIcon);
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.presetDialogShow = true;
            // @ts-ignore
            [twMerge, isFullScreen, topologyHeight, filterMode, filterMode, clearFilter, activeFilterChip, activeFilterChip, $t, $t, $t, $t, $t, toggleFilterLock, filterLocked, filterLocked, LockClosedIcon, LockOpenIcon, presetDialogShow,];
        } },
    ...{ class: "btn btn-ghost btn-xs" },
    title: (__VLS_ctx.$t('presets')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
let __VLS_5;
/** @ts-ignore @type {typeof __VLS_components.BookmarkIcon} */
BookmarkIcon;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ class: "h-4 w-4" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "max-sm:hidden" },
});
/** @type {__VLS_StyleScopedClasses['max-sm:hidden']} */ ;
(__VLS_ctx.$t('presets'));
if (__VLS_ctx.activePreset) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-outline badge-sm ml-1 max-w-[160px] truncate" },
        title: (__VLS_ctx.activePreset.name),
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[160px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (__VLS_ctx.activePreset.name);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: () => { } },
    ...{ class: "join" },
});
/** @type {__VLS_StyleScopedClasses['join']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.proxiesRelationshipWeightMode = 'traffic';
            // @ts-ignore
            [$t, $t, activePreset, activePreset, activePreset, proxiesRelationshipWeightMode,];
        } },
    ...{ class: "btn btn-xs join-item" },
    ...{ class: (__VLS_ctx.proxiesRelationshipWeightMode === 'traffic' ? 'btn-active' : '') },
    title: (__VLS_ctx.$t('traffic')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
(__VLS_ctx.$t('traffic'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.proxiesRelationshipWeightMode = 'count';
            // @ts-ignore
            [$t, $t, proxiesRelationshipWeightMode, proxiesRelationshipWeightMode,];
        } },
    ...{ class: "btn btn-xs join-item" },
    ...{ class: (__VLS_ctx.proxiesRelationshipWeightMode === 'count' ? 'btn-active' : '') },
    title: (__VLS_ctx.$t('count')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
(__VLS_ctx.$t('count'));
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onClick: () => { } },
    ...{ onMousedown: () => { } },
    ...{ class: "select select-xs join-item" },
    value: (__VLS_ctx.proxiesRelationshipTopN),
    title: "Top N",
});
/** @type {__VLS_StyleScopedClasses['select']} */ ;
/** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['join-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (10),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (20),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (30),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (40),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (60),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (70),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: (100),
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportPng) },
    ...{ class: "btn btn-ghost btn-xs" },
    title: (__VLS_ctx.$t('exportPng')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
let __VLS_10;
/** @ts-ignore @type {typeof __VLS_components.ArrowDownTrayIcon} */
ArrowDownTrayIcon;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "h-4 w-4" },
}));
const __VLS_12 = __VLS_11({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "max-sm:hidden" },
});
/** @type {__VLS_StyleScopedClasses['max-sm:hidden']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.isFullScreen = !__VLS_ctx.isFullScreen;
            // @ts-ignore
            [isFullScreen, isFullScreen, $t, $t, $t, proxiesRelationshipWeightMode, proxiesRelationshipTopN, exportPng,];
        } },
    ...{ class: (__VLS_ctx.twMerge('btn btn-ghost btn-circle btn-sm absolute right-1 bottom-1', __VLS_ctx.isFullScreen ? 'fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]' : '')) },
});
const __VLS_15 = (__VLS_ctx.isFullScreen ? __VLS_ctx.ArrowsPointingInIcon : __VLS_ctx.ArrowsPointingOutIcon);
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    ...{ class: "h-4 w-4" },
}));
const __VLS_17 = __VLS_16({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
if (!__VLS_ctx.isFullScreen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onPointerdown: (__VLS_ctx.startResize) },
        ...{ onMousedown: () => { } },
        ...{ onTouchstart: () => { } },
        ...{ class: "absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize opacity-40 hover:opacity-80" },
        title: (__VLS_ctx.$t('resize')),
    });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['left-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-ns-resize']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-40']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "mx-auto mt-1 h-1 w-16 rounded-full bg-base-content/30" },
    });
    /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-16']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-content/30']} */ ;
}
let __VLS_20;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    to: "body",
}));
const __VLS_22 = __VLS_21({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
const { default: __VLS_25 } = __VLS_23.slots;
if (__VLS_ctx.isFullScreen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bg-base-100 custom-background fixed inset-0 z-[9999] h-screen w-screen bg-cover bg-center" },
        ...{ class: (`blur-intensity-${__VLS_ctx.blurIntensity} custom-background-${__VLS_ctx.dashboardTransparent}`) },
        ...{ style: (__VLS_ctx.backgroundImage) },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['custom-background']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[9999]']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-screen']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-cover']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ref: "fullScreenChart",
        ...{ class: "bg-base-100 h-full w-full" },
        ...{ style: (__VLS_ctx.fullChartStyle) },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ref: "fsControlsBar",
        ...{ class: "fixed left-4 top-4 z-[10020] flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['left-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[10020]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    if (__VLS_ctx.filterMode !== 'none') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.clearFilter) },
            ...{ class: "badge badge-outline cursor-pointer hover:opacity-80 max-w-[min(920px,calc(100vw-12rem))] truncate" },
            title: (__VLS_ctx.activeFilterChip?.title || __VLS_ctx.$t('clear')),
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:opacity-80']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[min(920px,calc(100vw-12rem))]']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (__VLS_ctx.activeFilterChip?.text || (__VLS_ctx.filterMode === 'only' ? __VLS_ctx.$t('topologyFilterOnly') : __VLS_ctx.$t('topologyFilterExclude')));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.toggleFilterLock) },
            ...{ class: "btn btn-ghost btn-xs btn-square" },
            title: (__VLS_ctx.filterLocked ? __VLS_ctx.$t('topologyUnpinFilter') : __VLS_ctx.$t('topologyPinFilter')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-square']} */ ;
        const __VLS_26 = (__VLS_ctx.filterLocked ? __VLS_ctx.LockClosedIcon : __VLS_ctx.LockOpenIcon);
        // @ts-ignore
        const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_28 = __VLS_27({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_27));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isFullScreen))
                    return;
                __VLS_ctx.presetDialogShow = true;
                // @ts-ignore
                [twMerge, isFullScreen, isFullScreen, isFullScreen, isFullScreen, filterMode, filterMode, clearFilter, activeFilterChip, activeFilterChip, $t, $t, $t, $t, $t, $t, toggleFilterLock, filterLocked, filterLocked, LockClosedIcon, LockOpenIcon, presetDialogShow, ArrowsPointingInIcon, ArrowsPointingOutIcon, startResize, blurIntensity, dashboardTransparent, backgroundImage, fullChartStyle,];
            } },
        ...{ class: "btn btn-ghost btn-xs" },
        title: (__VLS_ctx.$t('presets')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    let __VLS_31;
    /** @ts-ignore @type {typeof __VLS_components.BookmarkIcon} */
    BookmarkIcon;
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
        ...{ class: "max-sm:hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['max-sm:hidden']} */ ;
    (__VLS_ctx.$t('presets'));
    if (__VLS_ctx.activePreset) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-outline badge-sm ml-1 max-w-[160px] truncate" },
            title: (__VLS_ctx.activePreset.name),
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[160px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (__VLS_ctx.activePreset.name);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "join" },
    });
    /** @type {__VLS_StyleScopedClasses['join']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isFullScreen))
                    return;
                __VLS_ctx.proxiesRelationshipWeightMode = 'traffic';
                // @ts-ignore
                [$t, $t, activePreset, activePreset, activePreset, proxiesRelationshipWeightMode,];
            } },
        ...{ class: "btn btn-xs join-item" },
        ...{ class: (__VLS_ctx.proxiesRelationshipWeightMode === 'traffic' ? 'btn-active' : '') },
        title: (__VLS_ctx.$t('traffic')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    (__VLS_ctx.$t('traffic'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isFullScreen))
                    return;
                __VLS_ctx.proxiesRelationshipWeightMode = 'count';
                // @ts-ignore
                [$t, $t, proxiesRelationshipWeightMode, proxiesRelationshipWeightMode,];
            } },
        ...{ class: "btn btn-xs join-item" },
        ...{ class: (__VLS_ctx.proxiesRelationshipWeightMode === 'count' ? 'btn-active' : '') },
        title: (__VLS_ctx.$t('count')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    (__VLS_ctx.$t('count'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onClick: () => { } },
        ...{ onMousedown: () => { } },
        ...{ class: "select select-xs join-item" },
        value: (__VLS_ctx.proxiesRelationshipTopN),
        title: "Top N",
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (10),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (20),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (30),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (40),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (60),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (70),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: (100),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.exportPng) },
        ...{ class: "btn btn-ghost btn-circle btn-sm fixed left-4 bottom-4 z-[10020] mb-[env(safe-area-inset-bottom)]" },
        title: (__VLS_ctx.$t('exportPng')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['left-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[10020]']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-[env(safe-area-inset-bottom)]']} */ ;
    let __VLS_36;
    /** @ts-ignore @type {typeof __VLS_components.ArrowDownTrayIcon} */
    ArrowDownTrayIcon;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_38 = __VLS_37({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.isFullScreen))
                    return;
                __VLS_ctx.isFullScreen = false;
                // @ts-ignore
                [isFullScreen, $t, $t, $t, proxiesRelationshipWeightMode, proxiesRelationshipTopN, exportPng,];
            } },
        ...{ class: "btn btn-ghost btn-circle btn-sm fixed right-4 bottom-4 z-[10020] mb-[env(safe-area-inset-bottom)]" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['bottom-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[10020]']} */ ;
    /** @type {__VLS_StyleScopedClasses['mb-[env(safe-area-inset-bottom)]']} */ ;
    let __VLS_41;
    /** @ts-ignore @type {typeof __VLS_components.ArrowsPointingInIcon} */
    ArrowsPointingInIcon;
    // @ts-ignore
    const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_43 = __VLS_42({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_42));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
}
// @ts-ignore
[];
var __VLS_23;
let __VLS_46;
/** @ts-ignore @type {typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
    to: "body",
}));
const __VLS_48 = __VLS_47({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
const { default: __VLS_51 } = __VLS_49.slots;
if (__VLS_ctx.focus) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onKeydown: (__VLS_ctx.closeDetails) },
        ...{ class: "fixed inset-0 z-[10010]" },
        tabindex: "-1",
    });
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[10010]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.closeDetails) },
        ...{ class: "absolute inset-0 bg-black/30" },
    });
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "bg-base-100 absolute right-2 top-2 bottom-2 w-[420px] max-w-[calc(100vw-1rem)] rounded-2xl shadow-xl overflow-hidden" },
    });
    /** @type {__VLS_StyleScopedClasses['bg-base-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
    /** @type {__VLS_StyleScopedClasses['right-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['top-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['bottom-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-[420px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[calc(100vw-1rem)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start justify-between gap-2 border-b border-base-content/10 p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    (__VLS_ctx.focusHeader.stageLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold leading-tight truncate" },
        title: (__VLS_ctx.focusHeader.title),
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-tight']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    (__VLS_ctx.focusHeader.title);
    if (__VLS_ctx.focusHeader.subTitle) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-xs opacity-70 truncate" },
            title: (__VLS_ctx.focusHeader.subTitle),
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (__VLS_ctx.focusHeader.subTitle);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeDetails) },
        ...{ class: "btn btn-ghost btn-circle btn-sm" },
        title: (__VLS_ctx.$t('close')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-circle']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    let __VLS_52;
    /** @ts-ignore @type {typeof __VLS_components.XMarkIcon} */
    XMarkIcon;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
        ...{ class: "h-5 w-5" },
    }));
    const __VLS_54 = __VLS_53({
        ...{ class: "h-5 w-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "p-3 flex flex-col gap-3 overflow-y-auto h-full" },
    });
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "join" },
    });
    /** @type {__VLS_StyleScopedClasses['join']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyOpenForFocus) },
        ...{ class: "btn btn-xs join-item" },
        ...{ class: (__VLS_ctx.filterMode === 'none' ? 'btn-active' : 'btn-outline') },
        disabled: (__VLS_ctx.focus.kind !== 'value'),
        title: (__VLS_ctx.$t('topologyShowAll')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    let __VLS_57;
    /** @ts-ignore @type {typeof __VLS_components.PresentationChartLineIcon} */
    PresentationChartLineIcon;
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_59 = __VLS_58({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_58));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyOnly) },
        ...{ class: "btn btn-xs join-item" },
        ...{ class: (__VLS_ctx.filterMode === 'only' && __VLS_ctx.isSameFocus(__VLS_ctx.filterFocus, __VLS_ctx.focus) ? 'btn-active' : 'btn-outline') },
        disabled: (__VLS_ctx.focus.kind !== 'value'),
        title: (__VLS_ctx.$t('topologyOnlyThis')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    let __VLS_62;
    /** @ts-ignore @type {typeof __VLS_components.FunnelIcon} */
    FunnelIcon;
    // @ts-ignore
    const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_64 = __VLS_63({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_63));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyExclude) },
        ...{ class: "btn btn-xs join-item" },
        ...{ class: (__VLS_ctx.filterMode === 'exclude' && __VLS_ctx.isSameFocus(__VLS_ctx.filterFocus, __VLS_ctx.focus) ? 'btn-active' : 'btn-outline') },
        disabled: (__VLS_ctx.focus.kind !== 'value'),
        title: (__VLS_ctx.$t('topologyExcludeThis')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
    let __VLS_67;
    /** @ts-ignore @type {typeof __VLS_components.NoSymbolIcon} */
    NoSymbolIcon;
    // @ts-ignore
    const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_69 = __VLS_68({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_68));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.toggleFilterLock) },
        ...{ class: "btn btn-xs" },
        ...{ class: (__VLS_ctx.filterLocked ? 'btn-active' : 'btn-outline') },
        disabled: (__VLS_ctx.filterMode === 'none'),
        title: (__VLS_ctx.filterLocked ? __VLS_ctx.$t('topologyUnpinFilter') : __VLS_ctx.$t('topologyPinFilter')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    const __VLS_72 = (__VLS_ctx.filterLocked ? __VLS_ctx.LockClosedIcon : __VLS_ctx.LockOpenIcon);
    // @ts-ignore
    const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_74 = __VLS_73({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_73));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    if (__VLS_ctx.focus && __VLS_ctx.focus.kind === 'value') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        if (__VLS_ctx.openMainLabel) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.openFocusedMain) },
                ...{ class: "btn btn-xs btn-outline" },
                title: (__VLS_ctx.$t('open')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
            let __VLS_77;
            /** @ts-ignore @type {typeof __VLS_components.ArrowTopRightOnSquareIcon} */
            ArrowTopRightOnSquareIcon;
            // @ts-ignore
            const __VLS_78 = __VLS_asFunctionalComponent1(__VLS_77, new __VLS_77({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_79 = __VLS_78({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_78));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            (__VLS_ctx.openMainLabel);
        }
        if (__VLS_ctx.openProviderLabel) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.openFocusedProvider) },
                ...{ class: "btn btn-xs btn-outline" },
                title: (__VLS_ctx.$t('open')),
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-outline']} */ ;
            let __VLS_82;
            /** @ts-ignore @type {typeof __VLS_components.ArrowTopRightOnSquareIcon} */
            ArrowTopRightOnSquareIcon;
            // @ts-ignore
            const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_84 = __VLS_83({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_83));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            (__VLS_ctx.openProviderLabel);
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stats stats-vertical lg:stats-horizontal shadow-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['stats']} */ ;
    /** @type {__VLS_StyleScopedClasses['stats-vertical']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:stats-horizontal']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['stat']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-title" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-title']} */ ;
    (__VLS_ctx.$t('traffic'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-value text-lg" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    (__VLS_ctx.prettyBytesHelper(__VLS_ctx.detailsTotals.bytes));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['stat']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-title" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-title']} */ ;
    (__VLS_ctx.$t('count'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "stat-value text-lg" },
    });
    /** @type {__VLS_StyleScopedClasses['stat-value']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    (__VLS_ctx.detailsTotals.count);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid grid-cols-1 gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid-cols-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card bg-base-200/40" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-body p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['card-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('topologyTopUsers'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "divider my-1" },
    });
    /** @type {__VLS_StyleScopedClasses['divider']} */ ;
    /** @type {__VLS_StyleScopedClasses['my-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    for (const [it] of __VLS_vFor((__VLS_ctx.topUsers))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (it.key),
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListOpen('C', it.key);
                    // @ts-ignore
                    [filterMode, filterMode, filterMode, filterMode, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, toggleFilterLock, filterLocked, filterLocked, filterLocked, LockClosedIcon, LockOpenIcon, focus, focus, focus, focus, focus, focus, focus, focus, closeDetails, closeDetails, closeDetails, focusHeader, focusHeader, focusHeader, focusHeader, focusHeader, focusHeader, applyOpenForFocus, applyOnly, isSameFocus, isSameFocus, filterFocus, filterFocus, applyExclude, openMainLabel, openMainLabel, openFocusedMain, openProviderLabel, openProviderLabel, openFocusedProvider, prettyBytesHelper, detailsTotals, detailsTotals, topUsers, applyListOpen,];
                } },
            ...{ class: "btn btn-ghost btn-sm flex-1 justify-between" },
            title: (it.title),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "truncate text-left" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        (it.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 shrink-0 text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (it.metric);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "join shrink-0" },
        });
        /** @type {__VLS_StyleScopedClasses['join']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListOpen('C', it.key);
                    // @ts-ignore
                    [applyListOpen,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyShowAll')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_87;
        /** @ts-ignore @type {typeof __VLS_components.PresentationChartLineIcon} */
        PresentationChartLineIcon;
        // @ts-ignore
        const __VLS_88 = __VLS_asFunctionalComponent1(__VLS_87, new __VLS_87({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_89 = __VLS_88({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_88));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListFilter('only', 'C', it.key);
                    // @ts-ignore
                    [$t, applyListFilter,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyOnlyThis')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_92;
        /** @ts-ignore @type {typeof __VLS_components.FunnelIcon} */
        FunnelIcon;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent1(__VLS_92, new __VLS_92({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_94 = __VLS_93({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListFilter('exclude', 'C', it.key);
                    // @ts-ignore
                    [$t, applyListFilter,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyExcludeThis')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_97;
        /** @ts-ignore @type {typeof __VLS_components.NoSymbolIcon} */
        NoSymbolIcon;
        // @ts-ignore
        const __VLS_98 = __VLS_asFunctionalComponent1(__VLS_97, new __VLS_97({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_99 = __VLS_98({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_98));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        // @ts-ignore
        [$t,];
    }
    if (!__VLS_ctx.topUsers.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card bg-base-200/40" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-body p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['card-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('topologyTopRules'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "divider my-1" },
    });
    /** @type {__VLS_StyleScopedClasses['divider']} */ ;
    /** @type {__VLS_StyleScopedClasses['my-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    for (const [it] of __VLS_vFor((__VLS_ctx.topRules))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (it.key),
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListOpen('R', it.key);
                    // @ts-ignore
                    [$t, topUsers, applyListOpen, topRules,];
                } },
            ...{ class: "btn btn-ghost btn-sm flex-1 justify-between" },
            title: (it.title),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "truncate text-left" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        (it.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 shrink-0 text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (it.metric);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "join shrink-0" },
        });
        /** @type {__VLS_StyleScopedClasses['join']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListOpen('R', it.key);
                    // @ts-ignore
                    [applyListOpen,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyShowAll')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_102;
        /** @ts-ignore @type {typeof __VLS_components.PresentationChartLineIcon} */
        PresentationChartLineIcon;
        // @ts-ignore
        const __VLS_103 = __VLS_asFunctionalComponent1(__VLS_102, new __VLS_102({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_104 = __VLS_103({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_103));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListFilter('only', 'R', it.key);
                    // @ts-ignore
                    [$t, applyListFilter,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyOnlyThis')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_107;
        /** @ts-ignore @type {typeof __VLS_components.FunnelIcon} */
        FunnelIcon;
        // @ts-ignore
        const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_109 = __VLS_108({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_108));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListFilter('exclude', 'R', it.key);
                    // @ts-ignore
                    [$t, applyListFilter,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyExcludeThis')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_112;
        /** @ts-ignore @type {typeof __VLS_components.NoSymbolIcon} */
        NoSymbolIcon;
        // @ts-ignore
        const __VLS_113 = __VLS_asFunctionalComponent1(__VLS_112, new __VLS_112({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_114 = __VLS_113({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        // @ts-ignore
        [$t,];
    }
    if (!__VLS_ctx.topRules.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card bg-base-200/40" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-body p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['card-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.$t('topologyTopProviders'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "divider my-1" },
    });
    /** @type {__VLS_StyleScopedClasses['divider']} */ ;
    /** @type {__VLS_StyleScopedClasses['my-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-1" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-1']} */ ;
    for (const [it] of __VLS_vFor((__VLS_ctx.topProviders))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (it.key),
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListOpen('P', it.key);
                    // @ts-ignore
                    [$t, applyListOpen, topRules, topProviders,];
                } },
            ...{ class: "btn btn-ghost btn-sm flex-1 justify-between" },
            title: (it.title),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "truncate text-left" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
        (it.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-2 shrink-0 text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (it.metric);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "join shrink-0" },
        });
        /** @type {__VLS_StyleScopedClasses['join']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListOpen('P', it.key);
                    // @ts-ignore
                    [applyListOpen,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyShowAll')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_117;
        /** @ts-ignore @type {typeof __VLS_components.PresentationChartLineIcon} */
        PresentationChartLineIcon;
        // @ts-ignore
        const __VLS_118 = __VLS_asFunctionalComponent1(__VLS_117, new __VLS_117({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_119 = __VLS_118({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_118));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListFilter('only', 'P', it.key);
                    // @ts-ignore
                    [$t, applyListFilter,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyOnlyThis')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_122;
        /** @ts-ignore @type {typeof __VLS_components.FunnelIcon} */
        FunnelIcon;
        // @ts-ignore
        const __VLS_123 = __VLS_asFunctionalComponent1(__VLS_122, new __VLS_122({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_124 = __VLS_123({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_123));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.focus))
                        return;
                    __VLS_ctx.applyListFilter('exclude', 'P', it.key);
                    // @ts-ignore
                    [$t, applyListFilter,];
                } },
            ...{ class: "btn btn-ghost btn-xs join-item" },
            title: (__VLS_ctx.$t('topologyExcludeThis')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['join-item']} */ ;
        let __VLS_127;
        /** @ts-ignore @type {typeof __VLS_components.NoSymbolIcon} */
        NoSymbolIcon;
        // @ts-ignore
        const __VLS_128 = __VLS_asFunctionalComponent1(__VLS_127, new __VLS_127({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_129 = __VLS_128({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_128));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        // @ts-ignore
        [$t,];
    }
    if (!__VLS_ctx.topProviders.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "opacity-0 h-10" },
    });
    /** @type {__VLS_StyleScopedClasses['opacity-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-10']} */ ;
}
// @ts-ignore
[topProviders,];
var __VLS_49;
const __VLS_132 = DialogWrapper || DialogWrapper;
// @ts-ignore
const __VLS_133 = __VLS_asFunctionalComponent1(__VLS_132, new __VLS_132({
    modelValue: (__VLS_ctx.presetDialogShow),
}));
const __VLS_134 = __VLS_133({
    modelValue: (__VLS_ctx.presetDialogShow),
}, ...__VLS_functionalComponentArgsRest(__VLS_133));
const { default: __VLS_137 } = __VLS_135.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-lg font-semibold" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
(__VLS_ctx.$t('presets'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-70 truncate max-w-[60%]" },
    title: (__VLS_ctx.currentSceneSummary),
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-[60%]']} */ ;
(__VLS_ctx.currentSceneSummary);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
const __VLS_138 = TextInput;
// @ts-ignore
const __VLS_139 = __VLS_asFunctionalComponent1(__VLS_138, new __VLS_138({
    modelValue: (__VLS_ctx.newPresetName),
    ...{ class: "flex-1" },
    placeholder: (__VLS_ctx.$t('presetNamePlaceholder')),
}));
const __VLS_140 = __VLS_139({
    modelValue: (__VLS_ctx.newPresetName),
    ...{ class: "flex-1" },
    placeholder: (__VLS_ctx.$t('presetNamePlaceholder')),
}, ...__VLS_functionalComponentArgsRest(__VLS_139));
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.createPreset) },
    ...{ class: "btn btn-sm" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
let __VLS_143;
/** @ts-ignore @type {typeof __VLS_components.PlusIcon} */
PlusIcon;
// @ts-ignore
const __VLS_144 = __VLS_asFunctionalComponent1(__VLS_143, new __VLS_143({
    ...{ class: "h-4 w-4" },
}));
const __VLS_145 = __VLS_144({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_144));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
(__VLS_ctx.$t('save'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-2 text-xs opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.$t('presetTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "divider my-4" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-2" },
});
/** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
for (const [p] of __VLS_vFor((__VLS_ctx.topologyPresets))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        key: (p.id),
        ...{ class: "card bg-base-200/40" },
    });
    /** @type {__VLS_StyleScopedClasses['card']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/40']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "card-body p-3" },
    });
    /** @type {__VLS_StyleScopedClasses['card-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0 flex-1" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    if (__VLS_ctx.editingPresetId === p.id) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        const __VLS_148 = TextInput;
        // @ts-ignore
        const __VLS_149 = __VLS_asFunctionalComponent1(__VLS_148, new __VLS_148({
            modelValue: (__VLS_ctx.editingPresetName),
            ...{ class: "flex-1" },
        }));
        const __VLS_150 = __VLS_149({
            modelValue: (__VLS_ctx.editingPresetName),
            ...{ class: "flex-1" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_149));
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.editingPresetId === p.id))
                        return;
                    __VLS_ctx.confirmRenamePreset(p);
                    // @ts-ignore
                    [$t, $t, $t, $t, presetDialogShow, currentSceneSummary, currentSceneSummary, newPresetName, createPreset, topologyPresets, editingPresetId, editingPresetName, confirmRenamePreset,];
                } },
            ...{ class: "btn btn-xs" },
            title: (__VLS_ctx.$t('save')),
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
        let __VLS_153;
        /** @ts-ignore @type {typeof __VLS_components.CheckIcon} */
        CheckIcon;
        // @ts-ignore
        const __VLS_154 = __VLS_asFunctionalComponent1(__VLS_153, new __VLS_153({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_155 = __VLS_154({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_154));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "font-semibold truncate" },
            title: (p.name),
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        (p.name);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-70 mt-1" },
        title: (__VLS_ctx.presetSummary(p)),
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    (__VLS_ctx.presetSummary(p));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col items-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.applyPreset(p);
                // @ts-ignore
                [$t, presetSummary, presetSummary, applyPreset,];
            } },
        ...{ class: "btn btn-xs w-24" },
        ...{ class: (__VLS_ctx.activePresetId === p.id ? 'btn-active' : 'btn-outline') },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-24']} */ ;
    (__VLS_ctx.$t('apply'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.overwritePreset(p);
                // @ts-ignore
                [$t, activePresetId, overwritePreset,];
            } },
        ...{ class: "btn btn-xs btn-ghost w-24" },
        title: (__VLS_ctx.$t('overwritePreset')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-24']} */ ;
    (__VLS_ctx.$t('update'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center justify-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.startRenamePreset(p);
                // @ts-ignore
                [$t, $t, startRenamePreset,];
            } },
        ...{ class: "btn btn-xs btn-ghost btn-square" },
        title: (__VLS_ctx.$t('rename')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-square']} */ ;
    let __VLS_158;
    /** @ts-ignore @type {typeof __VLS_components.PencilIcon} */
    PencilIcon;
    // @ts-ignore
    const __VLS_159 = __VLS_asFunctionalComponent1(__VLS_158, new __VLS_158({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_160 = __VLS_159({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_159));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.deletePreset(p);
                // @ts-ignore
                [$t, deletePreset,];
            } },
        ...{ class: "btn btn-xs btn-ghost btn-square" },
        title: (__VLS_ctx.$t('delete')),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-square']} */ ;
    let __VLS_163;
    /** @ts-ignore @type {typeof __VLS_components.TrashIcon} */
    TrashIcon;
    // @ts-ignore
    const __VLS_164 = __VLS_asFunctionalComponent1(__VLS_163, new __VLS_163({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_165 = __VLS_164({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_164));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    // @ts-ignore
    [$t,];
}
if (!__VLS_ctx.topologyPresets.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "divider my-4" },
});
/** @type {__VLS_StyleScopedClasses['divider']} */ ;
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetPresets) },
    ...{ class: "btn btn-sm btn-ghost" },
    title: (__VLS_ctx.$t('resetPresets')),
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
let __VLS_168;
/** @ts-ignore @type {typeof __VLS_components.ArrowUturnLeftIcon} */
ArrowUturnLeftIcon;
// @ts-ignore
const __VLS_169 = __VLS_asFunctionalComponent1(__VLS_168, new __VLS_168({
    ...{ class: "h-4 w-4" },
}));
const __VLS_170 = __VLS_169({
    ...{ class: "h-4 w-4" },
}, ...__VLS_functionalComponentArgsRest(__VLS_169));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
(__VLS_ctx.$t('resetPresets'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('presetMeaning'));
// @ts-ignore
[$t, $t, $t, topologyPresets, resetPresets,];
var __VLS_135;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
