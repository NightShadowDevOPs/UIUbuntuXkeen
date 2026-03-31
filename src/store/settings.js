import { CONNECTIONS_TABLE_ACCESSOR_KEY, DETAILED_CARD_STYLE, EMOJIS, FONTS, GLOBAL, IP_INFO_API, IS_APPLE_DEVICE, LANG, PROXY_CARD_SIZE, PROXY_CHAIN_DIRECTION, PROXY_COUNT_MODE, PROXY_PREVIEW_TYPE, PROXY_SORT_TYPE, TABLE_SIZE, TABLE_WIDTH_MODE, TEST_URL, } from '@/constant';
import { getMinCardWidth, isMiddleScreen, isPreferredDark } from '@/helper/utils';
import { useStorage } from '@vueuse/core';
import { computed, ref } from 'vue';
// global
export const defaultTheme = useStorage('config/default-theme', 'light');
export const darkTheme = useStorage('config/dark-theme', 'dark');
export const autoTheme = useStorage('config/auto-theme', true);
export const theme = computed(() => {
    if (autoTheme.value && isPreferredDark.value) {
        return darkTheme.value;
    }
    return defaultTheme.value;
});
export const customThemes = useStorage('config/custom-themes', []);
export const language = useStorage('config/language', Object.values(LANG).includes(navigator.language)
    ? navigator.language
    : LANG.EN_US);
