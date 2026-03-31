/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="../../../../../home/oai/.npm/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { agentHostRemoteTargetsAPI, agentHostTrafficLiveAPI, agentLanHostsAPI, agentQosStatusAPI, agentTrafficLiveAPI } from '@/api/agent';
import { getIPLabelFromMap } from '@/helper/sourceip';
import { COMMON_TUNNEL_INTERFACE_SUGGESTIONS, ifaceBaseDisplayName, inferTunnelKindFromName, normalizeTunnelDescription, normalizeTunnelInterfaceName } from '@/helper/tunnelDescriptions';
import { prettyBytesHelper } from '@/helper/utils';
import { ROUTE_NAME } from '@/constant';
import { agentEnabled } from '@/store/agent';
import { mergeRouterHostQosAppliedProfiles, routerHostQosAppliedProfiles } from '@/store/routerHostQos';
import { activeConnections } from '@/store/connections';
import { downloadSpeed, timeSaved, uploadSpeed } from '@/store/overview';
import { font, theme, tunnelInterfaceDescriptionMap } from '@/store/settings';
import { usersDbSyncEnabled } from '@/store/usersDbSync';
import { useElementSize } from '@vueuse/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { debounce } from 'lodash';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);
const { t } = useI18n();
const chartRef = ref(null);
const colorRef = ref(null);
const initValue = () => new Array(timeSaved).fill(0).map((v, i) => ({ name: i, value: v }));
const routerDownloadHistory = ref(initValue());
const routerUploadHistory = ref(initValue());
const mihomoDownloadHistory = ref(initValue());
const mihomoUploadHistory = ref(initValue());
const bypassDownloadHistory = ref(initValue());
const bypassUploadHistory = ref(initValue());
const vpnDownloadHistory = ref(initValue());
const vpnUploadHistory = ref(initValue());
const extraHistories = ref({});
const extraOrder = ref([]);
const colorSet = {
    baseContent: '',
    baseContent10: '',
    base70: '',
    success25: '',
    success60: '',
    info30: '',
    info60: '',
};
const extraPalette = [
    { down: '#06b6d4', up: '#f97316' },
    { down: '#84cc16', up: '#ef4444' },
    { down: '#a855f7', up: '#14b8a6' },
    { down: '#f43f5e', up: '#0ea5e9' },
    { down: '#facc15', up: '#7c3aed' },
    { down: '#22c55e', up: '#e11d48' },
    { down: '#38bdf8', up: '#d97706' },
    { down: '#10b981', up: '#8b5cf6' },
];
const trafficColors = {
    wanDown: '#2563eb',
    wanUp: '#14b8a6',
    mihomoDown: '#7c3aed',
    mihomoUp: '#ec4899',
    bypassDown: '#f59e0b',
    bypassUp: '#22c55e',
    vpnDown: '#0ea5e9',
    vpnUp: '#8b5cf6',
};
const trafficColorVars = {
    '--router-wan-down': trafficColors.wanDown,
    '--router-wan-up': trafficColors.wanUp,
    '--router-mihomo-down': trafficColors.mihomoDown,
    '--router-mihomo-up': trafficColors.mihomoUp,
    '--router-other-down': trafficColors.bypassDown,
    '--router-other-up': trafficColors.bypassUp,
    '--router-vpn-down': trafficColors.vpnDown,
    '--router-vpn-up': trafficColors.vpnUp,
};
let fontFamily = '';
let pollTimer = null;
let lastRxBytes = null;
let lastTxBytes = null;
let lastSampleTs = null;
const lastExtraCounters = ref({});
const lanHostNames = ref({});
const agentHostTrafficByIp = ref({});
const hostRemoteTargetsByIp = ref({});
const hostRemoteTargetsLoading = ref({});
let hostsTimer = null;
const updateColorSet = () => {
    if (!colorRef.value)
        return;
    const colorStyle = getComputedStyle(colorRef.value);
    colorSet.baseContent = colorStyle.getPropertyValue('--color-base-content').trim();
    colorSet.base70 = colorStyle.backgroundColor;
    colorSet.baseContent10 = colorStyle.color;
    colorSet.success25 = colorStyle.borderBottomColor;
    colorSet.success60 = colorStyle.borderTopColor;
    colorSet.info30 = colorStyle.borderLeftColor;
    colorSet.info60 = colorStyle.borderRightColor;
};
const updateFontFamily = () => {
    if (!colorRef.value)
        return;
    fontFamily = getComputedStyle(colorRef.value).fontFamily;
};
const latestValue = (items) => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
        const v = Number(items[i]?.value || 0);
        if (Number.isFinite(v))
            return v;
    }
    return 0;
};
const pushHistory = (target, timestamp, value) => {
    target.value.push({ name: timestamp, value: Math.max(0, Number(value) || 0) });
    target.value = target.value.slice(-1 * timeSaved);
};
const speedLabel = (value) => `${prettyBytesHelper(value, {
    maximumFractionDigits: value >= 1024 * 1024 ? 2 : 0,
    binary: false,
})}/s`;
const currentRouterUploadLabel = computed(() => speedLabel(latestValue(routerUploadHistory.value)));
const currentRouterDownloadLabel = computed(() => speedLabel(latestValue(routerDownloadHistory.value)));
const currentMihomoUploadLabel = computed(() => speedLabel(latestValue(mihomoUploadHistory.value)));
const currentMihomoDownloadLabel = computed(() => speedLabel(latestValue(mihomoDownloadHistory.value)));
const currentBypassUploadLabel = computed(() => speedLabel(latestValue(bypassUploadHistory.value)));
const currentBypassDownloadLabel = computed(() => speedLabel(latestValue(bypassDownloadHistory.value)));
const currentVpnUploadLabel = computed(() => speedLabel(latestValue(vpnUploadHistory.value)));
const currentVpnDownloadLabel = computed(() => speedLabel(latestValue(vpnDownloadHistory.value)));
const router = useRouter();
const tunnelDescriptionMap = tunnelInterfaceDescriptionMap;
const tunnelDescriptionStorageBadge = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedBadge') : t('routerTrafficTunnelDescriptionsStorageLocalBadge'));
const tunnelDescriptionStorageHint = computed(() => usersDbSyncEnabled.value ? t('routerTrafficTunnelDescriptionsStorageSharedHint') : t('routerTrafficTunnelDescriptionsStorageHint'));
const tunnelDescriptionManagerOpen = ref(true);
const tunnelDescriptionDrafts = ref({});
const newTunnelInterfaceName = ref('');
const newTunnelInterfaceDescription = ref('');
const getTunnelDescription = (name) => {
    const key = normalizeTunnelInterfaceName(name);
    if (!key)
        return '';
    return normalizeTunnelDescription((tunnelDescriptionMap.value || {})[key] || '');
};
const ifaceDisplayName = (name, kind, includeDescription = false) => {
    const base = ifaceBaseDisplayName(name, kind);
    if (!includeDescription)
        return base;
    const description = getTunnelDescription(name);
    return description ? `${base} · ${description}` : base;
};
const ifaceDownLabel = (name, kind) => `${ifaceDisplayName(name, kind)} ↓`;
const ifaceUpLabel = (name, kind) => `${ifaceDisplayName(name, kind)} ↑`;
const extraColorPair = (index) => extraPalette[index % extraPalette.length];
const ensureExtraHistory = (name, kind) => {
    if (!extraHistories.value[name]) {
        extraHistories.value[name] = { down: initValue(), up: initValue(), kind };
    }
    if (!extraOrder.value.includes(name)) {
        extraOrder.value = [...extraOrder.value, name];
    }
    if (kind)
        extraHistories.value[name].kind = kind;
};
const extraInterfaceKeys = computed(() => extraOrder.value.filter((name) => !!extraHistories.value[name]));
const currentExtraStats = computed(() => {
    return extraInterfaceKeys.value
        .map((name) => ({
        name,
        kind: extraHistories.value[name]?.kind || 'vpn',
        down: latestValue(extraHistories.value[name]?.down || []),
        up: latestValue(extraHistories.value[name]?.up || []),
    }))
        .filter((item) => item.down > 0 || item.up > 0 || !!item.kind)
        .sort((a, b) => (b.down + b.up) - (a.down + a.up));
});
const tunnelDescriptionEntries = computed(() => {
    const knownKinds = new Map(currentExtraStats.value.map((item) => [item.name, item.kind || inferTunnelKindFromName(item.name)]));
    const names = new Set([
        ...currentExtraStats.value.map((item) => item.name),
        ...Object.keys(tunnelDescriptionMap.value || {}).map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean),
    ]);
    return Array.from(names)
        .map((name) => ({
        name,
        kind: knownKinds.get(name) || inferTunnelKindFromName(name),
        description: getTunnelDescription(name),
    }))
        .sort((a, b) => a.name.localeCompare(b.name));
});
const tunnelDescriptionSuggestions = computed(() => {
    const names = [
        ...currentExtraStats.value.map((item) => item.name),
        ...Object.keys(tunnelDescriptionMap.value || {}),
        ...COMMON_TUNNEL_INTERFACE_SUGGESTIONS,
    ];
    return Array.from(new Set(names.map((name) => normalizeTunnelInterfaceName(name)).filter(Boolean)))
        .filter((name) => !tunnelDescriptionEntries.value.some((entry) => entry.name === name))
        .slice(0, 8);
});
const canAddTunnelDescription = computed(() => normalizeTunnelInterfaceName(newTunnelInterfaceName.value).length > 0);
const prefillTunnelDescriptionName = (name) => {
    const key = normalizeTunnelInterfaceName(name);
    if (!key)
        return;
    newTunnelInterfaceName.value = key;
    if (!tunnelDescriptionManagerOpen.value)
        tunnelDescriptionManagerOpen.value = true;
};
watch(tunnelDescriptionEntries, (entries) => {
    const next = { ...tunnelDescriptionDrafts.value };
    for (const entry of entries) {
        if (!(entry.name in next))
            next[entry.name] = entry.description;
    }
    tunnelDescriptionDrafts.value = next;
}, { immediate: true, deep: true });
const saveTunnelDescription = (name) => {
    const key = normalizeTunnelInterfaceName(name);
    if (!key)
        return;
    const next = { ...(tunnelDescriptionMap.value || {}) };
    const description = normalizeTunnelDescription(tunnelDescriptionDrafts.value[key] || '');
    if (description)
        next[key] = description;
    else
        delete next[key];
    tunnelDescriptionMap.value = next;
    tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description };
};
const clearTunnelDescription = (name) => {
    const key = normalizeTunnelInterfaceName(name);
    if (!key)
        return;
    const next = { ...(tunnelDescriptionMap.value || {}) };
    delete next[key];
    tunnelDescriptionMap.value = next;
    tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: '' };
};
const addTunnelDescriptionEntry = () => {
    const key = normalizeTunnelInterfaceName(newTunnelInterfaceName.value);
    if (!key)
        return;
    const description = normalizeTunnelDescription(newTunnelInterfaceDescription.value);
    tunnelDescriptionDrafts.value = { ...tunnelDescriptionDrafts.value, [key]: description };
    const next = { ...(tunnelDescriptionMap.value || {}) };
    if (description)
        next[key] = description;
    else
        delete next[key];
    tunnelDescriptionMap.value = next;
    newTunnelInterfaceName.value = '';
    newTunnelInterfaceDescription.value = '';
};
const openTunnelDescriptionsSettings = () => {
    router.push({ name: ROUTE_NAME.settings });
};
const hostTrafficState = ref({});
const hostQosByIp = ref({});
const storedHostQosProfiles = routerHostQosAppliedProfiles;
const hostHistoryState = ref({});
const hostScopeFilter = ref('all');
const hostSortBy = ref('traffic');
const hostGroupCollapseState = ref({});
const autoCollapseQuietHostGroups = ref(false);
const expandedHostDetails = ref({});
const hostTimelineLimit = 24;
const hostTimelineWindowSeconds = Math.round(hostTimelineLimit * 1.5);
const hostRemoteTargetsRefreshMs = 3000;
let hostTrafficTimer = null;
let hostTrafficAgentTimer = null;
let hostQosTimer = null;
let hostRemoteTargetsTimer = null;
const hostGroupCollapseStorageKey = 'router-traffic-host-groups-collapsed-v2';
const hostGroupAutoCollapseStorageKey = 'router-traffic-host-groups-autocollapse-v1';
const quietHostGroupThresholdBps = 32 * 1024;
const normalizeAgentHostTrafficItem = (item) => {
    const ip = String(item?.ip || '').trim();
    if (!ip)
        return null;
    return {
        ip,
        hostname: String(item?.hostname || '').trim() || undefined,
        mac: String(item?.mac || '').trim() || undefined,
        source: String(item?.source || '').trim() || undefined,
        bypassDown: Math.max(0, Number(item?.bypassDownBps || 0)),
        bypassUp: Math.max(0, Number(item?.bypassUpBps || 0)),
        vpnDown: Math.max(0, Number(item?.vpnDownBps || 0)),
        vpnUp: Math.max(0, Number(item?.vpnUpBps || 0)),
    };
};
const upsertHostTargetStat = (items, target, down, up, via, meta) => {
    if (!target)
        return;
    const scope = meta?.scope || 'mihomo';
    const kind = meta?.kind;
    const proto = meta?.proto;
    const existing = items.find((item) => item.target === target && (item.scope || 'mihomo') === scope && (item.via || '') === (via || ''));
    if (existing) {
        existing.down += down;
        existing.up += up;
        existing.connections += 1;
        if (!existing.via && via)
            existing.via = via;
        if (!existing.kind && kind)
            existing.kind = kind;
        if (!existing.proto && proto)
            existing.proto = proto;
        return;
    }
    items.push({ target, down, up, connections: 1, via, scope, kind, proto });
};
const normalizeAgentRemoteTargetItem = (item) => {
    const target = String(item?.target || '').trim();
    if (!target)
        return null;
    const scopeRaw = String(item?.scope || '').trim().toLowerCase();
    const scope = scopeRaw === 'vpn' || scopeRaw === 'bypass' ? scopeRaw : 'bypass';
    const kind = String(item?.kind || '').trim() || undefined;
    const viaName = String(item?.via || '').trim();
    const viaDescription = viaName ? getTunnelDescription(viaName) : '';
    const viaBase = viaName ? (scope === 'vpn' ? ifaceDisplayName(viaName, kind, false) : viaName) : undefined;
    const via = viaName ? (scope === 'vpn' ? ifaceDisplayName(viaName, kind, true) : viaName) : undefined;
    const proto = String(item?.proto || '').trim().toUpperCase() || undefined;
    return {
        target,
        down: Math.max(0, Number(item?.downBps || 0)),
        up: Math.max(0, Number(item?.upBps || 0)),
        connections: Math.max(0, Number(item?.connections || 0)),
        via,
        viaBase,
        viaName: viaName || undefined,
        viaDescription: viaDescription || undefined,
        scope,
        kind,
        proto,
    };
};
const hostTargetScopeLabel = (target) => {
    if (target.scope === 'vpn')
        return t('routerTrafficVpn');
    if (target.scope === 'bypass')
        return t('routerTrafficBypass');
    return t('mihomoVersion');
};
const hostTargetScopeColor = (target) => {
    if (target.scope === 'vpn')
        return trafficColors.vpnDown;
    if (target.scope === 'bypass')
        return trafficColors.bypassDown;
    return trafficColors.mihomoDown;
};
const hostRemoteTargets = (ip) => hostRemoteTargetsByIp.value[ip]?.items || [];
const parseRouteSource = (source) => {
    const raw = String(source || '').trim();
    if (!raw)
        return null;
    const match = raw.match(/^([a-z0-9_-]+)-route:(.+)$/i);
    if (!match)
        return null;
    const kind = String(match[1] || '').trim().toLowerCase() || 'vpn';
    const payload = String(match[2] || '').trim();
    if (!payload)
        return null;
    const parts = payload.split('|').map((part) => part.trim()).filter(Boolean);
    const via = String(parts.shift() || '').trim();
    if (!via)
        return null;
    const meta = {};
    for (const part of parts) {
        const eqIndex = part.indexOf('=');
        if (eqIndex <= 0)
            continue;
        const key = part.slice(0, eqIndex).trim().toLowerCase();
        const value = part.slice(eqIndex + 1).trim();
        if (!key || !value)
            continue;
        meta[key] = value;
    }
    const ifaceLabel = ifaceDisplayName(via, kind, true);
    const subnet = meta.subnet || undefined;
    const peer = meta.peer || undefined;
    const peerLabel = peer ? t('routerTrafficPeerLabel', { peer }) : '';
    const siteParts = [ifaceLabel];
    if (peerLabel)
        siteParts.push(peerLabel);
    if (subnet)
        siteParts.push(subnet);
    const siteLabel = siteParts.join(' · ');
    const compactSiteLabel = subnet || peerLabel || ifaceLabel;
    const siteKey = ['route', kind, via, peer || '-', subnet || '-'].join(':');
    const ifaceDescription = getTunnelDescription(via);
    return {
        kind,
        via,
        ifaceLabel,
        ifaceDescription,
        subnet,
        peer,
        peerLabel,
        siteLabel,
        compactSiteLabel,
        siteKey,
    };
};
const describeHostSource = (source) => {
    const route = parseRouteSource(source);
    if (route)
        return t('routerTrafficRoutedSource', { iface: route.siteLabel });
    return String(source || '').trim();
};
const hostSiteMeta = (item) => {
    const route = parseRouteSource(item.source);
    if (route) {
        return {
            key: route.siteKey,
            label: t('routerTrafficHostGroupRouted', { site: route.siteLabel }),
            badge: t('routerTrafficHostGroupRoutedBadge'),
            color: trafficColors.vpnDown,
            note: route.subnet
                ? t('routerTrafficDownstreamSiteHintDetailed', { iface: route.ifaceLabel, subnet: route.subnet })
                : t('routerTrafficDownstreamSiteHint', { iface: route.ifaceLabel }),
            isRouted: true,
        };
    }
    return {
        key: 'lan',
        label: t('routerTrafficHostGroupLan'),
        badge: t('routerTrafficHostGroupLanBadge'),
        color: trafficColors.wanDown,
        note: undefined,
        isRouted: false,
    };
};
const hostSiteBadge = (item) => {
    const route = parseRouteSource(item.source);
    if (!route)
        return '';
    return `${t('routerTrafficHostGroupRoutedBadge')} · ${route.compactSiteLabel}`;
};
const hostSiteBadgeStyle = (item) => {
    const meta = hostSiteMeta(item);
    return {
        borderColor: meta.color,
        color: meta.color,
    };
};
const qosLevel = (profile) => {
    if (profile === 'critical')
        return 6;
    if (profile === 'high')
        return 5;
    if (profile === 'elevated')
        return 4;
    if (profile === 'low')
        return 2;
    if (profile === 'background')
        return 1;
    return profile === 'normal' ? 3 : 0;
};
const qosProfileShortLabel = (profile) => {
    if (profile === 'critical')
        return 'C6';
    if (profile === 'high')
        return 'H5';
    if (profile === 'elevated')
        return 'E4';
    if (profile === 'normal')
        return 'N3';
    if (profile === 'low')
        return 'L2';
    if (profile === 'background')
        return 'B1';
    return '';
};
const qosProfileIcon = (profile) => {
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
    if (profile === 'normal')
        return '•';
    return '';
};
const qosProfileLabel = (profile) => {
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
    if (profile === 'normal')
        return t('hostQosNormal');
    return '';
};
const qosProfilePillClass = (profile) => {
    if (profile === 'critical')
        return 'border-error/30 bg-error/10 text-error';
    if (profile === 'high')
        return 'border-success/30 bg-success/10 text-success';
    if (profile === 'elevated')
        return 'border-accent/30 bg-accent/10 text-accent';
    if (profile === 'low')
        return 'border-warning/30 bg-warning/10 text-warning';
    if (profile === 'background')
        return 'border-base-content/10 bg-base-200/50 text-base-content/70';
    if (profile === 'normal')
        return 'border-info/30 bg-info/10 text-info';
    return 'border-base-content/10 bg-base-200/40 text-base-content/60';
};
const qosProfileBarClass = (profile) => {
    if (profile === 'critical')
        return 'bg-error';
    if (profile === 'high')
        return 'bg-success';
    if (profile === 'elevated')
        return 'bg-accent';
    if (profile === 'low')
        return 'bg-warning';
    if (profile === 'background')
        return 'bg-base-content/45';
    if (profile === 'normal')
        return 'bg-info';
    return 'bg-base-content/15';
};
const qosIndicatorBars = (profile) => {
    const active = qosLevel(profile);
    return [5, 7, 9, 11, 13, 15].map((height, index) => ({
        key: String(index),
        height,
        active: index < active,
    }));
};
const collectHostSnapshot = () => {
    const map = new Map();
    for (const conn of activeConnections.value) {
        const ip = String(conn?.metadata?.sourceIP || '').trim();
        if (!ip)
            continue;
        const mihomoDown = Math.max(0, Number(conn?.downloadSpeed || 0));
        const mihomoUp = Math.max(0, Number(conn?.uploadSpeed || 0));
        const target = String(conn?.metadata?.host || conn?.metadata?.sniffHost || conn?.metadata?.destinationIP || '').trim();
        const current = map.get(ip) || {
            ip,
            label: getIPLabelFromMap(ip) || lanHostNames.value[ip] || ip,
            down: 0,
            up: 0,
            mihomoDown: 0,
            mihomoUp: 0,
            bypassDown: 0,
            bypassUp: 0,
            vpnDown: 0,
            vpnUp: 0,
            connections: 0,
            targets: [],
            targetStats: [],
            source: undefined,
            qosProfile: hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip],
            qosMeta: hostQosByIp.value[ip],
        };
        current.label = getIPLabelFromMap(ip) || lanHostNames.value[ip] || current.label || ip;
        current.qosProfile = hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip];
        current.qosMeta = hostQosByIp.value[ip];
        current.mihomoDown += mihomoDown;
        current.mihomoUp += mihomoUp;
        current.down += mihomoDown;
        current.up += mihomoUp;
        current.connections += 1;
        if (target && current.targets.length < 3 && !current.targets.includes(target))
            current.targets.push(target);
        const chains = Array.isArray(conn?.chains) ? conn.chains : [];
        const via = String(chains?.[chains.length - 1] || chains?.[0] || '').trim() || undefined;
        upsertHostTargetStat(current.targetStats, target, mihomoDown, mihomoUp, via, { scope: 'mihomo' });
        current.targetStats = [...current.targetStats]
            .sort((a, b) => ((b.down + b.up) - (a.down + a.up)) || (b.connections - a.connections))
            .slice(0, 6);
        map.set(ip, current);
    }
    for (const [ip, item] of Object.entries(agentHostTrafficByIp.value)) {
        const current = map.get(ip) || {
            ip,
            label: getIPLabelFromMap(ip) || lanHostNames.value[ip] || item.hostname || item.mac || ip,
            down: 0,
            up: 0,
            mihomoDown: 0,
            mihomoUp: 0,
            bypassDown: 0,
            bypassUp: 0,
            vpnDown: 0,
            vpnUp: 0,
            connections: 0,
            targets: [],
            targetStats: [],
            source: item.source,
            qosProfile: hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip],
            qosMeta: hostQosByIp.value[ip],
        };
        current.label = getIPLabelFromMap(ip) || lanHostNames.value[ip] || item.hostname || item.mac || current.label || ip;
        current.qosProfile = hostQosByIp.value[ip]?.profile || storedHostQosProfiles.value[ip];
        current.qosMeta = hostQosByIp.value[ip];
        current.source = current.source || item.source;
        current.bypassDown += item.bypassDown;
        current.bypassUp += item.bypassUp;
        current.vpnDown += item.vpnDown;
        current.vpnUp += item.vpnUp;
        current.down += item.bypassDown + item.vpnDown;
        current.up += item.bypassUp + item.vpnUp;
        map.set(ip, current);
    }
    return [...map.values()];
};
const refreshHostTraffic = () => {
    const now = Date.now();
    const current = collectHostSnapshot();
    const seen = new Set();
    const next = { ...hostTrafficState.value };
    for (const item of current) {
        seen.add(item.ip);
        const prev = next[item.ip];
        const alpha = prev ? 0.38 : 1;
        const smooth = (prevValue, nextValue) => (prev ? ((prevValue * (1 - alpha)) + (nextValue * alpha)) : nextValue);
        const displayMihomoDown = smooth(prev?.displayMihomoDown || 0, item.mihomoDown);
        const displayMihomoUp = smooth(prev?.displayMihomoUp || 0, item.mihomoUp);
        const displayBypassDown = smooth(prev?.displayBypassDown || 0, item.bypassDown);
        const displayBypassUp = smooth(prev?.displayBypassUp || 0, item.bypassUp);
        const displayVpnDown = smooth(prev?.displayVpnDown || 0, item.vpnDown);
        const displayVpnUp = smooth(prev?.displayVpnUp || 0, item.vpnUp);
        const displayDown = displayMihomoDown + displayBypassDown + displayVpnDown;
        const displayUp = displayMihomoUp + displayBypassUp + displayVpnUp;
        const scoreBase = item.down + item.up + (item.connections * 1024);
        next[item.ip] = {
            ...item,
            displayDown,
            displayUp,
            displayMihomoDown,
            displayMihomoUp,
            displayBypassDown,
            displayBypassUp,
            displayVpnDown,
            displayVpnUp,
            lastSeen: now,
            score: prev ? ((prev.score * 0.7) + (scoreBase * 0.3)) : scoreBase,
            missingTicks: 0,
        };
    }
    for (const [ip, item] of Object.entries(next)) {
        if (seen.has(ip))
            continue;
        const agedMs = now - Number(item.lastSeen || 0);
        const decay = agedMs > 20000 ? 0.72 : 0.84;
        const displayMihomoDown = (item.displayMihomoDown || 0) * decay;
        const displayMihomoUp = (item.displayMihomoUp || 0) * decay;
        const displayBypassDown = (item.displayBypassDown || 0) * decay;
        const displayBypassUp = (item.displayBypassUp || 0) * decay;
        const displayVpnDown = (item.displayVpnDown || 0) * decay;
        const displayVpnUp = (item.displayVpnUp || 0) * decay;
        const displayDown = displayMihomoDown + displayBypassDown + displayVpnDown;
        const displayUp = displayMihomoUp + displayBypassUp + displayVpnUp;
        const score = (item.score || 0) * decay;
        const missingTicks = (item.missingTicks || 0) + 1;
        if ((displayDown + displayUp) < 256 && missingTicks > 8) {
            delete next[ip];
            continue;
        }
        next[ip] = {
            ...item,
            down: displayDown,
            up: displayUp,
            mihomoDown: displayMihomoDown,
            mihomoUp: displayMihomoUp,
            bypassDown: displayBypassDown,
            bypassUp: displayBypassUp,
            vpnDown: displayVpnDown,
            vpnUp: displayVpnUp,
            displayDown,
            displayUp,
            displayMihomoDown,
            displayMihomoUp,
            displayBypassDown,
            displayBypassUp,
            displayVpnDown,
            displayVpnUp,
            connections: 0,
            score,
            missingTicks,
        };
    }
    hostTrafficState.value = next;
    refreshHostHistory(next, now);
};
const refreshHostHistory = (items, ts) => {
    const next = { ...hostHistoryState.value };
    for (const [ip, item] of Object.entries(items)) {
        const sample = {
            ts,
            down: Math.max(0, Number(item.displayDown || 0)),
            up: Math.max(0, Number(item.displayUp || 0)),
            mihomoDown: Math.max(0, Number(item.displayMihomoDown || 0)),
            mihomoUp: Math.max(0, Number(item.displayMihomoUp || 0)),
            bypassDown: Math.max(0, Number(item.displayBypassDown || 0)),
            bypassUp: Math.max(0, Number(item.displayBypassUp || 0)),
            vpnDown: Math.max(0, Number(item.displayVpnDown || 0)),
            vpnUp: Math.max(0, Number(item.displayVpnUp || 0)),
        };
        const prev = Array.isArray(next[ip]) ? [...next[ip]] : [];
        const last = prev[prev.length - 1];
        if (last && (ts - last.ts) < 1100)
            prev[prev.length - 1] = sample;
        else
            prev.push(sample);
        next[ip] = prev.slice(-1 * hostTimelineLimit);
    }
    for (const [ip, series] of Object.entries(next)) {
        if (items[ip])
            continue;
        const last = series[series.length - 1];
        if (!last || (ts - last.ts) > (hostTimelineWindowSeconds * 2500))
            delete next[ip];
    }
    hostHistoryState.value = next;
};
const scheduleHostTrafficRefresh = () => {
    if (hostTrafficTimer !== null)
        window.clearTimeout(hostTrafficTimer);
    hostTrafficTimer = window.setTimeout(() => {
        refreshHostTraffic();
        scheduleHostTrafficRefresh();
    }, 1500);
};
const hostScopeTotals = (item) => ({
    mihomo: Math.max(0, Number(item.mihomoDown || 0)) + Math.max(0, Number(item.mihomoUp || 0)) + (Number(item.connections || 0) > 0 ? 1 : 0),
    vpn: Math.max(0, Number(item.vpnDown || 0)) + Math.max(0, Number(item.vpnUp || 0)),
    bypass: Math.max(0, Number(item.bypassDown || 0)) + Math.max(0, Number(item.bypassUp || 0)),
});
const hostScopeBadges = (item) => {
    const totals = hostScopeTotals(item);
    const badges = [];
    if (totals.mihomo > 1 || item.connections > 0)
        badges.push({ key: 'mihomo', label: t('mihomoVersion'), color: trafficColors.mihomoDown });
    if (totals.vpn > 1)
        badges.push({ key: 'vpn', label: t('routerTrafficVpn'), color: trafficColors.vpnDown });
    if (totals.bypass > 1)
        badges.push({ key: 'bypass', label: t('routerTrafficBypass'), color: trafficColors.bypassDown });
    return badges;
};
const hostScopeCount = (item) => hostScopeBadges(item).length;
const hostMatchesScopeFilter = (item) => {
    if (hostScopeFilter.value === 'all')
        return true;
    if (hostScopeFilter.value === 'mixed')
        return hostScopeCount(item) > 1;
    if (hostScopeFilter.value === 'routed')
        return hostSiteMeta(item).isRouted;
    return hostScopeBadges(item).some((badge) => badge.key === hostScopeFilter.value);
};
const hostPrimaryColor = (item, direction) => {
    const candidates = [
        {
            scope: 'mihomo',
            total: direction === 'down' ? item.mihomoDown : item.mihomoUp,
            color: direction === 'down' ? trafficColors.mihomoDown : trafficColors.mihomoUp,
        },
        {
            scope: 'vpn',
            total: direction === 'down' ? item.vpnDown : item.vpnUp,
            color: direction === 'down' ? trafficColors.vpnDown : trafficColors.vpnUp,
        },
        {
            scope: 'bypass',
            total: direction === 'down' ? item.bypassDown : item.bypassUp,
            color: direction === 'down' ? trafficColors.bypassDown : trafficColors.bypassUp,
        },
    ].sort((a, b) => b.total - a.total);
    return candidates[0]?.total > 0 ? candidates[0].color : (direction === 'down' ? trafficColors.wanDown : trafficColors.wanUp);
};
const hostBreakdownLabel = (item) => {
    const parts = [];
    if ((item.mihomoDown + item.mihomoUp) > 1 || item.connections > 0)
        parts.push(`${t('mihomoVersion')} ↓${speedLabel(item.mihomoDown)} ↑${speedLabel(item.mihomoUp)}`);
    if ((item.vpnDown + item.vpnUp) > 1)
        parts.push(`${t('routerTrafficVpn')} ↓${speedLabel(item.vpnDown)} ↑${speedLabel(item.vpnUp)}`);
    if ((item.bypassDown + item.bypassUp) > 1)
        parts.push(`${t('routerTrafficBypass')} ↓${speedLabel(item.bypassDown)} ↑${speedLabel(item.bypassUp)}`);
    return parts.join(' · ');
};
const hasTrafficHosts = computed(() => Object.values(hostTrafficState.value).some((item) => (item.displayDown + item.displayUp) > 0));
const visibleTrafficHosts = computed(() => {
    return Object.values(hostTrafficState.value)
        .filter((item) => (item.displayDown + item.displayUp) > 0)
        .filter(hostMatchesScopeFilter)
        .sort((a, b) => {
        if (hostSortBy.value === 'download') {
            const diff = (b.displayDown || 0) - (a.displayDown || 0);
            if (Math.abs(diff) > 64)
                return diff;
        }
        else if (hostSortBy.value === 'upload') {
            const diff = (b.displayUp || 0) - (a.displayUp || 0);
            if (Math.abs(diff) > 64)
                return diff;
        }
        else if (hostSortBy.value === 'connections') {
            const diff = (b.connections || 0) - (a.connections || 0);
            if (diff !== 0)
                return diff;
        }
        else if (hostSortBy.value === 'recent') {
            const diff = (b.lastSeen || 0) - (a.lastSeen || 0);
            if (diff !== 0)
                return diff;
        }
        else {
            const diff = (b.score || 0) - (a.score || 0);
            if (Math.abs(diff) > 128)
                return diff;
        }
        const speedDiff = ((b.displayDown || 0) + (b.displayUp || 0)) - ((a.displayDown || 0) + (a.displayUp || 0));
        if (Math.abs(speedDiff) > 64)
            return speedDiff;
        return (b.lastSeen || 0) - (a.lastSeen || 0);
    });
});
const visibleTrafficHostsCount = computed(() => visibleTrafficHosts.value.length);
const stableTrafficHosts = computed(() => {
    return visibleTrafficHosts.value
        .map((item) => ({
        ip: item.ip,
        label: item.label,
        down: item.displayDown,
        up: item.displayUp,
        mihomoDown: item.displayMihomoDown,
        mihomoUp: item.displayMihomoUp,
        bypassDown: item.displayBypassDown,
        bypassUp: item.displayBypassUp,
        vpnDown: item.displayVpnDown,
        vpnUp: item.displayVpnUp,
        connections: item.connections,
        targets: item.targets,
        targetStats: item.targetStats,
        source: item.source,
        qosProfile: item.qosProfile,
        qosMeta: item.qosMeta,
    }));
});
const stableTrafficHostGroups = computed(() => {
    const order = [];
    const groups = {};
    for (const item of stableTrafficHosts.value) {
        const meta = hostSiteMeta(item);
        if (!groups[meta.key]) {
            order.push(meta.key);
            groups[meta.key] = {
                ...meta,
                items: [],
                totalDown: 0,
                totalUp: 0,
                totalConnections: 0,
                totalMihomoDown: 0,
                totalMihomoUp: 0,
                totalVpnDown: 0,
                totalVpnUp: 0,
                totalBypassDown: 0,
                totalBypassUp: 0,
            };
        }
        const group = groups[meta.key];
        group.items.push(item);
        group.totalDown += item.down;
        group.totalUp += item.up;
        group.totalConnections += item.connections;
        group.totalMihomoDown += item.mihomoDown;
        group.totalMihomoUp += item.mihomoUp;
        group.totalVpnDown += item.vpnDown;
        group.totalVpnUp += item.vpnUp;
        group.totalBypassDown += item.bypassDown;
        group.totalBypassUp += item.bypassUp;
    }
    return order.map((key) => groups[key]).sort((a, b) => {
        if (a.isRouted !== b.isRouted)
            return a.isRouted ? -1 : 1;
        const aTotal = a.totalDown + a.totalUp;
        const bTotal = b.totalDown + b.totalUp;
        if (Math.abs(bTotal - aTotal) > 64)
            return bTotal - aTotal;
        return a.label.localeCompare(b.label);
    });
});
const hostGroupPrimaryColor = (group, direction) => {
    const downTotals = [
        { color: trafficColors.mihomoDown, value: group.totalMihomoDown },
        { color: trafficColors.vpnDown, value: group.totalVpnDown },
        { color: trafficColors.bypassDown, value: group.totalBypassDown },
    ];
    const upTotals = [
        { color: trafficColors.mihomoUp, value: group.totalMihomoUp },
        { color: trafficColors.vpnUp, value: group.totalVpnUp },
        { color: trafficColors.bypassUp, value: group.totalBypassUp },
    ];
    const primary = (direction === 'down' ? downTotals : upTotals).sort((a, b) => b.value - a.value)[0];
    return primary?.value > 0 ? primary.color : (direction === 'down' ? group.color : trafficColors.wanUp);
};
const hostGroupScopeBadges = (group) => {
    const badges = [];
    const mihomoValue = group.totalMihomoDown + group.totalMihomoUp;
    if (mihomoValue > 1)
        badges.push({ key: 'mihomo', label: t('mihomoVersion'), color: trafficColors.mihomoDown, value: mihomoValue });
    const vpnValue = group.totalVpnDown + group.totalVpnUp;
    if (vpnValue > 1)
        badges.push({ key: 'vpn', label: t('routerTrafficVpn'), color: trafficColors.vpnDown, value: vpnValue });
    const bypassValue = group.totalBypassDown + group.totalBypassUp;
    if (bypassValue > 1)
        badges.push({ key: 'bypass', label: t('routerTrafficBypass'), color: trafficColors.bypassDown, value: bypassValue });
    return badges.sort((a, b) => b.value - a.value);
};
const isHostGroupQuiet = (group) => (group.totalDown + group.totalUp) < quietHostGroupThresholdBps;
const isHostGroupCollapsed = (groupOrKey) => {
    const key = typeof groupOrKey === 'string' ? groupOrKey : groupOrKey.key;
    const manual = hostGroupCollapseState.value[key];
    if (manual === 'collapsed')
        return true;
    if (manual === 'expanded')
        return false;
    if (typeof groupOrKey === 'string')
        return false;
    return autoCollapseQuietHostGroups.value && isHostGroupQuiet(groupOrKey);
};
const setHostGroupManualState = (key, state) => {
    const next = { ...hostGroupCollapseState.value };
    if (state)
        next[key] = state;
    else
        delete next[key];
    hostGroupCollapseState.value = next;
};
const toggleHostGroup = (group) => {
    const target = typeof group === 'string' ? stableTrafficHostGroups.value.find((item) => item.key === group) || group : group;
    const key = typeof target === 'string' ? target : target.key;
    const collapsed = isHostGroupCollapsed(target);
    if (collapsed) {
        if (typeof target === 'string')
            setHostGroupManualState(key);
        else if (autoCollapseQuietHostGroups.value && isHostGroupQuiet(target))
            setHostGroupManualState(key, 'expanded');
        else
            setHostGroupManualState(key);
        return;
    }
    setHostGroupManualState(key, 'collapsed');
};
const collapseAllHostGroups = () => {
    const next = { ...hostGroupCollapseState.value };
    for (const group of stableTrafficHostGroups.value) {
        next[group.key] = 'collapsed';
    }
    hostGroupCollapseState.value = next;
};
const expandAllHostGroups = () => {
    const next = { ...hostGroupCollapseState.value };
    for (const group of stableTrafficHostGroups.value) {
        if (autoCollapseQuietHostGroups.value && isHostGroupQuiet(group))
            next[group.key] = 'expanded';
        else
            delete next[group.key];
    }
    hostGroupCollapseState.value = next;
};
const toggleAutoCollapseQuietHostGroups = () => {
    autoCollapseQuietHostGroups.value = !autoCollapseQuietHostGroups.value;
};
const quietHostGroupsCount = computed(() => stableTrafficHostGroups.value.filter((group) => isHostGroupQuiet(group)).length);
const isHostDetailsExpanded = (ip) => !!expandedHostDetails.value[ip];
const toggleHostDetails = (ip) => {
    const willExpand = !expandedHostDetails.value[ip];
    expandedHostDetails.value = {
        ...expandedHostDetails.value,
        [ip]: willExpand,
    };
    if (willExpand)
        void refreshHostRemoteTargets(ip, true);
};
const hostDetailCards = (item) => {
    const cards = [];
    if ((item.mihomoDown + item.mihomoUp) > 1 || item.connections > 0) {
        cards.push({
            key: 'mihomo',
            label: t('mihomoVersion'),
            down: item.mihomoDown,
            up: item.mihomoUp,
            color: trafficColors.mihomoDown,
            connections: item.connections,
        });
    }
    if ((item.vpnDown + item.vpnUp) > 1) {
        cards.push({
            key: 'vpn',
            label: t('routerTrafficVpn'),
            down: item.vpnDown,
            up: item.vpnUp,
            color: trafficColors.vpnDown,
            note: t('routerTrafficRouterSideAccounting'),
        });
    }
    if ((item.bypassDown + item.bypassUp) > 1) {
        cards.push({
            key: 'bypass',
            label: t('routerTrafficBypass'),
            down: item.bypassDown,
            up: item.bypassUp,
            color: trafficColors.bypassDown,
            note: t('routerTrafficDirectWan'),
        });
    }
    return cards;
};
const hostTopTargets = (item) => {
    const merged = [...(item.targetStats || []), ...hostRemoteTargets(item.ip)];
    return merged
        .filter((target) => (target.down + target.up) > 1 || target.connections > 0)
        .sort((a, b) => ((b.down + b.up) - (a.down + a.up)) || (b.connections - a.connections))
        .slice(0, 8);
};
const hostTunnelDescription = (item) => {
    const route = parseRouteSource(item.source);
    return route?.ifaceDescription || '';
};
const hostDetailNotes = (item) => {
    const notes = [];
    const route = parseRouteSource(item.source);
    const site = hostSiteMeta(item);
    if (item.source)
        notes.push(`${t('routerTrafficLabelSource')}: ${describeHostSource(item.source)}`);
    if (site.isRouted)
        notes.push(`${t('routerTrafficHostSiteLabel')}: ${site.label}`);
    if (route) {
        notes.push(t('routerTrafficRoutedHostHint', { iface: route.ifaceLabel }));
        if (route.subnet)
            notes.push(t('routerTrafficHostSubnetLabel', { subnet: route.subnet }));
        if (route.peer)
            notes.push(t('routerTrafficHostPeerLabel', { peer: route.peer }));
    }
    if ((item.vpnDown + item.vpnUp + item.bypassDown + item.bypassUp) > 1)
        notes.push(t('routerTrafficRemoteTargetsWarmupHint'));
    return notes;
};
const hostTimelineBars = (values) => {
    const clean = values.map((value) => Math.max(0, Number(value || 0))).slice(-1 * hostTimelineLimit);
    const maxValue = Math.max(1, ...clean);
    return clean.map((value, index) => {
        const ratio = value > 0 ? (value / maxValue) : 0;
        return {
            key: String(index),
            value,
            height: value > 0 ? Math.max(12, Math.round(ratio * 100)) : 6,
            opacity: value > 0 ? Math.min(1, 0.35 + (ratio * 0.65)) : 0.16,
        };
    });
};
const buildHostTimelineRows = (item) => {
    const history = hostHistoryState.value[item.ip] || [];
    if (!history.length)
        return [];
    const rows = [];
    const pushRow = (key, label, color, values) => {
        const hasActivity = values.some((value) => value > 1);
        if (!hasActivity && key !== 'total')
            return;
        rows.push({
            key,
            label,
            color,
            current: speedLabel(values[values.length - 1] || 0),
            peak: speedLabel(Math.max(0, ...values)),
            bars: hostTimelineBars(values),
        });
    };
    pushRow('total', t('routerTrafficTimelineTotal'), hostPrimaryColor(item, 'down'), history.map((entry) => entry.down + entry.up));
    pushRow('mihomo', t('mihomoVersion'), trafficColors.mihomoDown, history.map((entry) => entry.mihomoDown + entry.mihomoUp));
    pushRow('vpn', t('routerTrafficVpn'), trafficColors.vpnDown, history.map((entry) => entry.vpnDown + entry.vpnUp));
    pushRow('bypass', t('routerTrafficBypass'), trafficColors.bypassDown, history.map((entry) => entry.bypassDown + entry.bypassUp));
    return rows;
};
const stableTrafficHostTimelineRows = computed(() => {
    const out = {};
    for (const item of stableTrafficHosts.value)
        out[item.ip] = buildHostTimelineRows(item);
    return out;
});
const hostTimelineRows = (item) => stableTrafficHostTimelineRows.value[item.ip] || [];
watch(stableTrafficHosts, (items) => {
    const visible = new Set(items.map((item) => item.ip));
    const next = {};
    for (const [ip, expanded] of Object.entries(expandedHostDetails.value)) {
        if (expanded && visible.has(ip))
            next[ip] = true;
    }
    expandedHostDetails.value = next;
}, { deep: true });
const refreshHostRemoteTargets = async (ip, force = false) => {
    if (!agentEnabled.value)
        return;
    const key = String(ip || '').trim();
    if (!key)
        return;
    if (hostRemoteTargetsLoading.value[key])
        return;
    const cachedAt = Number(hostRemoteTargetsByIp.value[key]?.fetchedAt || 0);
    if (!force && cachedAt > 0 && (Date.now() - cachedAt) < Math.max(1200, hostRemoteTargetsRefreshMs - 500))
        return;
    hostRemoteTargetsLoading.value = { ...hostRemoteTargetsLoading.value, [key]: true };
    try {
        const res = await agentHostRemoteTargetsAPI(key);
        const items = Array.isArray(res?.items)
            ? res.items.map(normalizeAgentRemoteTargetItem).filter((item) => !!item)
            : [];
        hostRemoteTargetsByIp.value = {
            ...hostRemoteTargetsByIp.value,
            [key]: { items, fetchedAt: Date.now() },
        };
    }
    finally {
        const next = { ...hostRemoteTargetsLoading.value };
        delete next[key];
        hostRemoteTargetsLoading.value = next;
    }
};
const refreshExpandedHostRemoteTargets = async (force = false) => {
    const ips = Object.entries(expandedHostDetails.value)
        .filter(([, expanded]) => !!expanded)
        .map(([ip]) => ip);
    for (const ip of ips)
        await refreshHostRemoteTargets(ip, force);
};
const scheduleHostRemoteTargetsRefresh = () => {
    if (hostRemoteTargetsTimer !== null)
        window.clearTimeout(hostRemoteTargetsTimer);
    hostRemoteTargetsTimer = window.setTimeout(async () => {
        await refreshExpandedHostRemoteTargets();
        scheduleHostRemoteTargetsRefresh();
    }, hostRemoteTargetsRefreshMs);
};
const refreshLanHosts = async () => {
    if (!agentEnabled.value)
        return;
    const res = await agentLanHostsAPI();
    if (!res?.ok || !Array.isArray(res.items))
        return;
    const next = {};
    for (const item of res.items) {
        const ip = String(item?.ip || '').trim();
        if (!ip)
            continue;
        const label = String(item?.hostname || item?.mac || '').trim();
        if (label)
            next[ip] = label;
    }
    lanHostNames.value = next;
    refreshHostTraffic();
};
const refreshHostQos = async () => {
    if (!agentEnabled.value) {
        hostQosByIp.value = {};
        refreshHostTraffic();
        return;
    }
    const res = await agentQosStatusAPI();
    if (!res?.ok || !Array.isArray(res.items)) {
        hostQosByIp.value = {};
        refreshHostTraffic();
        return;
    }
    const next = {};
    for (const item of res.items) {
        const ip = String(item?.ip || '').trim();
        if (!ip || !item?.profile)
            continue;
        next[ip] = item;
    }
    hostQosByIp.value = next;
    mergeRouterHostQosAppliedProfiles(Object.fromEntries(Object.entries(next).map(([ip, item]) => [ip, item.profile])));
    refreshHostTraffic();
};
const scheduleHostQosRefresh = () => {
    if (hostQosTimer !== null)
        window.clearTimeout(hostQosTimer);
    hostQosTimer = window.setTimeout(async () => {
        await refreshHostQos();
        scheduleHostQosRefresh();
    }, 10000);
};
const refreshAgentHostTraffic = async () => {
    if (!agentEnabled.value) {
        agentHostTrafficByIp.value = {};
        refreshHostTraffic();
        return;
    }
    const res = await agentHostTrafficLiveAPI();
    if (!res?.ok || !Array.isArray(res.items)) {
        agentHostTrafficByIp.value = {};
        refreshHostTraffic();
        return;
    }
    const next = {};
    for (const item of res.items) {
        const normalized = normalizeAgentHostTrafficItem(item);
        if (!normalized)
            continue;
        next[normalized.ip] = normalized;
    }
    agentHostTrafficByIp.value = next;
    refreshHostTraffic();
};
const scheduleHostRefresh = () => {
    if (hostsTimer !== null)
        window.clearTimeout(hostsTimer);
    hostsTimer = window.setTimeout(async () => {
        await refreshLanHosts();
        scheduleHostRefresh();
    }, 60000);
};
const scheduleAgentHostTrafficRefresh = () => {
    if (hostTrafficAgentTimer !== null)
        window.clearTimeout(hostTrafficAgentTimer);
    hostTrafficAgentTimer = window.setTimeout(async () => {
        await refreshAgentHostTraffic();
        scheduleAgentHostTrafficRefresh();
    }, 3000);
};
const extraSeriesValues = computed(() => {
    return extraInterfaceKeys.value.flatMap((name) => {
        const hist = extraHistories.value[name];
        if (!hist)
            return [];
        return [...hist.down, ...hist.up].map((item) => Number(item?.value || 0));
    });
});
const allSeriesValues = computed(() => [
    ...routerDownloadHistory.value,
    ...routerUploadHistory.value,
    ...mihomoDownloadHistory.value,
    ...mihomoUploadHistory.value,
    ...bypassDownloadHistory.value,
    ...bypassUploadHistory.value,
    ...vpnDownloadHistory.value,
    ...vpnUploadHistory.value,
].map((item) => Number(item?.value || 0)).concat(extraSeriesValues.value));
const maxObserved = computed(() => Math.max(0, ...allSeriesValues.value));
const roundedPeak = computed(() => {
    const observed = Math.max(0, Number(maxObserved.value || 0));
    const floor = observed >= 512 * 1024
        ? 256 * 1024
        : observed >= 128 * 1024
            ? 128 * 1024
            : 64 * 1024;
    const raw = Math.max(observed * 1.2, floor);
    const step = raw < 256 * 1024
        ? 16 * 1024
        : raw < 1024 * 1024
            ? 64 * 1024
            : raw < 5 * 1024 * 1024
                ? 256 * 1024
                : 1024 * 1024;
    return Math.ceil(raw / step) * step;
});
const maxLabel = computed(() => `${t('peakScale')}: ${speedLabel(roundedPeak.value)}`);
const formatTime = (value) => {
    if (!value)
        return '—';
    const dt = new Date(Number(value));
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const ss = String(dt.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
};
const routerDownLabel = computed(() => t('routerTrafficLegendRouterDown'));
const routerUpLabel = computed(() => t('routerTrafficLegendRouterUp'));
const mihomoDownLabel = computed(() => t('routerTrafficLegendMihomoDown'));
const mihomoUpLabel = computed(() => t('routerTrafficLegendMihomoUp'));
const bypassDownLabel = computed(() => t('routerTrafficLegendBypassDown'));
const bypassUpLabel = computed(() => t('routerTrafficLegendBypassUp'));
const vpnDownLabel = computed(() => t('routerTrafficLegendVpnDown'));
const vpnUpLabel = computed(() => t('routerTrafficLegendVpnUp'));
const dynamicLegendItems = computed(() => extraInterfaceKeys.value.flatMap((name) => {
    const kind = extraHistories.value[name]?.kind;
    return [ifaceDownLabel(name, kind), ifaceUpLabel(name, kind)];
}));
const dynamicExtraSeries = computed(() => extraInterfaceKeys.value.flatMap((name, index) => {
    const hist = extraHistories.value[name];
    if (!hist)
        return [];
    const colors = extraColorPair(index);
    return [
        {
            name: ifaceDownLabel(name, hist.kind),
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: hist.down.map((item) => item.value),
            color: colors.down,
            lineStyle: { width: 1.8 },
            emphasis: { focus: 'series' },
        },
        {
            name: ifaceUpLabel(name, hist.kind),
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: hist.up.map((item) => item.value),
            color: colors.up,
            lineStyle: { width: 1.8, type: 'dotted' },
            emphasis: { focus: 'series' },
        },
    ];
}));
const options = computed(() => ({
    grid: {
        left: 12,
        top: 52,
        right: 12,
        bottom: 26,
        containLabel: true,
    },
    legend: {
        type: 'scroll',
        top: 8,
        left: 12,
        right: 12,
        itemWidth: 12,
        itemHeight: 8,
        pageIconColor: colorSet.baseContent,
        pageTextStyle: {
            color: colorSet.baseContent,
            fontFamily,
            fontSize: 10,
        },
        textStyle: {
            color: colorSet.baseContent,
            fontFamily,
            fontSize: 11,
        },
        data: [
            routerDownLabel.value,
            routerUpLabel.value,
            mihomoDownLabel.value,
            mihomoUpLabel.value,
            bypassDownLabel.value,
            bypassUpLabel.value,
            vpnDownLabel.value,
            vpnUpLabel.value,
            ...dynamicLegendItems.value,
        ],
    },
    tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: colorSet.base70,
        borderColor: colorSet.base70,
        textStyle: {
            color: colorSet.baseContent,
            fontFamily,
        },
        formatter: (params) => {
            const time = formatTime(Number(params?.[0]?.axisValue || 0));
            const lines = [
                `<div style="padding:6px 8px">`,
                `<div style="font-size:12px;opacity:.75;margin-bottom:4px">${time}</div>`,
            ];
            for (const item of params || []) {
                lines.push(`<div style="display:flex;align-items:center;gap:8px;margin:2px 0">` +
                    `<span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${item.color}"></span>` +
                    `<span>${item.seriesName}: ${speedLabel(Number(item.value || 0))}</span>` +
                    `</div>`);
            }
            lines.push(`</div>`);
            return lines.join('');
        },
    },
    xAxis: {
        type: 'category',
        boundaryGap: false,
        data: routerDownloadHistory.value.map((item) => item.name),
        axisLine: {
            lineStyle: { color: colorSet.baseContent10 },
        },
        axisTick: { show: false },
        axisLabel: {
            color: colorSet.baseContent,
            fontFamily,
            formatter: (value, index) => {
                const last = routerDownloadHistory.value.length - 1;
                return index === 0 || index === last ? formatTime(Number(value)) : '';
            },
        },
        splitLine: { show: false },
    },
    yAxis: {
        type: 'value',
        min: 0,
        max: roundedPeak.value,
        splitNumber: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
            color: colorSet.baseContent,
            fontFamily,
            formatter: (value) => (Number(value) === roundedPeak.value ? speedLabel(value) : ''),
        },
        splitLine: {
            show: true,
            lineStyle: {
                type: 'dashed',
                color: colorSet.baseContent10,
            },
        },
    },
    series: [
        {
            name: routerDownLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: routerDownloadHistory.value.map((item) => item.value),
            color: '#2563eb',
            lineStyle: { width: 2.4 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(37,99,235,0.30)' },
                    { offset: 1, color: 'rgba(37,99,235,0.05)' },
                ]),
            },
            emphasis: { focus: 'series' },
        },
        {
            name: routerUpLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: routerUploadHistory.value.map((item) => item.value),
            color: '#0d9488',
            lineStyle: { width: 2.4 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(13,148,136,0.28)' },
                    { offset: 1, color: 'rgba(13,148,136,0.05)' },
                ]),
            },
            emphasis: { focus: 'series' },
        },
        {
            name: mihomoDownLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: mihomoDownloadHistory.value.map((item) => item.value),
            color: '#7c3aed',
            lineStyle: { width: 1.8, type: 'dashed' },
            emphasis: { focus: 'series' },
        },
        {
            name: mihomoUpLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: mihomoUploadHistory.value.map((item) => item.value),
            color: '#ec4899',
            lineStyle: { width: 1.8, type: 'dashed' },
            emphasis: { focus: 'series' },
        },
        {
            name: bypassDownLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: bypassDownloadHistory.value.map((item) => item.value),
            color: '#f59e0b',
            lineStyle: { width: 2 },
            emphasis: { focus: 'series' },
        },
        {
            name: bypassUpLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: bypassUploadHistory.value.map((item) => item.value),
            color: '#22c55e',
            lineStyle: { width: 2 },
            emphasis: { focus: 'series' },
        },
        {
            name: vpnDownLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: vpnDownloadHistory.value.map((item) => item.value),
            color: '#0ea5e9',
            lineStyle: { width: 1.8, type: 'dashdot' },
            emphasis: { focus: 'series' },
        },
        {
            name: vpnUpLabel.value,
            type: 'line',
            smooth: true,
            symbol: 'none',
            data: vpnUploadHistory.value.map((item) => item.value),
            color: '#8b5cf6',
            lineStyle: { width: 1.8, type: 'dashdot' },
            emphasis: { focus: 'series' },
        },
        ...dynamicExtraSeries.value,
    ],
}));
const stopPolling = () => {
    if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
    }
};
const scheduleNextPoll = () => {
    stopPolling();
    pollTimer = window.setTimeout(pollTraffic, 2000);
};
const computeExtraSpeeds = (items, ts) => {
    const speeds = {};
    const nextState = { ...lastExtraCounters.value };
    for (const item of items) {
        const name = String(item?.name || '').trim();
        if (!name)
            continue;
        const kind = item?.kind || 'vpn';
        const rxBytes = Number(item?.rxBytes || 0);
        const txBytes = Number(item?.txBytes || 0);
        const prev = lastExtraCounters.value[name];
        let down = 0;
        let up = 0;
        if (prev && ts > prev.ts) {
            const dtSec = Math.max((ts - prev.ts) / 1000, 1);
            down = Math.max(rxBytes - prev.rxBytes, 0) / dtSec;
            up = Math.max(txBytes - prev.txBytes, 0) / dtSec;
        }
        speeds[name] = { down, up, kind };
        nextState[name] = { rxBytes, txBytes, ts, kind };
        ensureExtraHistory(name, kind);
    }
    lastExtraCounters.value = nextState;
    return speeds;
};
const pollTraffic = async () => {
    const timestamp = Date.now();
    const mihomoDown = Math.max(0, Number(downloadSpeed.value || 0));
    const mihomoUp = Math.max(0, Number(uploadSpeed.value || 0));
    let routerDown = 0;
    let routerUp = 0;
    let extraSpeeds = {};
    if (agentEnabled.value) {
        const live = await agentTrafficLiveAPI();
        const rxBytes = Number(live?.rxBytes || 0);
        const txBytes = Number(live?.txBytes || 0);
        const ts = Number(live?.ts || timestamp);
        if (live.ok && Number.isFinite(rxBytes) && Number.isFinite(txBytes)) {
            if (lastRxBytes !== null && lastTxBytes !== null && lastSampleTs !== null && ts > lastSampleTs) {
                const dtSec = Math.max((ts - lastSampleTs) / 1000, 1);
                const rxDelta = Math.max(rxBytes - lastRxBytes, 0);
                const txDelta = Math.max(txBytes - lastTxBytes, 0);
                routerDown = rxDelta / dtSec;
                routerUp = txDelta / dtSec;
            }
            lastRxBytes = rxBytes;
            lastTxBytes = txBytes;
            lastSampleTs = ts;
            if (Array.isArray(live.extraIfaces) && live.extraIfaces.length) {
                extraSpeeds = computeExtraSpeeds(live.extraIfaces, ts);
            }
        }
    }
    const otherDown = Math.max(routerDown - mihomoDown, 0);
    const otherUp = Math.max(routerUp - mihomoUp, 0);
    const vpnDownRaw = Object.values(extraSpeeds).reduce((sum, item) => sum + Math.max(0, Number(item?.down || 0)), 0);
    const vpnUpRaw = Object.values(extraSpeeds).reduce((sum, item) => sum + Math.max(0, Number(item?.up || 0)), 0);
    const vpnDown = Math.min(otherDown, vpnDownRaw);
    const vpnUp = Math.min(otherUp, vpnUpRaw);
    const bypassDown = Math.max(otherDown - vpnDown, 0);
    const bypassUp = Math.max(otherUp - vpnUp, 0);
    pushHistory(routerDownloadHistory, timestamp, routerDown);
    pushHistory(routerUploadHistory, timestamp, routerUp);
    pushHistory(mihomoDownloadHistory, timestamp, mihomoDown);
    pushHistory(mihomoUploadHistory, timestamp, mihomoUp);
    pushHistory(vpnDownloadHistory, timestamp, vpnDown);
    pushHistory(vpnUploadHistory, timestamp, vpnUp);
    pushHistory(bypassDownloadHistory, timestamp, bypassDown);
    pushHistory(bypassUploadHistory, timestamp, bypassUp);
    for (const name of extraInterfaceKeys.value) {
        const hist = extraHistories.value[name];
        if (!hist)
            continue;
        const current = extraSpeeds[name];
        pushHistory({ value: hist.down }, timestamp, current?.down || 0);
        hist.down = hist.down.slice(-1 * timeSaved);
        pushHistory({ value: hist.up }, timestamp, current?.up || 0);
        hist.up = hist.up.slice(-1 * timeSaved);
        if (current?.kind)
            hist.kind = current.kind;
    }
    scheduleNextPoll();
};
onMounted(() => {
    updateColorSet();
    updateFontFamily();
    watch(theme, updateColorSet);
    watch(font, updateFontFamily);
    try {
        const raw = window.localStorage.getItem(hostGroupCollapseStorageKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                const entries = Object.entries(parsed).filter(([key, value]) => !!key && (value === 'collapsed' || value === 'expanded'));
                hostGroupCollapseState.value = Object.fromEntries(entries);
            }
        }
    }
    catch {
        // ignore localStorage parse issues
    }
    try {
        autoCollapseQuietHostGroups.value = window.localStorage.getItem(hostGroupAutoCollapseStorageKey) === '1';
    }
    catch {
        // ignore localStorage read issues
    }
    watch(hostGroupCollapseState, (value) => {
        try {
            window.localStorage.setItem(hostGroupCollapseStorageKey, JSON.stringify(value));
        }
        catch {
            // ignore localStorage write issues
        }
    }, { deep: true });
    watch(autoCollapseQuietHostGroups, (value) => {
        try {
            window.localStorage.setItem(hostGroupAutoCollapseStorageKey, value ? '1' : '0');
        }
        catch {
            // ignore localStorage write issues
        }
    });
    const chart = echarts.init(chartRef.value);
    chart.setOption(options.value);
    watch(options, () => {
        chart.setOption(options.value);
    });
    const { width } = useElementSize(chartRef);
    const resize = debounce(() => chart.resize(), 100);
    watch(width, resize);
    refreshLanHosts();
    scheduleHostRefresh();
    pollTraffic();
    refreshAgentHostTraffic();
    scheduleAgentHostTrafficRefresh();
    refreshHostQos();
    scheduleHostQosRefresh();
    refreshHostTraffic();
    scheduleHostTrafficRefresh();
    scheduleHostRemoteTargetsRefresh();
    watch(activeConnections, refreshHostTraffic, { deep: true });
});
onBeforeUnmount(() => {
    stopPolling();
    if (hostsTimer !== null) {
        window.clearTimeout(hostsTimer);
        hostsTimer = null;
    }
    if (hostTrafficTimer !== null) {
        window.clearTimeout(hostTrafficTimer);
        hostTrafficTimer = null;
    }
    if (hostTrafficAgentTimer !== null) {
        window.clearTimeout(hostTrafficAgentTimer);
        hostTrafficAgentTimer = null;
    }
    if (hostQosTimer !== null) {
        window.clearTimeout(hostQosTimer);
        hostQosTimer = null;
    }
    if (hostRemoteTargetsTimer !== null) {
        window.clearTimeout(hostRemoteTargetsTimer);
        hostRemoteTargetsTimer = null;
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
    ...{ class: "card w-full" },
    ...{ style: (__VLS_ctx.trafficColorVars) },
});
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-title flex items-center justify-between gap-2 px-4 pt-4" },
});
/** @type {__VLS_StyleScopedClasses['card-title']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex min-w-0 flex-col" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('routerTrafficLive'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "text-xs font-normal opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-normal']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('routerTrafficLiveTip'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-full border border-base-content/10 bg-base-200/60 px-2 py-1 text-[11px] opacity-70" },
});
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
(__VLS_ctx.maxLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "card-body gap-3 pt-2" },
});
/** @type {__VLS_StyleScopedClasses['card-body']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative h-64 w-full overflow-hidden rounded-lg border border-base-content/10 bg-base-200/30" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['h-64']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/30']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ref: "chartRef",
    ...{ class: "h-full w-full" },
});
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ref: "colorRef",
    ...{ class: "border-b-success/25 border-t-success/60 border-l-info/25 border-r-info/60 text-base-content/10 bg-base-100/80 hidden [--router-wan-down:#2563eb] [--router-wan-up:#14b8a6] [--router-mihomo-down:#7c3aed] [--router-mihomo-up:#ec4899] [--router-other-down:#f59e0b] [--router-other-up:#22c55e]" },
});
/** @type {__VLS_StyleScopedClasses['border-b-success/25']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t-success/60']} */ ;
/** @type {__VLS_StyleScopedClasses['border-l-info/25']} */ ;
/** @type {__VLS_StyleScopedClasses['border-r-info/60']} */ ;
/** @type {__VLS_StyleScopedClasses['text-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-100/80']} */ ;
/** @type {__VLS_StyleScopedClasses['hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['[--router-wan-down:#2563eb]']} */ ;
/** @type {__VLS_StyleScopedClasses['[--router-wan-up:#14b8a6]']} */ ;
/** @type {__VLS_StyleScopedClasses['[--router-mihomo-down:#7c3aed]']} */ ;
/** @type {__VLS_StyleScopedClasses['[--router-mihomo-up:#ec4899]']} */ ;
/** @type {__VLS_StyleScopedClasses['[--router-other-down:#f59e0b]']} */ ;
/** @type {__VLS_StyleScopedClasses['[--router-other-up:#22c55e]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-2 px-1 text-sm sm:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('routerTrafficTotal'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.wanDown }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('download'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentRouterDownloadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.wanUp }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('upload'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentRouterUploadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('mihomoVersion'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.mihomoDown }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('download'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentMihomoDownloadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.mihomoUp }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('upload'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentMihomoUploadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 flex items-center justify-between gap-2 text-xs" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('routerTrafficVpn'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost badge-xs uppercase" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.vpnDown }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('download'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentVpnDownloadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.vpnUp }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('upload'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentVpnUploadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-1 flex items-center justify-between gap-2 text-xs" },
});
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('routerTrafficBypass'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost badge-xs" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.bypassDown }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('download'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentBypassDownloadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
    ...{ style: ({ backgroundColor: __VLS_ctx.trafficColors.bypassUp }) },
});
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "opacity-80" },
});
/** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
(__VLS_ctx.$t('upload'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "font-mono" },
});
/** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
(__VLS_ctx.currentBypassUploadLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-start justify-between gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2 text-sm font-medium" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.$t('routerTrafficTunnelDescriptions'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-ghost badge-xs" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
(__VLS_ctx.tunnelDescriptionEntries.length);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 text-xs opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
(__VLS_ctx.$t('routerTrafficTunnelDescriptionsHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-1 flex flex-wrap items-center gap-2 text-[11px] opacity-60" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.tunnelDescriptionStorageHint);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "badge badge-outline badge-xs" },
});
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
/** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
(__VLS_ctx.tunnelDescriptionStorageBadge);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openTunnelDescriptionsSettings) },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
(__VLS_ctx.$t('settings'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.tunnelDescriptionManagerOpen = !__VLS_ctx.tunnelDescriptionManagerOpen;
            // @ts-ignore
            [trafficColorVars, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, maxLabel, trafficColors, trafficColors, trafficColors, trafficColors, trafficColors, trafficColors, trafficColors, trafficColors, currentRouterDownloadLabel, currentRouterUploadLabel, currentMihomoDownloadLabel, currentMihomoUploadLabel, currentVpnDownloadLabel, currentVpnUploadLabel, currentBypassDownloadLabel, currentBypassUploadLabel, tunnelDescriptionEntries, tunnelDescriptionStorageHint, tunnelDescriptionStorageBadge, openTunnelDescriptionsSettings, tunnelDescriptionManagerOpen, tunnelDescriptionManagerOpen,];
        } },
    type: "button",
    ...{ class: "btn btn-ghost btn-xs" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
(__VLS_ctx.tunnelDescriptionManagerOpen ? __VLS_ctx.$t('collapse') : __VLS_ctx.$t('expand'));
if (__VLS_ctx.tunnelDescriptionManagerOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 space-y-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
    if (!__VLS_ctx.tunnelDescriptionEntries.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/10 bg-base-100/30 px-3 py-2 text-xs opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('routerTrafficTunnelDescriptionsEmpty'));
    }
    if (__VLS_ctx.tunnelDescriptionSuggestions.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        for (const [name] of __VLS_vFor((__VLS_ctx.tunnelDescriptionSuggestions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.tunnelDescriptionManagerOpen))
                            return;
                        if (!(__VLS_ctx.tunnelDescriptionSuggestions.length))
                            return;
                        __VLS_ctx.prefillTunnelDescriptionName(name);
                        // @ts-ignore
                        [$t, $t, $t, tunnelDescriptionEntries, tunnelDescriptionManagerOpen, tunnelDescriptionManagerOpen, tunnelDescriptionSuggestions, tunnelDescriptionSuggestions, prefillTunnelDescriptionName,];
                    } },
                key: (`tunnel-desc-suggest-${name}`),
                type: "button",
                ...{ class: "btn btn-ghost btn-xs font-mono" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            (name);
            // @ts-ignore
            [];
        }
    }
    for (const [entry] of __VLS_vFor((__VLS_ctx.tunnelDescriptionEntries))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`tunnel-desc-${entry.name}`),
            ...{ class: "grid gap-2 rounded-lg border border-base-content/10 bg-base-100/40 p-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto]" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto_auto]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "truncate text-sm font-medium" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        (__VLS_ctx.ifaceBaseDisplayName(entry.name, entry.kind));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "truncate font-mono text-[11px] opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        (entry.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            value: (__VLS_ctx.tunnelDescriptionDrafts[entry.name]),
            ...{ class: "input input-sm w-full" },
            type: "text",
            placeholder: (__VLS_ctx.$t('routerTrafficTunnelDescriptionPlaceholder')),
        });
        /** @type {__VLS_StyleScopedClasses['input']} */ ;
        /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tunnelDescriptionManagerOpen))
                        return;
                    __VLS_ctx.saveTunnelDescription(entry.name);
                    // @ts-ignore
                    [$t, tunnelDescriptionEntries, ifaceBaseDisplayName, tunnelDescriptionDrafts, saveTunnelDescription,];
                } },
            type: "button",
            ...{ class: "btn btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('save'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.tunnelDescriptionManagerOpen))
                        return;
                    __VLS_ctx.clearTunnelDescription(entry.name);
                    // @ts-ignore
                    [$t, clearTunnelDescription,];
                } },
            type: "button",
            ...{ class: "btn btn-ghost btn-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        (__VLS_ctx.$t('clear'));
        // @ts-ignore
        [$t,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 rounded-lg border border-dashed border-base-content/10 bg-base-100/30 p-2 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-100/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.newTunnelInterfaceName),
        ...{ class: "input input-sm w-full font-mono" },
        type: "text",
        placeholder: (__VLS_ctx.$t('routerTrafficTunnelInterfacePlaceholder')),
    });
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        value: (__VLS_ctx.newTunnelInterfaceDescription),
        ...{ class: "input input-sm w-full" },
        type: "text",
        placeholder: (__VLS_ctx.$t('routerTrafficTunnelDescriptionPlaceholder')),
    });
    /** @type {__VLS_StyleScopedClasses['input']} */ ;
    /** @type {__VLS_StyleScopedClasses['input-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.addTunnelDescriptionEntry) },
        type: "button",
        ...{ class: "btn btn-sm" },
        disabled: (!__VLS_ctx.canAddTunnelDescription),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    (__VLS_ctx.$t('add'));
}
if (__VLS_ctx.currentExtraStats.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 px-1 text-sm sm:grid-cols-2 xl:grid-cols-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
    for (const [item, index] of __VLS_vFor((__VLS_ctx.currentExtraStats))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`extra-card-${item.name}`),
            ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mb-1 flex items-start justify-between gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "truncate text-xs opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.ifaceBaseDisplayName(item.name, item.kind));
        if (__VLS_ctx.getTunnelDescription(item.name)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "truncate text-[11px] opacity-60" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
            (__VLS_ctx.getTunnelDescription(item.name));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge badge-ghost badge-xs uppercase" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        (item.kind || 'vpn');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
            ...{ style: ({ backgroundColor: __VLS_ctx.extraColorPair(index).down }) },
        });
        /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.$t('download'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.speedLabel(item.down));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 flex items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
            ...{ style: ({ backgroundColor: __VLS_ctx.extraColorPair(index).up }) },
        });
        /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "opacity-80" },
        });
        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
        (__VLS_ctx.$t('upload'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.speedLabel(item.up));
        // @ts-ignore
        [$t, $t, $t, $t, $t, ifaceBaseDisplayName, newTunnelInterfaceName, newTunnelInterfaceDescription, addTunnelDescriptionEntry, canAddTunnelDescription, currentExtraStats, currentExtraStats, getTunnelDescription, getTunnelDescription, extraColorPair, extraColorPair, speedLabel, speedLabel,];
    }
}
if (__VLS_ctx.hasTrafficHosts) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-3" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-2 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:justify-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm font-medium" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    (__VLS_ctx.$t('routerTrafficTopHosts'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs opacity-60" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
    (__VLS_ctx.$t('routerTrafficTopHostsTip'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center justify-end gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2 text-xs opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('filter'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.hostScopeFilter),
        ...{ class: "select select-xs min-w-[140px] sm:select-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-[140px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:select-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "all",
    });
    (__VLS_ctx.$t('all'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "mihomo",
    });
    (__VLS_ctx.$t('mihomoVersion'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "vpn",
    });
    (__VLS_ctx.$t('routerTrafficVpn'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "bypass",
    });
    (__VLS_ctx.$t('routerTrafficBypass'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "mixed",
    });
    (__VLS_ctx.$t('routerTrafficHostFilterMixed'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "routed",
    });
    (__VLS_ctx.$t('routerTrafficHostFilterRouted'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-2 text-xs opacity-70" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.$t('sortBy'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.hostSortBy),
        ...{ class: "select select-xs min-w-[170px] sm:select-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['select']} */ ;
    /** @type {__VLS_StyleScopedClasses['select-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-[170px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:select-sm']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "traffic",
    });
    (__VLS_ctx.$t('routerTrafficSortTraffic'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "download",
    });
    (__VLS_ctx.$t('downloadSpeed'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "upload",
    });
    (__VLS_ctx.$t('uploadSpeed'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "connections",
    });
    (__VLS_ctx.$t('connections'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "recent",
    });
    (__VLS_ctx.$t('routerTrafficSortRecent'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.expandAllHostGroups) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs sm:btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:btn-sm']} */ ;
    (__VLS_ctx.$t('routerTrafficExpandAllGroups'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.collapseAllHostGroups) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs sm:btn-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:btn-sm']} */ ;
    (__VLS_ctx.$t('routerTrafficCollapseAllGroups'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.toggleAutoCollapseQuietHostGroups) },
        type: "button",
        ...{ class: "btn btn-ghost btn-xs sm:btn-sm" },
        ...{ class: ({ 'btn-active': __VLS_ctx.autoCollapseQuietHostGroups }) },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-active']} */ ;
    (__VLS_ctx.$t('routerTrafficAutoCollapseQuietGroups'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-1 badge badge-ghost badge-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
    (__VLS_ctx.quietHostGroupsCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.visibleTrafficHostsCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.$t('mihomoVersion'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.$t('routerTrafficVpn'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge badge-ghost badge-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-sm']} */ ;
    (__VLS_ctx.$t('routerTrafficBypass'));
    if (__VLS_ctx.stableTrafficHosts.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "overflow-hidden rounded-lg border border-base-content/10 bg-base-100/30" },
        });
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/30']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid grid-cols-[minmax(0,1.7fr)_128px_112px_112px_72px] items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-wide opacity-60" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid-cols-[minmax(0,1.7fr)_128px_112px_112px_72px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.$t('routerTrafficTopHosts'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.$t('type'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.$t('download'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        (__VLS_ctx.$t('upload'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-right" },
        });
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        (__VLS_ctx.$t('connections'));
        for (const [group] of __VLS_vFor((__VLS_ctx.stableTrafficHostGroups))) {
            (group.key);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "border-t border-base-content/10 bg-base-200/15 px-3 py-2" },
            });
            /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-200/15']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-start justify-between gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.hasTrafficHosts))
                            return;
                        if (!(__VLS_ctx.stableTrafficHosts.length))
                            return;
                        __VLS_ctx.toggleHostGroup(group);
                        // @ts-ignore
                        [$t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, $t, hasTrafficHosts, hostScopeFilter, hostSortBy, expandAllHostGroups, collapseAllHostGroups, toggleAutoCollapseQuietHostGroups, autoCollapseQuietHostGroups, quietHostGroupsCount, visibleTrafficHostsCount, stableTrafficHosts, stableTrafficHostGroups, toggleHostGroup,];
                    } },
                type: "button",
                ...{ class: "min-w-0 flex-1 text-left transition hover:opacity-90" },
                'aria-expanded': (!__VLS_ctx.isHostGroupCollapsed(group)),
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:opacity-90']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-start gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-base-content/10 bg-base-100/50 text-[11px] opacity-70" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-base-100/50']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
            (__VLS_ctx.isHostGroupCollapsed(group) ? '▶' : '▼');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "truncate text-xs font-medium uppercase tracking-wide opacity-75" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
            (group.label);
            if (group.note) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "truncate text-[11px] opacity-60" },
                });
                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                (group.note);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-1 flex flex-wrap items-center gap-3 font-mono text-[11px] opacity-75" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-center gap-1.5" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "inline-block h-2 w-2 shrink-0 rounded-full" },
                ...{ style: ({ backgroundColor: __VLS_ctx.hostGroupPrimaryColor(group, 'down') }) },
            });
            /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.$t('routerTrafficGroupTotal'));
            (__VLS_ctx.speedLabel(group.totalDown));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "inline-flex items-center gap-1.5" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "inline-block h-2 w-2 shrink-0 rounded-full" },
                ...{ style: ({ backgroundColor: __VLS_ctx.hostGroupPrimaryColor(group, 'up') }) },
            });
            /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.$t('routerTrafficGroupTotal'));
            (__VLS_ctx.speedLabel(group.totalUp));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center justify-end gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-outline badge-xs uppercase" },
                ...{ style: ({ borderColor: group.color, color: group.color }) },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            (group.badge);
            for (const [badge] of __VLS_vFor((__VLS_ctx.hostGroupScopeBadges(group)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (`${group.key}-${badge.key}`),
                    ...{ class: "badge badge-outline badge-xs" },
                    ...{ style: ({ borderColor: badge.color, color: badge.color }) },
                });
                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                (badge.label);
                (__VLS_ctx.speedLabel(badge.value));
                // @ts-ignore
                [$t, $t, speedLabel, speedLabel, speedLabel, isHostGroupCollapsed, isHostGroupCollapsed, hostGroupPrimaryColor, hostGroupPrimaryColor, hostGroupScopeBadges,];
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (group.items.length);
            (__VLS_ctx.$t('routerTrafficHostsShort'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "badge badge-ghost badge-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['badge']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
            (group.totalConnections);
            (__VLS_ctx.$t('connections'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.hasTrafficHosts))
                            return;
                        if (!(__VLS_ctx.stableTrafficHosts.length))
                            return;
                        __VLS_ctx.toggleHostGroup(group);
                        // @ts-ignore
                        [$t, $t, toggleHostGroup,];
                    } },
                type: "button",
                ...{ class: "btn btn-ghost btn-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-xs']} */ ;
            (__VLS_ctx.isHostGroupCollapsed(group) ? __VLS_ctx.$t('expand') : __VLS_ctx.$t('collapse'));
            if (!__VLS_ctx.isHostGroupCollapsed(group)) {
                for (const [item] of __VLS_vFor((group.items))) {
                    (`traffic-host-${group.key}-${item.ip}`);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.hasTrafficHosts))
                                    return;
                                if (!(__VLS_ctx.stableTrafficHosts.length))
                                    return;
                                if (!(!__VLS_ctx.isHostGroupCollapsed(group)))
                                    return;
                                __VLS_ctx.toggleHostDetails(item.ip);
                                // @ts-ignore
                                [$t, $t, isHostGroupCollapsed, isHostGroupCollapsed, toggleHostDetails,];
                            } },
                        type: "button",
                        ...{ class: "grid w-full grid-cols-[minmax(0,1.7fr)_128px_112px_112px_72px] items-center gap-3 border-t border-base-content/10 px-3 py-2 text-left text-sm transition hover:bg-base-200/20" },
                    });
                    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                    /** @type {__VLS_StyleScopedClasses['grid-cols-[minmax(0,1.7fr)_128px_112px_112px_72px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:bg-base-200/20']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "min-w-0" },
                    });
                    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-wrap items-center gap-2" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "truncate font-medium" },
                    });
                    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    (item.label);
                    if (item.qosProfile) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium" },
                            ...{ class: (__VLS_ctx.qosProfilePillClass(item.qosProfile)) },
                            title: (item.qosMeta ? `${__VLS_ctx.qosProfileLabel(item.qosProfile)} · prio ${item.qosMeta.priority ?? '—'} · ↓ ${item.qosMeta.downMinMbit || 0} / ↑ ${item.qosMeta.upMinMbit || 0} Mbit` : __VLS_ctx.qosProfileLabel(item.qosProfile)),
                        });
                        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            'aria-hidden': "true",
                        });
                        (__VLS_ctx.qosProfileIcon(item.qosProfile));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "opacity-80" },
                        });
                        /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "inline-flex items-end gap-0.5" },
                            'aria-hidden': "true",
                        });
                        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
                        for (const [bar] of __VLS_vFor((__VLS_ctx.qosIndicatorBars(item.qosProfile)))) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                                key: (`${item.ip}-qos-${bar.key}`),
                                ...{ class: "w-1 rounded-full" },
                                ...{ class: (bar.active ? __VLS_ctx.qosProfileBarClass(item.qosProfile) : 'bg-base-content/10') },
                                ...{ style: ({ height: `${bar.height}px` }) },
                            });
                            /** @type {__VLS_StyleScopedClasses['w-1']} */ ;
                            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                            // @ts-ignore
                            [qosProfilePillClass, qosProfileLabel, qosProfileLabel, qosProfileIcon, qosIndicatorBars, qosProfileBarClass,];
                        }
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "hidden md:inline" },
                        });
                        /** @type {__VLS_StyleScopedClasses['hidden']} */ ;
                        /** @type {__VLS_StyleScopedClasses['md:inline']} */ ;
                        (__VLS_ctx.qosProfileShortLabel(item.qosProfile));
                    }
                    if (__VLS_ctx.hostSiteBadge(item)) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "badge badge-outline badge-xs" },
                            ...{ style: (__VLS_ctx.hostSiteBadgeStyle(item)) },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                        (__VLS_ctx.hostSiteBadge(item));
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                    (__VLS_ctx.isHostDetailsExpanded(item.ip) ? __VLS_ctx.$t('collapse') : __VLS_ctx.$t('details'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "truncate text-[11px] opacity-60" },
                    });
                    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                    (item.ip);
                    if (__VLS_ctx.hostBreakdownLabel(item)) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "truncate text-[11px] opacity-75" },
                        });
                        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
                        (__VLS_ctx.hostBreakdownLabel(item));
                    }
                    if (item.targets.length) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "truncate text-[11px] opacity-65" },
                        });
                        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-65']} */ ;
                        (item.targets.join(' · '));
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "flex flex-wrap gap-1" },
                    });
                    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                    for (const [badge] of __VLS_vFor((__VLS_ctx.hostScopeBadges(item)))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            key: (`${item.ip}-${badge.key}`),
                            ...{ class: "badge badge-outline badge-xs sm:badge-sm" },
                            ...{ style: ({ borderColor: badge.color, color: badge.color }) },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['sm:badge-sm']} */ ;
                        (badge.label);
                        // @ts-ignore
                        [$t, $t, qosProfileShortLabel, hostSiteBadge, hostSiteBadge, hostSiteBadgeStyle, isHostDetailsExpanded, hostBreakdownLabel, hostBreakdownLabel, hostScopeBadges,];
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "inline-flex items-center gap-2 font-mono text-xs sm:text-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                        ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
                        ...{ style: ({ backgroundColor: __VLS_ctx.hostPrimaryColor(item, 'down') }) },
                    });
                    /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (__VLS_ctx.speedLabel(item.down));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "inline-flex items-center gap-2 font-mono text-xs sm:text-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                        ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
                        ...{ style: ({ backgroundColor: __VLS_ctx.hostPrimaryColor(item, 'up') }) },
                    });
                    /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
                    /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (__VLS_ctx.speedLabel(item.up));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "text-right" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "badge badge-ghost badge-xs sm:badge-sm" },
                    });
                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                    /** @type {__VLS_StyleScopedClasses['sm:badge-sm']} */ ;
                    (item.connections);
                    if (__VLS_ctx.isHostDetailsExpanded(item.ip)) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "border-t border-base-content/10 bg-base-200/10 px-3 py-3" },
                        });
                        /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-base-200/10']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mb-3 text-xs opacity-65" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-65']} */ ;
                        (__VLS_ctx.$t('routerTrafficHostDetailsTip'));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "grid gap-2 lg:grid-cols-3" },
                        });
                        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['lg:grid-cols-3']} */ ;
                        for (const [card] of __VLS_vFor((__VLS_ctx.hostDetailCards(item)))) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                key: (`${item.ip}-detail-${card.key}`),
                                ...{ class: "rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-2" },
                            });
                            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
                            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "mb-1 flex items-center justify-between gap-2" },
                            });
                            /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
                            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "inline-flex items-center gap-2 text-sm font-medium" },
                            });
                            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                                ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
                                ...{ style: ({ backgroundColor: card.color }) },
                            });
                            /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
                            /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
                            /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
                            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                            (card.label);
                            if (typeof card.connections === 'number') {
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                    ...{ class: "badge badge-ghost badge-xs" },
                                });
                                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                                /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                                (card.connections);
                                (__VLS_ctx.$t('connections'));
                            }
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "flex items-center gap-2 font-mono text-xs sm:text-sm" },
                            });
                            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                            /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                ...{ class: "opacity-70" },
                            });
                            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                            (__VLS_ctx.$t('download'));
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                            (__VLS_ctx.speedLabel(card.down));
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "mt-1 flex items-center gap-2 font-mono text-xs sm:text-sm" },
                            });
                            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                            /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                ...{ class: "opacity-70" },
                            });
                            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                            (__VLS_ctx.$t('upload'));
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                            (__VLS_ctx.speedLabel(card.up));
                            if (card.note) {
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "mt-2 text-[11px] opacity-65" },
                                });
                                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                                /** @type {__VLS_StyleScopedClasses['opacity-65']} */ ;
                                (card.note);
                            }
                            // @ts-ignore
                            [$t, $t, $t, $t, speedLabel, speedLabel, speedLabel, speedLabel, isHostDetailsExpanded, hostPrimaryColor, hostPrimaryColor, hostDetailCards,];
                        }
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mt-3 rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-3" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mb-1 flex flex-wrap items-center justify-between gap-2" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
                        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "text-sm font-medium" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                        (__VLS_ctx.$t('routerTrafficRecentTimeline'));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "badge badge-ghost badge-xs" },
                        });
                        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                        /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                        (__VLS_ctx.hostTimelineWindowSeconds);
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mb-3 text-xs opacity-60" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                        (__VLS_ctx.$t('routerTrafficRecentTimelineTip', { seconds: __VLS_ctx.hostTimelineWindowSeconds }));
                        if (__VLS_ctx.hostTimelineRows(item).length) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "space-y-2" },
                            });
                            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                            for (const [row] of __VLS_vFor((__VLS_ctx.hostTimelineRows(item)))) {
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    key: (`${item.ip}-timeline-${row.key}`),
                                    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/15 px-3 py-2" },
                                });
                                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                                /** @type {__VLS_StyleScopedClasses['bg-base-200/15']} */ ;
                                /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "mb-2 flex flex-wrap items-center justify-between gap-2" },
                                });
                                /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "inline-flex min-w-0 items-center gap-2 text-sm font-medium" },
                                });
                                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
                                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                                /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
                                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                                    ...{ class: "inline-block h-2.5 w-2.5 shrink-0 rounded-full" },
                                    ...{ style: ({ backgroundColor: row.color }) },
                                });
                                /** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
                                /** @type {__VLS_StyleScopedClasses['h-2.5']} */ ;
                                /** @type {__VLS_StyleScopedClasses['w-2.5']} */ ;
                                /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
                                /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                    ...{ class: "truncate" },
                                });
                                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                                (row.label);
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "flex flex-wrap items-center gap-3 font-mono text-[11px] opacity-75" },
                                });
                                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                                /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                                /** @type {__VLS_StyleScopedClasses['opacity-75']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                                (__VLS_ctx.$t('routerTrafficTimelineCurrent'));
                                (row.current);
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                                (__VLS_ctx.$t('routerTrafficTimelinePeak'));
                                (row.peak);
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "flex h-14 items-end gap-1 rounded-lg border border-base-content/10 bg-base-100/40 px-2 py-2" },
                                });
                                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['h-14']} */ ;
                                /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
                                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                                /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
                                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                                for (const [bar] of __VLS_vFor((row.bars))) {
                                    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
                                        key: (`${item.ip}-${row.key}-${bar.key}`),
                                        ...{ class: "min-h-[4px] flex-1 rounded-[4px] transition-[height,opacity] duration-200" },
                                        ...{ style: ({ height: `${bar.height}%`, backgroundColor: row.color, opacity: bar.opacity }) },
                                        title: (`${row.label}: ${__VLS_ctx.speedLabel(bar.value)}`),
                                    });
                                    /** @type {__VLS_StyleScopedClasses['min-h-[4px]']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['rounded-[4px]']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['transition-[height,opacity]']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
                                    // @ts-ignore
                                    [$t, $t, $t, $t, speedLabel, hostTimelineWindowSeconds, hostTimelineWindowSeconds, hostTimelineRows, hostTimelineRows,];
                                }
                                // @ts-ignore
                                [];
                            }
                        }
                        else {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "rounded-lg border border-dashed border-base-content/10 bg-base-200/10 px-3 py-3 text-sm opacity-70" },
                            });
                            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['bg-base-200/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                            (__VLS_ctx.$t('routerTrafficTimelineIdle'));
                        }
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
                        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-3" },
                        });
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mb-1 text-sm font-medium" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                        (__VLS_ctx.$t('routerTrafficActiveTargets'));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mb-3 text-xs opacity-60" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                        (__VLS_ctx.$t('routerTrafficActiveTargetsTip'));
                        if (__VLS_ctx.hostTopTargets(item).length) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "space-y-2" },
                            });
                            /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                            for (const [target] of __VLS_vFor((__VLS_ctx.hostTopTargets(item)))) {
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    key: (`${item.ip}-target-${target.scope || 'mihomo'}-${target.target}-${target.via || 'direct'}`),
                                    ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" },
                                });
                                /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                                /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                                /** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
                                /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                                /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "flex items-start justify-between gap-3" },
                                });
                                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
                                /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
                                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "min-w-0" },
                                });
                                /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "truncate text-sm font-medium" },
                                });
                                /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                                /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                                (target.target);
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "mt-1 flex flex-wrap gap-1" },
                                });
                                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                    ...{ class: "badge badge-outline badge-xs" },
                                    ...{ style: ({ borderColor: __VLS_ctx.hostTargetScopeColor(target), color: __VLS_ctx.hostTargetScopeColor(target) }) },
                                });
                                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                                /** @type {__VLS_StyleScopedClasses['badge-outline']} */ ;
                                /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                                (__VLS_ctx.hostTargetScopeLabel(target));
                                if (target.proto) {
                                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                        ...{ class: "badge badge-ghost badge-xs uppercase" },
                                    });
                                    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                                    (target.proto);
                                }
                                if (target.viaBase || target.via) {
                                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                        ...{ class: "truncate text-[11px] opacity-65" },
                                    });
                                    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['opacity-65']} */ ;
                                    (__VLS_ctx.$t('routerTrafficVia'));
                                    (target.viaBase || target.via);
                                }
                                if (target.viaDescription) {
                                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                        ...{ class: "truncate text-[11px] opacity-65" },
                                    });
                                    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                                    /** @type {__VLS_StyleScopedClasses['opacity-65']} */ ;
                                    (__VLS_ctx.$t('routerTrafficTunnelDescriptionLabel'));
                                    (target.viaDescription);
                                }
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                    ...{ class: "badge badge-ghost badge-xs" },
                                });
                                /** @type {__VLS_StyleScopedClasses['badge']} */ ;
                                /** @type {__VLS_StyleScopedClasses['badge-ghost']} */ ;
                                /** @type {__VLS_StyleScopedClasses['badge-xs']} */ ;
                                (target.connections);
                                (__VLS_ctx.$t('connections'));
                                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                    ...{ class: "mt-2 flex flex-wrap items-center gap-3 font-mono text-xs sm:text-sm" },
                                });
                                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                                /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
                                /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                                /** @type {__VLS_StyleScopedClasses['sm:text-sm']} */ ;
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                                (__VLS_ctx.$t('download'));
                                (__VLS_ctx.speedLabel(target.down));
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                                (__VLS_ctx.$t('upload'));
                                (__VLS_ctx.speedLabel(target.up));
                                // @ts-ignore
                                [$t, $t, $t, $t, $t, $t, $t, $t, speedLabel, speedLabel, hostTopTargets, hostTopTargets, hostTargetScopeColor, hostTargetScopeColor, hostTargetScopeLabel,];
                            }
                        }
                        else {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "rounded-lg border border-dashed border-base-content/10 bg-base-200/10 px-3 py-3 text-sm opacity-70" },
                            });
                            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['bg-base-200/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                            (__VLS_ctx.$t('routerTrafficNoActiveTargets'));
                        }
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "rounded-lg border border-base-content/10 bg-base-100/40 px-3 py-3" },
                        });
                        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border']} */ ;
                        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                        /** @type {__VLS_StyleScopedClasses['bg-base-100/40']} */ ;
                        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mb-1 text-sm font-medium" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                        (__VLS_ctx.$t('details'));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "mb-3 text-xs opacity-60" },
                        });
                        /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                        /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                        (__VLS_ctx.$t('routerTrafficRouteContext'));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "space-y-2 text-sm" },
                        });
                        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                        if (__VLS_ctx.hostTunnelDescription(item)) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "rounded-lg border border-info/20 bg-info/5 px-3 py-2" },
                            });
                            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-info/20']} */ ;
                            /** @type {__VLS_StyleScopedClasses['bg-info/5']} */ ;
                            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "text-[11px] opacity-60" },
                            });
                            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                            /** @type {__VLS_StyleScopedClasses['opacity-60']} */ ;
                            (__VLS_ctx.$t('routerTrafficTunnelDescriptionLabel'));
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "mt-1 text-sm font-medium" },
                            });
                            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                            (__VLS_ctx.hostTunnelDescription(item));
                        }
                        for (const [note] of __VLS_vFor((__VLS_ctx.hostDetailNotes(item)))) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                key: (`${item.ip}-${note}`),
                                ...{ class: "rounded-lg border border-base-content/10 bg-base-200/20 px-3 py-2" },
                            });
                            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['bg-base-200/20']} */ ;
                            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
                            (note);
                            // @ts-ignore
                            [$t, $t, $t, $t, hostTunnelDescription, hostTunnelDescription, hostDetailNotes,];
                        }
                        if (!__VLS_ctx.hostDetailNotes(item).length) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ class: "rounded-lg border border-dashed border-base-content/10 bg-base-200/10 px-3 py-3 text-sm opacity-70" },
                            });
                            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
                            /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['bg-base-200/10']} */ ;
                            /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
                            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
                            /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
                            (__VLS_ctx.$t('routerTrafficNoExtraContext'));
                        }
                    }
                    // @ts-ignore
                    [$t, hostDetailNotes,];
                }
            }
            // @ts-ignore
            [];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-lg border border-dashed border-base-content/10 bg-base-100/20 px-3 py-4 text-sm opacity-70" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-base-content/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-base-100/20']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-70']} */ ;
        (__VLS_ctx.$t('routerTrafficHostsNoMatches'));
    }
}
// @ts-ignore
[$t,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