export const isSidebarCollapsedConfig = useStorage('config/is-sidebar-collapsed', true);
export const isSidebarCollapsed = computed({
    get: () => {
        if (isMiddleScreen.value) {
            return true;
        }
        return isSidebarCollapsedConfig.value;
    },
    set: (value) => {
        isSidebarCollapsedConfig.value = value;
    },
});
const fontConfig = useStorage('config/font', FONTS.MI_SANS);
export const font = computed({
    get: () => {
        const mode = import.meta.env.MODE;
        if (Object.values(FONTS).includes(mode)) {
            return mode;
        }
        return fontConfig.value;
    },
    set: (val) => {
        fontConfig.value = val;
    },
});
export const emoji = useStorage('config/emoji', IS_APPLE_DEVICE ? EMOJIS.TWEMOJI : EMOJIS.NOTO_COLOR_EMOJI);
export const customBackgroundURL = useStorage('config/custom-background-image', '');
export const dashboardTransparent = useStorage('config/dashboard-transparent', 90);
export const autoUpgrade = useStorage('config/auto-upgrade', false);
export const checkUpgradeCore = useStorage('config/check-upgrade-core', true);
export const autoUpgradeCore = useStorage('config/auto-upgrade-core', false);
export const swipeInPages = useStorage('config/swipe-in-pages', true);
export const swipeInTabs = useStorage('config/swipe-in-tabs', false);
export const disablePullToRefresh = useStorage('config/disable-pull-to-refresh', true);
export const displayAllFeatures = useStorage('config/display-all-features', false);
export const blurIntensity = useStorage('config/blur-intensity', 10);
export const proxyProviderCardOpacity = useStorage('config/proxy-provider-card-opacity', 82);
export const scrollAnimationEffect = useStorage('config/scroll-animation-effect', true);
export const IPInfoAPI = useStorage('config/geoip-info-api', IP_INFO_API.IPSB);
const twoIpTokenLegacy = useStorage('config/twoip-token', '');
export const twoIpTokens = useStorage('config/twoip-tokens', []);
export const twoIpToken = computed({
    get: () => {
        const first = twoIpTokens.value?.[0]?.trim();
        return first || (twoIpTokenLegacy.value || '').trim();
    },
    set: (val) => {
        const v = (val || '').trim();
        twoIpTokenLegacy.value = v;
        if (!v) {
            twoIpTokens.value = [];
            return;
        }
        const rest = (twoIpTokens.value || []).slice(1).map((x) => (x || '').trim()).filter(Boolean);
        twoIpTokens.value = [v, ...rest.filter((x) => x !== v)];
    },
});
export const twoIpTokensText = computed({
    get: () => {
        const legacy = (twoIpTokenLegacy.value || '').trim();
        const arr = (twoIpTokens.value || []).map((x) => (x || '').trim()).filter(Boolean);
        const merged = legacy && !arr.includes(legacy) ? [legacy, ...arr] : arr;
        return merged.join('\n');
    },
    set: (val) => {
        const raw = (val || '').split(/[\n,;]+/g).map((x) => x.trim()).filter(Boolean);
        const uniq = Array.from(new Set(raw));
        twoIpTokens.value = uniq;
        twoIpTokenLegacy.value = uniq[0] || '';
    },
});
export const autoDisconnectIdleUDP = useStorage('config/auto-disconnect-idle-udp', false);
export const autoDisconnectIdleUDPTime = useStorage('config/auto-disconnect-idle-udp-time', 300);
export const tunnelInterfaceDescriptionMap = useStorage('config/tunnel-interface-description-map', {});
// overview
export const splitOverviewPage = useStorage('config/split-overview-page', false);
export const showIPAndConnectionInfo = useStorage('config/show-ip-and-connection-info', true);
export const autoIPCheck = useStorage('config/auto-ip-check', true);
export const autoConnectionCheck = useStorage('config/auto-connection-check', true);
export const customPingTarget = useStorage('config/custom-ping-target', '');
export const showStatisticsWhenSidebarCollapsed = useStorage('config/show-statistics-when-sidebar-collapsed', true);
export const numberOfChartsInSidebar = useStorage('config/number-of-charts-in-sidebar', 2);
export const displayProxiesRelationship = useStorage('config/display-proxies-relationship', true);
export const proxiesRelationshipView = useStorage('config/proxies-relationship-view', 'rules');
export const proxiesRelationshipUseSources = computed({
    get: () => proxiesRelationshipView.value === 'sources',
    set: (v) => {
        proxiesRelationshipView.value = v ? 'sources' : 'tree';
    },
});
export const proxiesRelationshipPaused = useStorage('config/proxies-relationship-paused', false);
export const proxiesRelationshipRefreshSec = useStorage('config/proxies-relationship-refresh-sec', 5);
export const proxiesRelationshipRefreshNonce = ref(0);
export const proxiesRelationshipWeightMode = useStorage('config/proxies-relationship-weight-mode', 'traffic');
export const proxiesRelationshipTopN = useStorage('config/proxies-relationship-topn', 40);
export const proxiesRelationshipTopNChain = useStorage('config/proxies-relationship-topn-chain', 18);
export const proxiesRelationshipColorMode = useStorage('config/proxies-relationship-color-mode', 'proxy');
// one-time migration: older builds defaulted to "provider".
// For this fork the default UX is color-by-real-hop (proxy).
const proxiesRelationshipColorModeMigrated = useStorage('config/proxies-relationship-color-mode-migrated', false);
if (!proxiesRelationshipColorModeMigrated.value && proxiesRelationshipColorMode.value === 'provider') {
    proxiesRelationshipColorMode.value = 'proxy';
    proxiesRelationshipColorModeMigrated.value = true;
}
export const proxiesRelationshipSourceMode = useStorage('config/proxies-relationship-source-mode', 'auto');
// proxies
export const collapseGroupMap = useStorage('config/collapse-group-map', {});
export const displayFinalOutbound = useStorage('config/show-seleted-for-now-node', false);
export const twoColumnProxyGroup = useStorage('config/two-columns', true);
export const speedtestUrl = useStorage('config/speedtest-url', TEST_URL);
export const independentLatencyTest = useStorage('config/independent-latency-test', false);
export const speedtestTimeout = useStorage('config/speedtest-timeout', 5000);
export const proxySortType = useStorage('config/proxy-sort-type', PROXY_SORT_TYPE.DEFAULT);
export const automaticDisconnection = useStorage('config/automatic-disconnection', true);
export const truncateProxyName = useStorage('config/truncate-proxy-name', true);
export const proxyPreviewType = useStorage('config/proxy-preview-type', PROXY_PREVIEW_TYPE.AUTO);
export const hideUnavailableProxies = useStorage('config/hide-unavailable-proxies', false);
export const hideUnusedProxyProviders = useStorage('config/hide-unused-proxy-providers', true);
// normalize legacy string values from storage
if (typeof hideUnusedProxyProviders.value === 'string') {
    hideUnusedProxyProviders.value = hideUnusedProxyProviders.value === 'true';
}
// Providers tab: hide specific protocol tabs (e.g. DIRECT/REJECT/VLESS/...).
export const hiddenProxyProviderProtoKeys = useStorage('config/proxy-providers-proto-hidden', []);
// normalize legacy / bad values from storage
if (typeof hiddenProxyProviderProtoKeys.value === 'string') {
    const raw = String(hiddenProxyProviderProtoKeys.value || '');
    hiddenProxyProviderProtoKeys.value = raw
        .split(new RegExp('[\\s,;]+', 'g'))
        .map((x) => x.trim())
        .filter(Boolean);
}
if (Array.isArray(hiddenProxyProviderProtoKeys.value)) {
    hiddenProxyProviderProtoKeys.value = Array.from(new Set((hiddenProxyProviderProtoKeys.value || []).map((x) => String(x || '').trim()).filter(Boolean)));
}
export const lowLatency = useStorage('config/low-latency', 400);
export const mediumLatency = useStorage('config/medium-latency', 800);
export const IPv6test = useStorage('config/ipv6-test', false);
export const proxyCardSize = useStorage('config/proxy-card-size', PROXY_CARD_SIZE.LARGE);
export const minProxyCardWidth = useStorage('config/min-proxy-card-width', getMinCardWidth(proxyCardSize.value));
export const manageHiddenGroup = useStorage('config/manage-hidden-group-mode', false);
export const displayGlobalByMode = useStorage('config/display-global-by-mode', false);
export const customGlobalNode = useStorage('config/custom-global-node-name', GLOBAL);
export const proxyGroupIconSize = useStorage('config/proxy-group-icon-size', 24);
export const proxyGroupIconMargin = useStorage('config/proxy-group-icon-margin', 6);
export const proxyCountMode = useStorage('config/proxies-count-mode', PROXY_COUNT_MODE.ALIVE_TOTAL);
export const iconReflectList = useStorage('config/icon-reflect-list', []);
export const groupProxiesByProvider = useStorage('config/group-proxies-by-provider', false);
export const useSmartGroupSort = useStorage('config/use-smart-group-sort', false);
// connections
export const useConnectionCard = useStorage('config/use-connecticon-card', window.innerWidth < 640);
export const proxyChainDirection = useStorage('config/proxy-chain-direction', PROXY_CHAIN_DIRECTION.NORMAL);
export const tableSize = useStorage('config/connecticon-table-size', TABLE_SIZE.SMALL);
export const tableWidthMode = useStorage('config/table-width-mode', TABLE_WIDTH_MODE.AUTO);
export const connectionTableColumns = useStorage('config/connection-table-columns', [
    CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
    CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
    CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
    CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
    CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
]);
export const connectionCardLines = useStorage('config/connection-card-lines', DETAILED_CARD_STYLE);
export const sourceIPLabelList = useStorage('config/source-ip-label-list', []);
// Shared (synced via router-agent users DB): optional 3x-ui subscription URL per proxy-provider.
// Storage key stays legacy-compatible because existing browsers/users DB data already use this key.
export const proxyProviderPanelUrlMap = useStorage('config/proxy-provider-panel-url-map', {});
// Canonical alias used by Tasks/Providers code. Do not change the storage key without an explicit migration.
export const proxyProviderSubscriptionUrlMap = proxyProviderPanelUrlMap;
// Shared (synced via router-agent users DB): optional per-provider icon (country flag or globe)
// Values: '' (unset), 'globe', or ISO 3166-1 alpha-2 like 'RU', 'US'
export const proxyProviderIconMap = useStorage('config/proxy-provider-icon-map', {});
// Shared (synced via router-agent users DB): SSL "near expiry" warning threshold (days)
// Default: 2 days (shortlived LE certs are common for some setups)
export const sslNearExpiryDaysDefault = useStorage('config/ssl-near-expiry-days-default', 2);
// Shared (synced via router-agent users DB): per-provider override for SSL warning threshold (days)
export const proxyProviderSslWarnDaysMap = useStorage('config/proxy-provider-ssl-warn-days-map', {});
// rules
export const displayNowNodeInRule = useStorage('config/display-now-node-in-rule', true);
export const displayLatencyInRule = useStorage('config/display-latency-in-rule', true);
// logs
export const logRetentionLimit = useStorage('config/log-retention-limit', 1000);
export const logSearchHistory = useStorage('config/log-search-history', []);
